.PHONY: help dev dev-python dev-docker build test clean install docker-build docker-run docker-dev

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	@echo "Installing Python dependencies..."
	pip install -r requirements.txt
	@echo "Installing Node.js dependencies..."
	npm install

dev: ## Start local development server (Python HTTP server)
	@echo "Starting local development server on http://localhost:8000"
	python local-server.py 8000

dev-python: ## Start FastAPI development server
	@echo "Starting FastAPI server on http://localhost:7860"
	python app.py

dev-docker: ## Start development environment with Docker Compose
	docker-compose --profile dev up --build

build: ## Build the application (no-op for vanilla JS)
	@echo "No build step needed for vanilla JS application"

test: ## Run tests (placeholder)
	@echo "No tests configured yet"

clean: ## Clean temporary files
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true

docker-build: ## Build Docker image
	docker build -t cloze-reader .

docker-run: ## Run Docker container
	docker run -p 7860:7860 --env-file .env cloze-reader

docker-dev: ## Start with docker-compose
	docker-compose up --build

logs: ## Show Docker logs
	docker-compose logs -f

stop: ## Stop Docker containers
	docker-compose down