USE `carepulse_db`;

SET @reorder_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'inventory'
    AND column_name = 'reorder_level'
);
SET @inventory_reorder_sql = IF(
  @reorder_column_exists > 0,
  'ALTER TABLE `inventory` DROP COLUMN `reorder_level`',
  'SELECT 1'
);
PREPARE inventory_reorder_statement FROM @inventory_reorder_sql;
EXECUTE inventory_reorder_statement;
DEALLOCATE PREPARE inventory_reorder_statement;

UPDATE `inventory`
SET `status` = IF(`quantity` > 0, 'In Stock', 'Out of Stock');
ALTER TABLE `inventory`
  MODIFY `status` enum('In Stock','Out of Stock') DEFAULT 'In Stock';

CREATE TABLE IF NOT EXISTS `inventory_stock_batches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `inventory_id` int(11) NOT NULL,
  `quantity` int(11) unsigned NOT NULL DEFAULT 0,
  `expired_quantity` int(11) unsigned NOT NULL DEFAULT 0,
  `expiry_date` date DEFAULT NULL,
  `received_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `inventory_id` (`inventory_id`),
  KEY `expiry_date` (`expiry_date`),
  CONSTRAINT `inventory_stock_batches_inventory_fk`
    FOREIGN KEY (`inventory_id`) REFERENCES `inventory` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `inventory_stock_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `inventory_id` int(11) NOT NULL,
  `batch_id` int(11) DEFAULT NULL,
  `movement_type` enum('Received','Dispensed','Expired') NOT NULL,
  `quantity` int(11) unsigned NOT NULL,
  `patient_id` int(11) DEFAULT NULL,
  `patient_name` varchar(100) DEFAULT NULL,
  `performed_by` int(11) DEFAULT NULL,
  `occurred_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `inventory_id_occurred_at` (`inventory_id`,`occurred_at`),
  KEY `movement_type_occurred_at` (`movement_type`,`occurred_at`),
  KEY `batch_id` (`batch_id`),
  CONSTRAINT `inventory_stock_transactions_inventory_fk`
    FOREIGN KEY (`inventory_id`) REFERENCES `inventory` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `inventory_stock_transactions_batch_fk`
    FOREIGN KEY (`batch_id`) REFERENCES `inventory_stock_batches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `inventory_stock_batches` (`inventory_id`, `quantity`, `expiry_date`)
SELECT i.id, i.quantity, i.expiry_date
FROM `inventory` i
WHERE i.quantity > 0
  AND NOT EXISTS (
    SELECT 1 FROM `inventory_stock_batches` b WHERE b.inventory_id = i.id
  );
