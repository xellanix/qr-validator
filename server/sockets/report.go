package sockets

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"premark/lib"
	"premark/types"

	"github.com/zishang520/socket.io/servers/socket/v3"
)

func registerReportHandlers(client *socket.Socket) {
	client.On("client:report:export", func(args ...any) {
		if len(args) < 3 {
			return
		}
		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanReport {
			msg := fmt.Sprintf("Unauthorized report attempt by user: %s", ctx.User.Name)
			invokeAck(args, types.SocketResponse{Status: "error", Error: msg})
			return
		}

		matrix, err := lib.TryParseJson[[][]string](args[0])
		if err != nil {
			invokeAck(args, types.SocketResponse{Status: "error", Error: fmt.Sprintf("Failed parsing 2d matrix data: %s", err.Error())})
			return
		}
		datasetKeys, err := lib.TryParseJson[[]string](args[1])
		if err != nil {
			invokeAck(args, types.SocketResponse{Status: "error", Error: fmt.Sprintf("Failed parsing dataset keys: %s", err.Error())})
			return
		}

		buf := new(bytes.Buffer)
		writer := csv.NewWriter(buf)

		headers := append([]string{"Present"}, datasetKeys...)
		headers = append(headers, "Validator", "Validated At", "Status")
		_ = writer.Write(headers)

		for _, row := range matrix {
			_ = writer.Write(row)
		}
		writer.Flush()

		type CSVBlobBuffer struct {
			Buffer []byte `json:"buffer"`
			Type   string `json:"type"`
		}

		invokeAck(args, types.SocketResponse{
			Status: "success",
			Data: CSVBlobBuffer{
				Buffer: buf.Bytes(),
				Type:   "text/csv;charset=utf-8;",
			},
		})
	})
}
