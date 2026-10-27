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

function inventory_response($statusCode, array $payload)
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit();
}

function validate_inventory_item($data)
{
    $categories = ['Medicine', 'Medical Supplies', 'Utility and Maintenance Supplies'];
    $name = is_string($data['itemName'] ?? null) ? trim($data['itemName']) : '';
    $category = $data['category'] ?? null;
    $unit = is_string($data['unit'] ?? null) ? trim($data['unit']) : '';
    $quantity = filter_var($data['quantity'] ?? null, FILTER_VALIDATE_INT);
    $unitCost = $data['unitCost'] ?? null;
    $expiryDate = $data['expiryDate'] ?? '';

    if ($name === '' || strlen($name) > 150 || !is_string($category)
        || !in_array($category, $categories, true)
        || strlen($unit) > 50 || $quantity === false || $quantity < 0
        || !is_numeric($unitCost) || !is_finite((float)$unitCost)
        || (float)$unitCost < 0 || (float)$unitCost > 99999999.99) {
        return [null, 'Enter a valid item name, category, quantity, and unit cost.'];
    }

    if (!is_string($expiryDate)) {
        return [null, 'Enter a valid expiry date.'];
    }
    if ($expiryDate !== '') {
        $date = DateTime::createFromFormat('!Y-m-d', $expiryDate);
        if (!$date || $date->format('Y-m-d') !== $expiryDate) {
            return [null, 'Enter a valid expiry date.'];
        }
    }

    return [[
        'itemName' => $name,
        'category' => $category,
        'quantity' => $quantity,
        'unit' => $unit === '' ? null : $unit,
        'unitCost' => round((float)$unitCost, 2),
        'expiryDate' => $expiryDate === '' ? null : $expiryDate
    ], null];
}

