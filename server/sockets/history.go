package sockets

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"premark/db"
	"premark/lib"
	"premark/persist"
	"premark/types"
	"sync"
	"time"

	"github.com/zishang520/socket.io/servers/socket/v3"
)

var (
	historyPath = persist.PublicDir("output", "history.json")

	// Thread-safe slice structures representing operational logs scan items.
	historyMu     sync.RWMutex
	scanHistory   []*types.ScanEntry
	isWriting     bool
	needsWriteOut bool
)

func initializeHistory() {
	bytesData, err := os.ReadFile(historyPath)
	if err != nil {
		return
	}
	historyMu.Lock()
	_ = json.Unmarshal(bytesData, &scanHistory)
	historyMu.Unlock()
}

func syncHistoryToDisk() {
	historyMu.Lock()
	if isWriting {
		needsWriteOut = true
		historyMu.Unlock()
		return
	}
	isWriting = true
	payload, err := json.MarshalIndent(scanHistory, "", "  ")
	historyMu.Unlock()

	if err == nil {
		_ = os.MkdirAll(filepath.Dir(historyPath), 0755)
		_ = lib.AtomicWrite(historyPath, payload)
	}

	historyMu.Lock()
	isWriting = false
	again := needsWriteOut
	if again {
		needsWriteOut = false
	}
	historyMu.Unlock()

	if again {
		syncHistoryToDisk()
	}
}

func registerHistoryHandlers(io *socket.Server, client *socket.Socket) {
	client.On("client:history:init", func(args ...any) {
		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil {
			return
		}
		historyMu.RLock()
		defer historyMu.RUnlock()
		client.Emit("server:history:update", scanHistory)
	})

	client.On("client:history:validation", func(args ...any) {
		if len(args) < 3 {
			return
		}
		qrData, _ := args[0].(string)
		status, _ := args[1].(string)

		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanScan {
			msg := fmt.Sprintf("Unauthorized validation attempt by user: %s", ctx.User.Name)
			invokeAck(args, types.SocketResponse{Status: "error", Error: msg})
			return
		}

		var (
			allowDuplicateValid bool
			maxValidDuplicate   int
		)
		{
			creatorBytes := ctx.UserHashBytes
			pID, cHash, err := db.GetProjectCreatorForUser(ctx.UserHashBytes)
			if err == nil && len(cHash) > 0 {
				creatorBytes = cHash
			}
			project, _ := db.FindProjectScanOptById(creatorBytes, pID)
			if project != nil {
				allowDuplicateValid = project["allowDuplicateValid"].(bool)
				maxValidDuplicate = project["maxValidDuplicate"].(int)
			}
		}

		historyMu.RLock()
		duplicatedMsg := ""
		totalDuplicates := 0
		for _, entry := range scanHistory {
			if entry.Data == qrData && entry.Status == "Valid" {
				if allowDuplicateValid {
					totalDuplicates++
					if totalDuplicates > maxValidDuplicate {
						duplicatedMsg = fmt.Sprintf("This entry data (%s) has already been validated more than %d times", qrData, maxValidDuplicate)
						break
					}
				} else {
					duplicatedMsg = fmt.Sprintf("This entry data (%s) has already been validated by %s", qrData, entry.ValidatorName)
					break
				}
			}
		}
		historyMu.RUnlock()

		if duplicatedMsg != "" {
			invokeAck(args, types.SocketResponse{Status: "info", Message: duplicatedMsg})
			return
		}

		newScan := &types.ScanEntry{
			Id:            fmt.Sprintf("scan_%d", time.Now().UnixNano()/1e6),
			Data:          qrData,
			Status:        status,
			ValidatorName: ctx.User.Name,
			ValidatedAt:   time.Now().UTC().Format(time.RFC3339),
		}

		historyMu.Lock()
		scanHistory = append([]*types.ScanEntry{newScan}, scanHistory...)
		historyMu.Unlock()

		go syncHistoryToDisk()

		msg := fmt.Sprintf("Validation for %s has been submitted", qrData)
		invokeAck(args, types.SocketResponse{Status: "success", Data: msg})

		historyMu.RLock()
		io.Emit("server:history:update", scanHistory)
		historyMu.RUnlock()
	})

	client.On("client:history:delete", func(args ...any) {
		if len(args) < 1 {
			return
		}
		idToDelete, _ := args[0].(string)
		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanDelete {
			return
		}

		historyMu.Lock()
		initialLen := len(scanHistory)
		var filtered []*types.ScanEntry
		for _, entry := range scanHistory {
			if entry.Id != idToDelete {
				filtered = append(filtered, entry)
			}
		}
		scanHistory = filtered
		changed := len(scanHistory) < initialLen
		historyMu.Unlock()

		if changed {
			go syncHistoryToDisk()
			historyMu.RLock()
			io.Emit("server:history:update", scanHistory)
			historyMu.RUnlock()
		}
	})
}
