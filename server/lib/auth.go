package lib

import (
	"errors"
	"os"
	"sync"
	"time"

	"premark/types"

	"github.com/golang-jwt/jwt/v5"
)

var (
	jwtSecretKey     []byte
	jwtSecretKeyOnce sync.Once
)

// UserClaims defines the structured verification signature mapping your User model.
type UserClaims struct {
	Name           string `json:"name"`
	AuthorizeLevel int    `json:"authorizeLevel"`
	jwt.RegisteredClaims
}

func getJWTSecret() []byte {
	jwtSecretKeyOnce.Do(func() {
		secretStr := os.Getenv("JWT_SECRET")
		jwtSecretKey = ToNonSharedBytes(secretStr, 64, false)
	})
	return jwtSecretKey
}

// GenerateUserJWT signs a new token containing user permissions expiring in 2 hours.
func GenerateUserJWT(user types.User) (string, error) {
	claims := UserClaims{
		Name:           user.Name,
		AuthorizeLevel: user.AuthorizeLevel,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(2 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(getJWTSecret())
}

// VerifyUserJWT checks structural validity and returns verified claims payload definitions.
func VerifyUserJWT(tokenStr string) (*types.User, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &UserClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method configuration context")
		}
		return getJWTSecret(), nil
	})

	if err != nil || !token.Valid {
		return nil, errors.New("unauthorized: invalid or expired token context signature")
	}

	claims, ok := token.Claims.(*UserClaims)
	if !ok {
		return nil, errors.New("unauthorized: invalid claims conversion payload shape")
	}

	return &types.User{
		Name:           claims.Name,
		AuthorizeLevel: claims.AuthorizeLevel,
	}, nil
}
