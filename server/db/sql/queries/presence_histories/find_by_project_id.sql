SELECT
    ph.id,
    dr.payload AS dataset_row_payload,
    u.payload AS presence_by_user_payload,
    ph.status,
    ph.created_at_ns
FROM
    presence_histories ph
    JOIN dataset_rows dr ON ph.dataset_row_id = dr.id
    LEFT JOIN users u ON ph.presence_by_user_hash = u.user_hash
WHERE
    ph.project_id = ?
    AND ph.batch_number = ?
ORDER BY
    ph.id DESC;