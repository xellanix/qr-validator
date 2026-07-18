package sockets

import (
	"crypto/cipher"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"premark/db"
	"premark/lib"
	"premark/persist"
	"premark/types"
	"sort"
	"strings"
	"sync"

	"github.com/skip2/go-qrcode"
	"github.com/zishang520/socket.io/servers/socket/v3"
)

// Global cache instantiation handles mapping the internal data cryptos
var (
	userCryptoInstance cipher.AEAD
	userCryptoOnce     sync.Once
)

func getUserDataGCM() cipher.AEAD {
	userCryptoOnce.Do(func() {
		keyStr := os.Getenv("USERDATA_ENCRYPTION_KEY")
		keyBytes := lib.ToNonSharedBytes(keyStr, 32, false)
		inst, err := lib.NewGCMHelper(keyBytes)
		if err != nil {
			panic(err)
		}
		userCryptoInstance = inst
	})
	return userCryptoInstance
}

func executeQRGeneration(value string, projectID string) bool {
	gcm := getUserDataGCM()
	encryptedStr, err := lib.EncryptData[string](value, gcm)
	if err != nil {
		return false
	}

	outPath := persist.PublicDir("output", "presence", projectID, fmt.Sprintf("%s.png", value))
	if err := os.MkdirAll(filepath.Dir(outPath), 0755); err != nil {
		return false
	}

	// Uses standard go-qrcode engine producing explicit 1024px squares natively
	err = qrcode.WriteFile(encryptedStr, qrcode.Medium, 1024, outPath)
	return err == nil
}

func getSuccessfulDeletions(targetDir string, mustDelete []string) []string {
	err := os.RemoveAll(targetDir)
	if err == nil {
		return mustDelete
	}

	successful := mustDelete[:0]
	for _, filename := range mustDelete {
		fullpath := filepath.Join(targetDir, fmt.Sprintf("%s.png", filename))
		if _, err := os.Lstat(fullpath); os.IsNotExist(err) {
			successful = append(successful, filename)
		}
	}

	return successful
}

// getDirSize returns the total size of a directory in bytes.
func getDirSize(path string) (int64, error) {
	var size int64

	err := filepath.WalkDir(path, func(subPath string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// If it's a file, get its size and add it to the total
		if !d.IsDir() {
			info, err := d.Info()
			if err != nil {
				return err
			}
			size += info.Size()
		}

		return nil
	})

	return size, err
}

func registerPresenceHandlers(io *socket.Server, client *socket.Socket) {
	client.On("client:presence:fetch", func(args ...any) {
		if len(args) < 3 {
			return
		}
		projectID, _ := args[0].(string)
		keyStr, _ := args[1].(string)

		trimmed := strings.TrimSpace(projectID)
		if trimmed == "" {
			invokeAck(args, types.SocketResponse{Status: "error", Error: "Project identifier tracking cannot be empty."})
			return
		}

		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole {
			msg := fmt.Sprintf("Unauthorized fetch all attempt by user: %s", ctx.User.Name)
			invokeAck(args, types.SocketResponse{Status: "error", Error: msg})
			return
		}

		rows, err := db.FindDatasetRows(trimmed, true, nil)
		if err != nil {
			invokeAck(args, types.SocketResponse{Status: "error", Error: err.Error()})
			return
		}

		type PresenceItem struct {
			Key    string `json:"key"`
			Status string `json:"status"` // "generated" | "missing"
		}
		var list []PresenceItem

		for _, row := range rows {
			val := row[keyStr]
			if val == "" {
				continue
			}
			filePath := persist.PublicDir("output", "presence", trimmed, fmt.Sprintf("%s.png", val))
			status := "missing"
			if _, err := os.Stat(filePath); err == nil {
				status = "generated"
			}
			list = append(list, PresenceItem{Key: val, Status: status})
		}

		sort.Slice(list, func(i, j int) bool {
			return list[i].Key < list[j].Key
		})
		invokeAck(args, types.SocketResponse{Status: "success", Data: list})
	})

	client.On("client:presence:generate", func(args ...any) {
		if len(args) < 3 {
			return
		}
		value, _ := args[0].(string)
		projectID, _ := args[1].(string)

		trimmed := strings.TrimSpace(projectID)
		if trimmed == "" {
			invokeAck(args, types.SocketResponse{Status: "error", Error: "Project identifier tracking cannot be empty."})
			return
		}

		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole {
			invokeAck(args, types.SocketResponse{Status: "error", Error: fmt.Sprintf("Unauthorized generate attempt by user: %s", ctx.User.Name)})
			return
		}

		if !executeQRGeneration(value, trimmed) {
			invokeAck(args, types.SocketResponse{Status: "error", Error: "Error generating PNG."})
			return
		}
		invokeAck(args, types.SocketResponse{Status: "success", Data: true})
		io.To(socket.Room(ctx.UserHashBase64)).Emit("server:presence:update", "generate", value)
	})

	client.On("client:presence:generate:many", func(args ...any) {
		if len(args) < 2 {
			return
		}
		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole {
			client.Emit("server:response:error", fmt.Sprintf("Unauthorized generate attempt by user: %s", ctx.User.Name))
			return
		}

		var items []string
		rawBytes, _ := json.Marshal(args[0])
		_ = json.Unmarshal(rawBytes, &items)

		projectID, _ := args[1].(string)
		trimmed := strings.TrimSpace(projectID)
		if trimmed == "" {
			client.Emit("server:response:error", "Project identifier tracking cannot be empty.")
			return
		}

		count := 0
		for _, item := range items {
			if executeQRGeneration(item, trimmed) {
				count++
				io.To(socket.Room(ctx.UserHashBase64)).Emit("server:presence:update", "generate", item)
			}
		}
		client.Emit("server:presence:generate:done", count)
	})

	client.On("client:presence:delete:all", func(args ...any) {
		if len(args) < 2 {
			return
		}
		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole {
			client.Emit("server:response:error", fmt.Sprintf("Unauthorized delete attempt by user: %s", ctx.User.Name))
			return
		}

		var mustDelete []string
		rawBytes, _ := json.Marshal(args[0])
		_ = json.Unmarshal(rawBytes, &mustDelete)

		projectID, _ := args[1].(string)
		trimmed := strings.TrimSpace(projectID)
		if trimmed == "" {
			client.Emit("server:response:error", "Project identifier tracking cannot be empty.")
			return
		}

		projectDir := persist.PublicDir("output", "presence", projectID)
		deleted := getSuccessfulDeletions(projectDir, mustDelete)

		io.To(socket.Room(ctx.UserHashBase64)).Emit("server:presence:update", "delete", deleted)
		client.Emit("server:presence:delete:done", len(deleted))
	})

	client.On("client:presence:usage", func(args ...any) {
		if len(args) < 1 {
			return
		}
		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole {
			client.Emit("server:response:error", fmt.Sprintf("Unauthorized fetch usage attempt by user: %s", ctx.User.Name))
			return
		}

		projectID, _ := args[0].(string)
		trimmed := strings.TrimSpace(projectID)
		if trimmed == "" {
			client.Emit("server:response:error", "Project identifier tracking cannot be empty.")
			return
		}

		projectDir := persist.PublicDir("output", "presence", projectID)
		size, err := getDirSize(projectDir)
		if err != nil {
			client.Emit("server:response:error", err.Error())
			return
		}

		client.Emit("server:presence:usage:done", size)
	})
}
