<?php
require_once __DIR__ . '/patient-auth.php';
header('Content-Type: application/json');

function registration_response($status, $message)
{
    http_response_code($status);
    echo json_encode(['success' => $status < 400, 'message' => $message, 'error' => $status >= 400 ? $message : null]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    registration_response(405, 'Method not allowed.');
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    registration_response(400, 'Invalid registration request.');
}

foreach (['name', 'email', 'phone', 'dob', 'gender', 'address'] as $field) {
    if (isset($data[$field]) && !is_string($data[$field])) {
        registration_response(400, 'Invalid registration request.');
    }
}
$name = is_string($data['name'] ?? null) ? trim($data['name']) : '';
$email = is_string($data['email'] ?? null) ? strtolower(trim($data['email'])) : '';
$password = $data['password'] ?? '';
$phone = is_string($data['phone'] ?? null) ? trim($data['phone']) : '';
$dob = is_string($data['dob'] ?? null) ? trim($data['dob']) : '';
$gender = is_string($data['gender'] ?? null) ? trim($data['gender']) : '';
$address = is_string($data['address'] ?? null) ? trim($data['address']) : '';

if ($name === '' || strlen($name) > 100 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 100) {
    registration_response(400, 'Enter a valid name and email address.');
}
if (!is_string($password) || strlen($password) < 10 || strlen($password) > 4096) {
    registration_response(400, 'Password must be at least 10 characters long.');
}
if (strlen($phone) > 20 || strlen($gender) > 20 || strlen($address) > 1000) {
    registration_response(400, 'One or more profile fields are too long.');
}
if ($dob !== '') {
    $date = DateTime::createFromFormat('!Y-m-d', $dob);
    if (!$date || $date->format('Y-m-d') !== $dob || $date > new DateTime('today')) {
        registration_response(400, 'Enter a valid date of birth.');
    }
} else {
    $dob = null;
}

$pdo = null;
try {
    $pdo = patient_database();
    ensure_patient_verification_table($pdo);
    $pdo->beginTransaction();

    $stmt = $pdo->prepare('SELECT id, role FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    $token = bin2hex(random_bytes(32));

    if ($existing) {
        $pending = $pdo->prepare('SELECT user_id FROM patient_email_verifications WHERE user_id = ?');
        $pending->execute([$existing['id']]);
        if ($existing['role'] !== 'Patient' || !$pending->fetch()) {
            $pdo->rollBack();
            registration_response(409, 'An account with this email already exists.');
        }
        $userId = $existing['id'];
        $stmt = $pdo->prepare('UPDATE patient_email_verifications SET token_hash = ?, expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE user_id = ?');
        $stmt->execute([hash('sha256', $token), $userId]);
    } else {
        $stmt = $pdo->prepare(
            "INSERT INTO users (name, email, password, role, phone, dob, gender, address)
             VALUES (?, ?, ?, 'Patient', ?, ?, ?, ?)"
        );
        $stmt->execute([
            $name,
            $email,
            password_hash($password, PASSWORD_DEFAULT),
            $phone !== '' ? $phone : null,
            $dob,
            $gender !== '' ? $gender : null,
            $address !== '' ? $address : null
        ]);
        $userId = $pdo->lastInsertId();

        $stmt = $pdo->prepare('INSERT INTO patients (user_id, registered_date) VALUES (?, CURDATE())');
        $stmt->execute([$userId]);

        $stmt = $pdo->prepare(
            'INSERT INTO patient_email_verifications (user_id, token_hash, expires_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))'
        );
        $stmt->execute([$userId, hash('sha256', $token)]);
    }

    if (!send_patient_verification_email($email, $name, $token)) {
        $pdo->rollBack();
        registration_response(
            503,
            'Registration could not be completed because the verification email could not be sent. Configure the XAMPP SMTP mail relay, then try again.'
        );
    }
    $pdo->commit();
    registration_response(200, 'Check your email for a verification link before signing in.');
} catch (PatientVerificationUrlException $error) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Patient verification URL configuration failed: ' . $error->getMessage());
    registration_response(
        503,
        'Registration could not be completed because the verification link would not be reachable. Configure CARE_PULSE_BASE_URL with the site URL your phone can open, not localhost.'
    );
} catch (Throwable $error) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Patient registration failed: ' . $error->getMessage());
    registration_response(500, 'We could not complete registration. Please check the mail configuration and try again.');
}
?>
