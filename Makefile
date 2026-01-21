# All targets: show output only on failure (silent success)
# Unless V=1 is passed.

.PHONY: check dev test vet tidy goimports fmt vulncheck typescript build integration integration-file integration-test

# Macro to run a command with optional verbosity
# Usage: $(call run,Label,Command)
define run
	@echo "==> $(1)"
	@if [ "$(V)" = "1" ]; then \
		$(2); \
	else \
		if OUTPUT=$$($(2) 2>&1); then \
			echo "✓ $(1) OK"; \
		else \
			echo "✗ $(1) FAILED"; \
			echo "$$OUTPUT"; \
			exit 1; \
		fi; \
	fi
endef

check: tidy goimports vet test typescript vulncheck integration

dev:
	@wails dev

test:
	$(call run,go test ./...,go test -p 1 ./...)

vet:
	$(call run,go vet ./...,go vet ./...)

tidy:
	$(call run,go mod tidy,go mod tidy)

goimports:
	$(call run,goimports check,files=$$(goimports -l $$(go list -f '{{.Dir}}' ./...)); if [ -n "$$files" ]; then echo "$$files"; exit 1; fi)

fmt:
	$(call run,goimports -w,goimports -w $$(go list -f '{{.Dir}}' ./...))

vulncheck:
	$(call run,govulncheck ./...,govulncheck ./...)

typescript:
	$(call run,typescript check,cd frontend && pnpm exec tsc --noEmit)

build:
	$(call run,wails build,wails build)

integration:
	$(call run,integration tests,timeout 1m ./scripts/run-integration-tests.sh $(INTEGRATION_ARGS))

# Run single test file: make integration-file FILE=tests/basic.spec.ts
integration-file:
	@if [ -z "$(FILE)" ]; then \
		echo "Error: FILE argument required. Usage: make integration-file FILE=tests/basic.spec.ts"; \
		exit 1; \
	fi
	@if [ ! -f "frontend/$(FILE)" ]; then \
		echo "Error: File not found: frontend/$(FILE)"; \
		exit 1; \
	fi
	$(call run,integration tests (file: $(FILE)),./scripts/run-integration-tests.sh $(FILE))

# Run tests matching pattern: make integration-test NAME="add transaction"
integration-test:
	@if [ -z "$(NAME)" ]; then \
		echo "Error: NAME argument required. Usage: make integration-test NAME='test pattern'"; \
		exit 1; \
	fi
	$(call run,integration tests (pattern: '$(NAME)'),./scripts/run-integration-tests.sh -g "$(NAME)")
