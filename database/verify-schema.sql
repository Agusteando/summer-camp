-- Replace `YOUR_DATABASE_NAME` with APP_MYSQL_DATABASE.

SHOW CREATE TABLE `YOUR_DATABASE_NAME`.`summer_attendance_sheet`;

SELECT
  `summer_year`,
  `attendance_date`,
  `student_id`,
  `status`,
  `plantel`,
  `actor_name`,
  `device_id`,
  `client_timestamp`,
  `idempotency_key`,
  `created_at`,
  `updated_at`
FROM `YOUR_DATABASE_NAME`.`summer_attendance_sheet`
LIMIT 0;
