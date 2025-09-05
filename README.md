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

An interactive cloze reading practice application with AI-powered assistance. Practice reading comprehension by filling in blanks in randomly excerpted historical and literary passages.

## Features

- **Progressive Level System**: Start with 1 blank, advance to 2-3 blanks as you improve
- **Smart Hints**: Get word length, first letter, and contextual clues
- **AI Chat Help**: Click 💬 for intelligent hints about any blank
- **Historical and Literary Passages**: Randomly excerpted texts from Project Gutenberg's collection
- **Level-Appropriate Challenges**: Hints adapt based on your current level

## How to Use

1. Read the passage and literary context
2. Fill in the blank(s) with appropriate words
3. Use hints or chat help if needed
4. Submit to see your results and advance levels
5. Continue practicing with new passages

## Level System

- **Levels 1-2**: 1 blank, hints show first and last letter
- **Levels 3-4**: 2 blanks, hints show first letter only  
- **Level 5+**: 3 blanks, first letter hints

## Technology

Built with vanilla JavaScript, powered by AI for intelligent word selection and contextual assistance. Supports both OpenRouter API and local LLM integration.

## Running Locally with Docker

To run the Cloze Reader application locally using Docker:

1. **Build the Docker image**:
   ```bash
   docker build -t cloze-reader .
   ```

2. **Run the container**:
   ```bash
   docker run -p 7860:7860 cloze-reader
   ```

3. **Access the application**:
   Open your browser and navigate to `http://localhost:7860`

### Prerequisites
- Docker installed on your system
- Port 7860 available on your machine

## Local LLM Integration

Cloze Reader supports running with a local LLM server instead of OpenRouter API:

### Setup
1. **Start your local LLM server** on port 1234 (e.g., using LM Studio with Gemma-3-12b)
2. **Run the development server**:
   ```bash
   make dev  # or python3 local-server.py 8000
   ```
3. **Access with local LLM**:
   - Navigate to `http://localhost:8000/index.html?local=true`
   - The `?local=true` parameter switches from OpenRouter to your local LLM

### Local LLM Features
- **No API key required** - works entirely offline with your local model
- **Automatic response cleaning** - handles local LLM output artifacts
- **Compatible with LM Studio** and other OpenAI-compatible local servers
- **Same game experience** - all features work identically to cloud version

### Testing Local Integration
- Test page: `http://localhost:8000/test-local-llm.html?local=true`
- Stress test script: `node test-local-llm.js`
- Direct integration test available in test files

## Architecture
This is a **vanilla JavaScript modular application** with no build step. Key architectural patterns:

**Module Organization:**
- `app.js` - Main application controller, handles UI state and round management
- `clozeGameEngine.js` - Core game logic, word selection, and scoring
- `bookDataService.js` - Manages book data fetching from Hugging Face Datasets API
- `aiService.js` - OpenRouter API integration for AI-powered word selection and contextualization
- `chatInterface.js` - Modal-based chat UI for contextual hints
- `conversationManager.js` - AI conversation state management for chat functionality
- `welcomeOverlay.js` - First-time user onboarding

---
[milwright](https://huggingface.co/milwright), *Zach Muhlbauer*, CUNY Graduate Center