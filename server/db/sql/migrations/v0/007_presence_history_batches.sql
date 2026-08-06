CREATE TABLE
    IF NOT EXISTS presence_history_batches (
        project_id TEXT PRIMARY KEY,
        batch_number INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    ) WITHOUT ROWID;