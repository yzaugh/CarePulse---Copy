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

$data = json_decode(file_get_contents('php://input'), true);
$appointmentId = filter_var(is_array($data) ? ($data['id'] ?? null) : null, FILTER_VALIDATE_INT);
$action = is_array($data) ? ($data['action'] ?? null) : null;

if (!$appointmentId || !in_array($action, ['checked_in', 'absent'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'A valid appointment and attendance action are required.']);
    exit();
}

try {
    $pdo = patient_database();
    $statusColumn = $pdo->query("SHOW COLUMNS FROM appointments LIKE 'status'")->fetch(PDO::FETCH_ASSOC);
    $statusType = $statusColumn['Type'] ?? '';
    if (strpos(strtolower($statusType), 'enum(') === 0
        && (strpos($statusType, "'Checked In'") === false || strpos($statusType, "'Absent'") === false)) {
        $pdo->exec(
            "ALTER TABLE appointments
             MODIFY status ENUM('Pending', 'Confirmed', 'Checked In', 'Completed', 'Absent', 'Cancelled')
             NULL DEFAULT 'Pending'"
        );
    }

    if ($action === 'checked_in') {
        $stmt = $pdo->prepare(
            "UPDATE appointments
             SET status = 'Checked In'
             WHERE id = ? AND appointment_date = CURDATE()
               AND status IN ('Pending', 'Confirmed')"
        );
    } else {
        $stmt = $pdo->prepare(
            "UPDATE appointments
             SET status = 'Absent'
             WHERE id = ? AND TIMESTAMP(appointment_date, appointment_time) <= NOW()
               AND status IN ('Pending', 'Confirmed')"
        );
    }
    $stmt->execute([$appointmentId]);

    if ($stmt->rowCount() === 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Appointment not found or no longer eligible for this attendance action.']);
        exit();
    }

    $status = $action === 'checked_in' ? 'Checked In' : 'Absent';
    echo json_encode(['success' => true, 'status' => $status]);
} catch (PDOException $e) {
    error_log('Unable to update receptionist appointment: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to update the appointment right now.']);
}
?>
