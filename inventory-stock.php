<?php
require_once __DIR__ . '/patient-auth.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? null) !== 'InventoryManager') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Inventory manager access required.']);
    exit();
}

function inventory_stock_response($statusCode, array $payload)
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit();
}

function expire_inventory_stock(PDO $pdo)
{
    $batches = $pdo->query(
        "SELECT id, inventory_id, quantity
         FROM inventory_stock_batches
         WHERE quantity > 0 AND expiry_date < CURDATE()
         FOR UPDATE"
    )->fetchAll(PDO::FETCH_ASSOC);
    if (!$batches) {
        return;
    }

    $expireBatch = $pdo->prepare(
        "UPDATE inventory_stock_batches
         SET expired_quantity = expired_quantity + ?, quantity = 0
         WHERE id = ? AND quantity = ?"
    );
    $updateItem = $pdo->prepare(
        "UPDATE inventory SET quantity = GREATEST(quantity - ?, 0) WHERE id = ?"
    );
    $updateStatus = $pdo->prepare(
        "UPDATE inventory SET status = IF(quantity > 0, 'In Stock', 'Out of Stock') WHERE id = ?"
    );
    $log = $pdo->prepare(
        "INSERT INTO inventory_stock_transactions
         (inventory_id, batch_id, movement_type, quantity)
         VALUES (?, ?, 'Expired', ?)"
    );

    foreach ($batches as $batch) {
        $quantity = (int)$batch['quantity'];
        $expireBatch->execute([$quantity, $batch['id'], $quantity]);
        if ($expireBatch->rowCount() === 0) {
            continue;
        }
        $updateItem->execute([$quantity, $batch['inventory_id']]);
        $updateStatus->execute([$batch['inventory_id']]);
        $log->execute([$batch['inventory_id'], $batch['id'], $quantity]);
    }
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        header('Allow: POST');
        inventory_stock_response(405, ['success' => false, 'error' => 'Method not allowed.']);
    }

    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) {
        inventory_stock_response(400, ['success' => false, 'error' => 'Invalid stock movement request.']);
    }

    $itemId = filter_var($data['itemId'] ?? null, FILTER_VALIDATE_INT);
    $quantity = filter_var($data['quantity'] ?? null, FILTER_VALIDATE_INT);
    $movementType = $data['movementType'] ?? null;
    $patientId = filter_var($data['patientId'] ?? null, FILTER_VALIDATE_INT);
    $expiryDate = $data['expiryDate'] ?? '';
    if (!$itemId || $itemId < 1 || $quantity === false || $quantity < 1
        || $quantity > 100000000 || !in_array($movementType, ['Received', 'Dispensed'], true)) {
        inventory_stock_response(400, ['success' => false, 'error' => 'Enter a valid action and positive quantity.']);
    }
    if ($movementType === 'Dispensed' && (!$patientId || $patientId < 1)) {
        inventory_stock_response(400, ['success' => false, 'error' => 'Select the patient who received the medication.']);
    }
    if (!is_string($expiryDate)) {
        inventory_stock_response(400, ['success' => false, 'error' => 'Enter a valid batch expiry date.']);
    }
    if ($expiryDate !== '') {
        $date = DateTime::createFromFormat('!Y-m-d', $expiryDate);
        if (!$date || $date->format('Y-m-d') !== $expiryDate || $expiryDate < date('Y-m-d')) {
            inventory_stock_response(400, ['success' => false, 'error' => 'Expiry date must be today or later.']);
        }
    }
    if ($movementType === 'Dispensed' && $expiryDate !== '') {
        inventory_stock_response(400, ['success' => false, 'error' => 'Expiry date is only entered when receiving stock.']);
    }

    $pdo = patient_database();
    $pdo->beginTransaction();
    expire_inventory_stock($pdo);

    $itemQuery = $pdo->prepare(
        "SELECT id, item_name, category, quantity
         FROM inventory WHERE id = ? FOR UPDATE"
    );
    $itemQuery->execute([$itemId]);
    $item = $itemQuery->fetch(PDO::FETCH_ASSOC);
    if (!$item) {
        $pdo->rollBack();
        inventory_stock_response(404, ['success' => false, 'error' => 'Inventory item not found.']);
    }

    if ($movementType === 'Received') {
        $batch = $pdo->prepare(
            "INSERT INTO inventory_stock_batches (inventory_id, quantity, expiry_date)
             VALUES (?, ?, ?)"
        );
        $batch->execute([$itemId, $quantity, $expiryDate === '' ? null : $expiryDate]);
        $batchId = (int)$pdo->lastInsertId();

        $update = $pdo->prepare(
            "UPDATE inventory SET quantity = quantity + ?, status = 'In Stock' WHERE id = ?"
        );
        $update->execute([$quantity, $itemId]);
        $log = $pdo->prepare(
            "INSERT INTO inventory_stock_transactions
             (inventory_id, batch_id, movement_type, quantity, performed_by)
             VALUES (?, ?, 'Received', ?, ?)"
        );
        $log->execute([$itemId, $batchId, $quantity, $_SESSION['user_id']]);
    } else {
        if ($item['category'] !== 'Medicine') {
            $pdo->rollBack();
            inventory_stock_response(400, ['success' => false, 'error' => 'Only medicine can be dispensed to patients.']);
        }

        $patientQuery = $pdo->prepare(
            "SELECT p.id, u.name
             FROM patients p
             INNER JOIN users u ON u.id = p.user_id
             WHERE p.id = ? AND u.role = 'Patient'"
        );
        $patientQuery->execute([$patientId]);
        $patient = $patientQuery->fetch(PDO::FETCH_ASSOC);
        if (!$patient) {
            $pdo->rollBack();
            inventory_stock_response(400, ['success' => false, 'error' => 'The selected patient was not found.']);
        }

        $batchQuery = $pdo->prepare(
            "SELECT id, quantity
             FROM inventory_stock_batches
             WHERE inventory_id = ? AND quantity > 0
               AND (expiry_date IS NULL OR expiry_date >= CURDATE())
             ORDER BY expiry_date IS NULL, expiry_date, id
             FOR UPDATE"
        );
        $batchQuery->execute([$itemId]);
        $batches = $batchQuery->fetchAll(PDO::FETCH_ASSOC);
        $available = array_sum(array_map(static function ($batch) {
            return (int)$batch['quantity'];
        }, $batches));
        if ($available < $quantity) {
            $pdo->rollBack();
            inventory_stock_response(409, [
                'success' => false,
                'error' => 'Not enough unexpired stock is available for this dispense.'
            ]);
        }

        $remaining = $quantity;
        $decrementBatch = $pdo->prepare(
            "UPDATE inventory_stock_batches SET quantity = quantity - ? WHERE id = ?"
        );
        $log = $pdo->prepare(
            "INSERT INTO inventory_stock_transactions
             (inventory_id, batch_id, movement_type, quantity, patient_id, patient_name, performed_by)
             VALUES (?, ?, 'Dispensed', ?, ?, ?, ?)"
        );
        foreach ($batches as $batch) {
            if ($remaining === 0) {
                break;
            }
            $dispensed = min($remaining, (int)$batch['quantity']);
            $decrementBatch->execute([$dispensed, $batch['id']]);
            $log->execute([
                $itemId, $batch['id'], $dispensed, $patient['id'], $patient['name'], $_SESSION['user_id']
            ]);
            $remaining -= $dispensed;
        }

        $update = $pdo->prepare("UPDATE inventory SET quantity = quantity - ? WHERE id = ?");
        $update->execute([$quantity, $itemId]);
        $updateStatus = $pdo->prepare(
            "UPDATE inventory SET status = IF(quantity > 0, 'In Stock', 'Out of Stock') WHERE id = ?"
        );
        $updateStatus->execute([$itemId]);
    }

    $pdo->commit();
    inventory_stock_response(200, [
        'success' => true,
        'message' => $movementType === 'Received' ? 'Stock receipt recorded.' : 'Medicine dispense recorded.'
    ]);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Unable to record inventory stock movement: ' . $e->getMessage());
    inventory_stock_response(500, ['success' => false, 'error' => 'Unable to record stock movement right now.']);
}
?>
