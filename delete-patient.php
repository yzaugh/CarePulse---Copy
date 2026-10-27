<?php
require_once __DIR__ . '/access_control.php';
deny_admin_access();
header('Content-Type: application/json');

$host = '127.0.0.1';
$dbname = 'carepulse_db';
$username = 'root';
$password = '';

$data = json_decode(file_get_contents('php://input'), true);
$patientId = $data['id'] ?? '';

if (empty($patientId)) {
    echo json_encode(['success' => false, 'error' => 'Patient ID is required']);
    exit();
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $pdo->beginTransaction();

    // Get user_id from patient
    $stmt = $pdo->prepare("SELECT user_id FROM patients WHERE id = ?");
    $stmt->execute([$patientId]);
    $patient = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$patient) {
        echo json_encode(['success' => false, 'error' => 'Patient not found']);
        exit();
    }

    // Delete patient (cascade will handle related records)
    $stmt = $pdo->prepare("DELETE FROM patients WHERE id = ?");
    $stmt->execute([$patientId]);

    // Delete the user account
    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$patient['user_id']]);

    $pdo->commit();
    echo json_encode(['success' => true, 'message' => 'Patient deleted successfully']);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>