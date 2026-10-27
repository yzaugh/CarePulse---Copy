USE `carepulse_db`;

ALTER TABLE `users`
  MODIFY `role` enum('Admin','Physician','Patient','Receptionist','Pharmacist','InventoryManager') NOT NULL;

UPDATE `users`
SET `role` = 'InventoryManager'
WHERE `role` = 'Pharmacist';

ALTER TABLE `users`
  MODIFY `role` enum('Admin','Physician','Patient','Receptionist','InventoryManager') NOT NULL;
