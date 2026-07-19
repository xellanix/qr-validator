package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"premark/types"
	"reflect"
	"strings"
)

type projectRow struct {
	ID                   string
	DatasetID            sql.NullString
	Name                 string
	SchemaObjects        string
	AllowDuplicateValid  bool
	MaxValidDuplicate    int
	IsContinuousScanning bool
}

const addProjectQuery = "INSERT INTO projects (dataset_id, creator_user_hash, name, schema_objects, allow_duplicate_valid, max_valid_duplicate, is_continuous_scanning) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id"
const assignUsersToProjectQuery = "INSERT OR IGNORE INTO project_users (project_id, user_hash) VALUES (?, ?)"
const getAssignedUsersDataByProjectIdQuery = "SELECT u.payload FROM project_users p JOIN users u ON p.user_hash = u.user_hash WHERE p.project_id = ?"
const getAllProjectsQuery = "SELECT id, dataset_id, name, schema_objects, allow_duplicate_valid, max_valid_duplicate, is_continuous_scanning FROM projects WHERE creator_user_hash = ?"
const findProjectByIdQuery = "SELECT id, dataset_id, name, schema_objects, allow_duplicate_valid, max_valid_duplicate, is_continuous_scanning FROM projects WHERE creator_user_hash = ? AND id = ?"
const findProjectScanOptByIdQuery = "SELECT allow_duplicate_valid, max_valid_duplicate, is_continuous_scanning FROM projects WHERE creator_user_hash = ? AND id = ?"
const deleteAssignedUsersFromProjectQuery = "DELETE FROM project_users WHERE project_id = ?"
const deleteProjectByIdQuery = "DELETE FROM projects WHERE creator_user_hash = ? AND id = ?"

func AddProject(userHash []byte, datasetId string, name string, schemaObjects []types.SchemaObject, assignedUsers []types.User, allowDuplicateValid bool, maxValidDuplicate int, isContinuousScanning bool) (string, error) {
	schemaBytes, err := json.Marshal(schemaObjects)
	if err != nil {
		return "", err
	}

	var id string
	err = DB.QueryRow(addProjectQuery, sql.NullString{String: datasetId, Valid: datasetId != ""}, userHash, name, string(schemaBytes), allowDuplicateValid, maxValidDuplicate, isContinuousScanning).Scan(&id)
	if err != nil {
		return "", err
	}

	_, hashes, err := AddUsers(assignedUsers, id)
	if err != nil || len(hashes) == 0 {
		return "", err
	}

	tx, err := DB.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(assignUsersToProjectQuery)
	if err != nil {
		return "", err
	}
	defer stmt.Close()

	for _, h := range hashes {
		if _, err := stmt.Exec(id, h); err != nil {
			return "", err
		}
	}

	return id, tx.Commit()
}

func getProjectWithRelations(userHash []byte, row projectRow, withDataset, excludeUsers, excludeDatasetId bool) (map[string]any, error) {
	var schema []types.SchemaObject
	if err := json.Unmarshal([]byte(row.SchemaObjects), &schema); err != nil {
		return nil, err
	}

	p := make(map[string]any)
	p["id"] = row.ID
	p["name"] = row.Name
	p["schemaObjects"] = schema
	p["allowDuplicateValid"] = row.AllowDuplicateValid
	p["maxValidDuplicate"] = row.MaxValidDuplicate
	p["isContinuousScanning"] = row.IsContinuousScanning

	if !excludeDatasetId {
		if row.DatasetID.Valid {
			p["datasetId"] = row.DatasetID.String
		} else {
			p["datasetId"] = nil
		}
	}

	if withDataset && row.DatasetID.Valid {
		ds, err := FindDatasetById(userHash, row.DatasetID.String, false)
		if err == nil && ds != nil {
			p["key"] = ds.Key
			p["keyLabel"] = ds.KeyLabel
			p["columns"] = ds.Columns
		}
	}

	if !excludeUsers {
		rows, err := DB.Query(getAssignedUsersDataByProjectIdQuery, row.ID)
		if err == nil {
			defer rows.Close()
			var users []types.User
			for rows.Next() {
				var payload []byte
				if err := rows.Scan(&payload); err == nil {
					if u, err := GetUser(payload); err == nil && u != nil {
						users = append(users, *u)
					}
				}
			}
			p["users"] = users
		}
	}

	return p, nil
}

func GetAllProjects(userHash []byte, withDataset bool) (map[string]any, error) {
	rows, err := DB.Query(getAllProjectsQuery, userHash)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	projects := make(map[string]any)
	for rows.Next() {
		var r projectRow
		if err := rows.Scan(&r.ID, &r.DatasetID, &r.Name, &r.SchemaObjects, &r.AllowDuplicateValid, &r.MaxValidDuplicate, &r.IsContinuousScanning); err != nil {
			continue
		}

		p, err := getProjectWithRelations(userHash, r, withDataset, false, false)
		if err != nil {
			continue
		}
		projects[r.ID] = p
	}
	return projects, nil
}

