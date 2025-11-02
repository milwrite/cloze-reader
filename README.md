---
title: Cloze Reader
emoji: 📜
colorFrom: yellow
colorTo: gray
sdk: docker
pinned: true
thumbnail: >-
  https://cdn-uploads.huggingface.co/production/uploads/65a0caa15dfd8b9b1f3aa3d3/3GdgODxZMuycEJvbrtAdm.png
---

# Cloze Reader

## Overview

Cloze Reader transforms classic literature into interactive vocabulary exercises using AI-powered word selection and hint generation. The application uses Google's Gemma-3-27B model to analyze passages from Project Gutenberg, select contextually appropriate blanks, and provide adaptive guidance through a chat interface.

## Background

The cloze procedure, introduced by Wilson Taylor in 1953, measures reading comprehension by having readers fill in deleted words from passages. BERT and subsequent masked language models use the same fundamental technique as their training objective: predict missing tokens from context. Cloze Reader closes this loop by using models trained on masked prediction to generate cloze exercises for human learners.

## Features

**Progressive Difficulty:** Levels 1-5 present single blanks with full hints from recent texts; levels 6-10 add multiple blanks with partial hints; levels 11+ use historical texts with minimal hints. Players must complete two passages per round before advancing.

**Interactive Chat:** Each blank includes a chat interface providing contextual hints through Socratic questioning and semantic guidance.

**Public Domain Content:** All passages stream from Hugging Face's Project Gutenberg dataset, filtered to exclude dictionaries, technical documentation, and poetry.

## Technology Stack

**Frontend:** Vanilla JavaScript with ES6 modules, no build tooling. The application runs entirely in the browser.

**Backend:** Minimal FastAPI server for static file serving and API key injection.

**Models:** Google Gemma-3-27B via OpenRouter, with support for local LLM servers on port 1234.

**Data Source:** Hugging Face Datasets API streaming from Project Gutenberg corpus.

## Running with Docker

```bash
# Build the image
docker build -t cloze-reader .

# Run the container
docker run -p 7860:7860 cloze-reader

# Access at http://localhost:7860
```

**Prerequisites:** Docker installed, port 7860 available.

## Local LLM Integration

Run with a local LLM server instead of OpenRouter:

```bash
# Start local LLM server on port 1234 (e.g., LM Studio with Gemma-3-27b)
# Run development server
make dev  # or python3 local-server.py 8000

# Access at http://localhost:8000/index.html?local=true
```

**Features:**
- No API key required
- Offline operation
- Automatic response cleaning for local LLM output
- Compatible with LM Studio and OpenAI-compatible servers
- Testing available at `http://localhost:8000/test-local-llm.html?local=true`

## Architecture

**Module Organization:**
- `app.js` - Application controller and UI state management
- `clozeGameEngine.js` - Game logic, word selection, scoring
- `bookDataService.js` - Book data fetching from Hugging Face
- `aiService.js` - OpenRouter API integration
- `chatInterface.js` - Modal-based chat UI
- `conversationManager.js` - AI conversation state management
- `welcomeOverlay.js` - First-time user onboarding

## Research Context

Recent work connects cloze assessment and masked language modeling:
- Matsumori et al. (2023) developed CLOZER using masked language models for L2 English cloze question generation
- Ondov et al. (2024, NAACL) demonstrated masked language models as natural generators for cloze distractors
- Zhang & Hashimoto (2021) analyzed inductive biases in masked tokens, showing models learn statistical and syntactic dependencies that cloze tests measure in humans

---
[milwright](https://huggingface.co/milwright), *Zach Muhlbauer*, CUNY Graduate Center
