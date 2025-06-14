# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Local Development
- `make dev` - Start local Python HTTP server on port 8000
- `make dev-python` - Start FastAPI server on port 7860 (production-like)
- `npm run dev` - Alternative Python HTTP server command
- `python local-server.py 8000` - Direct local server command

### Docker Development
- `make docker-dev` - Start with docker-compose (recommended for production testing)
- `make docker-build` - Build Docker image
- `make docker-run` - Run container with environment variables
- `make logs` - View Docker logs
- `make stop` - Stop Docker containers

### Utilities
- `make install` - Install both Python and Node.js dependencies
- `make clean` - Remove temporary files and dependencies
- `make help` - Show all available commands

## Architecture Overview

### Frontend Structure
This is a **vanilla JavaScript modular application** with no build step. Key architectural patterns:

**Module Organization:**
- `app.js` - Main application controller, handles UI state and round management
- `clozeGameEngine.js` - Core game logic, word selection, and scoring
- `bookDataService.js` - Manages book data fetching from Hugging Face Datasets API
- `aiService.js` - OpenRouter API integration for AI-powered word selection and contextualization
- `chatInterface.js` - Modal-based chat UI for contextual hints
- `conversationManager.js` - AI conversation state management for chat functionality
- `welcomeOverlay.js` - First-time user onboarding

**Key Architectural Decisions:**
- **No capitalized words as blanks** - All word selection logic filters out capitalized words (proper nouns, sentence starters)
- **Progressive difficulty** - Levels 1-2: 1 blank, 3-4: 2 blanks, 5+: 3 blanks
- **Batch API processing** - Processes both passages simultaneously to avoid rate limits, with fallback to sequential processing
- **Accessible fonts** - Uses system font stack throughout UI, avoiding decorative fonts for accessibility

### Backend Structure
**Dual server setup:**
- `app.py` - FastAPI server for production (HuggingFace Spaces), handles environment variable injection
- `local-server.py` - Simple HTTP server for local development

**Environment variable handling:**
- Production: FastAPI injects API keys via meta tags, read by `init-env.js`
- Local: Environment variables accessed directly via `process.env` or `window`

### Data Flow
1. **Game Initialization**: BookDataService fetches book metadata from HuggingFace
2. **Passage Processing**: AIService processes passages via OpenRouter API for word selection and contextualization
3. **Word Selection**: Multi-layered selection (AI → manual fallback → emergency fallback) with capitalization filtering
4. **Chat System**: Context-aware conversation manager tracks per-blank question state

### API Dependencies
- **OpenRouter API** - AI word selection, contextualization, and chat responses (Google Gemma 3)
- **HuggingFace Datasets API** - Book content and metadata retrieval
- **External**: CDN-hosted Tailwind CSS and Google Fonts

### Styling Architecture
- **CSS Custom Properties** - Consistent theming with `--aged-paper`, `--typewriter-ink` variables
- **Accessible Design** - System fonts, proper contrast, keyboard navigation
- **Responsive Layout** - Mobile-first design with progressive enhancement