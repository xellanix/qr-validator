CREATE TRIGGER IF NOT EXISTS update_projects_updated_at AFTER
UPDATE ON projects WHEN OLD.updated_at IS NEW.updated_at BEGIN
UPDATE projects
SET
    updated_at = CURRENT_TIMESTAMP
WHERE
    id = OLD.id;

END;