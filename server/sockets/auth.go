package sockets

import (
	"premark/lib"
	"premark/types"

	"github.com/zishang520/socket.io/servers/socket/v3"
)

func setupSocketAuth(io *socket.Server) {
	io.Use(func(client *socket.Socket, next func(*socket.ExtendedError)) {
		reqHeaders := client.Request().Request()

		authCookie, err1 := reqHeaders.Cookie("auth_token")
		hashCookie, err2 := reqHeaders.Cookie("user_hash")

		if err1 != nil || err2 != nil || authCookie.Value == "" || hashCookie.Value == "" {
			next(socket.NewExtendedError("Authentication cookie missing", nil))
			return
		}

		userProfile, err := lib.VerifyUserJWT(authCookie.Value)
		if err != nil {
			next(socket.NewExtendedError("Session expired. Please sign in again.", nil))
			return
		}

		hashBytes, err := lib.Base64ToBytes(hashCookie.Value)
		if err != nil {
			next(socket.NewExtendedError("Malformed verification signatures.", nil))
			return
		}

		// Attach operational memory structure contexts straight to custom engine contexts
		client.SetData(&types.SocketData{
			IsTrulyLocal:   lib.IsTrulyLocal(reqHeaders, client.Conn().RemoteAddress()),
			User:           userProfile,
			UserHashBytes:  hashBytes,
			UserHashBase64: hashCookie.Value,
		})
		next(nil)
	})
}

func registerAuthHandlers(client *socket.Socket) {
	client.On("client:auth:sync", func(args ...any) {
		ctx := client.Data().(*types.SocketData)
		if ctx.User != nil {
			invokeAck(args, types.SocketResponse{Status: "success", Data: ctx.User})
			return
		}
		invokeAck(args, types.SocketResponse{Status: "error", Error: "Invalid token."})
	})
}
