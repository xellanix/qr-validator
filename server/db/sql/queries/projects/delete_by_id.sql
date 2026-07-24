DELETE FROM projects
WHERE
    creator_user_hash = ?
    AND id = ?