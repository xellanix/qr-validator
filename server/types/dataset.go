package types

import (
	orderedMap "github.com/wk8/go-ordered-map/v2"
)

type DataContentType = *orderedMap.OrderedMap[string, string] // "text" | "image"

type DatasetPayload struct {
	Key      string          `json:"key"`
	KeyLabel string          `json:"keyLabel"`
	Columns  DataContentType `json:"columns"`
}

//type DatasetPayloadMap = *orderedMap.OrderedMap[string, any]

type DatasetRow map[string]string

type DatasetWithRows struct {
	DatasetPayload
	ID   string       `json:"id,omitempty"`
	Rows []DatasetRow `json:"rows,omitempty"`
}
