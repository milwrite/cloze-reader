# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Local Development:**
- `python -m http.server 8000` - Start simple HTTP server for development on port 8000
- `python app.py` - Start FastAPI server on port 7860 (production-like)
- `make dev` - Start development server with simple HTTP server
- `make dev-python` - Start FastAPI development server

**Docker Development:**
- `make docker-build` - Build Docker image
- `make docker-run` - Run container on port 7860 with .env file
- `make docker-dev` or `docker-compose up --build` - Full development environment
- `make stop` - Stop Docker containers
- `make logs` - View container logs
- `make clean` - Remove temporary files, __pycache__, and node_modules

**Dependencies:**
- `make install` - Install both Python and Node.js dependencies
- `pip install -r requirements.txt` - Python dependencies (FastAPI, uvicorn, redis, httpx)
- `npm install` - Node.js dependencies (http-server for development)

**Testing & Debugging:**
- No automated test suite - `make test` and `npm test` are placeholders
- No linting configured - `npm run lint` is a placeholder
- Test with local LLM: `http://localhost:8000?local=true` (requires LLM server on port 1234)
- Enable debug mode: Add `?testMode=true` to URL for test runner interface
- Browser console shows detailed logs for debugging (especially for skip button functionality)

**Automation Testing:**
- `node play-game.js` - Playwright bot that automates game play using Gemma-3-12b via OpenRouter
  - Requires `OPENROUTER_API_KEY` in `.env`
  - Configurable via constants: `GAME_URL`, `TARGET_LEVEL`, `MAX_RELOAD_CYCLES`
  - Bot plays in headed mode (browser visible) for inspection
  - Uses hint constraints and chat queries to improve guessing accuracy
  - Implements retry logic with exponential backoff for failed answers
  - Parallel DOM checks and Promise.allSettled for robust element detection

## Architecture Overview

This is a **vanilla JavaScript modular application** with a FastAPI backend serving static files. The frontend runs entirely in the browser with AI integration via OpenRouter API or local LLM. No build process - uses ES6 modules directly.

**Core Game Flow:**
1. **Game Initialization** (`clozeGameEngine.js`) - Loads book data, initializes AI services
2. **Level-Aware Book Selection** (`bookDataService.js`) - Selects books by historical period (1-2: 1900s, 3-4: 1800s, 5+: any period)
3. **AI-Powered Word Selection** (`aiService.js`) - Uses AI to select appropriate vocabulary based on level
4. **Progressive Difficulty** - Level 1-5: 1 blank, 6-10: 2 blanks, 11+: 3 blanks
5. **Round System** - 2 passages per round, pass 2 rounds to advance level
6. **UI Management** (`app.js`) - Handles round transitions, answer validation, results display

**Key Module Interactions:**
- `bookDataService.js` streams from Hugging Face Datasets API (`manu/project_gutenberg`) with local fallbacks
- `aiService.js` handles AI configuration:
  - **Gemma-3-27b** (`google/gemma-3-27b-it`) for all operations: word selection, hint generation, contextualization, and chat
  - Local mode uses the fine-tuned **cloze-reader** adapter (Gemma-4-E4B LoRA) served by the inference-arcade vLLM host on port 1234
- `chatInterface.js` provides modal-based contextual hints for individual blanks
- `conversationManager.js` maintains AI conversation state per blank across rounds
- `app.js` manages sticky control panel with mobile-friendly bottom navigation

**Leaderboard System:**
- `leaderboardService.js` - Manages high scores, player stats, and localStorage persistence
- `leaderboardUI.js` - Arcade-style leaderboard display with 3-letter initials
- `hfLeaderboardAPI.js` - Optional Hugging Face Hub integration for global leaderboard
- Tracks: highest level reached, total passages passed/attempted, longest streaks
- Top 10 entries persisted locally, syncs with HF Hub when available
- **Important**: Stats reset on page load (fresh session each time)

**State Management:**
- All game state persists in `localStorage` (no backend database)
- Storage keys: `cloze-reader-leaderboard`, `cloze-reader-player`, `cloze-reader-stats`
- Player profile includes: initials, games played, last played timestamp
- Stats tracked: highest level, round progress, passage success rates, streaks
- First-time users see welcome overlay (`welcomeOverlay.js`) for onboarding
- Streak breaks when: user fails passage, skips passage, or has to retry any blank

