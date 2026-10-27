<?php
require_once __DIR__ . '/patient-auth.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? null) !== 'Physician') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Physician access required.']);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true);
$appointmentId = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
if (!$appointmentId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'A valid appointment ID is required.']);
    exit();
}

try {
    $pdo = patient_database();
    $stmt = $pdo->prepare(
        "UPDATE appointments a
         INNER JOIN doctors d ON d.id = a.doctor_id
         SET a.status = 'Completed'
         WHERE a.id = ? AND d.user_id = ? AND a.status IN ('Pending', 'Confirmed', 'Checked In')"
    );
    $stmt->execute([$appointmentId, $_SESSION['user_id']]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Appointment not found or is no longer active.']);
        exit();
    }

    echo json_encode(['success' => true, 'message' => 'Appointment marked as completed.']);
} catch (PDOException $e) {
    error_log('Unable to complete doctor appointment: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to update the appointment right now.']);
}
?>
