# All targets: show output only on failure (silent success)

.PHONY: check dev test vet tidy vulncheck typescript build integration

check: test vet tidy vulncheck typescript build integration

dev:
	@wails dev -nogorebuild

test:
	@echo "==> go test ./..."
	@if OUTPUT=$$(go test -p 1 ./... 2>&1); then \
		echo "✓ test OK"; \
	else \
		echo "✗ test FAILED"; \
		echo "$$OUTPUT"; \
		exit 1; \
	fi

vet:
	@echo "==> go vet ./..."
	@if OUTPUT=$$(go vet ./... 2>&1); then \
		echo "✓ vet OK"; \
	else \
		echo "✗ vet FAILED"; \
		echo "$$OUTPUT"; \
		exit 1; \
	fi

tidy:
	@echo "==> go mod tidy"
	@if OUTPUT=$$(go mod tidy 2>&1); then \
		echo "✓ tidy OK"; \
	else \
		echo "✗ tidy FAILED"; \
		echo "$$OUTPUT"; \
		exit 1; \
	fi

vulncheck:
	@echo "==> govulncheck ./..."
	@if OUTPUT=$$(govulncheck ./... 2>&1); then \
		echo "✓ vulncheck OK"; \
	else \
		echo "✗ vulncheck FAILED"; \
		echo "$$OUTPUT"; \
		exit 1; \
	fi

typescript:
	@echo "==> typescript check"
	@if OUTPUT=$$(cd frontend && npx tsc --noEmit 2>&1); then \
		echo "✓ typescript OK"; \
	else \
		echo "✗ typescript FAILED"; \
		echo "$$OUTPUT"; \
		exit 1; \
	fi

build:
	@echo "==> wails build"
	@if OUTPUT=$$(wails build 2>&1); then \
		echo "✓ build OK"; \
	else \
		echo "✗ build FAILED"; \
		echo "$$OUTPUT"; \
		exit 1; \
	fi

integration:
	@echo "==> integration tests"
	@if OUTPUT=$$(./scripts/run-integration-tests.sh 2>&1); then \
		echo "✓ integration OK"; \
	else \
		echo "✗ integration FAILED"; \
		echo "$$OUTPUT"; \
		exit 1; \
	fi
