package db

import (
	"crypto/cipher"
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"premark/lib"
	"premark/persist"
	"premark/types"
)

var (
	authGCMInstance cipher.AEAD
	authGCMOnce     sync.Once
	authGCMErr      error
)

type filePayload struct {
	Name       string
	TokenBytes []byte
}

const addUserQuery = "INSERT OR IGNORE INTO users (user_hash, payload) VALUES (?, ?)"
const findUserByTokenQuery = "SELECT payload FROM users WHERE user_hash = ?"
const deleteUserByTokenQuery = "DELETE FROM users WHERE user_hash = ?"
const getProjectCreatorForUserQuery = "SELECT pu.project_id, p.creator_user_hash FROM project_users pu JOIN projects p ON pu.project_id = p.id WHERE pu.user_hash = ?"

func getAuthGCM() (cipher.AEAD, error) {
	authGCMOnce.Do(func() {
		keyStr := os.Getenv("AUTH_ENCRYPTION_KEY")
		keyBytes := lib.ToNonSharedBytes(keyStr, 32, false)
		authGCMInstance, authGCMErr = lib.NewGCMHelper(keyBytes)
	})
	return authGCMInstance, authGCMErr
}

func writeTokenFile(name string, tokenBytes []byte, projectId string) error {
	now := time.Now()
	timemark := fmt.Sprintf("%04d%02d%02d%02d%02d%02d%03d",
		now.Year(), int(now.Month()), now.Day(),
		now.Hour(), now.Minute(), now.Second(),
		now.Nanosecond()/1e6,
	)
	randVal, _ := rand.Int(rand.Reader, big.NewInt(1000))
	timemark += randVal.String()

	reg := regexp.MustCompile(`[^a-zA-Z0-9]`)
	fileName := fmt.Sprintf("%s_%s.key", strings.ToLower(reg.ReplaceAllString(name, "_")), timemark)

	// Utilizes PublicDir from previous persist steps
	outPath := persist.PublicDir("output", "users", projectId, fileName)
	if err := os.MkdirAll(filepath.Dir(outPath), 0755); err != nil {
		return err
	}
	return os.WriteFile(outPath, tokenBytes, 0644)
}

func CreateUserHash(user types.User) ([]byte, []byte, string, error) {
	authGcm, err := getAuthGCM()
	if err != nil {
		return nil, nil, "", err
	}
	tokenBytes, err := encryptJSON(user, authGcm)
	if err != nil {
		return nil, nil, "", err
	}
	token := lib.BytesToBase64(tokenBytes)
	hash, err := lib.CreateSearchHash(tokenBytes)
	if err != nil {
		return nil, nil, "", err
	}
	return hash, tokenBytes, token, nil
}

func AddUser(user any, optionalPayload []byte) ([]byte, error) {
	// If payload is provided explicitly, 'user' parameter behaves as raw user_hash input
	if len(optionalPayload) > 0 {
		hash, ok := user.([]byte)
		if !ok {
			return nil, errors.New("Invalid user_hash type assertion mapping")
		}
		res, err := DB.Exec(addUserQuery, hash, optionalPayload)
		if err != nil {
			return nil, err
		}
		if changes, _ := res.RowsAffected(); changes == 0 {
			return nil, nil
		}
		return hash, nil
	}

	// Fallback path: 'user' is the primary User layout struct
	u, ok := user.(types.User)
	if !ok {
		return nil, errors.New("Invalid User object mapping structural type")
	}

	hash, tokenBytes, token, err := CreateUserHash(u)
	if err != nil {
		return nil, err
	}

	payloadMap := map[string]string{"token": token}
	payload, err := encryptJSON(payloadMap) // Evaluates using fallback engine default key
	if err != nil {
		return nil, err
	}

	res, err := DB.Exec(addUserQuery, hash, payload)
	if err != nil {
		return nil, err
	}
	if changes, _ := res.RowsAffected(); changes == 0 {
		return nil, nil
	}

	if err := writeTokenFile(u.Name, tokenBytes, ""); err != nil {
		return nil, err
	}
	return tokenBytes, nil
}

func AddUsers(users []types.User, projectId string) ([][]byte, [][]byte, error) {
	tx, err := DB.Begin()
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback()

	var filePayloads []filePayload
	var hashes [][]byte
	var tokensBytes [][]byte

	stmt, err := tx.Prepare(addUserQuery)
	if err != nil {
		return nil, nil, err
	}
	defer stmt.Close()

	for _, u := range users {
		hash, tokenBytes, token, err := CreateUserHash(u)
		if err != nil {
			return nil, nil, err
		}

		payloadMap := map[string]string{"token": token}
		payload, err := encryptJSON(payloadMap)
		if err != nil {
			return nil, nil, err
		}

		filePayloads = append(filePayloads, filePayload{Name: u.Name, TokenBytes: tokenBytes})
		hashes = append(hashes, hash)

		if _, err := stmt.Exec(hash, payload); err != nil {
			return nil, nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, nil, err
	}

	for _, fp := range filePayloads {
		if err := writeTokenFile(fp.Name, fp.TokenBytes, projectId); err != nil {
			return nil, nil, err
		}
		tokensBytes = append(tokensBytes, fp.TokenBytes)
	}

	return tokensBytes, hashes, nil
}

func GetUser(payload []byte) (*types.User, error) {
	type TokenWrapper struct {
		Token string `json:"token"`
	}
	wrapper, err := decryptJSON[TokenWrapper](payload)
	if err != nil || wrapper == nil || wrapper.Token == "" {
		return nil, err
	}

	tokenBytes, err := lib.Base64ToBytes(wrapper.Token)
	if err != nil {
		return nil, err
	}

	authGcm, err := getAuthGCM()
	if err != nil {
		return nil, err
	}
	return decryptJSON[types.User](tokenBytes, authGcm)
}

func FindUserByToken(rawToken any) (*types.User, error) {
	hash, err := lib.CreateSearchHash(rawToken)
	if err != nil {
		return nil, err
	}

	var payload []byte
	err = DB.QueryRow(findUserByTokenQuery, hash).Scan(&payload)
	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, err
	}

	return GetUser(payload)
}

func RemoveUserByToken(rawToken any) (bool, error) {
	hash, err := lib.CreateSearchHash(rawToken)
	if err != nil {
		return false, err
	}
	res, err := DB.Exec(deleteUserByTokenQuery, hash)
	if err != nil {
		return false, err
	}
	count, err := res.RowsAffected()
	return count > 0, err
}

func RemoveUserByFile(filePath string) (bool, error) {
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		return false, nil
	}
	return RemoveUserByToken(bytes)
}

func GetProjectCreatorForUser(userHash []byte) (string, []byte, error) {
	var pID string
	var creatorHash []byte

	err := DB.QueryRow(getProjectCreatorForUserQuery, userHash).Scan(&pID, &creatorHash)
	if err == sql.ErrNoRows {
		return "", nil, nil
	}
	return pID, creatorHash, err
}
