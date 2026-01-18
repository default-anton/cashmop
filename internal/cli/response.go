package cli

import (
	"encoding/json"
	"fmt"
	"io"
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

func writeJSON(out io.Writer, payload interface{}) error {
	enc := json.NewEncoder(out)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(payload); err != nil {
		return fmt.Errorf("encode json: %w", err)
	}
	return nil
}
