<?php
require_once __DIR__ . '/patient-auth.php';
require_patient_session();
header('Content-Type: application/json');

$doctorId = filter_var($_GET['doctorId'] ?? null, FILTER_VALIDATE_INT);
$date = $_GET['date'] ?? '';
$dateValue = is_string($date) ? DateTime::createFromFormat('!Y-m-d', $date) : false;
if (!$doctorId || !$dateValue || $dateValue->format('Y-m-d') !== $date || $date < date('Y-m-d')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Choose a valid doctor and future date.']);
    exit();
}

try {
    $pdo = patient_database();
    ensure_doctor_availability_table($pdo);

    $dayOfWeek = (int)$dateValue->format('N');
    $stmt = $pdo->prepare(
        "SELECT da.start_time, da.end_time
         FROM doctor_availability da
         INNER JOIN doctors d ON d.id = da.doctor_id
         INNER JOIN users u ON u.id = d.user_id
         WHERE da.doctor_id = ? AND da.day_of_week = ? AND u.role = 'Physician'"
    );
    $stmt->execute([$doctorId, $dayOfWeek]);
    $availability = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$availability) {
        echo json_encode(['success' => true, 'slots' => []]);
        exit();
    }

    $start = new DateTime($availability['start_time']);
    $end = new DateTime($availability['end_time']);
    $bookedStmt = $pdo->prepare(
        "SELECT TIME_FORMAT(appointment_time, '%H:%i') AS time
         FROM appointments
         WHERE doctor_id = ? AND appointment_date = ? AND status != 'Cancelled'"
    );
    $bookedStmt->execute([$doctorId, $date]);
    $bookedTimes = array_column($bookedStmt->fetchAll(PDO::FETCH_ASSOC), 'time');

    $slots = [];
    $slot = clone $start;
    while ((clone $slot)->modify('+30 minutes') <= $end) {
        $time = $slot->format('H:i');
        if (!in_array($time, $bookedTimes, true)) {
            $slots[] = $time;
        }
        $slot->modify('+30 minutes');
    }

    echo json_encode(['success' => true, 'slots' => $slots]);
} catch (PDOException $e) {
    error_log('Unable to load appointment time slots: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to load available times right now.']);
}
?>