**Level-Aware Systems:**
- **Word Selection**: AI prompts include level-specific vocabulary constraints (4-7 letters easy → 5-14 letters challenging)
- **Hint Generation**: Progressive disclosure based on level (first+last letter → first letter only)
- **Content Filtering**: Enhanced statistical passage quality analysis rejects technical/reference material
- **Word Validation**: Client-side filtering removes inappropriate vocabulary and enforces length constraints

**Environment Variables:**
- `OPENROUTER_API_KEY` - Required for AI functionality (OpenRouter mode)
- `HF_API_KEY` - Optional for Hugging Face Datasets access
- FastAPI server (`app.py`) injects API keys securely into browser via meta tags

**Local LLM Integration:**
- **Local mode is the default when available**: at startup the app probes `http://localhost:1234/v1/models` and switches to local mode if the `cloze-reader` model id is served (the inference-arcade vLLM host: Gemma-4-E4B base + cloze-reader LoRA)
- `?local=true` forces local mode, `?local=false` forces the OpenRouter proxy
- No API key required for local mode
- Automatic response cleaning handles output artifacts
- Compatible with OpenAI-compatible local servers

## Content Filtering System

**Dictionary/Academic Material Detection:**
- Hash symbols (`#`) used for formatting entries
- Abbreviations (`n.`, `adj.`, `adv.`, `OFr.`, `OE.`, `L.`) with concentration scoring
- Etymology brackets `[OFr. pité.]`, `[OE. piþa.]` detection
- Roman numeral references (`II 101`, `IV b 57`) filtering
- Definition line structures and technical terminology detection

**Word Matching Algorithm:**
- Exact match attempts first (cleaned text)
- Fallback to includes matching for partial words
- Base word matching removes common suffixes (`-ed`, `-ing`, `-s`)
- Enhanced fallback only when AI provides zero words
- Detailed logging for debugging word matching issues

**Quality Scoring System:**
- Threshold > 3 rejects passages
- Statistical analysis: caps ratio, numbers, punctuation density
- Pattern detection: formatting sequences, repetitive phrases, title lines
- Technical content filtering prevents academic/reference material

## UI Architecture

**Skip Button Behavior:**
- Skip button appears when user gets answers wrong (retry mode)
- Clicking skip: breaks streak, shows correct answers, waits 3 seconds before showing "Next Passage" button
- Ensures users see correct answers before advancing

**Sticky Control Panel:**
- Fixed bottom positioning with mobile-friendly "Hint | Submit" layout
- Stays visible above mobile keyboards for consistent accessibility
- Responsive styling with larger touch targets (48px min-height on mobile)
- Backdrop blur effect and themed styling consistent with vintage aesthetic

**Two-Passage Round System:**
- Each round contains two passages from different books
- User must complete both passages before level advancement
- Level progression requires passing at least one passage per round
- Clear messaging: "Passage 1/2", "Passage 2/2" in header
- Simplified score display: "Score: X/Y" with clear pass/fail indicators

**Progression Messages:**
- Pass with advancement: "✓ Level X unlocked!"
- Pass without advancement: "✓ Passed (1 more passage needed for next level)"
- Fail: "Try again (need X/Y)"

**Mobile Optimizations:**
- Controls remain accessible when mobile keyboard appears
- Enhanced touch targets for better mobile interaction
- Responsive design adapts to various screen sizes
- Content padding prevents overlap with sticky controls

**Responsive Button Scaling:**
- Chat button icons scale by viewport: mobile (28px) → tablet (30-32px) → desktop (28-32px)
- Question/suggestion buttons in chat modal: 64px (mobile) → 56px (tablet) → 48px (desktop) → 44px (XL screens)
- Sticky control buttons: 48px (mobile) → 44px (tablet) → 40px (desktop) → 36px (XL screens)
- Font sizes adjust proportionally to maintain visual balance across breakpoints

## Model Response Handling

**Gemma Models:**
- Generally reliable JSON responses
- Cleaner hint generation than OSS-20B
- Better batch processing success rate

**Response Extraction Fallbacks:**
- Primary: Check `message.content` field
- Secondary: Extract from `reasoning` field
- Tertiary: Parse `reasoning_details` array
- Final: Apply regex patterns to extract words/hints from text

**Error Recovery:**
- Retry mechanism with exponential backoff
- Fallback to sequential processing if batch fails
- Generic hint generation when AI fails
- Automatic response cleaning for local LLM artifacts

## Conceptual Framework

This project is a **meta-commentary on the convergence of educational assessment and machine learning**—two parallel histories that have now collapsed into each other.

### The Twin History