func FindProjectById(userHash []byte, id string, withDataset, excludeDatasetId bool) (map[string]any, error) {
	var r projectRow
	err := DB.QueryRow(findProjectByIdQuery, userHash, id).Scan(&r.ID, &r.DatasetID, &r.Name, &r.SchemaObjects, &r.AllowDuplicateValid, &r.MaxValidDuplicate, &r.IsContinuousScanning)
	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, err
	}

	return getProjectWithRelations(userHash, r, withDataset, true, excludeDatasetId)
}

func FindProjectScanOptById(userHash []byte, id string) (map[string]any, error) {
	var r struct {
		allowDuplicateValid  bool
		maxValidDuplicate    int
		isContinuousScanning bool
	}
	err := DB.QueryRow(findProjectScanOptByIdQuery, userHash, id).Scan(&r.allowDuplicateValid, &r.maxValidDuplicate, &r.isContinuousScanning)
	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, err
	}

	res := make(map[string]any)
	v := reflect.ValueOf(r)

	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}

	t := v.Type()
	for i := 0; i < v.NumField(); i++ {
		field := t.Field(i)
		value := v.Field(i).Interface()
		res[field.Name] = value
	}

	return res, nil
}

func UpdateProject(userHash []byte, id string, projectsPayload map[string]any, newAssignedUsers []types.User) (int64, error) {
	var totalChanges int64 = 0

	if len(newAssignedUsers) > 0 {
		var filePayloads []filePayload
		var payloads [][]byte
		var hashes [][]byte

		for _, u := range newAssignedUsers {
			hash, tokenBytes, token, err := CreateUserHash(u)
			if err != nil {
				return 0, err
			}

			payloadMap := map[string]string{"token": token}
			payload, err := encryptJSON(payloadMap)
			if err != nil {
				return 0, err
			}

			payloads = append(payloads, payload)
			filePayloads = append(filePayloads, filePayload{Name: u.Name, TokenBytes: tokenBytes})
			hashes = append(hashes, hash)
		}

		changes, err := syncProjectUsers(id, hashes, payloads)
		if err != nil || changes == 0 {
			return 0, err
		}
		totalChanges += changes

		for _, fp := range filePayloads {
			writeTokenFile(fp.Name, fp.TokenBytes, id)
		}
	}

	if len(projectsPayload) == 0 {
		return totalChanges, nil
	}

	var updates []string
	var args []any
	for k, v := range projectsPayload {
		updates = append(updates, fmt.Sprintf("%s = ?", k))
		args = append(args, v)
	}

	query := fmt.Sprintf("UPDATE projects SET %s WHERE creator_user_hash = ? AND id = ?", strings.Join(updates, ", "))
	args = append(args, userHash, id)

	res, err := DB.Exec(query, args...)
	if err != nil {
		return 0, err
	}

	dbChanges, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}
	return totalChanges + dbChanges, nil
}

func syncProjectUsers(projectId string, newUsers [][]byte, newPayloads [][]byte) (int64, error) {
	tx, err := DB.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	if len(newUsers) == 0 {
		res, err := tx.Exec(deleteAssignedUsersFromProjectQuery, projectId)
		if err != nil {
			return 0, err
		}
		return res.RowsAffected()
	}

	placeholders := make([]string, len(newUsers))
	args := make([]any, len(newUsers)+1)
	args[0] = projectId

	for i, h := range newUsers {
		placeholders[i] = "?"
		args[i+1] = h
	}

	delQuery := fmt.Sprintf("DELETE FROM project_users WHERE project_id = ? AND user_hash NOT IN (%s)", strings.Join(placeholders, ","))
	if _, err := tx.Exec(delQuery, args...); err != nil {
		return 0, err
	}

	userStmt, err := tx.Prepare(addUserQuery)
	if err != nil {
		return 0, err
	}
	defer userStmt.Close()

	assignStmt, err := tx.Prepare(assignUsersToProjectQuery)
	if err != nil {
		return 0, err
	}
	defer assignStmt.Close()

	for i, newUser := range newUsers {
		if _, err := userStmt.Exec(newUser, newPayloads[i]); err != nil {
			return 0, err
		}
		if _, err := assignStmt.Exec(projectId, newUser); err != nil {
			return 0, err
		}
	}

	return int64(len(newUsers)), tx.Commit()
}

func RemoveProjectById(userHash []byte, id string) (bool, error) {
	res, err := DB.Exec(deleteProjectByIdQuery, userHash, id)
	if err != nil {
		return false, err
	}
	count, err := res.RowsAffected()
	return count > 0, err
}
