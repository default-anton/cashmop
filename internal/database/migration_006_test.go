package database

import (
	"encoding/json"
	"testing"
)

// TestMigration006_RenameDefaultOwner tests that defaultOwner is renamed to owner
// and csv.owner column mapping is removed.
func TestMigration006_RenameDefaultOwner(t *testing.T) {
	h := newMigrationTest(t, 6)

	// Setup: Insert data in OLD format (as it existed after migration 005)
	h.exec(`INSERT INTO column_mappings (name, mapping_json) VALUES
		('with_default_owner', json_set(
			json_object(
				'csv', json_object('date', 'Date', 'description', json_array('Description'), 
					'amountMapping', json_object('type', 'single', 'column', 'Amount'), 'owner', 'OwnerColumn', 'account', 'Account'),
				'account', 'MyAccount',
				'currencyDefault', 'CAD'
			),
			'$.defaultOwner', 'Alex'
		)),
		('without_default_owner', json_object(
			'csv', json_object('date', 'Date', 'description', json_array('Description'),
				'amountMapping', json_object('type', 'single', 'column', 'Amount')),
			'account', 'MyAccount',
			'currencyDefault', 'USD'
		)),
		('with_empty_default_owner', json_set(
			json_object(
				'csv', json_object('date', 'Date', 'description', json_array('Description'),
					'amountMapping', json_object('type', 'single', 'column', 'Amount'), 'owner', 'OldOwner'),
				'account', 'MyAccount',
				'currencyDefault', 'EUR'
			),
			'$.defaultOwner', ''
		))`)

	// Run migration 006
	h.run()

	// Verify: defaultOwner -> owner, csv.owner removed

	// Case 1: defaultOwner "Alex" becomes owner "Alex", csv.owner removed
	json1 := h.queryJSON("SELECT mapping_json FROM column_mappings WHERE name = 'with_default_owner'")
	m1 := h.parseMapping(json1)
	if m1.Owner != "Alex" {
		t.Errorf("expected owner 'Alex', got '%s'", m1.Owner)
	}
	var raw1 map[string]interface{}
	json.Unmarshal([]byte(json1), &raw1)
	csv1 := raw1["csv"].(map[string]interface{})
	if _, exists := csv1["owner"]; exists {
		t.Errorf("expected csv.owner to be removed, but it exists: %v", csv1["owner"])
	}

	// Case 2: no defaultOwner, owner should be empty
	json2 := h.queryJSON("SELECT mapping_json FROM column_mappings WHERE name = 'without_default_owner'")
	m2 := h.parseMapping(json2)
	if m2.Owner != "" {
		t.Errorf("expected empty owner, got '%s'", m2.Owner)
	}

	// Case 3: empty defaultOwner, owner empty, csv.owner removed
	json3 := h.queryJSON("SELECT mapping_json FROM column_mappings WHERE name = 'with_empty_default_owner'")
	m3 := h.parseMapping(json3)
	if m3.Owner != "" {
		t.Errorf("expected empty owner, got '%s'", m3.Owner)
	}
	var raw3 map[string]interface{}
	json.Unmarshal([]byte(json3), &raw3)
	csv3 := raw3["csv"].(map[string]interface{})
	if _, exists := csv3["owner"]; exists {
		t.Errorf("expected csv.owner to be removed, but it exists: %v", csv3["owner"])
	}

	// Test idempotency: run SQL again (without schema_migrations tracking), should produce same result
	h.runSQL()

	json1Again := h.queryJSON("SELECT mapping_json FROM column_mappings WHERE name = 'with_default_owner'")
	if json1 != json1Again {
		t.Errorf("migration not idempotent: before=%s, after=%s", json1, json1Again)
	}
}

// TestMigration006_RenameDefaultOwnerDown tests the down migration.
func TestMigration006_RenameDefaultOwnerDown(t *testing.T) {
	h := newMigrationTest(t, 6)

	// Apply the up migration first to get to post-migration state
	h.run()

	// Insert data in NEW format (after migration 006)
	h.exec(`INSERT INTO column_mappings (name, mapping_json) VALUES
		('test_mapping', json_object(
			'csv', json_object('date', 'Date', 'description', json_array('Description'),
				'amountMapping', json_object('type', 'single', 'column', 'Amount')),
			'account', 'MyAccount',
			'owner', 'Alex',
			'currencyDefault', 'CAD'
		))`)

	// Verify setup
	jsonBefore := h.queryJSON("SELECT mapping_json FROM column_mappings WHERE name = 'test_mapping'")
	mBefore := h.parseMapping(jsonBefore)
	if mBefore.Owner != "Alex" {
		t.Fatalf("setup failed: expected owner 'Alex', got '%s'", mBefore.Owner)
	}

	// Run down migration
	h.runDown()

	// Verify: owner -> defaultOwner, csv.owner stays absent
	jsonAfter := h.queryJSON("SELECT mapping_json FROM column_mappings WHERE name = 'test_mapping'")

	var raw map[string]interface{}
	if err := json.Unmarshal([]byte(jsonAfter), &raw); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if raw["defaultOwner"] != "Alex" {
		t.Errorf("expected defaultOwner 'Alex', got %v", raw["defaultOwner"])
	}
	csv := raw["csv"].(map[string]interface{})
	if _, exists := csv["owner"]; exists {
		t.Errorf("expected csv.owner to remain absent, but exists: %v", csv["owner"])
	}
}
