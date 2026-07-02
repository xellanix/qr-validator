package handlers

import (
	"strings"
	"time"

	"premark/constants"
	"premark/db"
	"premark/lib"
	"premark/types"

	"github.com/gofiber/fiber/v3"
)

// SetSecurityCookies configures session keys atomically on the client response context.
func SetSecurityCookies(c fiber.Ctx, jwtToken string, userHash string) {
	sameSite := "Lax"
	if constants.IS_PROD {
		sameSite = "Strict"
	}

	cookieConfig := &fiber.Cookie{
		Path:     "/",
		HTTPOnly: true,
		Secure:   true,
		SameSite: sameSite,
	}

	// Clone core traits for the authentication token session lifespan
	authCookie := *cookieConfig
	authCookie.Name = "auth_token"
	authCookie.Value = jwtToken
	authCookie.Expires = time.Now().Add(24 * time.Hour)
	c.Cookie(&authCookie)

	// Clone core traits for the tracking lookups hash block
	hashCookie := *cookieConfig
	hashCookie.Name = "user_hash"
	hashCookie.Value = userHash
	hashCookie.Expires = time.Now().Add(24 * time.Hour)
	c.Cookie(&hashCookie)
}

func HandleCheckAuth(c fiber.Ctx) error {
	token := c.Cookies("auth_token")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).SendString("Unauthorized")
	}

	if _, err := lib.VerifyUserJWT(token); err != nil {
		return c.Status(fiber.StatusUnauthorized).SendString("Unauthorized")
	}

	return c.SendString("OK")
}

func HandleSignIn(c fiber.Ctx) error {
	bodyBytes := c.Body()
	if len(bodyBytes) == 0 {
		return c.Status(fiber.StatusUnauthorized).SendString("Unauthorized: Invalid User Id")
	}

	user, err := db.FindUserByToken(bodyBytes)
	if err != nil || user == nil {
		return c.Status(fiber.StatusUnauthorized).SendString("Unauthorized: Invalid User Id")
	}

	jwtStr, err := lib.GenerateUserJWT(*user)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
	}

	rawHash, err := lib.CreateSearchHash(bodyBytes)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
	}
	userHash := lib.BytesToBase64(rawHash)

	SetSecurityCookies(c, jwtStr, userHash)
	return c.SendString("OK")
}

func HandleSignUp(c fiber.Ctx) error {
	type RequestPayload struct {
		Name string `json:"name"`
	}

	var req RequestPayload
	if err := c.Bind().JSON(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Bad Request: Invalid User Name")
	}

	userIdBytes, err := db.AddUser(types.User{Name: strings.TrimSpace(req.Name), AuthorizeLevel: 3}, nil)
	if err != nil || len(userIdBytes) == 0 {
		return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
	}

	user, err := db.FindUserByToken(userIdBytes)
	if err != nil || user == nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
	}

	jwtStr, err := lib.GenerateUserJWT(*user)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
	}

	rawHash, err := lib.CreateSearchHash(userIdBytes)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
	}
	userHash := lib.BytesToBase64(rawHash)

	SetSecurityCookies(c, jwtStr, userHash)
	return c.SendString("OK")
}

func HandleSignOut(c fiber.Ctx) error {
	// Erase authentication states instantly by zeroing out lifespans
	eraseCookie := &fiber.Cookie{
		Path:     "/",
		Value:    "",
		Expires:  time.Unix(0, 0),
		HTTPOnly: true,
		Secure:   true,
	}

	authCookie := *eraseCookie
	authCookie.Name = "auth_token"
	c.Cookie(&authCookie)

	hashCookie := *eraseCookie
	hashCookie.Name = "user_hash"
	c.Cookie(&hashCookie)

	return c.SendString("OK")
}
