package cli

import (
	"flag"
	"fmt"
	"io"
	"strings"
)

type globalFlags struct {
	Help    bool
	Version bool
	DBPath  string
	Format  string
}

func parseGlobalFlags(args []string) (globalFlags, []string, *cliError) {
	fs := flag.NewFlagSet("cashmop", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var help bool
	var version bool
	var dbPath string
	var format string
	fs.BoolVar(&help, "help", false, "")
	fs.BoolVar(&help, "h", false, "")
	fs.BoolVar(&version, "version", false, "")
	fs.StringVar(&dbPath, "db", "", "")
	fs.StringVar(&format, "format", "json", "")

	if err := fs.Parse(args); err != nil {
		return globalFlags{}, nil, validationError(flagErrorDetail(err))
	}

	return globalFlags{Help: help, Version: version, DBPath: dbPath, Format: format}, fs.Args(), nil
}

func flagErrorDetail(err error) ErrorDetail {
	msg := err.Error()
	field := ""
	hint := "Run with --help to see available flags."

	const unknownPrefix = "flag provided but not defined: "
	const missingPrefix = "flag needs an argument: "
	const forFlag = " for flag "

	switch {
	case strings.HasPrefix(msg, unknownPrefix):
		field = strings.TrimLeft(strings.TrimSpace(strings.TrimPrefix(msg, unknownPrefix)), "-")
		if field != "" {
			hint = fmt.Sprintf("Remove --%s or run --help to see available flags.", field)
		}
	case strings.HasPrefix(msg, missingPrefix):
		field = strings.TrimLeft(strings.TrimSpace(strings.TrimPrefix(msg, missingPrefix)), "-")
		if field != "" {
			hint = fmt.Sprintf("Provide a value for --%s.", field)
		}
	case strings.Contains(msg, forFlag):
		after := strings.SplitN(msg, forFlag, 2)[1]
		name := strings.SplitN(after, ":", 2)[0]
		field = strings.TrimLeft(strings.TrimSpace(name), "-")
		if field != "" {
			hint = fmt.Sprintf("Provide a valid value for --%s.", field)
		}
	}

	return ErrorDetail{Field: field, Message: msg, Hint: hint}
}

type subcommandFlagSet struct {
	*flag.FlagSet
	help bool
}

func newSubcommandFlagSet(name string) *subcommandFlagSet {
	fs := flag.NewFlagSet(name, flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	s := &subcommandFlagSet{FlagSet: fs}
	fs.BoolVar(&s.help, "help", false, "")
	fs.BoolVar(&s.help, "h", false, "")
	return s
}

func (s *subcommandFlagSet) parse(args []string, helpCmd string) (bool, commandResult) {
	if err := s.Parse(args); err != nil {
		return false, commandResult{Err: validationError(flagErrorDetail(err))}
	}
	if s.help {
		printHelp(helpCmd)
		return false, commandResult{Help: true}
	}
	return true, commandResult{}
}

type stringSliceFlag struct {
	values []string
}

func (s *stringSliceFlag) String() string {
	return strings.Join(s.values, ",")
}

func (s *stringSliceFlag) Set(value string) error {
	if value == "" {
		return nil
	}
	s.values = append(s.values, value)
	return nil
}

type optionalStringFlag struct {
	value string
	set   bool
}

func (o *optionalStringFlag) String() string {
	return o.value
}

func (o *optionalStringFlag) Set(value string) error {
	o.value = value
	o.set = true
	return nil
}
