package sockets

import (
	"fmt"
	"premark/db"
	"premark/lib"
	"premark/types"

	"github.com/zishang520/socket.io/servers/socket/v3"
)

// Mutex to protect read-then-write (check-and-insert) race conditions across concurrent sockets.
var validationMu = lib.NewKeyedRWMutex()

func checkIfDuplicate(projectId string, creatorHash []byte, rowId int, allowDuplicateValid bool, maxValidDuplicate int) (string, int) {
	var threshold int
	if allowDuplicateValid {
		threshold = maxValidDuplicate
	} else {
		threshold = 1
	}

	batchNumber := getCachedBatchNumber(lib.BytesToBase64(creatorHash))
	if batchNumber == 0 {
		return "", 0
	}

	exists, err := db.HasValidPresenceAtLeast(projectId, batchNumber, rowId, threshold)
	if err != nil || !exists {
		return "", 0
	}

	if allowDuplicateValid {
		msg := fmt.Sprintf("This entry row (%d) has already been validated more than %d times", rowId, maxValidDuplicate)
		return msg, 1
	}

	msg := fmt.Sprintf("This entry row (%d) has already been validated", rowId)
	return msg, 2
}

func fetchAndEmitHistory(io *socket.Server, client *socket.Socket, creatorHash []byte, projectId string, broadcast bool) {
	dataset, err := db.FindDatasetByProjectId(creatorHash, projectId, false)
	if err != nil {
		return
	}

	batchNumber := getCachedBatchNumber(lib.BytesToBase64(creatorHash))
	if batchNumber == 0 {
		return
	}

	histories, err := db.FindPresenceHistoriesByProjectId(projectId, batchNumber, dataset.Key, true)
	if err != nil {
		return
	}

	if broadcast {
		io.Emit("server:history:update", histories)
	} else if client != nil {
		client.Emit("server:history:update", histories)
	}
}

func registerHistoryHandlers(io *socket.Server, client *socket.Socket) {
	client.On("client:history:init", func(args ...any) {
		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil {
			return
		}

		pID, creatorHash, err := getActiveProject(ctx.UserHashBytes, ctx.UserHashBase64)
		if err != nil {
			return
		}

		fetchAndEmitHistory(io, client, creatorHash, pID, false)
	})

	client.On("client:history:check:duplicate", func(args ...any) {
		if len(args) < 4 {
			return
		}
		qrData, _ := args[0].(string)
		allowDuplicateValid, _ := args[1].(bool)
		maxValidDuplicate, err := tryParseInt(args[2])
		if err != nil {
			invokeAck(args, types.SocketResponse{Status: "error", Error: "Invalid maximum valid duplicate."})
			return
		}

		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanScan {
			msg := fmt.Sprintf("Unauthorized check attempt by user: %s", ctx.User.Name)
			invokeAck(args, types.SocketResponse{Status: "error", Error: msg})
			return
		}

		decrypted, err := decryptUserData(qrData)
		if err != nil {
			invokeAck(args, types.SocketResponse{Status: "error", Error: "Decryption failed."})
			return
		}

		rowHash, err := lib.CreateSearchHash(decrypted)
		if err != nil {
			invokeAck(args, types.SocketResponse{Status: "error", Error: "Hashing failed."})
			return
		}

		pID, creatorBytes, err := getActiveProject(ctx.UserHashBytes, ctx.UserHashBase64)
		if err != nil {
			msg := fmt.Sprintf("Unable to get active project: %s", err.Error())
			invokeAck(args, types.SocketResponse{Status: "error", Error: msg})
			return
		}

		rowId, err := db.FindDatasetRowId(pID, rowHash)
		if err != nil || rowId == -1 {
			msg := fmt.Sprintf("Row not found: %s", rowHash)
			invokeAck(args, types.SocketResponse{Status: "error", Error: msg})
		}

		validationMu.DoRLock(fmt.Sprintf("%s:%d", pID, rowId), func() {
			_, duplicatedCode := checkIfDuplicate(pID, creatorBytes, rowId, allowDuplicateValid, maxValidDuplicate)

			res := map[string]any{
				"decrypted":      decrypted,
				"duplicatedCode": duplicatedCode,
			}
			invokeAck(args, types.SocketResponse{Status: "success", Data: res})
		})
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

		rowHash, err := lib.CreateSearchHash(qrData)
		if err != nil {
			invokeAck(args, types.SocketResponse{Status: "error", Error: "Hashing failed."})
			return
		}

		var (
			allowDuplicateValid bool
			maxValidDuplicate   int
		)
		pID, creatorBytes, err := getActiveProject(ctx.UserHashBytes, ctx.UserHashBase64)
		if err != nil {
			msg := fmt.Sprintf("Unable to get active project: %s", err.Error())
			invokeAck(args, types.SocketResponse{Status: "error", Error: msg})
			return
		}

		project, _ := db.FindProjectScanOptById(creatorBytes, pID)
		if project != nil {
			if v, ok := project["allowDuplicateValid"].(bool); ok {
				allowDuplicateValid = v
			}
			if v, ok := project["maxValidDuplicate"].(int); ok {
				maxValidDuplicate = v
			}
		}

		rowId, err := db.FindDatasetRowId(pID, rowHash)
		if err != nil || rowId == -1 {
			msg := fmt.Sprintf("Row not found: %s", rowHash)
			invokeAck(args, types.SocketResponse{Status: "error", Error: msg})
			return
		}

		batchNumber := getCachedBatchNumber(lib.BytesToBase64(creatorBytes))
		if batchNumber == 0 {
			invokeAck(args, types.SocketResponse{Status: "error", Error: fmt.Sprintf("Failed to get batch number for project: %s", pID)})
			return
		}

		// Mutex lock prevents TOCTOU race conditions when multiple workers scan concurrently
		hasDuplicates, err := func() (bool, error) {
			unlock := validationMu.Lock(fmt.Sprintf("%s:%d", pID, rowId))
			defer unlock()

			duplicatedMsg, _ := checkIfDuplicate(pID, creatorBytes, rowId, allowDuplicateValid, maxValidDuplicate)
			if duplicatedMsg != "" {
				invokeAck(args, types.SocketResponse{Status: "info", Message: duplicatedMsg})
				return true, nil
			}

			_, err = db.AddPresenceHistory(pID, rowId, ctx.UserHashBytes, status, batchNumber)
			return false, err
		}()

		if hasDuplicates {
			return
		}
		if err != nil {
			invokeAck(args, types.SocketResponse{Status: "error", Error: "Failed to record scan."})
			return
		}

		msg := fmt.Sprintf("Validation for %s has been submitted", qrData)
		invokeAck(args, types.SocketResponse{Status: "success", Data: msg})

		// Broadcast updated history to all connected sockets
		fetchAndEmitHistory(io, nil, creatorBytes, pID, true)
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

		pID, creatorHash, err := getActiveProject(ctx.UserHashBytes, ctx.UserHashBase64)
		if err != nil {
			return
		}

		if err := db.DeletePresenceHistory(idToDelete); err != nil {
			return
		}

		fetchAndEmitHistory(io, nil, creatorHash, pID, true)
	})
}
