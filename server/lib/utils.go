package lib

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"sync"
)

var (
	gcmInstance cipher.AEAD
	gcmOnce     sync.Once
	gcmErr      error

	hashSecretKey     []byte
	hashSecretKeyOnce sync.Once
)

// BytesToBase64 encodes a byte slice into a standard Base64 string.
func BytesToBase64(data []byte) string {
	return base64.StdEncoding.EncodeToString(data)
}

// Base64ToBytes decodes a standard Base64 string back into a byte slice.
func Base64ToBytes(data string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(data)
}

// ToNonSharedBytes verifies that the base64 input matches the expected byte length.
// If verification fails, it either panics (if panicOnError is true) or forcefully terminates the process.
func ToNonSharedBytes(data string, length int, panicOnError bool) []byte {
	if data == "" {
		errorMsg := "Error: Missing data. Force exit with code (1)."
		if panicOnError {
			panic(errorMsg)
		}
		fmt.Fprintln(os.Stderr, errorMsg)
		os.Exit(1)
	}

	decoded, err := Base64ToBytes(data)
	if err != nil || len(decoded) != length {
		actualLen := -1
		if err == nil {
			actualLen = len(decoded)
		}
		errorMsg := fmt.Sprintf("Error: Expected %d bytes, but got %d. Force exit with code (1).", length, actualLen)
		if panicOnError {
			panic(errorMsg)
		}
		fmt.Fprintln(os.Stderr, errorMsg)
		os.Exit(1)
	}

	return decoded
}

// NewGCMHelper is a convenience factory to build a custom cipher.AEAD from raw bytes.
func NewGCMHelper(key []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("Failed to initialize AES cipher: %w", err)
	}
	return cipher.NewGCM(block)
}

// getDefaultGCM initializes the global AES-GCM cipher block using the environment's ENCRYPTION_KEY.
func getDefaultGCM() (cipher.AEAD, error) {
	gcmOnce.Do(func() {
		keyStr := os.Getenv("ENCRYPTION_KEY")
		keyBytes := ToNonSharedBytes(keyStr, 32, false)
		gcmInstance, gcmErr = NewGCMHelper(keyBytes)
	})
	return gcmInstance, gcmErr
}

// EncryptData encrypts plaintext via AES-GCM and prepends the 12-byte IV to the returned payload.
// It uses generics to return either a base64 string or raw []byte.
// It accepts an optional variadic key; if not provided, it falls back to ENCRYPTION_KEY.
func EncryptData[T string | []byte](plainText string, gcm ...cipher.AEAD) (T, error) {
	var aesgcm cipher.AEAD
	var err error
	var zero T // Used to inspect the requested return type

	// Resolve AEAD block: Use passed GCM instance, or fallback to global default
	if len(gcm) > 0 && gcm[0] != nil {
		aesgcm = gcm[0]
	} else {
		aesgcm, err = getDefaultGCM()
		if err != nil {
			return zero, err
		}
	}

	// Create a 12-byte initialization vector (Nonce)
	iv := make([]byte, aesgcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return zero, err
	}

	// Passing 'iv' as the first argument (dst) directs Seal to append
	// the payload directly to the IV, prepending it perfectly.
	combined := aesgcm.Seal(iv, iv, []byte(plainText), nil)

	// Handle generic return types using a type assertion bypass
	var result any
	switch any(zero).(type) {
	case string:
		result = BytesToBase64(combined)
	case []byte:
		result = combined
	}

	return result.(T), nil
}

// DecryptData slices the first 12 bytes away as the IV to decode your data payload.
// It accepts either a base64 string or raw []byte as input.
// It accepts an optional variadic key; if not provided, it falls back to ENCRYPTION_KEY.
func DecryptData(combinedInput any, gcm ...cipher.AEAD) (string, error) {
	var combined []byte
	var err error

	// Resolve union input type (string vs []byte)
	switch v := combinedInput.(type) {
	case string:
		combined, err = Base64ToBytes(v)
		if err != nil {
			return "", fmt.Errorf("decrypt: Failed to decode base64 input: %w", err)
		}
	case []byte:
		combined = v
	default:
		return "", fmt.Errorf("decrypt: Unsupported input type %T", combinedInput)
	}

	// Resolve AEAD block: Use passed GCM instance, or fallback to global default
	var aesgcm cipher.AEAD
	if len(gcm) > 0 && gcm[0] != nil {
		aesgcm = gcm[0]
	} else {
		aesgcm, err = getDefaultGCM()
		if err != nil {
			return "", err
		}
	}

	// Extract IV and decrypt
	ivSize := aesgcm.NonceSize()
	if len(combined) < ivSize {
		return "", errors.New("decrypt: Data payload is too short")
	}

	// Unpack IV and Ciphertext allocations
	iv := combined[:ivSize]
	ciphertext := combined[ivSize:]

	plainBytes, err := aesgcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		fmt.Fprintln(os.Stderr, "Decryption failed! The key might be wrong or data is tampered with.")
		return "", err
	}

	return string(plainBytes), nil
}

