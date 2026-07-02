package migration

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"strings"

	"premark/lib"
	"premark/persist"

	"github.com/joho/godotenv"
)

// MigrateEnv checks for missing environment keys, generates secure defaults,
// and atomically appends them to the local .env file.
func MigrateEnv() error {
	envPath := persist.ExecDir(".env")

	// Attempt to load existing .env file into the process environment.
	// We ignore the error because the file might not exist yet on the first run.
	_ = godotenv.Load(envPath)

	b32s := []string{
		"ENCRYPTION_KEY",
		"AUTH_ENCRYPTION_KEY",
		"DATASET_ENCRYPTION_KEY",
		"USERDATA_ENCRYPTION_KEY",
	}
	b64s := []string{"HASH_SECRET", "JWT_SECRET"}
	var linesToAdd []string

	// Generate 32-byte keys
	for _, key := range b32s {
		if os.Getenv(key) == "" {
			val, err := generateRandomBase64(32)
			if err != nil {
				return fmt.Errorf("Failed to generate key %s: %w", key, err)
			}
			os.Setenv(key, val)
			linesToAdd = append(linesToAdd, fmt.Sprintf("%s=%s", key, val))
		}
	}

	// Generate 64-byte keys
	for _, key := range b64s {
		if os.Getenv(key) == "" {
			val, err := generateRandomBase64(64)
			if err != nil {
				return fmt.Errorf("Failed to generate key %s: %w", key, err)
			}
			os.Setenv(key, val)
			linesToAdd = append(linesToAdd, fmt.Sprintf("%s=%s", key, val))
		}
	}

	// Exit early if nothing needs to be generated
	if len(linesToAdd) == 0 {
		return nil
	}

	fmt.Println("> Generating missing environment variables...")

	// Read existing content safely
	var existingContent string
	if bytes, err := os.ReadFile(envPath); err == nil {
		existingContent = string(bytes)
	}

	// Ensure there is a newline separator if the existing file doesn't end with one
	prefix := ""
	if len(existingContent) > 0 && !strings.HasSuffix(existingContent, "\n") {
		prefix = "\n"
	}

	contentToAppend := prefix + strings.Join(linesToAdd, "\n") + "\n"
	finalContent := existingContent + contentToAppend

	// Atomically write the combined updates back to disk
	return lib.AtomicWrite(envPath, []byte(finalContent))
}

// generateRandomBase64 reads cryptographically secure bytes and encodes them to a Base64 string.
func generateRandomBase64(size int) (string, error) {
	bytes := make([]byte, size)
	if _, err := io.ReadFull(rand.Reader, bytes); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(bytes), nil
}
