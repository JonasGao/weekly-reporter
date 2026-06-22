.PHONY: dev build start clean test lint migrate help

help:
	@echo "Weekly Reporter - Makefile Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make <command>"
	@echo ""
	@echo "Commands:"
	@echo "  dev       Start development server"
	@echo "  build     Build for production"
	@echo "  start     Start production server"
	@echo "  test      Run tests"
	@echo "  lint      Run linter"
	@echo "  migrate   Generate database migration"
	@echo "  clean     Clean build artifacts"
	@echo "  help      Show this help message"

dev:
	source ~/.nvm/nvm.sh && npm run dev

build:
	source ~/.nvm/nvm.sh && npm run build

start:
	source ~/.nvm/nvm.sh && npm run start

test:
	source ~/.nvm/nvm.sh && npm run test

lint:
	source ~/.nvm/nvm.sh && npm run lint

migrate:
	source ~/.nvm/nvm.sh && npx drizzle-kit generate

clean:
	rm -rf .next node_modules/.cache
	rm -rf data/*.db