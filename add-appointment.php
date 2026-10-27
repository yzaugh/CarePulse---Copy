<?php
require_once __DIR__ . '/patient-auth.php';
require_patient_session();
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid appointment request.']);
    exit();
}

foreach (['doctorId', 'date', 'time', 'reason'] as $field) {
    if (!is_string($data[$field] ?? null)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Doctor, date, time, and reason are required.']);
        exit();
    }
}

$doctorId = filter_var($data['doctorId'], FILTER_VALIDATE_INT);
$date = $data['date'];
$time = $data['time'];
$reason = trim($data['reason']);
$dateValue = DateTime::createFromFormat('!Y-m-d', $date);
$timeValue = DateTime::createFromFormat('!H:i', $time);

if (!$doctorId || !$dateValue || $dateValue->format('Y-m-d') !== $date || $date < date('Y-m-d')
    || !$timeValue || $timeValue->format('H:i') !== $time || $reason === '' || strlen($reason) > 2000) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Enter a valid doctor, future date, time, and reason.']);
    exit();
}

try {
    $pdo = patient_database();
    ensure_doctor_availability_table($pdo);

    $stmt = $pdo->prepare("SELECT id FROM patients WHERE user_id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $patientId = $stmt->fetchColumn();
    if (!$patientId) {
        $stmt = $pdo->prepare("INSERT INTO patients (user_id, registered_date) VALUES (?, CURDATE())");
        $stmt->execute([$_SESSION['user_id']]);
        $patientId = $pdo->lastInsertId();
    }

    $pdo->beginTransaction();
    $stmt = $pdo->prepare(
        "SELECT d.specialization, da.start_time, da.end_time
         FROM doctors d
         INNER JOIN users u ON u.id = d.user_id
         INNER JOIN doctor_availability da ON da.doctor_id = d.id
         WHERE d.id = ? AND u.role = 'Physician'"
         . " AND da.day_of_week = ? FOR UPDATE"
    );
    $stmt->execute([$doctorId, (int)$dateValue->format('N')]);
    $doctor = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$doctor) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'The selected doctor is not available on this day.']);
        exit();
    }

    $startTime = substr($doctor['start_time'], 0, 5);
    $endTime = substr($doctor['end_time'], 0, 5);
    $startMinutes = ((int)substr($startTime, 0, 2) * 60) + (int)substr($startTime, 3, 2);
    $endMinutes = ((int)substr($endTime, 0, 2) * 60) + (int)substr($endTime, 3, 2);
    $appointmentMinutes = ((int)$timeValue->format('H') * 60) + (int)$timeValue->format('i');
    if ($appointmentMinutes < $startMinutes || $appointmentMinutes + 30 > $endMinutes
        || ($appointmentMinutes - $startMinutes) % 30 !== 0) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Choose a time within the doctor's saved schedule."]);
        exit();
    }

    $stmt = $pdo->prepare(
        "SELECT id FROM appointments
         WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'Cancelled'"
    );
    $stmt->execute([$doctorId, $date, $time]);
    if ($stmt->fetch()) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'This time slot is already booked.']);
        exit();
    }

    $stmt = $pdo->prepare(
        "INSERT INTO appointments
         (patient_id, doctor_id, department, appointment_date, appointment_time, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, 'Pending')"
    );
    $stmt->execute([$patientId, $doctorId, $doctor['specialization'], $date, $time, $reason]);
    $appointmentId = $pdo->lastInsertId();
    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Appointment created successfully.',
        'id' => $appointmentId
    ]);

} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Unable to create patient appointment: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to create the appointment right now.']);
}
?>