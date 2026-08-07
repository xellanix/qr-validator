package db

import (
	"database/sql"
	"embed"
	"fmt"
	"premark/types"
	"sort"
	"time"

	"github.com/google/uuid"
	orderedMap "github.com/wk8/go-ordered-map/v2"
)

type presenceHistoryItem struct {
	Id         string `json:"id"`
	DatasetRow string `json:"datasetRow"`
	PresenceBy string `json:"presenceBy"`
	CreatedAt  int64  `json:"createdAt"`
	Status     string `json:"status"`
}

type ReportRow = *orderedMap.OrderedMap[string, any]

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

func GenerateReport(projectId string, batchNumber int, sorted bool) ([]string, []ReportRow, error) {
	query, err := presenceHistoriesQueries.ReadFile("sql/queries/presence_histories/get_report.sql")
	if err != nil {
		return nil, nil, fmt.Errorf("Failed to read presence history report query: %s", err.Error())
	}

	rows, err := DB.Query(string(query), batchNumber, projectId)
	if err != nil {
		return nil, nil, fmt.Errorf("Failed to execute presence history report query: %s", err.Error())
	}
	defer rows.Close()

	gcm, err := getDatasetGCM()
	if err != nil {
		return nil, nil, fmt.Errorf("Failed to get dataset GCM: %s", err.Error())
	}

	var datasetPayload []byte
	err = DB.QueryRow("SELECT d.payload FROM datasets d JOIN projects p ON d.id = p.dataset_id WHERE p.id = ?", projectId).Scan(&datasetPayload)
	if err != nil {
		return nil, nil, fmt.Errorf("Failed to get dataset payload: %s", err.Error())
	}

	ds, err := decryptJSON[types.DatasetPayload](datasetPayload, gcm)
	if err != nil {
		return nil, nil, fmt.Errorf("Failed to decrypt dataset payload: %s", err.Error())
	}

	var headers []string
	for k := range ds.Columns {
		headers = append(headers, k)
	}

	var result []ReportRow
	for rows.Next() {
		row := orderedMap.New[string, any]()

		var (
			present           bool
			rowPayload        []byte
			presenceByPayload []byte
			createdAtNs       sql.NullInt64
			status            sql.NullString
		)

		if err := rows.Scan(&present, &rowPayload, &presenceByPayload, &createdAtNs, &status); err != nil {
			return nil, nil, fmt.Errorf("Failed to scan presence history row: %s", err.Error())
		}

		if present {
			row.Set("present", "Yes")
		} else {
			row.Set("present", "No")
		}

		dr, err := decryptJSON[types.DatasetRow](rowPayload, gcm)
		if err != nil {
			return nil, nil, fmt.Errorf("Failed to decrypt dataset row: %s", err.Error())
		}

		for _, k := range headers {
			v, _ := (*dr)[k]
			row.Set(k, v)
		}

		row.Set("presenceBy", "")
		if presenceByPayload != nil {
			if presenceBy, err := GetUser(presenceByPayload); err == nil {
				row.Set("presenceBy", presenceBy.Name)
			}
		}

		if createdAtNs.Valid {
			row.Set("createdAt", createdAtNs.Int64)
		} else {
			row.Set("createdAt", 0)
		}

		if status.Valid {
			row.Set("status", status.String)
		} else {
			row.Set("status", "")
		}

		result = append(result, row)
	}

	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("Failed to iterate presence history rows: %s", err.Error())
	}

	// Sort logic
	sort.Slice(result, func(i, j int) bool {
		if sorted {
			pi, _ := result[i].Value("present").(string)
			pj, _ := result[j].Value("present").(string)
			if pi != pj {
				return pi != "Yes" && pj == "Yes"
			}
		}

		rki, _ := result[i].Value(ds.Key).(string)
		rkj, _ := result[j].Value(ds.Key).(string)
		if rki != rkj {
			return rki < rkj
		}

		ci, _ := result[i].Value("createdAt").(int64)
		cj, _ := result[j].Value("createdAt").(int64)
		return ci < cj
	})

	return headers, result, nil
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
