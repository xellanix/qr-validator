package sockets

import (
	"fmt"
	"os"
	"premark/constants"
	"premark/types"

	"github.com/zishang520/socket.io/servers/engine/v3/transports"
	"github.com/zishang520/socket.io/servers/socket/v3"
	io_types "github.com/zishang520/socket.io/v3/pkg/types"
)

func InitSocketServer() *socket.Server {
	// Initialize history variables out from local storage files
	initializeHistory()

	io := socket.NewServer(nil, nil)

	// Set path variable options matching TypeScript configuration details
	io.Opts().SetPath("/api/socket_io/")
	io.Opts().SetTransports(io_types.NewSet[transports.TransportCtor](&transports.WebSocketBuilder{}))

	var origin string
	if !constants.IS_PROD {
		origin = "http://localhost:" + constants.FRONTEND_PORT

	} else {
		origin = "http://localhost:" + constants.SERVER_PORT
	}
	io.Opts().SetCors(&io_types.Cors{
		Origin:      origin,
		Methods:     []string{"GET", "POST"},
		Credentials: true,
	})

	// Intercept and print failed handshake connection attempts
	io.On("connection_error", func(args ...any) {
		if len(args) > 0 {
			errData, ok := args[0].(map[string]any)
			if ok {
				fmt.Printf("⚠️ Socket connection refused: Code=%v, Message=%v\n", errData["code"], errData["message"])
			} else {
				fmt.Printf("⚠️ Socket connection refused with arguments: %v\n", args)
			}
		}
	})

	// Mount core security checks connection interceptors
	setupSocketAuth(io)

	// Bind public events listener managers
	io.On("connection", func(args ...any) {
		client := args[0].(*socket.Socket)
		ctx := client.Data().(*types.SocketData)

		fmt.Printf("✅ Client connected   : %s [%s]\n", client.Id(), client.Conn().Transport().Name())

		// Emit structural device identifier signals cleanly
		deviceName, _ := os.Hostname()
		client.Emit("server:socket:device:info", map[string]any{
			"isTrulyLocal": ctx.IsTrulyLocal,
			"name":         deviceName,
		})

		// Route module listeners mappings blocks
		registerAuthHandlers(client)
		registerPresenceHandlers(io, client)
		registerProjectHandlers(io, client)
		registerDatasetHandlers(client)
		registerHistoryHandlers(io, client)
		registerSecurityHandlers(client)
		registerReportHandlers(client)

		client.On("disconnect", func(args ...any) {
			fmt.Printf("❌ Client disconnected: %s\n", client.Id())
		})
	})

	return io
}

// GetPermissions evaluates functional permission scopes according to user clearance profiles.
func GetPermissions(level int) types.Permissions {
	return types.Permissions{
		IsUseDataset:     level >= 2,
		CanAccessConsole: level >= 3,
		CanScan:          level >= 1,
		CanDelete:        level >= 2,
		CanReport:        level >= 2,
	}
}

// InvokeAck parses out and calls the client acknowledgment function if present in arguments.
func invokeAck(args []any, response types.SocketResponse) {
	if len(args) == 0 {
		return
	}
	// The Socket.IO library attaches client acknowledgement callbacks at the end of the variadic args slice
	lastArg := args[len(args)-1]

	// Try the standard function signature used by github.com/zishang520/socket.io
	if cb, ok := lastArg.(func([]any, error)); ok {
		cb([]any{response}, nil)
		return
	}

	// Fallback check for standard variadic signatures just in case
	if cb, ok := lastArg.(func(...any)); ok {
		cb(response)
		return
	}
}
