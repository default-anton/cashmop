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
