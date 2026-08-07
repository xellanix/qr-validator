SELECT
    d.id,
    d.payload
FROM
    datasets d
    JOIN projects p ON d.id = p.dataset_id
WHERE
    d.creator_user_hash = ?
    AND p.id = ?