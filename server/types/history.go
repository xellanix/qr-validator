package types

type ScanEntry struct {
	Id            string `json:"id"`
	Data          string `json:"data"`
	ValidatorName string `json:"validatorName"`
	ValidatedAt   string `json:"validatedAt"`
	Status        string `json:"status"` // "Valid" | "Not Valid"
}
