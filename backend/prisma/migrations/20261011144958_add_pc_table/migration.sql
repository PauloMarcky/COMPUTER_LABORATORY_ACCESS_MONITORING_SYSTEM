-- CreateTable
CREATE TABLE `pcs` (
    `pc_id` INTEGER NOT NULL AUTO_INCREMENT,
    `lab_room_id` INTEGER NOT NULL,
    `pc_number` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pcs_lab_room_id_pc_number_key`(`lab_room_id`, `pc_number`),
    PRIMARY KEY (`pc_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pcs` ADD CONSTRAINT `pcs_lab_room_id_fkey` FOREIGN KEY (`lab_room_id`) REFERENCES `lab_rooms`(`lab_room_id`) ON DELETE CASCADE ON UPDATE CASCADE;
