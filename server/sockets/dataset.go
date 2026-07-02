package sockets

import (
	"encoding/json"
	"fmt"
	"premark/db"
	"premark/types"
	"strings"

	"github.com/zishang520/socket.io/servers/socket/v3"
)

func registerDatasetHandlers(client *socket.Socket) {
	client.On("client:dataset:row:get", func(args ...any) {
		if len(args) < 4 {
			return
		}
		datasetID, _ := args[0].(string)
		isProject, _ := args[1].(bool)
		rowKey, _ := args[2].(string)

		trimmed := strings.TrimSpace(datasetID)
		if trimmed == "" {
			invokeAck(args, types.SocketResponse{Status: "error", Error: "Dataset identifier tracking cannot be empty."})
			return
		}

		row, err := db.FindDatasetRow(trimmed, isProject, rowKey)
		if err != nil || row == nil {
			invokeAck(args, types.SocketResponse{Status: "error", Error: "Row not found."})
			return
		}
		invokeAck(args, types.SocketResponse{Status: "success", Data: row})
	})

	client.On("client:dataset:row:all", func(args ...any) {
		if len(args) < 3 {
			return
		}
		datasetID, _ := args[0].(string)
		isProject, _ := args[1].(bool)

		trimmed := strings.TrimSpace(datasetID)
		if trimmed == "" {
			invokeAck(args, types.SocketResponse{Status: "error", Error: "Dataset identifier tracking cannot be empty."})
			return
		}

		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).IsUseDataset {
			msg := fmt.Sprintf("Unauthorized fetch all attempt by user: %s", ctx.User.Name)
			invokeAck(args, types.SocketResponse{Status: "error", Error: msg})
			return
		}

		rows, err := db.FindDatasetRows(trimmed, isProject, nil)
		if err != nil {
			invokeAck(args, types.SocketResponse{Status: "error", Error: err.Error()})
			return
		}
		invokeAck(args, types.SocketResponse{Status: "success", Data: rows})
	})

	client.On("client:dataset:all", func(args ...any) {
		if len(args) < 1 {
			return
		}

		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole {
			msg := fmt.Sprintf("Unauthorized fetch many attempt by user: %s", ctx.User.Name)
			invokeAck(args, types.SocketResponse{Status: "error", Error: msg})
			return
		}

		items, err := db.GetAllDatasets(ctx.UserHashBytes)
		if err != nil {
			invokeAck(args, types.SocketResponse{Status: "error", Error: err.Error()})
			return
		}
		invokeAck(args, types.SocketResponse{Status: "success", Data: items})
	})

	client.On("client:dataset:add", func(args ...any) {
		if len(args) < 2 {
			return
		}
		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole {
			client.Emit("server:response:error", fmt.Sprintf("Unauthorized add attempt by user: %s", ctx.User.Name))
			return
		}

		rawJSON, err := json.Marshal(args[0])
		if err != nil {
			invokeAck(args, types.SocketResponse{Status: "error", Error: "Failed parsing tracking payloads."})
			return
		}

		var payload types.DatasetPayload
		_ = json.Unmarshal(rawJSON, &payload)

		id, err := db.AddDataset(ctx.UserHashBytes, payload, nil)
		if err != nil || id == "" {
			invokeAck(args, types.SocketResponse{Status: "error", Error: "Failed to add dataset."})
			return
		}
		invokeAck(args, types.SocketResponse{Status: "success", Data: id})
	})
}
