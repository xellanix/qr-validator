package db

import (
	"crypto/cipher"
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"premark/persist"
	"sort"
	"strconv"

	"premark/lib"

	_ "github.com/mattn/go-sqlite3"
)

//go:embed sql/migrations
var migrationFolder embed.FS

// DB represents the global shared pool connection context handle.
var DB *sql.DB

// migrate runs the core database migration process
func migrate(version string, nextVersion int) error {
	dir := "sql/migrations/v" + version
	entries, err := migrationFolder.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("Failed to read migration directory: %w", err)
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, entry := range entries {
		path := dir + "/" + entry.Name()
		content, err := migrationFolder.ReadFile(path)
		if err != nil {
			return fmt.Errorf("Failed to read file %s: %w", entry.Name(), err)
		}

		if _, err := tx.Exec(string(content)); err != nil {
			return fmt.Errorf("Migration failed in %s: %w", entry.Name(), err)
		}
	}

	// Fast-forward straight to the target version
	if _, err := tx.Exec(fmt.Sprintf("PRAGMA user_version = %d;", nextVersion)); err != nil {
		return fmt.Errorf("Failed to execute migration query: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("Failed to commit transaction: %w", err)
	}

	return nil
}

// runMigrations runs the core database migration process
func runMigrations() error {
	var currentVersion int
	err := DB.QueryRow("PRAGMA user_version").Scan(&currentVersion)
	if err != nil {
		return err
	}

	entries, err := migrationFolder.ReadDir("sql/migrations")
	if err != nil {
		return fmt.Errorf("Failed to read migration directory: %w", err)
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	targetVer, err := strconv.Atoi(entries[len(entries)-1].Name()[1:])
	if err != nil {
		return fmt.Errorf("Failed to parse migration directory: %w", err)
	}
	if targetVer == 0 {
		targetVer = 1
	}

	if currentVersion == 0 {
		var tableExists int
		// Query SQLite's internal master table to see if the 'users' table exists
		err := DB.QueryRow("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='users'").Scan(&tableExists)
		if err != nil {
			return fmt.Errorf("Failed to check for legacy tables: %w", err)
		}

		if tableExists == 0 {
			return migrate("0", targetVer)
		} else {
			currentVersion = 1
		}
	}

	for _, entry := range entries[1:] {
		if !entry.IsDir() {
			continue
		}

		verStr := entry.Name()[1:]
		ver, err := strconv.Atoi(verStr)
		if err != nil {
			return fmt.Errorf("Failed to parse migration directory: %w", err)
		}

		// Migration to version n
		if currentVersion < ver {
			if err := migrate(verStr, ver); err != nil {
				return err
			}
		}
	}

	return nil
}

// InitDB initializes the SQLite connectivity state and runs the core structural migration tables.
func InitDB() {
	var err error

	dbPath := persist.PublicDir("app.db")
	// Ensure the parent directory tree matches disk footprints safely
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		log.Fatalf("Failed to initialize database directory: %v", err)
	}

	DB, err = sql.Open("sqlite3", dbPath+"?_foreign_keys=on&_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		log.Fatalf("Failed to execute database engine hook: %v", err)
	}

	if err := runMigrations(); err != nil {
		log.Fatalf("Migration failed: %v", err)
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
