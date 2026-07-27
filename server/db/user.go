package db

import (
	"crypto/cipher"
	"crypto/rand"
	"database/sql"
	"embed"
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
	Name     string
	UserHash []byte
}

//go:embed sql/queries/users
var usersQueries embed.FS

func getAuthGCM() (cipher.AEAD, error) {
	authGCMOnce.Do(func() {
		keyStr := os.Getenv("AUTH_ENCRYPTION_KEY")
		keyBytes := lib.ToNonSharedBytes(keyStr, 32, false)
		authGCMInstance, authGCMErr = lib.NewGCMHelper(keyBytes)
	})
	return authGCMInstance, authGCMErr
}

func writeUserHashFile(name string, hash []byte, projectId string) error {
	now := time.Now()
	randVal, _ := rand.Int(rand.Reader, big.NewInt(1000))
	timemark := fmt.Sprintf("%04d%02d%02d%02d%02d%02d%03d%03d",
		now.Year(), int(now.Month()), now.Day(),
		now.Hour(), now.Minute(), now.Second(),
		now.Nanosecond()/1e6,
		randVal.Int64(),
	)

	reg := regexp.MustCompile(`[^a-zA-Z0-9]`)
	fileName := fmt.Sprintf("%s_%s_v2.key", strings.ToLower(reg.ReplaceAllString(name, "_")), timemark)

	// Utilizes PublicDir from previous persist steps
	outPath := persist.PublicDir("output", "users", projectId, fileName)
	if err := os.MkdirAll(filepath.Dir(outPath), 0755); err != nil {
		return err
	}
	return os.WriteFile(outPath, hash, 0644)
}

func CreateUserToken(user types.User) ([]byte, string, error) {
	user.Hash = ""
	authGcm, err := getAuthGCM()
	if err != nil {
		return nil, "", err
	}
	tokenBytes, err := encryptJSON(user, authGcm)
	if err != nil {
		return nil, "", err
	}
	token := lib.BytesToBase64(tokenBytes)
	return tokenBytes, token, nil
}

func CreateUserHash(user types.User) ([]byte, string, error) {
	tokenBytes, token, err := CreateUserToken(user)
	if err != nil {
		return nil, "", err
	}
	hash, err := lib.CreateSearchHash(tokenBytes)
	if err != nil {
		return nil, "", err
	}
	return hash, token, nil
}

func AddUser(user types.User) ([]byte, error) {
	hash, token, err := CreateUserHash(user)
	if err != nil {
		return nil, err
	}

	payloadMap := map[string]string{"token": token}
	payload, err := encryptJSON(payloadMap) // Evaluates using fallback engine default key
	if err != nil {
		return nil, err
	}

	query, err := usersQueries.ReadFile("sql/queries/users/add.sql")
	if err != nil {
		return nil, err
	}
	res, err := DB.Exec(string(query), hash, payload)
	if err != nil {
		return nil, err
	}
	if changes, _ := res.RowsAffected(); changes == 0 {
		return nil, nil
	}

	if err := writeUserHashFile(user.Name, hash, ""); err != nil {
		return nil, err
	}
	return hash, nil
}

func AddUsers(users []types.User, projectId string) ([][]byte, error) {
	tx, err := DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var filePayloads []filePayload
	var hashes [][]byte

	query, err := usersQueries.ReadFile("sql/queries/users/add.sql")
	if err != nil {
		return nil, err
	}
	stmt, err := tx.Prepare(string(query))
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	for _, u := range users {
		hash, token, err := CreateUserHash(u)
		if err != nil {
			return nil, err
		}

		payloadMap := map[string]string{"token": token}
		payload, err := encryptJSON(payloadMap)
		if err != nil {
			return nil, err
		}

		filePayloads = append(filePayloads, filePayload{Name: u.Name, UserHash: hash})

		if _, err := stmt.Exec(hash, payload); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	for _, fp := range filePayloads {
		if err := writeUserHashFile(fp.Name, fp.UserHash, projectId); err != nil {
			return nil, err
		}
		hashes = append(hashes, fp.UserHash)
	}

	return hashes, nil
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

func FindUserByHash(hash []byte) (*types.User, error) {
	query, err := usersQueries.ReadFile("sql/queries/users/find_by_token.sql")
	if err != nil {
		return nil, err
	}

	var payload []byte
	err = DB.QueryRow(string(query), hash).Scan(&payload)
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
	query, err := usersQueries.ReadFile("sql/queries/users/delete_by_token.sql")
	if err != nil {
		return false, err
	}
	res, err := DB.Exec(string(query), hash)
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
