INSERT INTO
    presence_history_batches (project_id, batch_number)
VALUES
    (?, ?) ON CONFLICT (project_id) DO
UPDATE
SET
    batch_number = excluded.batch_number;