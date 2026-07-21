-- Summer Camp attendance schema
-- Execute this file manually with a DBA/provisioning account authorized for DDL.
-- Replace `YOUR_DATABASE_NAME` with the value of APP_MYSQL_DATABASE.

CREATE TABLE `YOUR_DATABASE_NAME`.`summer_attendance_sheet` (
  `summer_year` SMALLINT UNSIGNED NOT NULL,
  `attendance_date` DATE NOT NULL,
  `student_id` VARCHAR(120) NOT NULL,
  `attendance_type` VARCHAR(40) NOT NULL DEFAULT 'general',
  `status` ENUM('present', 'absent') NOT NULL,
  `plantel` VARCHAR(20) NOT NULL,
  `actor_name` VARCHAR(160) NOT NULL DEFAULT '',
  `device_id` VARCHAR(120) NOT NULL,
  `client_timestamp` DATETIME NOT NULL,
  `idempotency_key` VARCHAR(160) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`summer_year`, `attendance_date`, `student_id`, `attendance_type`),
  KEY `idx_summer_attendance_sheet_idempotency` (`idempotency_key`),
  KEY `idx_summer_attendance_sheet_date` (`summer_year`, `attendance_date`),
  KEY `idx_summer_attendance_sheet_date_type` (`summer_year`, `attendance_date`, `attendance_type`),
  KEY `idx_summer_attendance_sheet_plantel` (`summer_year`, `plantel`, `attendance_date`)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Optional: grant only the DML privileges used by the application.
-- Replace the database, user and host placeholders before executing.
-- GRANT SELECT, INSERT, UPDATE, DELETE
--   ON `YOUR_DATABASE_NAME`.`summer_attendance_sheet`
--   TO 'YOUR_APP_USER'@'YOUR_APP_HOST';
