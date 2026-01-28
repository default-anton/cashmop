package main

import (
	"testing"

	"github.com/default-anton/cashmop/internal/cashmop"
)

func TestSanitizeCSVField(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{name: "empty string", input: "", expected: ""},
		{name: "normal text", input: "grocery shopping", expected: "grocery shopping"},
		{name: "formula with equals", input: "=HYPERLINK(\"http://evil.com\", \"click me\")", expected: "\t=HYPERLINK(\"http://evil.com\", \"click me\")"},
		{name: "formula with plus", input: "+1+1", expected: "\t+1+1"},
		{name: "formula with minus", input: "-100", expected: "\t-100"},
		{name: "formula with at sign", input: "@SUM(1,2,3)", expected: "\t@SUM(1,2,3)"},
		{name: "formula with tab", input: "\tcmd|/c calc", expected: "\t\tcmd|/c calc"},
		{name: "formula with carriage return", input: "\rcmd|/c calc", expected: "\t\rcmd|/c calc"},
		{name: "negative amount in middle", input: "expense -50", expected: "expense -50"},
		{name: "description with equals not at start", input: "price = $100", expected: "price = $100"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := cashmop.SanitizeCSVField(tt.input)
			if result != tt.expected {
				t.Errorf("SanitizeCSVField(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}
