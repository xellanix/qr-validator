package handlers

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"premark/lib"
	"premark/persist"
	"premark/sockets"

	"github.com/gofiber/fiber/v3"
)

var traversalRegex = regexp.MustCompile(`^(\.\.(\/|\\|$))+`)

// HandleServeAssets handles serving public assets
func HandleServeAssets(c fiber.Ctx) error {
	// Extract the trailing wildcard path segment (e.g., "input/dataset1.csv")
	reqPath := c.Params("*")

	// Strip leading path traversal tokens out completely
	reqPath = traversalRegex.ReplaceAllString(reqPath, "")

	// Clean the path and format backslashes uniformly to look like standard web requests
	reqPath = filepath.Clean(strings.ReplaceAll(reqPath, "\\", "/"))

	if strings.HasPrefix(reqPath, "input") {
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

		// Enforce user clearance level constraints matching GetPermissions().isUseDataset
		if !sockets.GetPermissions(user.AuthorizeLevel).IsUseDataset {
			return c.Status(fiber.StatusForbidden).SendString("Forbidden: Insufficient Permissions")
		}

		baseDir := persist.PublicDir()
		targetPath := filepath.Clean(filepath.Join(baseDir, reqPath))

		// Directory Traversal Shield: Ensure the resolved absolute path remains inside baseDir
		if !strings.HasPrefix(targetPath, baseDir) {
			return c.Status(fiber.StatusForbidden).SendString("Forbidden: Invalid Path")
		}

		// Verify file existence on disk before attempting delivery
		if _, err := os.Stat(targetPath); os.IsNotExist(err) {
			return c.Status(fiber.StatusNotFound).SendString("Not Found")
		}

		fmt.Println("File request...")
		fmt.Printf("> Request path: %s\n", reqPath)
		fmt.Printf("> Resolved path: %s\n", targetPath)

		// Stream the asset efficiently to the client browser
		return c.SendFile(targetPath)
	}

	return c.Status(fiber.StatusNotFound).SendString("Not Found: Invalid Path")
}
