CREATE TABLE IF NOT EXISTS projects (
	id TEXT PRIMARY KEY DEFAULT (
		lower(
			hex(randomblob(4)) || '-' || 
			hex(randomblob(2)) || '-4' || 
			substr(hex(randomblob(2)), 2) || '-' || 
			substr('89ab', abs(randomblob(1) % 4) + 1, 1) || 
			substr(hex(randomblob(2)), 2) || '-' || 
			hex(randomblob(6))
		)
	),
	dataset_id TEXT,
	creator_user_hash BLOB,
	name TEXT,
	schema_objects TEXT,
	allow_duplicate_valid BOOLEAN,
	max_valid_duplicate INTEGER,
	is_continuous_scanning BOOLEAN,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (dataset_id) REFERENCES datasets (id) ON DELETE SET NULL,
	FOREIGN KEY (creator_user_hash) REFERENCES users (user_hash) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_project_dataset_id ON projects (dataset_id);
CREATE INDEX IF NOT EXISTS idx_project_user_hash ON projects (creator_user_hash);