**1953: Cloze as Educational Assessment**
Wilson L. Taylor introduced the "cloze procedure" as a tool for measuring readability and comprehension. The logic: systematically delete words from text, ask readers to fill in blanks, and score accuracy. Success demonstrates not mere vocabulary recall but contextual understanding—the ability to integrate syntactic, semantic, and pragmatic cues. By the 1960s, cloze testing became standard in educational assessment, literacy research, and language teaching. Its appeal was efficiency and objectivity: many items could be aggregated, scoring was straightforward (match vs. non-match), and it avoided the subjectivity of essay grading.

**2018: Masked Language Modeling as AI Training**
BERT introduced "masked language modeling" (MLM): randomly mask 15% of tokens, train the model to predict missing words from context. The researchers didn't cite Taylor or frame this as educational assessment. Yet they had independently reinvented the cloze procedure as a pre-training objective. The methodology traveled from educational psychology to computational linguistics because both capture something fundamental: understanding language means predicting from context.

### The Convergence

Cloze testing and MLM operate on identical premises:
- **Masking creates inference demands**: Removing a token forces reliance on surrounding structure
- **Context integration**: Success requires synthesizing local syntax, semantics, discourse coherence
- **Efficiency**: Many items can be processed; scoring is deterministic (for humans) or probabilistic (for LMs)
- **Variable "clozability"**: Some blanks are easier to predict than others due to context salience, limited synonyms, or statistical frequency

Recent research explicitly connects these histories:
- Matsumori et al. (2023) use MLMs to generate open cloze questions for L2 English learners
- Ondov et al. (2024, NAACL) argue: "The cloze training objective of Masked Language Models makes them a natural choice for generating plausible distractors for human cloze questions"
- Zhang & Hashimoto (2021) analyze the inductive biases of masked tokens in LMs: they learn statistical and syntactic dependencies—exactly what cloze tests aim to measure in humans

### What This Game Explores

**Recursive Assessment**: Models trained on masked prediction (filling in blanks) now generate masked prediction tests for humans (creating blanks to fill). The training methodology has become the assessment tool. Assessment data could theoretically become training data for future models. The feedback loop is complete.

**Standardization vs. Serendipity**: Educational cloze tests sought psychometric validity—predictable difficulty, planned items, calibrated discrimination. This system uses Gemma models on Project Gutenberg's full corpus with no curricular planning. The algorithm selects passages and words through statistical patterns learned from internet-scale training, introducing radical unpredictability. What does "appropriate difficulty" mean when no human predetermined it?

**Surface Cues vs. Deep Comprehension**: Educational researchers critique cloze tests for measuring only local, sentence-level inference (surface coherence) rather than global text structure or pragmatic reasoning. Similarly, MLM critics note that models exploit spurious statistical regularities rather than genuine semantic understanding. When a model trained on surface patterns generates tests, and humans solve those tests using similar heuristics, where is comprehension happening?

**Authority and Transparency**: Traditional assessment required human expertise—teachers selecting texts, choosing pedagogically sound blanks, evaluating answers against learning objectives. This system automates the entire pipeline using open-weight models (Gemma-3) that anyone can download, inspect, modify, and run locally. Authority over "correct" reading comprehension shifts from institutional gatekeeping to interrogable algorithmic systems. But what is lost when assessment design becomes black-boxed in model weights rather than documented in curriculum guides?

**Exact-Word Criterion**: Educational cloze testing debates whether to accept only exact matches or score semantic/grammatical equivalents. This game enforces exact-word matching (with some suffix normalization), mirroring how MLMs are trained on exact token prediction. Both approaches may penalize valid alternatives, raising questions about what counts as "correct" inference.

### Implications for This Codebase

When working on this project, understand that technical decisions align with these conceptual interests:

- **Vanilla JS, no build step**: Keeps machinery visible and modifiable rather than obscured behind tooling
- **Open-weight models (Gemma-3)**: Enables inspection, local deployment, and interrogation of the assessment generator
- **Streaming from public archives (Project Gutenberg)**: Makes the entire pipeline reproducible without proprietary content
- **Local LLM support**: Removes dependency on API providers; you can run the "teacher" on your own hardware
- **No backend database**: All state in localStorage; the assessment system is fully client-side and auditable

The goal is not to resolve the tensions between human assessment and algorithmic generation, but to **stage them**—to make them experientially tangible through gameplay. Every passage is a collision between 70 years of educational theory and 7 years of masked language modeling.
- For all git messages: lowercase, short and sweet, NEVER any sign off