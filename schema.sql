CREATE DATABASE IF NOT EXISTS musicdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE musicdb;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  artist_id VARCHAR(128) NOT NULL,
  artist_name VARCHAR(255) NOT NULL,
  artist_description TEXT,
  artist_picture TEXT,
  album_title VARCHAR(255),
  track_title VARCHAR(255),
  track_length VARCHAR(16),
  track_artwork TEXT,
  review_title VARCHAR(255) NOT NULL,
  review_description TEXT NOT NULL,
  star_rating TINYINT NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (artist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
