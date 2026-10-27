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

function doctor_availability_response($status, $data)
{
    http_response_code($status);
    echo json_encode($data);
    exit();
}

try {
    $pdo = patient_database();
    ensure_doctor_availability_table($pdo);

    $doctorStmt = $pdo->prepare('SELECT id FROM doctors WHERE user_id = ?');
    $doctorStmt->execute([$_SESSION['user_id']]);
    $doctorId = $doctorStmt->fetchColumn();
    if (!$doctorId) {
        doctor_availability_response(404, ['success' => false, 'error' => 'No doctor profile is linked to this account.']);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare(
            'SELECT day_of_week AS dayOfWeek,
                    TIME_FORMAT(start_time, \'%H:%i\') AS startTime,
                    TIME_FORMAT(end_time, \'%H:%i\') AS endTime
             FROM doctor_availability
             WHERE doctor_id = ?
             ORDER BY day_of_week'
        );
        $stmt->execute([$doctorId]);
        doctor_availability_response(200, ['success' => true, 'availability' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header('Allow: GET, POST');
        doctor_availability_response(405, ['success' => false, 'error' => 'Method not allowed.']);
    }

    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data) || !is_array($data['availability'] ?? null)) {
        doctor_availability_response(400, ['success' => false, 'error' => 'Invalid weekly schedule.']);
    }

    $slots = [];
    foreach ($data['availability'] as $slot) {
        if (!is_array($slot)
            || !is_numeric($slot['dayOfWeek'] ?? null)
            || !is_string($slot['startTime'] ?? null)
            || !is_string($slot['endTime'] ?? null)) {
            doctor_availability_response(400, ['success' => false, 'error' => 'Each schedule day needs valid hours.']);
        }

        $dayOfWeek = filter_var($slot['dayOfWeek'], FILTER_VALIDATE_INT);
        $startTime = $slot['startTime'];
        $endTime = $slot['endTime'];
        $start = DateTime::createFromFormat('!H:i', $startTime);
        $end = DateTime::createFromFormat('!H:i', $endTime);
        if (!$dayOfWeek || $dayOfWeek < 1 || $dayOfWeek > 7
            || !$start || $start->format('H:i') !== $startTime
            || !$end || $end->format('H:i') !== $endTime
            || $startTime >= $endTime || isset($slots[$dayOfWeek])) {
            doctor_availability_response(400, ['success' => false, 'error' => 'Schedule days and hours must be valid and unique.']);
        }

        $slots[$dayOfWeek] = [$startTime, $endTime];
    }

    $pdo->beginTransaction();
    $delete = $pdo->prepare('DELETE FROM doctor_availability WHERE doctor_id = ?');
    $delete->execute([$doctorId]);
    $insert = $pdo->prepare(
        'INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time)
         VALUES (?, ?, ?, ?)'
    );
    foreach ($slots as $dayOfWeek => [$startTime, $endTime]) {
        $insert->execute([$doctorId, $dayOfWeek, $startTime, $endTime]);
    }
    $pdo->commit();

    echo json_encode(['success' => true, 'message' => 'Weekly schedule saved successfully.']);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Unable to load or save doctor availability: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to save or load your schedule right now.']);
}
?>