try {
    $pdo = patient_database();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        $pdo->beginTransaction();
        inventory_expire_stock_batches($pdo);
        $pdo->commit();

        $stmt = $pdo->query(
            "SELECT i.id, i.item_name AS itemName, i.category,
                    COALESCE(SUM(b.quantity), 0) AS quantity, i.unit,
                    i.unit_cost AS unitCost,
                    (SELECT MIN(active.expiry_date)
                     FROM inventory_stock_batches active
                     WHERE active.inventory_id = i.id AND active.quantity > 0
                       AND active.expiry_date IS NOT NULL) AS expiryDate,
                    DATE_FORMAT(i.last_updated, '%Y-%m-%d') AS lastUpdated,
                    COALESCE((SELECT SUM(t.quantity)
                              FROM inventory_stock_transactions t
                              WHERE t.inventory_id = i.id AND t.movement_type = 'Received'), 0) AS receivedQuantity,
                    COALESCE((SELECT SUM(t.quantity)
                              FROM inventory_stock_transactions t
                              WHERE t.inventory_id = i.id AND t.movement_type = 'Dispensed'), 0) AS dispensedQuantity,
                    COALESCE((SELECT COUNT(DISTINCT t.patient_id)
                              FROM inventory_stock_transactions t
                              WHERE t.inventory_id = i.id AND t.movement_type = 'Dispensed'
                                AND t.patient_id IS NOT NULL), 0) AS patientCount
             FROM inventory i
             LEFT JOIN inventory_stock_batches b ON b.inventory_id = i.id
             GROUP BY i.id
             ORDER BY FIELD(i.category, 'Medicine', 'Medical Supplies', 'Utility and Maintenance Supplies'),
                      i.item_name, i.id"
        );
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $patients = $pdo->query(
            "SELECT p.id, u.name
             FROM patients p
             INNER JOIN users u ON u.id = p.user_id
             WHERE u.role = 'Patient'
             ORDER BY u.name, p.id"
        )->fetchAll(PDO::FETCH_ASSOC);

        $expiringBatches = $pdo->query(
            "SELECT b.id, i.item_name AS itemName, i.category, b.quantity,
                    i.unit, DATE_FORMAT(b.expiry_date, '%Y-%m-%d') AS expiryDate
             FROM inventory_stock_batches b
             INNER JOIN inventory i ON i.id = b.inventory_id
             WHERE b.quantity > 0 AND b.expiry_date >= CURDATE()
               AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
             ORDER BY b.expiry_date, i.item_name, b.id
             LIMIT 200"
        )->fetchAll(PDO::FETCH_ASSOC);
        $expiringBatchCount = (int)$pdo->query(
            "SELECT COUNT(*)
             FROM inventory_stock_batches
             WHERE quantity > 0 AND expiry_date >= CURDATE()
               AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)"
        )->fetchColumn();

        $expiredBatches = $pdo->query(
            "SELECT b.id, i.item_name AS itemName, i.category, b.expired_quantity AS quantity,
                    i.unit, DATE_FORMAT(b.expiry_date, '%Y-%m-%d') AS expiryDate
             FROM inventory_stock_batches b
             INNER JOIN inventory i ON i.id = b.inventory_id
             WHERE b.expired_quantity > 0
             ORDER BY b.expiry_date DESC, i.item_name, b.id
             LIMIT 200"
        )->fetchAll(PDO::FETCH_ASSOC);

        $recentActivity = $pdo->query(
            "SELECT t.id, t.movement_type AS movementType, t.quantity,
                    i.item_name AS itemName, i.unit, t.patient_name AS patientName,
                    DATE_FORMAT(t.occurred_at, '%Y-%m-%d %H:%i') AS occurredAt
             FROM inventory_stock_transactions t
             INNER JOIN inventory i ON i.id = t.inventory_id
             ORDER BY t.occurred_at DESC, t.id DESC
             LIMIT 50"
        )->fetchAll(PDO::FETCH_ASSOC);

        $daily = $pdo->query(
            "SELECT movement_type AS movementType, COALESCE(SUM(quantity), 0) AS quantity
             FROM inventory_stock_transactions
             WHERE DATE(occurred_at) = CURDATE()
             GROUP BY movement_type"
        )->fetchAll(PDO::FETCH_KEY_PAIR);

        $expiredUnits = $pdo->query(
            "SELECT COALESCE(SUM(expired_quantity), 0) FROM inventory_stock_batches"
        )->fetchColumn();

        inventory_response(200, [
            'success' => true,
            'items' => $items,
            'patients' => $patients,
            'expiringBatches' => $expiringBatches,
            'expiringBatchCount' => $expiringBatchCount,
            'expiredBatches' => $expiredBatches,
            'recentActivity' => $recentActivity,
            'receivedToday' => (int)($daily['Received'] ?? 0),
            'dispensedToday' => (int)($daily['Dispensed'] ?? 0),
            'expiredUnits' => (int)$expiredUnits
        ]);
    }

    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) {
        inventory_response(400, ['success' => false, 'error' => 'Invalid inventory request.']);
    }

    if ($method === 'POST' || $method === 'PUT') {
        [$item, $validationError] = validate_inventory_item($data);
        if ($validationError !== null) {
            inventory_response(400, ['success' => false, 'error' => $validationError]);
        }

        if ($method === 'POST') {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare(
                "INSERT INTO inventory (item_name, category, quantity, unit, unit_cost, expiry_date, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $item['itemName'], $item['category'], $item['quantity'], $item['unit'],
                $item['unitCost'], $item['expiryDate'],
                $item['quantity'] > 0 ? 'In Stock' : 'Out of Stock'
            ]);
            $itemId = (int)$pdo->lastInsertId();
            if ($item['quantity'] > 0) {
                $batch = $pdo->prepare(
                    "INSERT INTO inventory_stock_batches (inventory_id, quantity, expiry_date)
                     VALUES (?, ?, ?)"
                );
                $batch->execute([$itemId, $item['quantity'], $item['expiryDate']]);
            }
            $pdo->commit();
            inventory_response(201, ['success' => true, 'message' => 'Inventory item added.', 'id' => $itemId]);
        }

        $itemId = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$itemId || $itemId < 1) {
            inventory_response(400, ['success' => false, 'error' => 'A valid inventory item ID is required.']);
        }
        $stmt = $pdo->prepare(
            "UPDATE inventory
             SET item_name = ?, category = ?, unit = ?, unit_cost = ?
             WHERE id = ?"
        );
        $stmt->execute([
            $item['itemName'], $item['category'], $item['unit'], $item['unitCost'], $itemId
        ]);
        if ($stmt->rowCount() === 0) {
            $exists = $pdo->prepare("SELECT 1 FROM inventory WHERE id = ?");
            $exists->execute([$itemId]);
            if (!$exists->fetchColumn()) {
                inventory_response(404, ['success' => false, 'error' => 'Inventory item not found.']);
            }
        }
        inventory_response(200, ['success' => true, 'message' => 'Inventory item updated.']);
    }

    if ($method === 'DELETE') {
        $itemId = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$itemId || $itemId < 1) {
            inventory_response(400, ['success' => false, 'error' => 'A valid inventory item ID is required.']);
        }
        $hasActivity = $pdo->prepare("SELECT 1 FROM inventory_stock_transactions WHERE inventory_id = ? LIMIT 1");
        $hasActivity->execute([$itemId]);
        if ($hasActivity->fetchColumn()) {
            inventory_response(409, [
                'success' => false,
                'error' => 'This item has stock activity history and cannot be deleted.'
            ]);
        }
        $stmt = $pdo->prepare("DELETE FROM inventory WHERE id = ?");
        $stmt->execute([$itemId]);
        if ($stmt->rowCount() === 0) {
            inventory_response(404, ['success' => false, 'error' => 'Inventory item not found.']);
        }
        inventory_response(200, ['success' => true, 'message' => 'Inventory item deleted.']);
    }

    header('Allow: GET, POST, PUT, DELETE');
    inventory_response(405, ['success' => false, 'error' => 'Method not allowed.']);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Unable to access inventory items: ' . $e->getMessage());
    inventory_response(500, ['success' => false, 'error' => 'Unable to access inventory right now.']);
}

function inventory_expire_stock_batches(PDO $pdo)
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
?>
