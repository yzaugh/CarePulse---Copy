<?php
require_once __DIR__ . '/patient-auth.php';
require_patient_session();
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid reschedule request.']);
    exit();
}

$appointmentId = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
$doctorId = filter_var($data['doctorId'] ?? null, FILTER_VALIDATE_INT);
$date = $data['date'] ?? null;
$time = $data['time'] ?? null;
$reason = is_string($data['reason'] ?? null) ? trim($data['reason']) : '';
$dateValue = is_string($date) ? DateTime::createFromFormat('!Y-m-d', $date) : false;
$timeValue = is_string($time) ? DateTime::createFromFormat('!H:i', $time) : false;

if (!$appointmentId || !$doctorId || !$dateValue || $dateValue->format('Y-m-d') !== $date
    || $date < date('Y-m-d') || !$timeValue || $timeValue->format('H:i') !== $time
    || $reason === '' || strlen($reason) > 2000) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Enter a valid doctor, future date, time, and reason.']);
    exit();
}

try {
    $pdo = patient_database();
    ensure_doctor_availability_table($pdo);
    $pdo->beginTransaction();

    $stmt = $pdo->prepare(
        "SELECT a.id
         FROM appointments a
         INNER JOIN patients p ON p.id = a.patient_id
         WHERE a.id = ? AND p.user_id = ? AND a.status = 'Absent'
         FOR UPDATE"
    );
    $stmt->execute([$appointmentId, $_SESSION['user_id']]);
    if (!$stmt->fetchColumn()) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Absent appointment not found.']);
        exit();
    }

    $stmt = $pdo->prepare(
        "SELECT d.specialization, da.start_time, da.end_time
         FROM doctors d
         INNER JOIN users u ON u.id = d.user_id
         INNER JOIN doctor_availability da ON da.doctor_id = d.id
         WHERE d.id = ? AND u.role = 'Physician' AND da.day_of_week = ?
         FOR UPDATE"
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
         WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
           AND status != 'Cancelled' AND id != ?"
    );
    $stmt->execute([$doctorId, $date, $time, $appointmentId]);
    if ($stmt->fetch()) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'This time slot is already booked.']);
        exit();
    }

    $stmt = $pdo->prepare(
        "UPDATE appointments
         SET doctor_id = ?, department = ?, appointment_date = ?, appointment_time = ?,
             reason = ?, status = 'Pending'
         WHERE id = ?"
    );
    $stmt->execute([$doctorId, $doctor['specialization'], $date, $time, $reason, $appointmentId]);
    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Appointment rescheduled successfully.',
        'id' => $appointmentId
    ]);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Unable to reschedule patient appointment: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to reschedule the appointment right now.']);
}
?>
