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

try {
    $pdo = patient_database();
    $doctorStmt = $pdo->prepare("SELECT id FROM doctors WHERE user_id = ?");
    $doctorStmt->execute([$_SESSION['user_id']]);
    $doctorId = $doctorStmt->fetchColumn();
    if (!$doctorId) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'No doctor profile is linked to this account.']);
        exit();
    }

    $stmt = $pdo->prepare(
        "SELECT a.id, a.patient_id AS patientId,
                COALESCE(u.name, 'Patient') AS patientName,
                DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS date,
                TIME_FORMAT(a.appointment_time, '%H:%i') AS time,
                a.reason, a.status
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         LEFT JOIN users u ON u.id = p.user_id
         WHERE a.doctor_id = ? AND LOWER(a.status) <> 'cancelled'
         ORDER BY a.appointment_date, a.appointment_time, a.id"
    );
    $stmt->execute([$doctorId]);

    echo json_encode(['success' => true, 'appointments' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
} catch (PDOException $e) {
    error_log('Unable to load doctor appointments: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to load appointments right now.']);
}
?>
