SELECT
    u.payload
FROM
    project_users p
    JOIN users u ON p.user_hash = u.user_hash
WHERE
    p.project_id = ?