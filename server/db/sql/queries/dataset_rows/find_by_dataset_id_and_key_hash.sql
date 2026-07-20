SELECT
    payload
FROM
    dataset_rows
WHERE
    dataset_id = ?
    AND key_hash = ?