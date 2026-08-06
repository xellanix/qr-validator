INSERT INTO
    presence_histories (
        id,
        project_id,
        dataset_row_id,
        presence_by_user_hash,
        status,
        batch_number,
        created_at_ns
    )
VALUES
    (?, ?, ?, ?, ?, ?, ?)