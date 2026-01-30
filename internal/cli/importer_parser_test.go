package cli

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseCSVFile(t *testing.T) {
	tests := []struct {
		name         string
		content      string
		wantHeaders  []string
		wantRowCount int
		wantErr      bool
	}{
		{
			name: "basic csv",
			content: `Date,Description,Amount
2025-01-10,Groceries,-50.00
2025-01-11,Salary,1000.00`,
			wantHeaders:  []string{"Date", "Description", "Amount"},
			wantRowCount: 2,
			wantErr:      false,
		},
		{
			name:         "csv with BOM",
			content:      "\xEF\xBB\xBFDate,Amount\n2025-01-10,-50.00",
			wantHeaders:  []string{"Date", "Amount"},
			wantRowCount: 1,
			wantErr:      false,
		},
		{
			name:         "empty file",
			content:      "",
			wantHeaders:  nil,
			wantRowCount: 0,
			wantErr:      true,
		},
		{
			name: "csv with quotes",
			content: `Date,Description,Amount
2025-01-10,"Some, quoted text",-50.00`,
			wantHeaders:  []string{"Date", "Description", "Amount"},
			wantRowCount: 1,
			wantErr:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tmpDir := t.TempDir()
			path := filepath.Join(tmpDir, "test.csv")
			if err := os.WriteFile(path, []byte(tt.content), 0644); err != nil {
				t.Fatal(err)
			}

			got, err := parseCSVFile(path)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseCSVFile() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if err != nil {
				return
			}

			if len(got.headers) != len(tt.wantHeaders) {
				t.Errorf("got %d headers, want %d", len(got.headers), len(tt.wantHeaders))
			}
			for i, h := range tt.wantHeaders {
				if got.headers[i] != h {
					t.Errorf("header[%d] = %q, want %q", i, got.headers[i], h)
				}
			}
			if len(got.rows) != tt.wantRowCount {
				t.Errorf("got %d rows, want %d", len(got.rows), tt.wantRowCount)
			}
		})
	}
}

func TestParseXLSXFile(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "test.xlsx")

	// For now, just test that non-existent file returns error
	_, err := parseXLSXFile(path)
	if err == nil {
		t.Error("expected error for non-existent file")
	}
}

func TestParseXLSFile(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "test.xls")

	// Test non-existent file
	_, err := parseXLSFile(path)
	if err == nil {
		t.Error("expected error for non-existent file")
	}

	// Test invalid file (not a valid XLS)
	if err := os.WriteFile(path, []byte("not a valid xls file"), 0644); err != nil {
		t.Fatal(err)
	}
	_, err = parseXLSFile(path)
	if err == nil {
		t.Error("expected error for invalid XLS file")
	}
}

func TestParseFileForImport(t *testing.T) {
	tmpDir := t.TempDir()

	tests := []struct {
		name    string
		ext     string
		content []byte
		wantErr bool
	}{
		{
			name:    "unsupported extension",
			ext:     ".pdf",
			content: []byte("test"),
			wantErr: true,
		},
		{
			name:    "csv file",
			ext:     ".csv",
			content: []byte("Date,Amount\n2025-01-10,-50.00"),
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := filepath.Join(tmpDir, "test"+tt.ext)
			if err := os.WriteFile(path, tt.content, 0644); err != nil {
				t.Fatal(err)
			}

			_, err := parseFileForImport(path)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseFileForImport() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestDetectHeaderRow(t *testing.T) {
	tests := []struct {
		name string
		rows [][]string
		want bool
	}{
		{
			name: "header with keywords",
			rows: [][]string{
				{"Date", "Description", "Amount"},
				{"2025-01-10", "Groceries", "-50.00"},
			},
			want: true,
		},
		{
			name: "data looks like numbers",
			rows: [][]string{
				{"2025-01-10", "-50.00"},
				{"2025-01-11", "100.00"},
			},
			want: false,
		},
		{
			name: "first row text, second row numbers",
			rows: [][]string{
				{"Transaction", "Details"},
				{"2025-01-10", "-50.00"},
			},
			want: true,
		},
		{
			name: "empty rows",
			rows: [][]string{},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := detectHeaderRow(tt.rows)
			if got != tt.want {
				t.Errorf("detectHeaderRow() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBuildParsedRows(t *testing.T) {
	tests := []struct {
		name       string
		rawRows    [][]string
		hasHeader  bool
		wantHeader []string
		wantRows   int
	}{
		{
			name: "with header",
			rawRows: [][]string{
				{"Date", "Amount"},
				{"2025-01-10", "-50.00"},
			},
			hasHeader:  true,
			wantHeader: []string{"Date", "Amount"},
			wantRows:   1,
		},
		{
			name: "without header",
			rawRows: [][]string{
				{"2025-01-10", "-50.00"},
				{"2025-01-11", "100.00"},
			},
			hasHeader:  false,
			wantHeader: []string{"Column A", "Column B"},
			wantRows:   2,
		},
		{
			name:       "empty rows",
			rawRows:    [][]string{},
			hasHeader:  true,
			wantHeader: nil,
			wantRows:   0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			headers, rows := buildParsedRows(tt.rawRows, tt.hasHeader)
			if len(headers) != len(tt.wantHeader) {
				t.Errorf("got %d headers, want %d", len(headers), len(tt.wantHeader))
			}
			if len(rows) != tt.wantRows {
				t.Errorf("got %d rows, want %d", len(rows), tt.wantRows)
			}
		})
	}
}

func TestToColumnName(t *testing.T) {
	tests := []struct {
		input int
		want  string
	}{
		{0, "A"},
		{1, "B"},
		{25, "Z"},
		{26, "AA"},
		{27, "AB"},
		{51, "AZ"},
		{52, "BA"},
		{701, "ZZ"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			got := toColumnName(tt.input)
			if got != tt.want {
				t.Errorf("toColumnName(%d) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
