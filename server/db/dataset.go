package db

import (
	"crypto/cipher"
	"database/sql"
	"embed"
	"encoding/json"
	"os"
	"sync"

	"premark/lib"
	"premark/types"
)

var (
	datasetGCMInstance cipher.AEAD
	datasetGCMOnce     sync.Once
	datasetGCMErr      error
)

//go:embed sql/queries/datasets
var datasetsQueries embed.FS

//go:embed sql/queries/dataset_rows
var datasetRowsQueries embed.FS

func getDatasetGCM() (cipher.AEAD, error) {
	datasetGCMOnce.Do(func() {
		keyStr := os.Getenv("DATASET_ENCRYPTION_KEY")
		keyBytes := lib.ToNonSharedBytes(keyStr, 32, false)
		datasetGCMInstance, datasetGCMErr = lib.NewGCMHelper(keyBytes)
	})
	return datasetGCMInstance, datasetGCMErr
}

func AddDataset(userHash []byte, dataset types.DatasetPayload, rows []types.DatasetRow) (string, error) {
	gcm, err := getDatasetGCM()
	if err != nil {
		return "", err
	}

	payload, err := encryptJSON(dataset, gcm)
	if err != nil {
		return "", err
	}

	query, err := datasetsQueries.ReadFile("sql/queries/datasets/add.sql")
	if err != nil {
		return "", err
	}

	var id string
	err = DB.QueryRow(string(query), userHash, payload).Scan(&id)
	if err != nil {
		return "", err
	}

	if len(rows) > 0 {
		_, err = AddDatasetRows(userHash, id, rows, dataset.Key)
		if err != nil {
			return "", err
		}
	}

	return id, nil
}

func AddDatasetRows(userHash []byte, datasetId string, rows []types.DatasetRow, datasetKey ...string) (int, error) {
	if len(rows) == 0 {
		return 0, nil
	}

	var targetKey string
	if len(datasetKey) > 0 && datasetKey[0] != "" {
		targetKey = datasetKey[0]
	} else {
		prev, err := FindDatasetById(userHash, datasetId, false)
		if err != nil || prev == nil {
			return 0, err
		}
		targetKey = prev.Key
	}

	gcm, err := getDatasetGCM()
	if err != nil {
		return 0, err
	}

	tx, err := DB.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	query, err := datasetRowsQueries.ReadFile("sql/queries/dataset_rows/add.sql")
	if err != nil {
		return 0, err
	}
	stmt, err := tx.Prepare(string(query))
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	count := 0
	for _, row := range rows {
		kh, err := lib.CreateSearchHash(row[targetKey])
		if err != nil {
			return 0, err
		}

		payload, err := encryptJSON(row, gcm)
		if err != nil {
			return 0, err
		}

		if _, err := stmt.Exec(datasetId, kh, payload); err != nil {
			return 0, err
		}
		count++
	}

	return count, tx.Commit()
}

func GetAllDatasets(userHash []byte) ([]types.DatasetWithRows, error) {
	query, err := datasetsQueries.ReadFile("sql/queries/datasets/get_all.sql")
	if err != nil {
		return nil, err
	}

	rows, err := DB.Query(string(query), userHash)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	gcm, err := getDatasetGCM()
	if err != nil {
		return nil, err
	}

	var items []types.DatasetWithRows
	for rows.Next() {
		var id string
		var payload []byte
		if err := rows.Scan(&id, &payload); err != nil {
			return nil, err
		}

		ds, err := decryptJSON[types.DatasetPayload](payload, gcm)
		if err != nil {
			continue
		}
		items = append(items, types.DatasetWithRows{DatasetPayload: *ds, ID: id})
	}
	return items, nil
}

func FindDatasetById(userHash []byte, id string, withRows bool) (*types.DatasetWithRows, error) {
	query, err := datasetsQueries.ReadFile("sql/queries/datasets/find_by_id.sql")
	if err != nil {
		return nil, err
	}

	var payload []byte
	err = DB.QueryRow(string(query), userHash, id).Scan(&payload)
	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, err
	}

	gcm, err := getDatasetGCM()
	if err != nil {
		return nil, err
	}

	ds, err := decryptJSON[types.DatasetPayload](payload, gcm)
	if err != nil {
		return nil, err
	}

	res := &types.DatasetWithRows{DatasetPayload: *ds, ID: id}
	if withRows {
		dr, err := FindDatasetRows(id, false, nil)
		if err != nil {
			return nil, err
		}
		res.Rows = dr
	}
	return res, nil
}

