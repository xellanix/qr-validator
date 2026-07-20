SELECT
    pu.project_id,
    p.creator_user_hash
FROM
    project_users pu
    JOIN projects p ON pu.project_id = p.id
WHERE
    pu.user_hash = ?