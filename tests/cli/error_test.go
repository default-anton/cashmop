package cli_test

import (
	"testing"
)

func TestErrorStructure(t *testing.T) {
	db := setupDB(t)

	// Missing required flags for import
	res, _ := run(db, "import")
	assertGlobal(t, res, 2)

	errors := res.JSON["errors"].([]interface{})
	if len(errors) == 0 {
		t.Errorf("expected errors in JSON, got empty")
	}

	errDetail := errors[0].(map[string]interface{})
	if _, ok := errDetail["message"]; !ok {
		t.Errorf("expected 'message' in error detail")
	}

	// Invalid date range
	res, _ = run(db, "tx", "list", "--start", "2025-01-01")
	assertGlobal(t, res, 2)

	errors = res.JSON["errors"].([]interface{})
	foundField := false
	for _, e := range errors {
		ed := e.(map[string]interface{})
		if ed["field"] == "start" {
			foundField = true
			if ed["hint"] == "" {
				t.Errorf("expected hint for start date error")
			}
		}
	}
	if !foundField {
		t.Errorf("expected error field 'start' for missing end date")
	}
}

func TestValidationHints(t *testing.T) {
	db := setupDB(t)

	res, _ := run(db, "import")
	assertGlobal(t, res, 2)

	errors := res.JSON["errors"].([]interface{})
	var fileHint bool
	var mappingHint bool
	for _, e := range errors {
		ed := e.(map[string]interface{})
		field, _ := ed["field"].(string)
		hint, _ := ed["hint"].(string)
		if field == "file" && hint != "" {
			fileHint = true
		}
		if field == "mapping" && hint != "" {
			mappingHint = true
		}
	}
	if !fileHint {
		t.Errorf("expected hint for --file error")
	}
	if !mappingHint {
		t.Errorf("expected hint for --mapping error")
	}

	res, _ = run(db, "tx", "list", "--bogus")
	assertGlobal(t, res, 2)

	errors = res.JSON["errors"].([]interface{})
	if len(errors) == 0 {
		t.Fatalf("expected errors for unknown flag")
	}
	first := errors[0].(map[string]interface{})
	field, _ := first["field"].(string)
	if field != "bogus" {
		t.Errorf("expected field 'bogus', got %v", first["field"])
	}
	hint, _ := first["hint"].(string)
	if hint == "" {
		t.Errorf("expected hint for unknown flag error")
	}
}
