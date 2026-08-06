CREATE TABLE
    IF NOT EXISTS presence_histories (
        id BLOB PRIMARY KEY,
        project_id TEXT NOT NULL,
        dataset_row_id INTEGER NOT NULL,
        presence_by_user_hash BLOB,
        batch_number INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at_ns INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        FOREIGN KEY (dataset_row_id) REFERENCES dataset_rows (id) ON DELETE CASCADE,
        FOREIGN KEY (presence_by_user_hash) REFERENCES users (user_hash) ON DELETE SET NULL
    );

CREATE INDEX idx_presence_histories_lookup ON presence_histories (project_id, dataset_row_id, status);