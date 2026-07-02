package types

type DataContentType map[string]string // "text" | "image"

type DatasetPayload struct {
	Key      string          `json:"key"`
	KeyLabel string          `json:"keyLabel"`
	Columns  DataContentType `json:"columns"`
}

type DatasetRow map[string]string

type DatasetWithRows struct {
	DatasetPayload
	ID   string       `json:"id,omitempty"`
	Rows []DatasetRow `json:"rows,omitempty"`
}
