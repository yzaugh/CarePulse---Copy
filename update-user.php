<?php
require_once __DIR__ . '/access_control.php';
require_admin();
header('Content-Type: application/json');

$host = '127.0.0.1';
$dbname = 'carepulse_db';
$username = 'root';
$password = '';

$data = json_decode(file_get_contents('php://input'), true);
$userId = $data['id'] ?? '';
$name = $data['name'] ?? '';
$email = $data['email'] ?? '';
$role = $data['role'] ?? '';

if (empty($userId) || empty($name) || empty($email) || empty($role)) {
    echo json_encode(['success' => false, 'error' => 'All fields are required']);
    exit();
}

$allowedRoles = worker_roles();
if (!in_array($role, $allowedRoles, true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Only worker accounts can be assigned']);
    exit();
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $currentRole = $stmt->fetchColumn();
    if (!$currentRole || !is_worker_role($currentRole)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Only worker accounts can be managed here']);
        exit();
    }

    $stmt = $pdo->prepare("UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?");
    $stmt->execute([$name, $email, $role, $userId]);

    echo json_encode(['success' => true, 'message' => 'User updated successfully']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>