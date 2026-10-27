<?php
require_once __DIR__ . '/access_control.php';
deny_admin_access();
header('Content-Type: application/json');

$host = '127.0.0.1';
$dbname = 'carepulse_db';
$username = 'root';
$password = '';

$data  = json_decode(file_get_contents('php://input'), true);
$name  = $data['name']  ?? '';
$email = $data['email'] ?? '';
$phone = $data['phone'] ?? '';

if (empty($name) || empty($email)) {
    echo json_encode(['success' => false, 'error' => 'Name and email are required']);
    exit();
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $pdo->beginTransaction();

    $stmtUser = $pdo->prepare("INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, 'default123', 'Patient', ?)");
    $stmtUser->execute([$name, $email, $phone]);
    $userId = $pdo->lastInsertId();

    $stmtPatient = $pdo->prepare("INSERT INTO patients (user_id, registered_date, last_visit) VALUES (?, CURDATE(), CURDATE())");
    $stmtPatient->execute([$userId]);

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>