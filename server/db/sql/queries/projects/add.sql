INSERT INTO
    projects (
        dataset_id,
        creator_user_hash,
        name,
        schema_objects,
        skip_dataset_check,
        allow_duplicate_valid,
        max_valid_duplicate,
        is_continuous_scanning
    )
VALUES
    (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id