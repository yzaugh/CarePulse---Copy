<?php
class PatientVerificationUrlException extends RuntimeException
{
}

function patient_database()
{
    $host = '127.0.0.1';
    $dbname = 'carepulse_db';
    $username = 'root';
    $password = '';

    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $username,
        $password,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    return $pdo;
}

function ensure_doctor_availability_table(PDO $pdo)
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS doctor_availability (
            doctor_id INT NOT NULL,
            day_of_week TINYINT UNSIGNED NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            PRIMARY KEY (doctor_id, day_of_week),
            CONSTRAINT fk_doctor_availability_doctor
                FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

function ensure_patient_verification_table(PDO $pdo)
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS patient_email_verifications (
            user_id INT NOT NULL PRIMARY KEY,
            token_hash CHAR(64) NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            CONSTRAINT fk_patient_email_verifications_user
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

function require_patient_session()
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? null) !== 'Patient') {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Patient access required']);
        exit();
    }
}

function patient_registration_base_url()
{
    $configuredUrl = getenv('CARE_PULSE_BASE_URL');
    if ($configuredUrl) {
        $parts = parse_url($configuredUrl);
        $host = is_array($parts) ? ($parts['host'] ?? '') : '';
        $scheme = is_array($parts) ? ($parts['scheme'] ?? '') : '';
        if (!in_array(strtolower($scheme), ['http', 'https'], true) || $host === '') {
            throw new PatientVerificationUrlException('CARE_PULSE_BASE_URL must be an absolute HTTP or HTTPS site URL.');
        }
        if (patient_registration_host_is_local($host)) {
            throw new PatientVerificationUrlException('CARE_PULSE_BASE_URL must use a phone-accessible site URL, not localhost.');
        }
        return rtrim($configuredUrl, '/');
    }

    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    if (!preg_match('/^[a-zA-Z0-9.-]+(?::[0-9]{1,5})?$/', $host)) {
        throw new PatientVerificationUrlException('Configure CARE_PULSE_BASE_URL with the public site URL.');
    }
    if (patient_registration_host_is_local(preg_replace('/:\d+$/', '', $host))) {
        throw new PatientVerificationUrlException('Configure CARE_PULSE_BASE_URL with a phone-accessible site URL, not localhost.');
    }

    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $directory = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return $scheme . '://' . $host . $directory;
}

function patient_registration_host_is_local($host)
{
    $host = strtolower(rtrim($host, '.'));
    if ($host === 'localhost' || substr($host, -10) === '.localhost') {
        return true;
    }

    $ip = filter_var($host, FILTER_VALIDATE_IP);
    if ($ip === false) {
        return false;
    }
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        return strpos($ip, '127.') === 0;
    }

    return inet_pton($ip) === str_repeat("\0", 15) . "\1";
}

function send_patient_verification_email($email, $name, $token)
{
    $configuredSender = getenv('CARE_PULSE_FROM_EMAIL');
    $iniSender = ini_get('sendmail_from');
    $sender = null;
    foreach ([$configuredSender, $iniSender, 'no-reply@carepulse.com'] as $candidate) {
        if (is_string($candidate) && $candidate !== '' && filter_var($candidate, FILTER_VALIDATE_EMAIL)) {
            $sender = $candidate;
            break;
        }
    }
    if ($configuredSender && !filter_var($configuredSender, FILTER_VALIDATE_EMAIL)) {
        error_log('CARE_PULSE_FROM_EMAIL is invalid; using the configured PHP sender or CarePulse fallback.');
    }

    $url = patient_registration_base_url() . '/verify-patient.php?token=' . rawurlencode($token);
    $safeName = htmlspecialchars($name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeUrl = htmlspecialchars($url, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $subject = 'Verify your CarePulse patient account';
    $message = "<p>Hello $safeName,</p>"
        . '<p>Verify your CarePulse patient account by opening this link:</p>'
        . "<p><a href=\"$safeUrl\">Verify my email address</a></p>"
        . '<p>This link expires in 24 hours. If you did not request this account, ignore this email.</p>';
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'From: CarePulse <' . $sender . '>'
    ];

    try {
        $sent = @mail($email, $subject, $message, implode("\r\n", $headers));
    } catch (Throwable $error) {
        error_log('PHP mail() raised an error while sending patient verification email: ' . $error->getMessage());
        $sent = false;
    }
    if (!$sent) {
        error_log('PHP mail() could not send the patient verification email; check the configured mail relay.');
    }
    return $sent;
}
?>
