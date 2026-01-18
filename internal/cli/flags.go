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
}

func parseGlobalFlags(args []string) (globalFlags, []string, error) {
	fs := flag.NewFlagSet("cashmop", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var help bool
	var version bool
	var dbPath string
	fs.BoolVar(&help, "help", false, "")
	fs.BoolVar(&help, "h", false, "")
	fs.BoolVar(&version, "version", false, "")
	fs.StringVar(&dbPath, "db", "", "")

	if err := fs.Parse(args); err != nil {
		return globalFlags{}, nil, err
	}

	return globalFlags{Help: help, Version: version, DBPath: dbPath}, fs.Args(), nil
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
