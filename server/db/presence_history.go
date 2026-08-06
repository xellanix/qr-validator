package db

import (
	"database/sql"
	"embed"
	"fmt"
	"premark/types"
	"time"

	"github.com/google/uuid"
)

type presenceHistoryItem struct {
	Id         string `json:"id"`
	DatasetRow string `json:"datasetRow"`
	PresenceBy string `json:"presenceBy"`
	CreatedAt  int64  `json:"createdAt"`
	Status     string `json:"status"`
}

//go:embed sql/queries/presence_histories
var presenceHistoriesQueries embed.FS

//go:embed sql/queries/presence_history_batches
var presenceHistoryBatchesQueries embed.FS

func AddPresenceHistory(projectId string, rowId int, presenceByHash []byte, status string, batchNumber int) (string, error) {
	query, err := presenceHistoriesQueries.ReadFile("sql/queries/presence_histories/add.sql")
	if err != nil {
		return "", err
	}

	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}

	idBytes, err := id.MarshalBinary()
	if err != nil {
		return "", err
	}

	nowNs := time.Now().UnixNano()
	_, err = DB.Exec(string(query), idBytes, projectId, rowId, presenceByHash, status, batchNumber, nowNs)
	if err != nil {
		return "", err
	}

	return id.String(), nil
}

func FindPresenceHistoriesByProjectId(projectId string, batchNumber int, rowKey string, asMilliseconds bool) ([]presenceHistoryItem, error) {
	query, err := presenceHistoriesQueries.ReadFile("sql/queries/presence_histories/find_by_project_id.sql")
	if err != nil {
		return nil, err
	}

	rows, err := DB.Query(string(query), projectId, batchNumber)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	gcm, err := getDatasetGCM()
	if err != nil {
		return nil, err
	}

	items := make([]presenceHistoryItem, 0)
	for rows.Next() {
		var item presenceHistoryItem
		var rawId []byte
		var rowPayload []byte
		var presenceByPayload []byte

		if err := rows.Scan(&rawId, &rowPayload, &presenceByPayload, &item.Status, &item.CreatedAt); err != nil {
			return nil, err
		}

		if asMilliseconds {
			item.CreatedAt = item.CreatedAt / 1_000_000
		}

		if parsedUUID, err := uuid.FromBytes(rawId); err == nil {
			item.Id = parsedUUID.String()
		} else {
			item.Id = string(rawId)
		}

		if dr, err := decryptJSON[types.DatasetRow](rowPayload, gcm); err == nil {
			v, ok := (*dr)[rowKey]
			if ok {
				item.DatasetRow = v
			}
		}

		if presenceBy, err := GetUser(presenceByPayload); err == nil {
			item.PresenceBy = presenceBy.Name
		}

		items = append(items, item)
	}

	return items, nil
}

func HasValidPresenceAtLeast(projectId string, batchNumber int, rowId int, max int) (bool, error) {
	// Guard clause: if asking for <= 0, it's trivially true
	if max <= 0 {
		return true, nil
	}

	query, err := presenceHistoriesQueries.ReadFile("sql/queries/presence_histories/has_valid_at_least.sql")
	if err != nil {
		return false, err
	}

	offset := max - 1

	var exists bool
	err = DB.QueryRow(string(query), projectId, batchNumber, rowId, offset).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("Failed to check presence history count: %w", err)
	}

	return exists, nil
}

func DeletePresenceHistory(id string) error {
	query, err := presenceHistoriesQueries.ReadFile("sql/queries/presence_histories/delete_by_id.sql")
	if err != nil {
		return err
	}

	var targetID any = id
	if parsedUUID, err := uuid.Parse(id); err == nil {
		if bytes, err := parsedUUID.MarshalBinary(); err == nil {
			targetID = bytes
		}
	}

	_, err = DB.Exec(string(query), targetID)
	return err
}

func GetCurrentBatchNumber(projectId string) (int, error) {
	query, err := presenceHistoryBatchesQueries.ReadFile("sql/queries/presence_history_batches/find_by_project_id.sql")
	if err != nil {
		return 0, err
	}

	var batchNumber int
	err = DB.QueryRow(string(query), projectId).Scan(&batchNumber)
	if err == sql.ErrNoRows {
		return 1, nil
	}
	return batchNumber, err
}

func UpsertBatchNumber(projectId string, batchNumber int) error {
	query, err := presenceHistoryBatchesQueries.ReadFile("sql/queries/presence_history_batches/upsert.sql")
	if err != nil {
		return err
	}

	_, err = DB.Exec(string(query), projectId, batchNumber)
	return err
}
