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
	"reflect"
	"regexp"
	"strings"
	"sync"

	"github.com/zishang520/socket.io/servers/socket/v3"
)

type projectMetadataCache struct {
	mu        sync.Mutex
	isDeleted bool

	id          string
	batchNumber int
}

type set = map[string]struct{}

var (
	// Thread-safe map storage contexts for tracking console operational triggers.
	activeIdsMu sync.RWMutex
	activeIds   = make(map[string]*projectMetadataCache)
)

func getActiveProject(userHash []byte, userHashBase64 string) (string, []byte, error) {
	pCache, ok := lib.GetMuMapValue(&activeIdsMu, activeIds, userHashBase64)

	if ok && pCache != nil {
		pCache.mu.Lock()
		defer pCache.mu.Unlock()
		if !pCache.isDeleted && pCache.id != "" {
			return pCache.id, userHash, nil
		}
	}

	pID, uHash, err := db.GetProjectCreatorForUser(userHash)
	if err == nil && pID != "" {
		return pID, uHash, nil
	}

	return "", nil, fmt.Errorf("No active project for user: %s", userHashBase64)
}

func getCachedBatchNumber(creatorHash string) int {
	pCache, ok := lib.GetMuMapValue(&activeIdsMu, activeIds, creatorHash)
	if !ok || pCache == nil {
		return 0
	}
	pCache.mu.Lock()
	defer pCache.mu.Unlock()
	return pCache.batchNumber
}

func structToMapReflect(obj any, keys set) map[string]any {
	result := make(map[string]any)
	val := reflect.ValueOf(obj)

	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}

	if val.Kind() != reflect.Struct {
		return result
	}

	typ := val.Type()
	for i := 0; i < val.NumField(); i++ {
		field := typ.Field(i)

		if !field.IsExported() {
			continue
		}

		tag := field.Tag.Get("json")
		if tag == "-" {
			continue
		}

		parts := strings.Split(tag, ",")
		key := parts[0]
		if key == "" {
			key = field.Name
		}

		if keys != nil {
			if _, ok := keys[key]; !ok {
				continue
			}
		}

		result[key] = val.Field(i).Interface()
	}

	return result
}

