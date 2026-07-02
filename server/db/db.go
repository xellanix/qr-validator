package db

import (
	"crypto/cipher"
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"premark/persist"

	"premark/lib"

	_ "github.com/mattn/go-sqlite3"
)

// DB represents the global shared pool connection context handle.
var DB *sql.DB

// InitDB initializes the SQLite connectivity state and runs the core structural migration tables.
func InitDB() {
	var err error

	dbPath := persist.PublicDir("app.db")
	// Ensure the parent directory tree matches disk footprints safely
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		log.Fatalf("Failed to initialize database directory: %v", err)
	}

	DB, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatalf("Failed to execute database engine hook: %v", err)
	}

	// Turn on explicit cascading foreign key restrictions
	if _, err := DB.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		log.Fatalf("Failed to configure foreign key system pragmas: %v", err)
	}

	schema := `
	CREATE TABLE IF NOT EXISTS users (
		user_hash BLOB PRIMARY KEY,
		payload BLOB
	) WITHOUT ROWID;

	CREATE TABLE IF NOT EXISTS datasets (
		id TEXT PRIMARY KEY DEFAULT (
		  lower(
			hex(randomblob(4)) || '-' || 
			hex(randomblob(2)) || '-4' || 
			substr(hex(randomblob(2)), 2) || '-' || 
			substr('89ab', abs(randomblob(1) % 4) + 1, 1) || 
			substr(hex(randomblob(2)), 2) || '-' || 
			hex(randomblob(6))
		  )
		),
		creator_user_hash BLOB,
		payload BLOB NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (creator_user_hash) REFERENCES users (user_hash) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS dataset_rows (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		dataset_id TEXT NOT NULL,
		key_hash BLOB NOT NULL,
		payload BLOB NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
	);
	CREATE INDEX IF NOT EXISTS idx_dataset_rows_key_hash ON dataset_rows (dataset_id, key_hash);

	CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY DEFAULT (
		  	lower(
				hex(randomblob(4)) || '-' || 
				hex(randomblob(2)) || '-4' || 
				substr(hex(randomblob(2)), 2) || '-' || 
				substr('89ab', abs(randomblob(1) % 4) + 1, 1) || 
				substr(hex(randomblob(2)), 2) || '-' || 
				hex(randomblob(6))
		  	)
		),
		dataset_id TEXT,
		creator_user_hash BLOB,
		name TEXT,
		schema_objects TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (dataset_id) REFERENCES datasets (id) ON DELETE SET NULL,
		FOREIGN KEY (creator_user_hash) REFERENCES users (user_hash) ON DELETE CASCADE
	);
	CREATE INDEX IF NOT EXISTS idx_project_dataset_id ON projects (dataset_id);
	CREATE INDEX IF NOT EXISTS idx_project_user_hash ON projects (creator_user_hash);

	CREATE TABLE IF NOT EXISTS project_users (
		project_id TEXT NOT NULL,
		user_hash BLOB NOT NULL,
		PRIMARY KEY (project_id, user_hash),
		FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
		FOREIGN KEY (user_hash) REFERENCES users (user_hash) ON DELETE CASCADE
	);

	CREATE TRIGGER IF NOT EXISTS cleanup_orphaned_users
		AFTER DELETE ON project_users
		BEGIN
			DELETE FROM users
			WHERE user_hash = OLD.user_hash
			AND NOT EXISTS (SELECT 1 FROM project_users WHERE user_hash = OLD.user_hash);
		END;
	`
	if _, err := DB.Exec(schema); err != nil {
		log.Fatalf("Failed to execute data schema initialization migrations: %v", err)
	}
}

// Internal payload encryption marshalling shorthand helper
func encryptJSON[T any](v T, gcm ...cipher.AEAD) ([]byte, error) {
	bytes, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	return lib.EncryptData[[]byte](string(bytes), gcm...)
}

// Internal payload decryption unmarshalling shorthand helper
func decryptJSON[T any](combined []byte, gcm ...cipher.AEAD) (*T, error) {
	plainText, err := lib.DecryptData(combined, gcm...)
	if err != nil {
		return nil, err
	}
	var target T
	if err := json.Unmarshal([]byte(plainText), &target); err != nil {
		return nil, err
	}
	return &target, nil
}
