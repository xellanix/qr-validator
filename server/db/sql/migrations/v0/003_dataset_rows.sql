CREATE TABLE
	IF NOT EXISTS dataset_rows (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		dataset_id TEXT NOT NULL,
		key_hash BLOB NOT NULL,
		payload BLOB NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (dataset_id) REFERENCES datasets (id) ON DELETE CASCADE
	);

CREATE INDEX IF NOT EXISTS idx_dataset_rows_key_hash ON dataset_rows (dataset_id, key_hash);