package types

type User struct {
	Hash           string `json:"hash,omitempty"`
	Name           string `json:"name"`
	AuthorizeLevel int    `json:"authorizeLevel"`
}
