<?php
require_once __DIR__ . '/patient-auth.php';
require_patient_session();
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$appointmentId = filter_var(is_array($data) ? ($data['id'] ?? null) : null, FILTER_VALIDATE_INT);

if (!$appointmentId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'A valid appointment ID is required.']);
    exit();
}

try {
    $pdo = patient_database();

    $stmt = $pdo->prepare(
        "UPDATE appointments a
         INNER JOIN patients p ON p.id = a.patient_id
         SET a.status = 'Cancelled'
         WHERE a.id = ? AND p.user_id = ? AND a.status IN ('Pending', 'Confirmed')"
    );
    $stmt->execute([$appointmentId, $_SESSION['user_id']]);

    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Appointment cancelled successfully.']);
    } else {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Appointment not found or is no longer active.']);
    }

} catch (PDOException $e) {
    error_log('Unable to cancel patient appointment: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to cancel the appointment right now.']);
}
?>