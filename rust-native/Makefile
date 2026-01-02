.PHONY: build release clean run test help

help:
	@echo "Discord Rust Extension - Build Commands"
	@echo "========================================"
	@echo "  make build    - Build debug binary"
	@echo "  make release  - Build optimized release binary"
	@echo "  make run      - Build and run the application"
	@echo "  make clean    - Remove build artifacts"
	@echo "  make test     - Run tests"

build:
	@echo "Building debug binary..."
	cargo build --manifest-path Cargo.toml

release:
	@echo "Building release binary..."
	cargo build --manifest-path Cargo.toml --release

run: build
	@echo "Running Discord client..."
	. .env && cargo run --manifest-path Cargo.toml

test:
	cargo test --manifest-path Cargo.toml

clean:
	cargo clean --manifest-path Cargo.toml

check:
	cargo check --manifest-path Cargo.toml

fmt:
	cargo fmt --manifest-path Cargo.toml

clippy:
	cargo clippy --manifest-path Cargo.toml -- -D warnings
