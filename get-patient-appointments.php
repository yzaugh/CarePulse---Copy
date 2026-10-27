<?php
require_once __DIR__ . '/patient-auth.php';
require_patient_session();
header('Content-Type: application/json');

try {
    $pdo = patient_database();
    $stmt = $pdo->prepare(
        "SELECT a.id, a.patient_id AS patientId, a.doctor_id AS doctorId,
                COALESCE(doctor.name, 'Physician') AS doctorName,
                DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS date,
                TIME_FORMAT(a.appointment_time, '%H:%i') AS time,
                a.reason, a.status
         FROM appointments a
         INNER JOIN patients p ON p.id = a.patient_id
         LEFT JOIN doctors d ON d.id = a.doctor_id
         LEFT JOIN users doctor ON doctor.id = d.user_id
         WHERE p.user_id = ?
         ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.id DESC"
    );
    $stmt->execute([$_SESSION['user_id']]);

    echo json_encode(['success' => true, 'appointments' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
} catch (PDOException $e) {
    error_log('Unable to load patient appointments: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to load appointments right now.']);
}
?>
