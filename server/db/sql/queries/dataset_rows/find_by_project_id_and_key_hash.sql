SELECT
    r.payload
FROM
    dataset_rows r
    JOIN projects p ON r.dataset_id = p.dataset_id
WHERE
    p.id = ?
    AND r.key_hash = ?