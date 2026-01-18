package cli

import (
	"encoding/json"
	"fmt"
	"io"
	"text/tabwriter"
)

type ErrorDetail struct {
	Message string      `json:"message"`
	Field   string      `json:"field,omitempty"`
	Hint    string      `json:"hint,omitempty"`
	Details interface{} `json:"details,omitempty"`
}

type cliError struct {
	Code   int
	Errors []ErrorDetail
}

func (e *cliError) Error() string {
	if len(e.Errors) == 0 {
		return "cli error"
	}
	return e.Errors[0].Message
}

func validationError(details ...ErrorDetail) *cliError {
	return &cliError{Code: 2, Errors: details}
}

func runtimeError(details ...ErrorDetail) *cliError {
	return &cliError{Code: 1, Errors: details}
}

type errorResponse struct {
	Ok     bool          `json:"ok"`
	Errors []ErrorDetail `json:"errors"`
}

type Tableable interface {
	ToTable() [][]string
	TableHeaders() []string
}

func writeTable(out io.Writer, t Tableable) error {
	w := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
	headers := t.TableHeaders()
	for i, h := range headers {
		fmt.Fprint(w, h)
		if i < len(headers)-1 {
			fmt.Fprint(w, "\t")
		}
	}
	fmt.Fprintln(w)

	for _, row := range t.ToTable() {
		for i, cell := range row {
			fmt.Fprint(w, cell)
			if i < len(row)-1 {
				fmt.Fprint(w, "\t")
			}
		}
		fmt.Fprintln(w)
	}
	return w.Flush()
}

func writeResponse(out io.Writer, payload interface{}, format string) error {
	if format == "table" {
		if t, ok := payload.(Tableable); ok {
			return writeTable(out, t)
		}
	}
	return writeJSON(out, payload)
}

func writeJSON(out io.Writer, payload interface{}) error {
	enc := json.NewEncoder(out)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(payload); err != nil {
		return fmt.Errorf("encode json: %w", err)
	}
	return nil
}
