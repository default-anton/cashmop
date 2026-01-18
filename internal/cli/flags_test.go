package cli

import (
	"testing"
)

func TestSubcommandFlagSet(t *testing.T) {
	t.Run("basic parsing", func(t *testing.T) {
		fs := newSubcommandFlagSet("test")
		var val string
		fs.StringVar(&val, "val", "", "")

		ok, res := fs.parse([]string{"--val", "hello"}, "test")
		if !ok {
			t.Fatalf("expected ok=true, got false, res=%+v", res)
		}
		if val != "hello" {
			t.Errorf("expected val=hello, got %s", val)
		}
	})

	t.Run("help flag", func(t *testing.T) {
		fs := newSubcommandFlagSet("test")
		ok, res := fs.parse([]string{"--help"}, "import")
		if ok {
			t.Fatal("expected ok=false for help flag")
		}
		if !res.Help {
			t.Error("expected res.Help to be true")
		}
	})

	t.Run("invalid flag", func(t *testing.T) {
		fs := newSubcommandFlagSet("test")
		ok, res := fs.parse([]string{"--unknown"}, "test")
		if ok {
			t.Fatal("expected ok=false for unknown flag")
		}
		if res.Err == nil {
			t.Fatal("expected error for unknown flag")
		}
		if len(res.Err.Errors) == 0 || res.Err.Errors[0].Message == "" {
			t.Error("expected error message")
		}
	})
}
