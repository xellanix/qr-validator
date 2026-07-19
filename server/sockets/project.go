package sockets

import (
	"encoding/json"
	"fmt"
	"maps"
	"os"
	"premark/db"
	"premark/lib"
	"premark/persist"
	"premark/types"
	"regexp"
	"strings"
	"sync"

	"github.com/zishang520/socket.io/servers/socket/v3"
)

var (
	// Thread-safe map storage contexts for tracking console operational triggers.
	activeIdsMu sync.RWMutex
	activeIds   = make(map[string]string)
)

func registerProjectHandlers(io *socket.Server, client *socket.Socket) {
	client.On("client:project:init", func(args ...any) {
		if len(args) < 1 {
			return
		}
		ctx := client.Data().(*types.SocketData)

		var opt struct {
			Activation bool `json:"activation"`
			Projects   bool `json:"projects"`
			All        bool `json:"all"`
		}
		rawBytes, _ := json.Marshal(args[0])
		_ = json.Unmarshal(rawBytes, &opt)

		creatorBytes := ctx.UserHashBytes
		creatorBase64 := ctx.UserHashBase64
		if len(creatorBase64) == 0 || (opt.All && (ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole)) {
			client.Emit("server:response:error", fmt.Sprintf("Unauthorized fetch all attempt by user: %s", ctx.User.Name))
			return
		}

		var activeID string

		if opt.All {
			client.Join(socket.Room(creatorBase64))
			activeIdsMu.RLock()
			activeID = activeIds[creatorBase64]
			activeIdsMu.RUnlock()
		} else {
			pID, cHash, err := db.GetProjectCreatorForUser(ctx.UserHashBytes)
			if err == nil && len(cHash) > 0 {
				creatorBytes = cHash
				creatorBase64 = lib.BytesToBase64(cHash)
			}

			activeIdsMu.RLock()
			activeID = activeIds[creatorBase64]
			activeIdsMu.RUnlock()

			if pID == "" {
				client.Join(socket.Room(creatorBase64))
			} else {
				client.Join(socket.Room(fmt.Sprintf("%s-%s-children", creatorBase64, pID)))

				if activeID != pID {
					activeID = ""
				}
			}
		}

		res := make(map[string]any)

		if opt.Activation {
			if activeID != "" {
				res["activeId"] = activeID
			} else {
				res["activeId"] = nil
			}
		}

		if opt.Projects {
			if opt.All {
				projects, _ := db.GetAllProjects(creatorBytes, true)
				res["projects"] = projects
			} else if activeID != "" {
				project, _ := db.FindProjectById(creatorBytes, activeID, true, true)
				if project != nil {
					res["projects"] = map[string]any{activeID: project}
				} else {
					res["projects"] = map[string]any{}
				}
			} else {
				res["projects"] = map[string]any{}
			}
		}

		client.Emit("server:project:init", res)
	})

	client.On("client:project:add", func(args ...any) {
		if len(args) < 2 {
			return
		}
		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole {
			client.Emit("server:response:error", fmt.Sprintf("Unauthorized add attempt by user: %s", ctx.User.Name))
			return
		}

		var pData struct {
			Name          string               `json:"name"`
			DatasetID     string               `json:"datasetId"`
			SchemaObjects []types.SchemaObject `json:"schemaObjects"`
			Users         []types.User         `json:"users"`
		}
		var forward struct {
			Columns  map[string]string `json:"columns"`
			Key      string            `json:"key"`
			KeyLabel string            `json:"keyLabel"`
		}

		b1, _ := json.Marshal(args[0])
		b2, _ := json.Marshal(args[1])
		_ = json.Unmarshal(b1, &pData)
		_ = json.Unmarshal(b2, &forward)

		pID, err := db.AddProject(ctx.UserHashBytes, pData.DatasetID, pData.Name, pData.SchemaObjects, pData.Users)
		success := err == nil && pID != ""

		var out any
		if success {
			out = map[string]any{
				`id`:            pID,
				`name`:          pData.Name,
				`datasetId`:     pData.DatasetID,
				`columns`:       forward.Columns,
				`key`:           forward.Key,
				`keyLabel`:      forward.KeyLabel,
				`schemaObjects`: pData.SchemaObjects,
				`users`:         pData.Users,
			}
		}
		io.To(socket.Room(ctx.UserHashBase64)).Emit("server:project:add", out, success)
	})

	client.On("client:project:update", func(args ...any) {
		if len(args) < 4 {
			return
		}
		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole {
			client.Emit("server:response:error", fmt.Sprintf("Unauthorized update attempt by user: %s", ctx.User.Name))
			return
		}

		id, _ := args[0].(string)
		datasetID, _ := args[1].(string)

		var projectsPayload map[string]any
		var datasetsPayload map[string]any

		b1, _ := json.Marshal(args[2])
		b2, _ := json.Marshal(args[3])
		_ = json.Unmarshal(b1, &projectsPayload)
		_ = json.Unmarshal(b2, &datasetsPayload)

		var changes int64
		if len(datasetsPayload) > 0 && datasetID != "" {
			c, err := db.UpdateDataset(ctx.UserHashBytes, datasetID, datasetsPayload)
			if err == nil {
				changes += c
			}
		}

		if len(projectsPayload) > 0 {
			// Build a separate map for the DB so the original projectsPayload remains pristine for the frontend broadcast.
			pPayload := make(map[string]any)
			var newUsers []types.User

			for k, v := range projectsPayload {
				switch k {
				case "users":
					uBytes, _ := json.Marshal(v)
					_ = json.Unmarshal(uBytes, &newUsers)
				case "schemaObjects":
					// Strip sortId from schemaObjects strictly for the database copy
					var schemas []map[string]any
					sBytes, _ := json.Marshal(v)
					_ = json.Unmarshal(sBytes, &schemas)
					for _, s := range schemas {
						delete(s, "sortId")
					}
					pPayload["schema_objects"] = schemas
				default:
					// Convert camelCase parameters to snake_case only for SQL columns
					snakeKey := regexp.MustCompile("([A-Z])").ReplaceAllString(k, "_$1")
					pPayload[strings.ToLower(snakeKey)] = v
				}
			}

			c, err := db.UpdateProject(ctx.UserHashBytes, id, pPayload, newUsers)
			if err == nil {
				changes += c
			}
		}

		if changes == 0 {
			client.Emit("server:response:error", "Failed to update project.")
			return
		}

		mergedResult := make(map[string]any)
		maps.Copy(mergedResult, projectsPayload)
		maps.Copy(mergedResult, datasetsPayload)

		client.Emit("server:project:update", id, mergedResult, true)
		client.To(socket.Room(ctx.UserHashBase64)).Emit("server:project:update", id, mergedResult)

		activeIdsMu.RLock()
		currentActive := activeIds[ctx.UserHashBase64]
		activeIdsMu.RUnlock()

		if id == currentActive {
			io.To(socket.Room(fmt.Sprintf("%s-%s-children", ctx.UserHashBase64, id))).Emit("server:project:update", id, mergedResult)
		}
	})

	client.On("client:project:delete", func(args ...any) {
		if len(args) < 2 {
			return
		}
		id, _ := args[0].(string)
		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole {
			client.Emit("server:response:error", fmt.Sprintf("Unauthorized delete attempt by user: %s", ctx.User.Name))
			return
		}

		success, err := db.RemoveProjectById(ctx.UserHashBytes, id)
		if err == nil && success {
			rooms := io.To(socket.Room(ctx.UserHashBase64))
			activeIdsMu.Lock()
			if id == activeIds[ctx.UserHashBase64] {
				delete(activeIds, ctx.UserHashBase64)
				rooms = rooms.To(socket.Room(fmt.Sprintf("%s-%s-children", ctx.UserHashBase64, id)))
			}
			activeIdsMu.Unlock()
			rooms.Emit("server:project:delete", id)
		}
		invokeAck(args, types.SocketResponse{Status: "success", Data: success})

		if err == nil && success {
			// Delete the project folder from the file system
			_ = os.RemoveAll(persist.PublicDir("output", "users", id))
			_ = os.RemoveAll(persist.PublicDir("output", "presence", id))
		}
	})

	client.On("client:project:activation:toggle", func(args ...any) {
		if len(args) < 2 {
			return
		}
		id, _ := args[0].(string)
		checked, _ := args[1].(bool)

		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole {
			client.Emit("server:response:error", fmt.Sprintf("Unauthorized activation toggle attempt by user: %s", ctx.User.Name))
			return
		}

		activeIdsMu.Lock()
		prevActiveID := activeIds[ctx.UserHashBase64]
		var nextActive any = nil
		if checked {
			activeIds[ctx.UserHashBase64] = id
			nextActive = id
		} else {
			delete(activeIds, ctx.UserHashBase64)
		}
		activeIdsMu.Unlock()

		io.To(socket.Room(ctx.UserHashBase64)).
			To(socket.Room(fmt.Sprintf("%s-%s-children", ctx.UserHashBase64, id))).
			Emit("server:project:activation:toggle", nextActive)

		if prevActiveID != "" {
			io.To(socket.Room(fmt.Sprintf("%s-%s-children", ctx.UserHashBase64, prevActiveID))).Emit("server:project:activation:toggle", nil)
		}
	})
}
