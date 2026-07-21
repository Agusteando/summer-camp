-- Existing installations only.
-- Replace `YOUR_DATABASE_NAME` with APP_MYSQL_DATABASE and execute manually before deploying the new application version.

ALTER TABLE `YOUR_DATABASE_NAME`.`summer_attendance_sheet`
  ADD COLUMN `attendance_type` VARCHAR(40) NOT NULL DEFAULT 'general' AFTER `student_id`,
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`summer_year`, `attendance_date`, `student_id`, `attendance_type`),
  ADD KEY `idx_summer_attendance_sheet_date_type` (`summer_year`, `attendance_date`, `attendance_type`);
