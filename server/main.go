package main

import (
	"embed"
	"fmt"
	"io/fs"
	"strings"

	"premark/constants"
	"premark/db"
	"premark/handlers"
	"premark/migration"
	"premark/persist"
	"premark/sockets"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/adaptor"
	"github.com/gofiber/fiber/v3/middleware/static"
)

// These variables act as receivers for compiler injection
var (
	Version = "0.0.0" // Overwritten by -X main.Version
)

// Embed the production frontend build.
//
//go:embed dist/frontend
var embeddedFrontend embed.FS

var AuthHeaders = map[string]string{}

func printAppHeader() {
	var mode string
	var port string
	if constants.IS_PROD {
		mode = "production "
		port = constants.SERVER_PORT
	} else {
		mode = "development"
		port = constants.FRONTEND_PORT
	}

	fmt.Println("┌────────────────────────────────┐")
	fmt.Println("│ Xellanix PreMark               │")
	{
		len := 22 - len(Version)
		fmt.Printf("│ Version %s%s │\n", Version, strings.Repeat(" ", len))
	}
	fmt.Println("├────────────────────────────────┤")
	fmt.Printf("│ Server: http://localhost:%s │\n", constants.SERVER_PORT)
	fmt.Printf("│ Mode  : %s            │\n", mode)
	fmt.Println("└────────────────────────────────┘")

	fmt.Println("📂 Directories")
	fmt.Println("> Execution:", persist.ExecDir())
	fmt.Println("> Public   :", persist.PublicDir())
	fmt.Println("")
	fmt.Println("🔗 Pages (URLs)")
	fmt.Println("> Home   :", "http://localhost:"+port)
	fmt.Println("> Console:", "http://localhost:"+port+"/console")
	fmt.Println("")
}

func init() {
	printAppHeader()
	migration.StartMigration()

	if !constants.IS_PROD {
		// Populate development CORS values matching your original config
		AuthHeaders["Access-Control-Allow-Origin"] = "http://localhost:" + constants.FRONTEND_PORT
		AuthHeaders["Access-Control-Allow-Credentials"] = "true"
		AuthHeaders["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
		AuthHeaders["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
		AuthHeaders["Access-Control-Max-Age"] = "7200"
	}
}

func main() {
	// Fire up database connection handles
	db.InitDB()

	// Initialize the custom Socket.IO Server Engine
	io := sockets.InitSocketServer()

	app := fiber.New()

	// Replicate programmatic development CORS strategies
	if !constants.IS_PROD {
		app.Use(func(c fiber.Ctx) error {
			// Inject the explicit Auth Headers into every response
			for key, value := range AuthHeaders {
				c.Set(key, value)
			}

			if c.Method() == fiber.MethodOptions {
				return c.SendStatus(fiber.StatusOK) // Returns 200 OK with the headers attached
			}

			// Continue down the execution line to your actual handlers
			return c.Next()
		})
	}

	// Mount migrated service paths
	app.Get("/auth/signin", handlers.HandleCheckAuth)
	app.Post("/auth/signin", handlers.HandleSignIn)
	app.Post("/auth/signout", handlers.HandleSignOut)
	app.Post("/auth/signup", handlers.HandleSignUp)

	app.Post("/api/dataset/submit", handlers.HandleSubmitCSV)
	app.Post("/api/dataset/extract", handlers.HandleExtractCSVColumns)

	app.Get("/api/download/user/*", handlers.HandleUserKeyDownload)
	app.Get("/api/download/presence/*", handlers.HandlePresenceDownload)

	// Mount the Socket.IO Web server handler using a standard HTTP request context proxy adaptor
	socketHandler := adaptor.HTTPHandler(io.ServeHandler(nil))
	app.All("/api/socket_io", socketHandler)
	app.All("/api/socket_io/*", socketHandler)

	// Mount static assets
	app.Get("/api/assets/*", handlers.HandleServeAssets)

	if constants.IS_PROD {
		// Strip the outer "dist/frontend" directory prefix from the embedded structure paths
		frontendFS, err := fs.Sub(embeddedFrontend, "dist/frontend")
		if err != nil {
			panic(fmt.Sprintf("Failed initializing embedded asset sub-tree: %v", err))
		}

		// Cache index.html securely into RAM for fast Single Page Application fallback delivery
		indexBytes, err := fs.ReadFile(frontendFS, "index.html")
		if err != nil {
			panic(fmt.Sprintf("Missing index.html footprint inside embedded build: %v", err))
		}

		// Serve asset requests (JS, CSS, images) straight out of the binary via static middleware
		app.Get("/*", static.New("", static.Config{
			FS: frontendFS,
		}))

		// Single unified handler: Serves real assets if they exist, otherwise serves index.html
		app.Get("/*", static.New("", static.Config{
			FS: frontendFS,
			NotFoundHandler: func(c fiber.Ctx) error {
				c.Set(fiber.HeaderContentType, fiber.MIMETextHTMLCharsetUTF8)
				return c.Send(indexBytes)
			},
		}))
	} else {
		app.Get("/*", func(c fiber.Ctx) error {
			return c.Status(fiber.StatusOK).SendString(
				"Go Backend: Running in DEV mode. Please use the Vite dev server to view the frontend.",
			)
		})
	}

	// Fallback route for invalid paths
	app.Use(func(c fiber.Ctx) error {
		return c.Status(fiber.StatusNotFound).SendString("Not Found: Invalid Path")
	})

	_ = app.Listen(":"+constants.SERVER_PORT, fiber.ListenConfig{
		DisableStartupMessage: true,
	})
}
