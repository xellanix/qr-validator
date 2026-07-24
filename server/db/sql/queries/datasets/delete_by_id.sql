DELETE FROM datasets
WHERE
    creator_user_hash = ?
    AND id = ?