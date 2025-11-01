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

## When Assessment Becomes Training Data, and Training Data Becomes Assessment

In 1953, Wilson Taylor proposed the "cloze procedure" as a measurement tool for reading comprehension and text difficulty. The method was elegantly simple: delete every nth word from a passage, ask readers to fill in the blanks, and score their accuracy. Taylor argued that successful completion demonstrated not mere vocabulary knowledge but genuine contextual understanding—the ability to infer meaning from surrounding linguistic patterns. By the 1960s, cloze testing had become standard in educational assessment, literacy research, and language teaching. Its appeal lay in its objectivity: unlike essay grading, cloze scores could be automated, quantified, compared across populations.

Sixty-five years later, Google researchers published "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding." BERT's innovation was masked language modeling: randomly mask 15% of tokens in a text, train the model to predict the missing words. The researchers didn't cite Taylor. They didn't frame this as a pedagogical technique. Yet they had independently reinvented the cloze procedure as a machine learning objective. BERT learned language by solving millions of fill-in-the-blank exercises, training on the same task that had measured human comprehension since the Eisenhower administration.

This convergence wasn't coincidental. Both cloze testing and masked language modeling operate on the same premise: understanding language means predicting from context. If you can accurately fill in blanks, you've demonstrated comprehension—whether you're a student in 1960s Kansas or a transformer model in 2018. The methodology traveled from educational psychology to computational linguistics because it captured something fundamental about how meaning works: language is redundant, predictable, inferable from surrounding structure.

Both approaches also share the same constraints. Educational researchers identified "clozability"—the phenomenon that some words are easier to predict than others due to context salience, limited synonyms, or statistical frequency. Machine learning researchers independently discovered the same issue: certain tokens are trivially predictable from context, while others require deeper reasoning. Zhang & Hashimoto (2021) showed that masked language models learn statistical and syntactic dependencies—exactly what cloze tests aim to measure in humans. The parallel is not superficial.

But now the loop has closed in an unexpected way. BERT and its descendants—including Google's Gemma models—were trained on masked prediction tasks extracted from web text, books, Wikipedia. These models learned to predict missing words from billions of cloze-like exercises. Now, with Cloze Reader, those same models generate cloze tests for humans. The AI that learned language by filling in blanks now decides which blanks you should fill in. The training methodology has become the assessment tool, and the assessment tool has become training data.

## What This Game Explores

Cloze Reader uses Google's open-weight Gemma-3-27b model to transform Project Gutenberg literature into dynamically generated cloze exercises. The model scans passages, selects vocabulary to remove, generates contextual hints, and provides conversational guidance. Every passage is fresh, every blank algorithmically chosen, every hint synthesized in real time.

This isn't just automated test generation. It's an investigation into what happens when the twin histories of educational assessment and machine learning collapse into each other. Consider:

**Standardization vs. Serendipity:** Educational cloze tests sought standardization—predictable difficulty, comparable scores, systematic progression. Machine learning cloze tasks sought diversity—randomized masking, varied contexts, statistical coverage. Using Gemma models on Project Gutenberg's 70,000-book corpus introduces radical serendipity: you might encounter Victorian Gothic prose, 1920s adventure serials, obscure 19th-century essays, forgotten feminist manifestos. The algorithm selects passages and words through statistical patterns trained on internet-scale text, not curriculum design. What does assessment mean when no human predetermined what counts as "appropriate difficulty"?

**Inference vs. Memorization:** Traditional cloze tests measured whether students could infer from context rather than recall from memory. Educational researchers have long critiqued cloze procedures for measuring primarily local, sentence-level inference (surface coherence) rather than global text structure or pragmatic reasoning. Machine learning critics make parallel arguments: masked language models exploit spurious statistical regularities rather than genuine semantic understanding. When a model trained on surface patterns generates tests, and humans solve those tests using similar heuristics, where is comprehension actually happening? The distinction between understanding and statistical correlation becomes harder to maintain on both sides.

**Automation and Authority:** Educational assessment historically required human expertise—teachers selecting texts, choosing appropriate blanks, evaluating answers. Automated testing promised efficiency but was criticized for reducing learning to quantifiable metrics. Now the automation is complete: an algorithmic system with no pedagogical training, no curriculum knowledge, no understanding of individual learners generates and evaluates exercises. It runs on open-weight models anyone can download, modify, or interrogate. What happens to authority over what constitutes "correct" reading comprehension when assessment moves from institutional gatekeeping to open algorithmic systems?

