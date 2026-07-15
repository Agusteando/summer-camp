CREATE TABLE IF NOT EXISTS summer_student_overrides (
  summer_year SMALLINT NOT NULL,
  matricula VARCHAR(64) NOT NULL,
  program ENUM('unassigned','husky_dreamers','clinica_futbol') NOT NULL DEFAULT 'unassigned',
  meal_plan ENUM('none','comida','cena','comida_cena','pending_one') DEFAULT NULL,
  age_override TINYINT UNSIGNED DEFAULT NULL,
  updated_by VARCHAR(255) NOT NULL DEFAULT 'anonymous',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (summer_year, matricula),
  KEY idx_summer_overrides_program (summer_year, program),
  KEY idx_summer_overrides_meal (summer_year, meal_plan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS summer_attendance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  summer_year SMALLINT NOT NULL,
  attendance_date DATE NOT NULL,
  matricula VARCHAR(64) NOT NULL,
  status ENUM('present','absent') NOT NULL,
  plantel VARCHAR(40) NOT NULL,
  actor_email VARCHAR(255) NOT NULL DEFAULT '',
  actor_name VARCHAR(255) NOT NULL DEFAULT 'Dispositivo',
  device_id VARCHAR(80) NOT NULL DEFAULT 'anonymous',
  client_timestamp DATETIME NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_summer_attendance_student_day (summer_year, attendance_date, matricula),
  UNIQUE KEY uniq_summer_attendance_idempotency (idempotency_key),
  KEY idx_summer_attendance_day_plantel (summer_year, attendance_date, plantel),
  KEY idx_summer_attendance_student (summer_year, matricula, attendance_date),
  KEY idx_summer_attendance_device (summer_year, device_id, attendance_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
