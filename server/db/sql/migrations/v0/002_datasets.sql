CREATE TABLE IF NOT EXISTS datasets (
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
	creator_user_hash BLOB,
	payload BLOB NOT NULL,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (creator_user_hash) REFERENCES users (user_hash) ON DELETE CASCADE
);