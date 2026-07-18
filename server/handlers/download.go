package handlers

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"premark/lib"
	"premark/persist"
	"premark/sockets"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v3"
)

type prefixValue struct {
	dir      string
	resolver func(fiber.Ctx, string, string) (string, string, error)
}

func handleDownload(c fiber.Ctx, dir string, resolver func(fiber.Ctx, string, string) (string, string, error)) error {
	// Extract the trailing wildcard path segment (e.g., "input/dataset1.csv")
	reqPath := c.Params("*")

	// Strip leading path traversal tokens out completely
	reqPath = traversalRegex.ReplaceAllString(reqPath, "")

	// Clean the path and format backslashes uniformly to look like standard web requests
	reqPath = filepath.Clean(strings.ReplaceAll(reqPath, "\\", "/"))

	// Extract verification token directly from cookies
	token := c.Cookies("auth_token")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).SendString("Unauthorized")
	}

	// Validate token signature and decrypt payload
	user, err := lib.VerifyUserJWT(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).SendString("Unauthorized")
	}

	// Enforce user clearance level constraints matching GetPermissions().CanAccessConsole
	if !sockets.GetPermissions(user.AuthorizeLevel).CanAccessConsole {
		return c.Status(fiber.StatusForbidden).SendString("Forbidden: Insufficient Permissions")
	}

	targetPath, downloadName, err := resolver(c, reqPath, dir)
	if err != nil {
		return err
	}

	// Directory Traversal Shield: Ensure the resolved absolute path remains inside dir
	if !strings.HasPrefix(targetPath, dir) {
		return c.Status(fiber.StatusForbidden).SendString("Forbidden: Invalid Path")
	}

	// Verify file existence on disk (again) before attempting delivery
	if _, err := os.Stat(targetPath); os.IsNotExist(err) {
		return c.Status(fiber.StatusNotFound).SendString("Not Found")
	}

	fmt.Println("Download request...")
	fmt.Printf("> Request path: %s\n", reqPath)
	fmt.Printf("> Resolved path: %s\n", targetPath)

	return c.Download(targetPath, downloadName)
}

func HandleUserKeyDownload(c fiber.Ctx) error {
	return handleDownload(c, persist.PublicDir("output", "users"), func(c fiber.Ctx, trimmed, dir string) (string, string, error) {
		badRequest := func() (string, string, error) {
			return "", "", c.Status(fiber.StatusBadRequest).SendString("Bad Request")
		}

		if trimmed == "" {
			return badRequest()
		}

		segments := strings.Split(trimmed, string(filepath.Separator))
		if len(segments) != 3 {
			return badRequest()
		}

		projectID, err := url.PathUnescape(segments[0])
		if err != nil {
			return badRequest()
		}
		trimmedProjectID := (strings.TrimSpace(projectID))

		name, err := url.PathUnescape(segments[1])
		if err != nil {
			return badRequest()
		}

		uniqueIndex, err := strconv.Atoi(segments[2])
		if trimmedProjectID == "" || name == "" || err != nil {
			return badRequest()
		}

		targetDir := dir
		if uniqueIndex != -1 {
			targetDir = filepath.Join(dir, trimmedProjectID)
		} else {
			uniqueIndex = 0
		}

		fullpath, err := lib.GetFileByDuplicateIndex(targetDir, name, uniqueIndex)
		if err != nil {
			return "", "", err
		}

		cleaned := filepath.Clean(fullpath)
		return cleaned, filepath.Base(cleaned), nil
	})
}

func HandlePresenceDownload(c fiber.Ctx) error {
	return handleDownload(c, persist.PublicDir("output", "presence"), func(c fiber.Ctx, trimmed, dir string) (string, string, error) {
		badRequest := func() (string, string, error) {
			return "", "", c.Status(fiber.StatusBadRequest).SendString("Bad Request")
		}

		if trimmed == "" {
			return badRequest()
		}

		segments := strings.Split(trimmed, string(filepath.Separator))
		if len(segments) != 2 {
			return badRequest()
		}

		projectID, err := url.PathUnescape(segments[0])
		if err != nil {
			return badRequest()
		}
		trimmedProjectID := (strings.TrimSpace(projectID))
		if trimmedProjectID == "" {
			return badRequest()
		}

		name, err := url.PathUnescape(segments[1])
		if err != nil || name == "" {
			return badRequest()
		}

		targetPath := filepath.Join(dir, trimmedProjectID, name+".png")

		cleaned := filepath.Clean(targetPath)
		return cleaned, filepath.Base(cleaned), nil
	})
}
