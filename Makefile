SHELL := /bin/bash
.PHONY: dev build start stop restart status install uninstall clean test lint migrate help

SERVICE_NAME=weekly-reporter
SERVICE_FILE=$(SERVICE_NAME).service
SYSTEMD_USER_DIR=$(HOME)/.config/systemd/user
DEFAULT_PORT=6868
DEFAULT_HOSTNAME=0.0.0.0

help:
	@echo "Weekly Reporter - Makefile Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make <command>"
	@echo ""
	@echo "Commands:"
	@echo "  dev        Start development server"
	@echo "  build      Build for production"
	@echo "  install    Install systemd user service (default: port=$(DEFAULT_PORT), host=$(DEFAULT_HOSTNAME))"
	@echo "  uninstall  Uninstall systemd user service"
	@echo "  start      Start systemd user service"
	@echo "  stop       Stop systemd user service"
	@echo "  restart    Restart systemd user service"
	@echo "  status     Show service status"
	@echo "  logs       Show service logs"
	@echo "  test       Run tests"
	@echo "  lint       Run linter"
	@echo "  migrate    Generate database migration"
	@echo "  clean      Clean build artifacts"
	@echo "  help       Show this help message"
	@echo ""
	@echo "Configuration (.env.production):"
	@echo "  PORT=6868          - Server port"
	@echo "  HOSTNAME=0.0.0.0   - Bind host (0.0.0.0 for LAN, localhost for local only)"

dev:
	source ~/.nvm/nvm.sh && npm run dev

build:
	source ~/.nvm/nvm.sh && npm run build

install: build
	@echo "Installing $(SERVICE_NAME) service..."
	mkdir -p $(SYSTEMD_USER_DIR)
	cp $(SERVICE_FILE) $(SYSTEMD_USER_DIR)/$(SERVICE_FILE)
	sed -i "s|%h|$(HOME)|g" $(SYSTEMD_USER_DIR)/$(SERVICE_FILE)
	if [ -f .env.production ]; then \
		PORT=$$(grep -E '^PORT=' .env.production | cut -d'=' -f2 || echo "$(DEFAULT_PORT)"); \
		HOSTNAME=$$(grep -E '^HOSTNAME=' .env.production | cut -d'=' -f2 || echo "$(DEFAULT_HOSTNAME)"); \
		sed -i "s|Environment=PORT=$(DEFAULT_PORT)|Environment=PORT=$$PORT|g" $(SYSTEMD_USER_DIR)/$(SERVICE_FILE); \
		sed -i "s|Environment=HOSTNAME=$(DEFAULT_HOSTNAME)|Environment=HOSTNAME=$$HOSTNAME|g" $(SYSTEMD_USER_DIR)/$(SERVICE_FILE); \
	fi
	systemctl --user daemon-reload
	systemctl --user enable $(SERVICE_NAME).service
	@echo "Service installed and enabled. Run 'make start' to start."

uninstall:
	@echo "Uninstalling $(SERVICE_NAME) service..."
	systemctl --user stop $(SERVICE_NAME).service || true
	systemctl --user disable $(SERVICE_NAME).service || true
	rm -f $(SYSTEMD_USER_DIR)/$(SERVICE_FILE)
	systemctl --user daemon-reload
	@echo "Service uninstalled."

start:
	systemctl --user start $(SERVICE_NAME).service

stop:
	systemctl --user stop $(SERVICE_NAME).service

restart:
	systemctl --user restart $(SERVICE_NAME).service

status:
	systemctl --user status $(SERVICE_NAME).service

logs:
	journalctl --user -u $(SERVICE_NAME).service -f

test:
	source ~/.nvm/nvm.sh && npm run test

lint:
	source ~/.nvm/nvm.sh && npm run lint

migrate:
	source ~/.nvm/nvm.sh && npx drizzle-kit generate

clean:
	rm -rf .next node_modules/.cache
	rm -rf data/*.db