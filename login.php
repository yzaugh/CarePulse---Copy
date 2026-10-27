<?php
require_once __DIR__ . '/patient-auth.php';
session_start();
header('Content-Type: text/html');

$host = '127.0.0.1';
$dbname = 'carepulse_db';
$username = 'root';
$password = '';

try {
    $pdo = patient_database();
    ensure_patient_verification_table($pdo);
} catch (PDOException $e) {
    die("Database Connection Failed: " . $e->getMessage());
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $emailValue = $_POST['email'] ?? '';
    $password = $_POST['password'] ?? '';
    if (!is_string($emailValue) || !is_string($password)) {
        echo "<script>alert('Invalid login request.'); window.location.href='login.html';</script>";
        exit();
    }
    $email = strtolower(trim($emailValue));

    if (empty($email) || empty($password)) {
        echo "<script>alert('All fields are required.'); window.location.href='login.html';</script>";
        exit();
    }

    $stmt = $pdo->prepare("SELECT id, name, email, password, role FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $passwordIsHashed = $row && password_verify($password, $row['password']);
    $passwordValid = $row && (
        $passwordIsHashed ||
        hash_equals($row['password'], $password)
    );
    if (!$passwordValid) {
        echo "<script>alert('Invalid email or password.'); window.location.href='login.html';</script>";
        exit();
    }

    if ($row['role'] === 'Patient') {
        $stmt = $pdo->prepare('SELECT 1 FROM patient_email_verifications WHERE user_id = ?');
        $stmt->execute([$row['id']]);
        if ($stmt->fetchColumn()) {
            echo "<script>alert('Please verify your email address using the link we sent before signing in.'); window.location.href='login.html';</script>";
            exit();
        }
    }

    if (!$passwordIsHashed) {
        $stmt = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
        $stmt->execute([password_hash($password, PASSWORD_DEFAULT), $row['id']]);
    }

    session_regenerate_id(true);
    // Store in PHP session
    $_SESSION['user_id'] = $row['id'];
    $_SESSION['role']    = $row['role'];
    $_SESSION['name']    = $row['name'];
    $_SESSION['email']   = $row['email'];

    // Map DB role -> JS role (must match UserRoles in shared.js)
    $roleMap = [
        'Admin'            => 'admin',
        'Physician'        => 'doctor',
        'Patient'          => 'patient',
        'Receptionist'     => 'receptionist',
        'Pharmacist'       => 'inventory_manager',
        'InventoryManager' => 'inventory_manager',
    ];

    // Map DB role -> portal page
    $targetMap = [
        'Admin'            => 'index.html',
        'Physician'        => 'doctor-portal.html',
        'Patient'          => 'patient-portal.html',
        'Receptionist'     => 'receptionist-portal.html',
        'Pharmacist'       => 'inventory-portal.html',
        'InventoryManager' => 'inventory-portal.html',
    ];

    $jsRole = $roleMap[$row['role']]   ?? strtolower($row['role']);
    $target = $targetMap[$row['role']] ?? 'login.html';

    // Build the session object AuthManager expects in localStorage
    $sessionPayload = [
        'id'           => 'sess_' . bin2hex(random_bytes(4)),
        'email'        => $row['email'],
        'name'         => $row['name'],
        'role'         => $jsRole,
        'timestamp'    => round(microtime(true) * 1000),
        'lastActivity' => round(microtime(true) * 1000),
    ];

    // Write localStorage then redirect (browser will follow after JS runs)
    echo "<!DOCTYPE html><html><head><meta charset='utf-8'></head><body>
    <script>
      try {
        localStorage.setItem('carepulse_user', " . json_encode(json_encode($sessionPayload)) . ");
      } catch (e) {}
      window.location.href = " . json_encode($target) . ";
    </script>
    </body></html>";
    exit();
}
?>