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

try {
    $pdo = patient_database();
    $stmt = $pdo->query(
        "SELECT a.id,
                COALESCE(patient.name, 'Patient') AS patientName,
                COALESCE(doctor.name, 'Physician') AS doctorName,
                DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS date,
                TIME_FORMAT(a.appointment_time, '%H:%i') AS time,
                a.status
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         LEFT JOIN users patient ON patient.id = p.user_id
         LEFT JOIN doctors d ON d.id = a.doctor_id
         LEFT JOIN users doctor ON doctor.id = d.user_id
         ORDER BY a.appointment_date, a.appointment_time, a.id"
    );

    echo json_encode(['success' => true, 'appointments' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
} catch (PDOException $e) {
    error_log('Unable to load receptionist appointments: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to load appointments right now.']);
}
?>
