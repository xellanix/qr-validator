package sockets

import (
	"fmt"
	"premark/lib"
	"premark/types"

	"github.com/zishang520/socket.io/servers/socket/v3"
)

func decryptUserData(dataStr string) (string, error) {
	gcm := getUserDataGCM()
	return lib.DecryptData(dataStr, gcm)
}

func registerSecurityHandlers(client *socket.Socket) {
	client.On("client:security:decrypt", func(args ...any) {
		if len(args) < 2 {
			return
		}
		dataStr, _ := args[0].(string)
		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanScan {
			msg := fmt.Sprintf("Unauthorized decryption attempt by user: %s", ctx.User.Name)
			invokeAck(args, types.SocketResponse{Status: "error", Error: msg})
			return
		}

		decrypted, err := decryptUserData(dataStr)
		if err != nil {
			invokeAck(args, types.SocketResponse{Status: "error", Error: "Decryption failed."})
			return
		}
		invokeAck(args, types.SocketResponse{Status: "success", Data: decrypted})
	})
}
