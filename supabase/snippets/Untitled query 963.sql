SELECT id, title FROM roles;
INSERT INTO role_areas (id, role_id, title, description, display_order, created_at, updated_at)
--   VALUES
--     ('<original-area-id>', '<role-uuid>', 'Area title', '{"type":"doc",...}', 0, now(), now()),
--     ...;