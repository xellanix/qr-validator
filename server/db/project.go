package db

import (
	"database/sql"
	"embed"
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

//go:embed sql/queries/projects
var projectsQueries embed.FS

//go:embed sql/queries/project_users
var projectUsersQueries embed.FS

func AddProject(userHash []byte, datasetId string, name string, schemaObjects []types.SchemaObject, assignedUsers []types.User, allowDuplicateValid bool, maxValidDuplicate int, isContinuousScanning bool) (string, error) {
	schemaBytes, err := json.Marshal(schemaObjects)
	if err != nil {
		return "", err
	}

	query, err := projectsQueries.ReadFile("sql/queries/projects/add.sql")
	if err != nil {
		return "", err
	}

	var id string
	err = DB.QueryRow(string(query), sql.NullString{String: datasetId, Valid: datasetId != ""}, userHash, name, string(schemaBytes), allowDuplicateValid, maxValidDuplicate, isContinuousScanning).Scan(&id)
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

	query, err = projectUsersQueries.ReadFile("sql/queries/project_users/add.sql")
	if err != nil {
		return "", err
	}

	stmt, err := tx.Prepare(string(query))
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
		query, err := projectUsersQueries.ReadFile("sql/queries/project_users/find_by_project_id.sql")
		if err != nil {
			return nil, err
		}

		rows, err := DB.Query(string(query), row.ID)
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
	query, err := projectsQueries.ReadFile("sql/queries/projects/get_all.sql")
	if err != nil {
		return nil, err
	}

	rows, err := DB.Query(string(query), userHash)
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
	query, err := projectsQueries.ReadFile("sql/queries/projects/find_by_id.sql")
	if err != nil {
		return nil, err
	}

	var r projectRow
	err = DB.QueryRow(string(query), userHash, id).Scan(&r.ID, &r.DatasetID, &r.Name, &r.SchemaObjects, &r.AllowDuplicateValid, &r.MaxValidDuplicate, &r.IsContinuousScanning)
	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, err
	}

	return getProjectWithRelations(userHash, r, withDataset, true, excludeDatasetId)
}

func FindProjectScanOptById(userHash []byte, id string) (map[string]any, error) {
	query, err := projectsQueries.ReadFile("sql/queries/projects/find_scan_opt_by_id.sql")
	if err != nil {
		return nil, err
	}

	var r struct {
		allowDuplicateValid  bool
		maxValidDuplicate    int
		isContinuousScanning bool
	}
	err = DB.QueryRow(string(query), userHash, id).Scan(&r.allowDuplicateValid, &r.maxValidDuplicate, &r.isContinuousScanning)
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
		query, err := projectUsersQueries.ReadFile("sql/queries/project_users/delete_all_by_project_id.sql")
		if err != nil {
			return 0, err
		}

		res, err := tx.Exec(string(query), projectId)
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

	query, err := usersQueries.ReadFile("sql/queries/users/add.sql")
	if err != nil {
		return 0, err
	}
	userStmt, err := tx.Prepare(string(query))
	if err != nil {
		return 0, err
	}
	defer userStmt.Close()

	query, err = projectUsersQueries.ReadFile("sql/queries/project_users/add.sql")
	if err != nil {
		return 0, err
	}
	assignStmt, err := tx.Prepare(string(query))
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
	query, err := projectsQueries.ReadFile("sql/queries/projects/delete_by_id.sql")
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

func GetProjectCreatorForUser(userHash []byte) (string, []byte, error) {
	var pID string
	var creatorHash []byte

	query, err := projectsQueries.ReadFile("sql/queries/projects/get_project_creator.sql")
	if err != nil {
		return "", nil, err
	}

	err = DB.QueryRow(string(query), userHash).Scan(&pID, &creatorHash)
	if err == sql.ErrNoRows {
		return "", nil, nil
	}
	return pID, creatorHash, err
}
