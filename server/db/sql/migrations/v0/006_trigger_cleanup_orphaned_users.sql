CREATE TRIGGER IF NOT EXISTS cleanup_orphaned_users AFTER DELETE ON project_users BEGIN
DELETE FROM users
WHERE
    user_hash = OLD.user_hash
    AND NOT EXISTS (
        SELECT
            1
        FROM
            project_users
        WHERE
            user_hash = OLD.user_hash
    );

END;