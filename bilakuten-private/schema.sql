-- Import into the database supplied by Simply. Does not create or drop databases.
CREATE TABLE IF NOT EXISTS bk_bookings (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 reference CHAR(13) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 service VARCHAR(32) NOT NULL,
 date DATE NOT NULL,
 time CHAR(5) NOT NULL,
 name VARCHAR(100) NOT NULL,
 phone VARCHAR(25) NOT NULL,
 email VARCHAR(160) NOT NULL DEFAULT '',
 registration VARCHAR(12) NOT NULL,
 message TEXT NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'pending',
 created_at DATETIME NOT NULL,
 updated_at DATETIME NOT NULL,
 UNIQUE KEY bk_request_unique (request_id),
 UNIQUE KEY bk_reference_unique (reference),
 KEY bk_status_date (status,date,time),
 KEY bk_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bk_sessions (
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 auth_tag CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 expires_at BIGINT UNSIGNED NOT NULL,
 KEY bk_session_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bk_rate_limits (
 bucket_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 attempts INT UNSIGNED NOT NULL DEFAULT 0,
 expires_at BIGINT UNSIGNED NOT NULL,
 KEY bk_rate_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bk_meta (
 setting_name VARCHAR(64) NOT NULL PRIMARY KEY,
 setting_value VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO bk_meta (setting_name,setting_value) VALUES ('schema_version','1')
ON DUPLICATE KEY UPDATE setting_value=setting_value;