// CreateSearchHash signs searching content inputs using a base64-configured HASH_SECRET.
// It accepts either a base64 string or a raw []byte slice.
func CreateSearchHash(input any) ([]byte, error) {
	// Thread-safely initialize the 64-byte key once
	hashSecretKeyOnce.Do(func() {
		secretStr := os.Getenv("HASH_SECRET")
		hashSecretKey = ToNonSharedBytes(secretStr, 64, false)
	})

	// Resolve the input union type
	var bytes []byte
	var err error

	switch v := input.(type) {
	case string:
		// If it's a string, assume it's base64 and decode it
		bytes, err = Base64ToBytes(v)
		if err != nil {
			return nil, fmt.Errorf("createSearchHash: Failed to decode base64 input: %w", err)
		}
	case []byte:
		// If it's already a byte slice, use it directly
		bytes = v
	default:
		return nil, fmt.Errorf("createSearchHash: Unsupported input type %T (expected string or []byte)", input)
	}

	// 3. Compute the HMAC-SHA256 hash
	mac := hmac.New(sha256.New, hashSecretKey)
	mac.Write(bytes)

	// mac.Sum(nil) returns the raw []byte
	return mac.Sum(nil), nil
}

// splitHostPort splits a network address into host and port.
// If the address doesn't have a port, it returns the original address.
func splitHostPort(addr string) string {
	// Strip the connection port out from incoming network context details
	host, _, err := net.SplitHostPort(addr)
	if err == nil {
		return host
	} else {
		// Fallback if addr doesn't have a port (e.g., in some test environments)
		return addr
	}

}

// IsTrulyLocal checks if the request is originating locally without any proxy/tunnel headers.
// If an explicit ip string is provided, it will fallback to it if the request remote address is empty.
func IsTrulyLocal(req *http.Request, explicitIP ...string) bool {
	if req == nil {
		return false
	}

	// Extract the IP address
	var ip string
	if req.RemoteAddr != "" {
		ip = splitHostPort(req.RemoteAddr)
	}

	// Fallback to explicit IP if req.RemoteAddr was empty
	if ip == "" && len(explicitIP) > 0 {
		ip = splitHostPort(explicitIP[0])
	}

	// Map equivalent local routing structures
	isLocalIP := ip == "127.0.0.1" || ip == "::1" || ip == "::ffff:127.0.0.1"
	if !isLocalIP {
		return false
	}

	// Reverse proxy headers to cross-examine
	proxyHeaders := []string{
		"X-Forwarded-For",
		"X-Real-Ip",
		"Cf-Connecting-Ip",
		"True-Client-Ip",
		"Fastly-Client-Ip",
		"X-Cluster-Client-Ip",
		"X-Forwarded",
		"Forwarded-For",
		"Forward", // Maintained typo fallback from original codebase
		"Ngrok-Skip-Browser-Warning",
	}

	// Go's req.Header.Get automatically handles canonical case-insensitivity formatting
	for _, header := range proxyHeaders {
		if req.Header.Get(header) != "" {
			return false
		}
	}

	// It is only "True Local" if it has a Local IP AND No Proxy Headers
	return true
}

// AtomicWrite writes data to a temp file first, then swaps it via os.Rename to prevent partial writes.
func AtomicWrite(destPath string, data []byte) error {
	// Create the temporary path in the same directory to guarantee they're on the same drive partition
	tmpPath := destPath + ".tmp"

	// Write out the complete payload to the temp file
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("Failed to write temp file: %w", err)
	}

	// Atomic filesystem swap replaces the old file or creates it cleanly
	if err := os.Rename(tmpPath, destPath); err != nil {
		// Clean up the temporary file if the rename step fails
		_ = os.Remove(tmpPath)
		return fmt.Errorf("Failed to rename temp file: %w", err)
	}

	return nil
}
