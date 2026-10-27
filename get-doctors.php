<?php
require_once __DIR__ . '/patient-auth.php';
require_patient_session();
header('Content-Type: application/json');

try {
    $pdo = patient_database();
    ensure_doctor_availability_table($pdo);
    $stmt = $pdo->query(
        "SELECT d.id, u.name, d.specialization,
                da.day_of_week AS dayOfWeek,
                TIME_FORMAT(da.start_time, '%H:%i') AS startTime,
                TIME_FORMAT(da.end_time, '%H:%i') AS endTime
         FROM doctors d
         INNER JOIN users u ON u.id = d.user_id
         LEFT JOIN doctor_availability da ON da.doctor_id = d.id
         WHERE u.role = 'Physician'
         ORDER BY u.name, da.day_of_week"
    );

    $doctors = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $doctorId = (int)$row['id'];
        if (!isset($doctors[$doctorId])) {
            $doctors[$doctorId] = [
                'id' => $doctorId,
                'name' => $row['name'],
                'specialization' => $row['specialization'],
                'availability' => []
            ];
        }
        if ($row['dayOfWeek'] !== null) {
            $doctors[$doctorId]['availability'][] = [
                'dayOfWeek' => (int)$row['dayOfWeek'],
                'startTime' => $row['startTime'],
                'endTime' => $row['endTime']
            ];
        }
    }

    echo json_encode(['success' => true, 'doctors' => array_values($doctors)]);
} catch (PDOException $e) {
    error_log('Unable to load doctors for patient booking: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to load doctors right now.']);
}
?>
