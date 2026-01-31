-- Rename defaultOwner → owner and remove csv.owner column mapping
-- This is idempotent: safe to run multiple times
UPDATE column_mappings SET mapping_json = json_set(
  json_remove(
    json_remove(mapping_json, '$.defaultOwner'),
    '$.csv.owner'
  ),
  '$.owner',
  COALESCE(json_extract(mapping_json, '$.defaultOwner'), json_extract(mapping_json, '$.owner'), '')
);