**The Feedback Loop:** Most critically, this is a recursive system. Gemma models were trained partly on digitized books—including many from Project Gutenberg. The texts they learned from become the texts they generate exercises from. The model learned language patterns from Victorian literature, then uses those patterns to test human understanding of Victorian literature. Meanwhile, interactions with this game could theoretically become training data for future models. Assessment data becomes training data becomes assessment tools becomes training data. At what point does the distinction between learning and evaluation dissolve entirely?

**The Exact-Word Problem:** Educational cloze testing has long debated whether to accept only exact matches or score semantic/grammatical equivalents (synonyms, morphological variants). This game enforces exact-word matching with some suffix normalization, mirroring how masked language models are trained on exact token prediction. Both approaches may penalize valid alternatives. When you type "sad" but the answer was "melancholy," have you failed to comprehend the passage—or simply chosen a different word from the same semantic field? This scoring problem exists identically in human assessment and algorithmic evaluation.

## The Research Context

Recent scholarship explicitly bridges cloze assessment and masked language modeling:

- **Matsumori et al. (2023)** built CLOZER, a system using masked language models to generate open cloze questions for L2 English learners, demonstrating practical pedagogical applications
- **Ondov et al. (2024, NAACL)** argue: "The cloze training objective of Masked Language Models makes them a natural choice for generating plausible distractors for human cloze questions"
- **Zhang & Hashimoto (2021)** analyzed the inductive biases of masked tokens, showing that models learn statistical and syntactic dependencies through the same mechanisms cloze tests measure in humans

This project sits at the intersection of these research trajectories—using the tools that now generate assessments to explore what happens when the boundary between human learning and machine training dissolves.

## A Game, Not a Conclusion

Cloze Reader doesn't resolve these tensions. It stages them. Through vintage aesthetics and classic texts, it creates a space where the convergence of educational assessment and machine learning becomes palpable. You're playing a literacy game designed by an algorithm that learned literacy by playing the same game billions of times. Every passage is a historical text processed by a model trained on historical texts. Every hint comes from a system that doesn't "understand" in any human sense but can nonetheless guide you toward understanding.

The experience raises more questions than it answers. Is this pedagogy or pattern replication? Assessment or performance? Human learning or collaborative prediction with a statistical engine? These aren't rhetorical questions—they're open empirical questions about what education looks like when the tools we use to measure learning are built from the same processes we're trying to measure.

## How It Works

**Single-Model Architecture:** The system uses Google's Gemma-3-27b model for all operations—analyzing passages, selecting words to mask, generating contextual hints, and powering the chat interface. The model handles both assessment design and pedagogical guidance through the same algorithmic system.

**Progressive Levels:** The game implements a level system (1-5 with 1 blank, 6-10 with 2 blanks, 11+ with 3 blanks) that scaffolds difficulty through word length constraints, historical period selection, and hint disclosure. Early levels use 1900s texts and show first+last letters; advanced levels draw from any era and provide only first letters. Each round presents two passages from different books, requiring consistent performance across rounds before advancing.

**Serendipitous Selection:** Passages stream directly from Hugging Face's Project Gutenberg dataset. The model selects words based on its training rather than curricular logic—sometimes choosing obvious vocabulary, sometimes obscure terms, sometimes generating exercises that are trivially easy or frustratingly hard. This unpredictability is a feature: it reveals how algorithmic assessment differs from human-designed pedagogy.

**Chat as Scaffold:** Click the 💬 icon beside any blank to engage the model in conversation. It attempts to guide you through Socratic questioning, semantic clues, and contextual hints—replicating what a tutor might do, constrained by what a language model trained on text prediction can actually accomplish.

The system filters out dictionaries, technical documentation, and poetry—ensuring narrative prose where blanks are theoretically inferable from context, even if the model's choices sometimes suggest otherwise.

## Technology

**Vanilla JavaScript, No Build Step:** The application runs entirely in the browser using ES6 modules—no webpack, no bundler, no compilation. This architectural choice mirrors the project's conceptual interests: keeping the machinery visible and modifiable rather than obscured behind layers of tooling. A minimal FastAPI backend serves static files and injects API keys; everything else happens client-side.

**Open-Weight Models:** Uses Google's Gemma-3-27b model (27 billion parameters) via OpenRouter, or alternatively connects to local LLM servers (LM Studio, etc.) on port 1234 with smaller models like Gemma-3-12b. The choice of open-weight models is deliberate: these systems can be downloaded, inspected, run locally, modified. When assessment becomes algorithmic, transparency about the algorithm matters. You can examine exactly which model is generating your exercises, run the same models yourself, experiment with alternatives.

**Streaming from Public Archives:** Book data streams directly from Hugging Face's mirror of Project Gutenberg's corpus—public domain texts, open dataset infrastructure, no proprietary content libraries. The entire pipeline from literature to exercises relies on openly accessible resources, making the system reproducible and auditable.

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