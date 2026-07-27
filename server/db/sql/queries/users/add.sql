INSERT INTO
    users (user_hash, payload)
VALUES
    (?, ?) ON CONFLICT (user_hash) DO
UPDATE
SET
    payload = excluded.payload