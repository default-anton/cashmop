-- Reverse: restore defaultOwner from owner, keep owner as fallback for forward compatibility
UPDATE column_mappings SET mapping_json = json_set(
  json_remove(
    json_remove(mapping_json, '$.owner'),
    '$.csv.owner'
  ),
  '$.defaultOwner',
  COALESCE(json_extract(mapping_json, '$.owner'), '')
);
