package sockets

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
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

		var matrix [][]string
		var datasetKeys []string

		b1, _ := json.Marshal(args[0])
		b2, _ := json.Marshal(args[1])
		_ = json.Unmarshal(b1, &matrix)
		_ = json.Unmarshal(b2, &datasetKeys)

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
