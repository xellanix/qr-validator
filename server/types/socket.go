package types

// SocketData mirrors the custom context attached to every client connection.
type SocketData struct {
	IsTrulyLocal   bool
	User           *User
	UserHashBytes  []byte
	UserHashBase64 string
}

// SocketResponse uniform shape matching the original client interface expectations.
type SocketResponse struct {
	Status  string `json:"status"`            // "success" | "error" | "info"
	Data    any    `json:"data,omitempty"`    // Arbitrary response payload
	Error   string `json:"error,omitempty"`   // Error description string
	Message string `json:"message,omitempty"` // General operational message
}

// Permissions replicates the original authorize level validation bitmask properties.
type Permissions struct {
	IsUseDataset     bool
	CanAccessConsole bool
	CanScan          bool
	CanDelete        bool
	CanReport        bool
}
