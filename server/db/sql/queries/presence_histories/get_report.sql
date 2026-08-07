SELECT
    (ph.id IS NOT NULL) AS present,
    dr.payload,
    u.payload AS presence_by_user_payload,
    ph.created_at_ns,
    ph.status
FROM
    projects p
    JOIN dataset_rows dr ON dr.dataset_id = p.dataset_id
    LEFT JOIN presence_histories ph ON ph.dataset_row_id = dr.id
    AND ph.project_id = p.id
    AND ph.batch_number = ?
    LEFT JOIN users u ON ph.presence_by_user_hash = u.user_hash
WHERE
    p.id = ?