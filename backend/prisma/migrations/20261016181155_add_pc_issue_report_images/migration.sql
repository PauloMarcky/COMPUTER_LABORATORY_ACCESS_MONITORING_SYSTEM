-- CreateTable
CREATE TABLE `pc_issue_report_images` (
    `pc_issue_report_image_id` INTEGER NOT NULL AUTO_INCREMENT,
    `pc_issue_report_id` INTEGER NOT NULL,
    `image_url` VARCHAR(500) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pc_issue_report_images_pc_issue_report_id_idx`(`pc_issue_report_id`),
    PRIMARY KEY (`pc_issue_report_image_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pc_issue_report_images` ADD CONSTRAINT `pc_issue_report_images_pc_issue_report_id_fkey` FOREIGN KEY (`pc_issue_report_id`) REFERENCES `pc_issue_report`(`pc_issue_report_id`) ON DELETE CASCADE ON UPDATE CASCADE;
