# TODO: Optimize CLI Integration Test Build Process

## Context
CLI integration tests in `tests/cli/` currently build the application binary to test real command execution.

## Problem
Building the binary is a slow operation. If multiple test files exist, the overhead of rebuilding or checking the build status can significantly slow down the test suite.

## Requirements
- Ensure the CLI integration tests only build the binary **once** for the entire test suite run.
- Use a `sync.Once` or a shared `TestMain` pattern to manage the binary lifecycle.
- Maintain the "black-box" nature of the tests (executing the binary) rather than calling Go functions directly, to ensure we catch packaging and CLI entry-point issues.
- The binary should be built into a temporary directory and cleaned up after tests finish.

## Files
- `tests/cli/cli_test.go`
- Other files in `tests/cli/`
