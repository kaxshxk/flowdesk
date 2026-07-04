# ─────────────────────────────────────────────────────────────────────────────
# FlowDesk — HR-Productivity Hub  |  Root Makefile
# ─────────────────────────────────────────────────────────────────────────────
# Usage:
#   make setup       — one-time install of both stacks
#   make dev         — start backend + frontend in parallel (recommended)
#   make backend     — start FastAPI only
#   make frontend    — start Next.js only
#   make install-be  — install Python deps inside venv
#   make install-fe  — install Node deps
#   make lint        — lint both stacks
#   make clean       — remove generated build artefacts
# ─────────────────────────────────────────────────────────────────────────────

BACKEND_DIR  := hr_productivity_hub
FRONTEND_DIR := frontend
VENV         := $(BACKEND_DIR)/venv
PYTHON       := $(VENV)/Scripts/python
PIP          := $(VENV)/Scripts/pip

.PHONY: setup dev backend frontend install-be install-fe lint clean

# ─── One-time project setup ───────────────────────────────────────────────────
setup: install-be install-fe
	@echo ""
	@echo "✅  FlowDesk setup complete."
	@echo "    Copy .env.example → .env and fill in your credentials, then run: make dev"

# ─── Install Python deps ──────────────────────────────────────────────────────
install-be:
	@echo "▶  Setting up Python virtual environment..."
	python -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r $(BACKEND_DIR)/requirements.txt
	@echo "✅  Backend dependencies installed."

# ─── Install Node deps ────────────────────────────────────────────────────────
install-fe:
	@echo "▶  Installing frontend Node modules..."
	cd $(FRONTEND_DIR) && npm install
	@echo "✅  Frontend dependencies installed."

# ─── Start both servers concurrently (Windows-compatible) ────────────────────
dev:
	@echo "🚀  Starting FlowDesk dev servers..."
	@echo "    Backend  → http://127.0.0.1:8000"
	@echo "    Frontend → http://localhost:3000"
	@start cmd /k "cd $(BACKEND_DIR) && ..\$(VENV)\Scripts\python startup.py --reload"
	@cd $(FRONTEND_DIR) && npm run dev

# ─── Individual server start ──────────────────────────────────────────────────
backend:
	cd $(BACKEND_DIR) && ..\$(VENV)\Scripts\python startup.py --reload

frontend:
	cd $(FRONTEND_DIR) && npm run dev

# ─── Lint ─────────────────────────────────────────────────────────────────────
lint:
	$(VENV)/Scripts/ruff check $(BACKEND_DIR) || true
	cd $(FRONTEND_DIR) && npm run lint

# ─── Clean ────────────────────────────────────────────────────────────────────
clean:
	@echo "🧹  Cleaning build artefacts..."
	rm -rf $(FRONTEND_DIR)/.next
	find $(BACKEND_DIR) -type d -name __pycache__ -exec rm -rf {} + 2>nul || true
	@echo "✅  Clean complete."
