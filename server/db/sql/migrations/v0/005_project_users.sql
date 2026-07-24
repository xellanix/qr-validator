CREATE TABLE
	IF NOT EXISTS project_users (
		project_id TEXT NOT NULL,
		user_hash BLOB NOT NULL,
		PRIMARY KEY (project_id, user_hash),
		FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
		FOREIGN KEY (user_hash) REFERENCES users (user_hash) ON DELETE CASCADE
	);