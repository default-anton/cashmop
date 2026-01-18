package cli

import (
	"flag"
	"io"
	"strings"
)

type globalFlags struct {
	Help    bool
	Version bool
	DBPath  string
	Format  string
}

func parseGlobalFlags(args []string) (globalFlags, []string, error) {
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
		return globalFlags{}, nil, err
	}

	return globalFlags{Help: help, Version: version, DBPath: dbPath, Format: format}, fs.Args(), nil
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
		return false, commandResult{Err: validationError(ErrorDetail{Message: err.Error()})}
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
