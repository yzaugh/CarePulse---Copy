<?php
require_once __DIR__ . '/patient-auth.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? null) !== 'Receptionist') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Receptionist access required.']);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true);
$appointmentId = filter_var(is_array($data) ? ($data['id'] ?? null) : null, FILTER_VALIDATE_INT);
if (!$appointmentId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'A valid appointment ID is required.']);
    exit();
}

try {
    $pdo = patient_database();
    $stmt = $pdo->prepare("DELETE FROM appointments WHERE id = ? AND status = 'Cancelled'");
    $stmt->execute([$appointmentId]);

    if ($stmt->rowCount() === 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Only cancelled appointments can be removed.']);
        exit();
    }

    echo json_encode(['success' => true, 'message' => 'Cancelled appointment removed.']);
} catch (PDOException $e) {
    error_log('Unable to remove cancelled receptionist appointment: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to remove the cancelled appointment right now.']);
}
?>
