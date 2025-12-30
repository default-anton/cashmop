.PHONY: check test vet tidy vulncheck build

check: test vet tidy vulncheck build

test:
	@echo "==> go test ./..."
	@if OUTPUT=$$(go test ./... 2>&1); then \
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

build:
	@echo "==> wails build"
	@if OUTPUT=$$(wails build 2>&1); then \
		echo "✓ build OK"; \
	else \
		echo "✗ build FAILED"; \
		echo "$$OUTPUT"; \
		exit 1; \
	fi
