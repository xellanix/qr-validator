SELECT
    EXISTS (
        SELECT
            1
        FROM
            presence_histories
        WHERE
            project_id = ?
            AND batch_number = ?
            AND dataset_row_id = ?
            AND status = 'Valid'
        LIMIT
            1
        OFFSET
            ?
    );