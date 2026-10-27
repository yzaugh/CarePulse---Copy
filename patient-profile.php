<?php
require_once __DIR__ . '/patient-auth.php';
require_patient_session();
header('Content-Type: application/json');

function profile_response($status, $data)
{
    http_response_code($status);
    echo json_encode($data);
    exit();
}

try {
    $pdo = patient_database();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare(
            "SELECT name, email, phone, DATE_FORMAT(dob, '%Y-%m-%d') AS dob, gender, blood_type, address
             FROM users WHERE id = ? AND role = 'Patient'"
        );
        $stmt->execute([$_SESSION['user_id']]);
        $profile = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$profile) {
            profile_response(404, ['success' => false, 'error' => 'Patient account not found.']);
        }
        profile_response(200, ['success' => true, 'profile' => $profile]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header('Allow: GET, POST');
        profile_response(405, ['success' => false, 'error' => 'Method not allowed.']);
    }

    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) {
        profile_response(400, ['success' => false, 'error' => 'Invalid profile update.']);
    }

    foreach (['name', 'phone', 'dob', 'gender', 'address'] as $field) {
        if (isset($data[$field]) && !is_string($data[$field])) {
            profile_response(400, ['success' => false, 'error' => 'Invalid profile update.']);
        }
    }
    $name = is_string($data['name'] ?? null) ? trim($data['name']) : '';
    $phone = is_string($data['phone'] ?? null) ? trim($data['phone']) : '';
    $dob = is_string($data['dob'] ?? null) ? trim($data['dob']) : '';
    $gender = is_string($data['gender'] ?? null) ? trim($data['gender']) : '';
    $address = is_string($data['address'] ?? null) ? trim($data['address']) : '';

    if ($name === '' || strlen($name) > 100 || strlen($phone) > 20 || strlen($gender) > 20 || strlen($address) > 1000) {
        profile_response(400, ['success' => false, 'error' => 'Enter a valid name and ensure profile fields are within their length limits.']);
    }
    if ($dob !== '') {
        $date = DateTime::createFromFormat('!Y-m-d', $dob);
        if (!$date || $date->format('Y-m-d') !== $dob || $date > new DateTime('today')) {
            profile_response(400, ['success' => false, 'error' => 'Enter a valid date of birth.']);
        }
    } else {
        $dob = null;
    }

    $stmt = $pdo->prepare(
        "UPDATE users SET name = ?, phone = ?, dob = ?, gender = ?, address = ?
         WHERE id = ? AND role = 'Patient'"
    );
    $stmt->execute([
        $name,
        $phone !== '' ? $phone : null,
        $dob,
        $gender !== '' ? $gender : null,
        $address !== '' ? $address : null,
        $_SESSION['user_id']
    ]);
    $_SESSION['name'] = $name;
    profile_response(200, ['success' => true, 'message' => 'Profile updated successfully.']);
} catch (PDOException $error) {
    error_log('Patient profile request failed: ' . $error->getMessage());
    profile_response(500, ['success' => false, 'error' => 'Unable to save your profile right now.']);
}
?>
