<?php
require_once __DIR__ . '/patient-auth.php';

function verification_page($title, $message)
{
    $safeTitle = htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeMessage = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    echo "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>$safeTitle - CarePulse</title><link rel=\"stylesheet\" href=\"login.css\"></head><body><main class=\"login-container\"><section class=\"login-card\"><h1>$safeTitle</h1><p>$safeMessage</p><p class=\"register-link\"><a href=\"login.html\">Go to login</a></p></section></main></body></html>";
}

$token = $_GET['token'] ?? '';
if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) {
    http_response_code(400);
    verification_page('Invalid verification link', 'The verification link is invalid or incomplete.');
    exit();
}

try {
    $pdo = patient_database();
    ensure_patient_verification_table($pdo);
    $pdo->beginTransaction();
    $stmt = $pdo->prepare(
        'SELECT user_id FROM patient_email_verifications
         WHERE token_hash = ? AND expires_at > NOW() FOR UPDATE'
    );
    $stmt->execute([hash('sha256', $token)]);
    $verification = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$verification) {
        $pdo->rollBack();
        http_response_code(400);
        verification_page('Link expired or already used', 'Register again with the same email address to request a fresh verification link.');
        exit();
    }

    $stmt = $pdo->prepare('DELETE FROM patient_email_verifications WHERE user_id = ?');
    $stmt->execute([$verification['user_id']]);
    $pdo->commit();
    verification_page('Email verified', 'Your patient account is ready. You can now sign in.');
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Patient email verification failed: ' . $error->getMessage());
    http_response_code(500);
    verification_page('Verification unavailable', 'Please try again later.');
}
?>