func registerProjectHandlers(io *socket.Server, client *socket.Socket) {
	client.On("client:project:init", func(args ...any) {
		if len(args) < 1 {
			return
		}
		ctx := client.Data().(*types.SocketData)

		type initOpt struct {
			Activation bool `json:"activation"`
			Projects   bool `json:"projects"`
			All        bool `json:"all"`
		}
		opt, err := lib.TryParseJson[initOpt](args[0])
		if err != nil {
			client.Emit("server:response:error", fmt.Sprintf("Failed parsing initialization options: %s", err.Error()))
			return
		}

		creatorBytes := ctx.UserHashBytes
		creatorBase64 := ctx.UserHashBase64
		if len(creatorBase64) == 0 || (opt.All && (ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole)) {
			client.Emit("server:response:error", fmt.Sprintf("Unauthorized fetch all attempt by user: %s", ctx.User.Name))
			return
		}

		var activeID string

		if opt.All {
			client.Join(socket.Room(creatorBase64))
			pCache, ok := lib.GetMuMapValue(&activeIdsMu, activeIds, creatorBase64)
			if ok && pCache != nil {
				lib.DoLock(&pCache.mu, func() {
					if pCache.isDeleted || pCache.id == "" {
						return
					}
					activeID = pCache.id
				})
			}
		} else {
			pID, cHash, err := db.GetProjectCreatorForUser(ctx.UserHashBytes)
			if err == nil && len(cHash) > 0 {
				creatorBytes = cHash
				creatorBase64 = lib.BytesToBase64(cHash)
			}

			pCache, ok := lib.GetMuMapValue(&activeIdsMu, activeIds, creatorBase64)
			if ok && pCache != nil {
				lib.DoLock(&pCache.mu, func() {
					if pCache.isDeleted || pCache.id == "" {
						return
					}
					activeID = pCache.id
				})
			}

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

		type projectData struct {
			Name                 string               `json:"name"`
			DatasetID            string               `json:"datasetId"`
			SchemaObjects        []types.SchemaObject `json:"schemaObjects"`
			Users                []types.User         `json:"users"`
			SkipDatasetCheck     bool                 `json:"skipDatasetCheck"`
			AllowDuplicateValid  bool                 `json:"allowDuplicateValid"`
			MaxValidDuplicate    int                  `json:"maxValidDuplicate"`
			IsContinuousScanning bool                 `json:"isContinuousScanning"`
		}

		pData, err := lib.TryParseJson[projectData](args[0])
		if err != nil {
			client.Emit("server:response:error", fmt.Sprintf("Failed parsing project data: %s", err.Error()))
			return
		}

		var forward types.DatasetPayload
		err = json.Unmarshal([]byte(args[1].(string)), &forward)
		if err != nil {
			client.Emit("server:response:error", fmt.Sprintf("Failed parsing forward data: %s", err.Error()))
			return
		}

		pID, err := db.AddProject(ctx.UserHashBytes, pData.DatasetID, pData.Name, pData.SchemaObjects, pData.Users, pData.SkipDatasetCheck, pData.AllowDuplicateValid, pData.MaxValidDuplicate, pData.IsContinuousScanning)
		success := err == nil && pID != ""

		var out any
		if success {
			out = map[string]any{
				`id`:                   pID,
				`name`:                 pData.Name,
				`datasetId`:            pData.DatasetID,
				`columns`:              forward.Columns,
				`key`:                  forward.Key,
				`keyLabel`:             forward.KeyLabel,
				`schemaObjects`:        pData.SchemaObjects,
				`users`:                pData.Users,
				`skipDatasetCheck`:     pData.SkipDatasetCheck,
				`allowDuplicateValid`:  pData.AllowDuplicateValid,
				`maxValidDuplicate`:    pData.MaxValidDuplicate,
				`isContinuousScanning`: pData.IsContinuousScanning,
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

		if id == "" {
			client.Emit("server:response:error", "Project identifier tracking cannot be empty.")
			return
		}

		projectsPayload, err := lib.TryParseJson[map[string]any](args[2])
		if err != nil {
			client.Emit("server:response:error", fmt.Sprintf("Failed parsing project data: %s", err.Error()))
			return
		}

		var datasetsPayload map[string]any
		var changes int64
		if datasetID != "" {
			payloadStr, ok := args[3].(string)
			if !ok {
				client.Emit("server:response:error", "Invalid dataset update payload.")
				return
			}
			payloadBytes := []byte(payloadStr)

			payloadKeys := make(set)
			{
				var data map[string]any
				err = json.Unmarshal(payloadBytes, &data)
				if err != nil {
					client.Emit("server:response:error", fmt.Sprintf("Failed parsing dataset payload: %s", err.Error()))
					return
				}
				for key := range data {
					payloadKeys[key] = struct{}{}
				}
			}

			dsPayload, err := db.GetPartialUpdateDataset(ctx.UserHashBytes, datasetID, payloadBytes)
			if err != nil {
				client.Emit("server:response:error", fmt.Sprintf("Failed parsing dataset data: %s", err.Error()))
				return
			}
			datasetsPayload = structToMapReflect(dsPayload, payloadKeys)

			c, err := db.UpdateDataset(ctx.UserHashBytes, datasetID, dsPayload)
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
					newUsers, _ = lib.TryParseJson[[]types.User](v)
				case "schemaObjects":
					// Strip sortId from schemaObjects strictly for the database copy
					schemas, _ := lib.TryParseJson[[]map[string]any](v)
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

		pCache, ok := lib.GetMuMapValue(&activeIdsMu, activeIds, ctx.UserHashBase64)
		if !ok || pCache == nil {
			return
		}

		lib.DoLock(&pCache.mu, func() {
			if pCache.isDeleted || id != pCache.id {
				return
			}

			io.To(socket.Room(fmt.Sprintf("%s-%s-children", ctx.UserHashBase64, id))).Emit("server:project:update", id, mergedResult)
		})
	})

	client.On("client:project:delete", func(args ...any) {
		if len(args) < 2 {
			return
		}
		id, _ := args[0].(string)
		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole {
			invokeAck(args, types.SocketResponse{Status: "error", Error: fmt.Sprintf("Unauthorized delete attempt by user: %s", ctx.User.Name)})
			return
		}

		success, err := db.RemoveProjectById(ctx.UserHashBytes, id)
		var errorMsg string
		if err == nil && success {
			rooms := io.To(socket.Room(ctx.UserHashBase64))

			lib.DoLock(&activeIdsMu, func() {
				pCache, ok := activeIds[ctx.UserHashBase64]
				if !ok || pCache == nil {
					errorMsg = fmt.Sprintf("No active project for user: %s", ctx.UserHashBase64)
					return
				}

				isDeleted := func() bool {
					pCache.mu.Lock()
					defer pCache.mu.Unlock()

					if id == pCache.id {
						pCache.isDeleted = true
						return true
					}

					return false
				}

				if isDeleted() {
					delete(activeIds, ctx.UserHashBase64)
					rooms = rooms.To(socket.Room(fmt.Sprintf("%s-%s-children", ctx.UserHashBase64, id)))
				}
				rooms.Emit("server:project:delete", id)
			})
		} else {
			errorMsg = fmt.Sprintf("Failed to delete project: %s", err.Error())
		}

		if errorMsg != "" {
			invokeAck(args, types.SocketResponse{Status: "error", Error: errorMsg})
			return
		}

		invokeAck(args, types.SocketResponse{Status: "success", Data: success})

		if err == nil && success {
			// Delete the project folder from the file system
			_ = os.RemoveAll(persist.PublicDir("output", "users", id))
			_ = os.RemoveAll(persist.PublicDir("output", "presence", id))
		}
	})

	client.On("client:project:activation:batch_number", func(args ...any) {
		if len(args) < 2 {
			return
		}
		id, _ := args[0].(string)

		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole {
			invokeAck(args, types.SocketResponse{Status: "error", Error: fmt.Sprintf("Unauthorized activation toggle attempt by user: %s", ctx.User.Name)})
			return
		}

		batchNumber, err := db.GetCurrentBatchNumber(id)
		if err != nil {
			invokeAck(args, types.SocketResponse{Status: "error", Error: fmt.Sprintf("Failed to get current batch number: %s", err.Error())})
			return
		}

		invokeAck(args, types.SocketResponse{Status: "success", Data: batchNumber})
	})

	client.On("client:project:activation:toggle", func(args ...any) {
		if len(args) < 4 {
			return
		}
		id, _ := args[0].(string)
		checked, _ := args[1].(bool)
		batchNumber, err := tryParseInt(args[2])
		if err != nil {
			invokeAck(args, types.SocketResponse{Status: "error", Error: "Invalid batch number."})
			return
		}

		ctx := client.Data().(*types.SocketData)
		if ctx.User == nil || !GetPermissions(ctx.User.AuthorizeLevel).CanAccessConsole {
			invokeAck(args, types.SocketResponse{Status: "error", Error: fmt.Sprintf("Unauthorized activation toggle attempt by user: %s", ctx.User.Name)})
			return
		}

		var prevActiveID string
		var nextActive any = nil
		var errorMsg string
		lib.DoLock(&activeIdsMu, func() {
			pCache, ok := activeIds[ctx.UserHashBase64]
			cached := ok && pCache != nil

			if checked {
				err := db.UpsertBatchNumber(id, batchNumber)
				if err != nil {
					errorMsg = fmt.Sprintf("Failed to update batch number: %s", err.Error())
					return
				}

				nextActive = id
				if !cached {
					activeIds[ctx.UserHashBase64] = &projectMetadataCache{id: id, batchNumber: batchNumber, mu: sync.Mutex{}}
					return
				}

				pCache.mu.Lock()
				prevActiveID = pCache.id
				pCache.id = id
				pCache.batchNumber = batchNumber
				pCache.mu.Unlock()
			} else {
				if !cached {
					errorMsg = fmt.Sprintf("No active project for user: %s", ctx.UserHashBase64)
					return
				}

				pCache.mu.Lock()
				prevActiveID = pCache.id
				pCache.isDeleted = true
				pCache.mu.Unlock()

				delete(activeIds, ctx.UserHashBase64)
			}
		})

		if errorMsg != "" {
			invokeAck(args, types.SocketResponse{Status: "error", Error: errorMsg})
			return
		}

		io.To(socket.Room(ctx.UserHashBase64)).
			To(socket.Room(fmt.Sprintf("%s-%s-children", ctx.UserHashBase64, id))).
			Emit("server:project:activation:toggle", nextActive)

		if prevActiveID != "" {
			io.To(socket.Room(fmt.Sprintf("%s-%s-children", ctx.UserHashBase64, prevActiveID))).Emit("server:project:activation:toggle", nil)
		}

		invokeAck(args, types.SocketResponse{Status: "success", Data: true})
	})
}