func FindDatasetRow(id string, isProject bool, keyHash any) (types.DatasetRow, error) {
	res, err := FindDatasetRows(id, isProject, keyHash)
	if err != nil || len(res) == 0 {
		return nil, err
	}
	return res[0], nil
}

func FindDatasetRows(id string, isProject bool, keyHash any) ([]types.DatasetRow, error) {
	var kh []byte
	var err error

	if keyHash != nil {
		switch v := keyHash.(type) {
		case string:
			kh, err = lib.CreateSearchHash(v)
		case []byte:
			kh = v
		}
		if err != nil {
			return nil, err
		}
	}

	var query []byte
	var args []any
	if len(kh) > 0 {
		if isProject {
			query, err = datasetRowsQueries.ReadFile("sql/queries/dataset_rows/find_by_project_id_and_key_hash.sql")
			if err != nil {
				return nil, err
			}
		} else {
			query, err = datasetRowsQueries.ReadFile("sql/queries/dataset_rows/find_by_dataset_id_and_key_hash.sql")
			if err != nil {
				return nil, err
			}
		}
		args = append(args, id, kh)
	} else {
		if isProject {
			query, err = datasetRowsQueries.ReadFile("sql/queries/dataset_rows/find_by_project_id.sql")
			if err != nil {
				return nil, err
			}
		} else {
			query, err = datasetRowsQueries.ReadFile("sql/queries/dataset_rows/find_by_dataset_id.sql")
			if err != nil {
				return nil, err
			}
		}
		args = append(args, id)
	}

	rows, err := DB.Query(string(query), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	gcm, err := getDatasetGCM()
	if err != nil {
		return nil, err
	}

	var list []types.DatasetRow
	for rows.Next() {
		var payload []byte
		if err := rows.Scan(&payload); err != nil {
			return nil, err
		}
		dr, err := decryptJSON[types.DatasetRow](payload, gcm)
		if err != nil {
			continue
		}
		list = append(list, *dr)
	}
	return list, nil
}

func UpdateDataset(userHash []byte, id string, datasetsPayload map[string]any) (int64, error) {
	prev, err := FindDatasetById(userHash, id, false)
	if err != nil || prev == nil {
		return 0, err
	}

	// Marshals through a generic structural map to update properties dynamically
	prevBytes, _ := json.Marshal(prev.DatasetPayload)
	var intermediate map[string]any
	_ = json.Unmarshal(prevBytes, &intermediate)

	for k, v := range datasetsPayload {
		if _, exists := intermediate[k]; exists {
			intermediate[k] = v
		}
	}

	var target types.DatasetPayload
	updatedBytes, _ := json.Marshal(intermediate)
	_ = json.Unmarshal(updatedBytes, &target)

	gcm, err := getDatasetGCM()
	if err != nil {
		return 0, err
	}

	payload, err := encryptJSON(target, gcm)
	if err != nil {
		return 0, err
	}

	query, err := datasetsQueries.ReadFile("sql/queries/datasets/update_by_id.sql")
	if err != nil {
		return 0, err
	}
	res, err := DB.Exec(string(query), payload, userHash, id)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func RemoveDatasetById(userHash []byte, id string) (bool, error) {
	query, err := datasetsQueries.ReadFile("sql/queries/datasets/delete_by_id.sql")
	if err != nil {
		return false, err
	}
	res, err := DB.Exec(string(query), userHash, id)
	if err != nil {
		return false, err
	}
	count, err := res.RowsAffected()
	return count > 0, err
}

func RemoveDatasetRows(datasetId string, keyHash ...[]byte) (bool, error) {
	var res sql.Result
	var err error
	var query []byte

	if len(keyHash) > 0 && len(keyHash[0]) > 0 {
		query, err = datasetRowsQueries.ReadFile("sql/queries/dataset_rows/delete_by_dataset_id_and_key_hash.sql")
		if err == nil {
			res, err = DB.Exec(string(query), datasetId, keyHash[0])
		}
	} else {
		query, err = datasetRowsQueries.ReadFile("sql/queries/dataset_rows/delete_by_dataset_id.sql")
		if err == nil {
			res, err = DB.Exec(string(query), datasetId)
		}
	}

	if err != nil {
		return false, err
	}
	count, err := res.RowsAffected()
	return count > 0, err
}
