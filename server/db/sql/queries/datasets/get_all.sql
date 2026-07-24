SELECT
    id,
    payload
FROM
    datasets
WHERE
    creator_user_hash = ?