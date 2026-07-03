package types

type User struct {
	Name           string `json:"name"`
	AuthorizeLevel int    `json:"authorizeLevel"`
}
