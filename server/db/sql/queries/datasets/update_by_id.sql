UPDATE datasets
SET
    payload = ?
WHERE
    creator_user_hash = ?
    AND id = ?