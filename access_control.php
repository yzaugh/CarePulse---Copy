<?php
function worker_roles()
{
    return ['Physician', 'Receptionist', 'InventoryManager'];
}

function is_worker_role($role)
{
    return $role === 'Pharmacist' || in_array($role, worker_roles(), true);
}

function require_admin()
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? null) !== 'Admin') {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Admin access required']);
        exit();
    }
}

function deny_admin_access()
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    if (($_SESSION['role'] ?? null) === 'Admin') {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Admins may only access worker accounts']);
        exit();
    }
}
?>
