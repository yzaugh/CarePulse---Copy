USE `carepulse_db`;

INSERT INTO `inventory`
  (`item_name`, `category`, `quantity`, `unit`, `unit_cost`, `expiry_date`, `status`)
SELECT seed.item_name, seed.category, seed.quantity, seed.unit, seed.unit_cost,
       seed.expiry_date, seed.status
FROM (
  SELECT 'Aspirin 500mg' AS item_name, 'Medicine' AS category, 150 AS quantity,
         'tablets' AS unit, 5.99 AS unit_cost, '2027-12-31' AS expiry_date, 'In Stock' AS status
  UNION ALL SELECT 'Ibuprofen 200mg', 'Medicine', 30, 'tablets', 4.99, '2027-06-30', 'In Stock'
  UNION ALL SELECT 'Amoxicillin 500mg', 'Medicine', 200, 'capsules', 8.99, '2027-09-15', 'In Stock'
  UNION ALL SELECT 'Lisinopril 10mg', 'Medicine', 45, 'tablets', 12.99, '2028-01-20', 'In Stock'
  UNION ALL SELECT 'Surgical Gloves', 'Medical Supplies', 150, 'boxes', 15.00, NULL, 'In Stock'
  UNION ALL SELECT 'Syringes 10ml', 'Medical Supplies', 45, 'pieces', 2.50, NULL, 'In Stock'
  UNION ALL SELECT 'IV Fluids (Saline)', 'Medical Supplies', 300, 'bags', 8.00, NULL, 'In Stock'
  UNION ALL SELECT 'Bandages', 'Medical Supplies', 500, 'rolls', 3.00, NULL, 'In Stock'
  UNION ALL SELECT 'Oxygen Tanks', 'Medical Supplies', 25, 'tanks', 150.00, NULL, 'In Stock'
  UNION ALL SELECT 'Surface Disinfectant', 'Utility and Maintenance Supplies', 80, 'bottles', 6.50, NULL, 'In Stock'
  UNION ALL SELECT 'Paper Towels', 'Utility and Maintenance Supplies', 22, 'packs', 4.00, NULL, 'In Stock'
  UNION ALL SELECT 'LED Bulbs', 'Utility and Maintenance Supplies', 40, 'pieces', 3.25, NULL, 'In Stock'
  UNION ALL SELECT 'HVAC Filters', 'Utility and Maintenance Supplies', 12, 'pieces', 18.00, NULL, 'In Stock'
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM `inventory` existing
  WHERE existing.item_name = seed.item_name AND existing.category = seed.category
);

INSERT INTO `inventory_stock_batches` (`inventory_id`, `quantity`, `expiry_date`)
SELECT i.id, i.quantity, i.expiry_date
FROM `inventory` i
WHERE i.quantity > 0
  AND NOT EXISTS (
    SELECT 1 FROM `inventory_stock_batches` b WHERE b.inventory_id = i.id
  );
