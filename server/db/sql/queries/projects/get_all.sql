SELECT
    id,
    dataset_id,
    name,
    schema_objects,
    allow_duplicate_valid,
    max_valid_duplicate,
    is_continuous_scanning
FROM
    projects
WHERE
    creator_user_hash = ?