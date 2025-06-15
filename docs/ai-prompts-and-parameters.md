# AI Prompts and Parameters Documentation

This document outlines the different types of AI requests, prompts, and parameters used in the Cloze Reader application.

## Overview

The Cloze Reader uses OpenRouter's API with the `google/gemma-3-27b-it:free` model to power various AI-driven features. All requests use a consistent retry mechanism with exponential backoff (3 attempts, 0.5s initial delay).

## Difficulty Progression

The game uses a level-based system to control difficulty:

### Blank Count by Level
- **Levels 1-5**: 1 blank per passage
- **Levels 6-10**: 2 blanks per passage
- **Level 11+**: 3 blanks per passage

### Word Length Constraints by Level
- **Levels 1-3**: 3-10 letters (easier, shorter words)
- **Levels 4+**: 5-13 letters (longer, more challenging words)

### Hint System by Level
- **Levels 1-2**: Shows word length, first letter, and last letter
- **Level 3+**: Shows word length and first letter only

## Request Types

### 1. Contextual Hint Generation

**Purpose:** Generate hints for word puzzles without revealing the answer word.

**API Endpoint:** `https://openrouter.ai/api/v1/chat/completions`

**Parameters:**
```json
{
  "model": "google/gemma-3-27b-it:free",
  "messages": [
    {
      "role": "user", 
      "content": "You provide clues for word puzzles. You will be told the target word that players need to guess, but you must NEVER mention, spell, or reveal that word in your response. Follow the EXACT format requested. Be concise and direct about the target word without revealing it. Use plain text only - no bold, italics, asterisks, or markdown formatting. Stick to word limits.\n\n[CONTEXT AND PASSAGE]\n\nImportant: The hidden word is \"[TARGET_WORD]\". Never say this word directly - use \"it,\" \"this word,\" or \"the word\" instead.\n\nSuggest a word that could replace it in this sentence. Pick something simple and explain why it works. Under 15 words.\nExample: \"You could use 'bright' here - it captures the same feeling of intensity.\""
    }
  ],
  "max_tokens": 50,
  "temperature": 0.6
}
```

**Example Request Body:**
```json
{
  "model": "google/gemma-3-27b-it:free",
  "messages": [
    {
      "role": "user",
      "content": "You are a cluemaster for a fill-in-the-blank game rendering clues for word puzzles. You will be told the target word that players need to guess, but you must NEVER mention, spell, or reveal that word in your response. Follow the EXACT format requested. Be concise and direct about the target word without revealing it. Use plain text only - no bold, italics, asterisks, or markdown formatting. Stick to word limits.\n\nfrom \"William the Conqueror\" by Edward Augustus Freeman: \"Of bloodshed, of wanton interference\nwith law and usage, there is wonderfully little. Englishmen and Normans\nwere held to have ____ down in peace under the equal protection of\nKing William.\"\n\nImportant: The hidden word is \"settled\". Never say this word directly - use \"it,\" \"this word,\" or \"the word\" instead.\n\nSuggest a word that could replace it in this sentence. Pick something simple and explain why it works. Under 15 words.\nExample: \"You could use 'bright' here - it captures the same feeling of intensity.\""
    }
  ],
  "max_tokens": 50,
  "temperature": 0.6
}
```

### 2. Word Selection for Cloze Exercises

**Purpose:** Select appropriate words to be blanked out in reading passages.

**Parameters:**
```json
{
  "model": "google/gemma-3-27b-it:free",
  "messages": [
    {
      "role": "user",
      "content": "You are a cluemaster vocabulary selector for educational cloze exercises. Select exactly [COUNT] words from this passage for a cloze exercise.\n\nCLOZE DELETION PRINCIPLES:\n- Select words that require understanding context and vocabulary to identify\n- Choose words essential for comprehension that test language ability\n- Target words where deletion creates meaningful cognitive gaps\n\nREQUIREMENTS:\n- Choose clear, properly-spelled words (no OCR errors like \"andsatires\")\n- Select meaningful nouns, verbs, or adjectives ([WORD_LENGTH] letters)\n- Words must appear EXACTLY as written in the passage\n- Avoid: capitalized words, function words, archaic terms, proper nouns, technical jargon\n- Skip any words that look malformed or concatenated\n\nReturn ONLY a JSON array of the selected words.\n\nPassage: \"[PASSAGE_TEXT]\""
    }
  ],
  "max_tokens": 100,
  "temperature": 0.3
}
```

**Word Length by Level:**
- Levels 1-3: 3-10 letters
- Levels 4+: 5-13 letters

**Response Format:** JSON array of strings
```json
["word1", "word2", "word3"]
```

### 3. Batch Passage Processing

**Purpose:** Process two passages simultaneously to reduce API calls and improve performance.

**Parameters:**
```json
{
  "model": "google/gemma-3-27b-it:free",
  "messages": [
    {
      "role": "system",
      "content": "Process two passages for a cloze reading exercise. For each passage: 1) Select words for blanks, 2) Generate a contextual introduction. Return a JSON object with both passages' data."
    },
    {
      "role": "user",
      "content": "Process these two passages for cloze exercises:\n\nPASSAGE 1:\nTitle: \"[BOOK1_TITLE]\" by [BOOK1_AUTHOR]\nText: \"[PASSAGE1_TEXT]\"\nSelect [COUNT] words for blanks.\n\nPASSAGE 2:\nTitle: \"[BOOK2_TITLE]\" by [BOOK2_AUTHOR]\nText: \"[PASSAGE2_TEXT]\"\nSelect [COUNT] words for blanks.\n\nWORD SELECTION CRITERIA:\n[WORD_LENGTH_CRITERIA]\n- Choose meaningful nouns, verbs, or adjectives\n- Avoid capitalized words, function words, archaic terms\n- Words must appear EXACTLY as written in the passage\n\nFor each passage return:\n- \"words\": array of selected words (exactly as they appear)\n- \"context\": one-sentence intro about the book/author\n\nReturn as JSON: {\"passage1\": {...}, \"passage2\": {...}}"
    }
  ],
  "max_tokens": 800,
  "temperature": 0.5
}
```

**Word Length by Level:**
- Levels 1-3: Select words 3-10 letters long
- Levels 4+: Select words 5-13 letters long

**Response Format:**
```json
{
  "passage1": {
    "words": ["word1", "word2"],
    "context": "A one-sentence description of the book and author"
  },
  "passage2": {
    "words": ["word3", "word4"],
    "context": "A one-sentence description of the book and author"
  }
}
```

### 4. Literary Contextualization

**Purpose:** Generate factual introductions about books and authors for educational context.

**Parameters:**
```json
{
  "model": "google/gemma-3-27b-it:free",
  "messages": [
    {
      "role": "user",
      "content": "You are a historical and literary expert of public domain entries in Project Gutenberg. Write one factual sentence about \"[BOOK_TITLE]\" by [AUTHOR]. Focus on what type of work it is, when it was written, or its historical significance. Be accurate and concise."
    }
  ],
  "max_tokens": 80,
  "temperature": 0.5
}
```

**Response Format:** Plain text sentence
```

"The Flockmaster of Poison Creek is a Western novel by George W. Ogden published in the early 20th century."
```

## Common Request Configuration

### Headers
All requests include these headers:

```javascript
{
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${this.apiKey}`,
  'HTTP-Referer': window.location.origin,
  'X-Title': 'Cloze Reader'
}
```

### Parameter Patterns

| Feature | Max Tokens | Temperature | Retry Logic |
|---------|------------|-------------|-------------|
| Hints | 50 | 0.6 | 3 attempts |
| Word Selection | 100 | 0.3 | 3 attempts |
| Batch Processing | 800 | 0.5 | 3 attempts |
| Contextualization | 80 | 0.5 | 3 attempts |

### Temperature Guidelines
- **0.3**: Structured tasks (word selection)
- **0.5**: Semi-structured tasks (batch processing, contextualization)
- **0.6**: Creative tasks (hint generation)

## Response Processing

### JSON Parsing Strategy
1. **Direct parsing**: Attempt to parse response as JSON
2. **Markdown extraction**: Extract JSON from code blocks (```json ... ```)
3. **Cleanup**: Remove markdown artifacts and fix truncated JSON
4. **Fallback extraction**: Use regex to extract partial data

### Artifact Removal
All responses are cleaned to remove AI formatting artifacts:
```javascript
content = content
  .replace(/^\s*["']|["']\s*$/g, '')  // Remove leading/trailing quotes
  .replace(/^\s*[:;]+\s*/, '')        // Remove leading colons and semicolons
  .replace(/\*+/g, '')                // Remove asterisks (markdown bold/italic)
  .replace(/_+/g, '')                 // Remove underscores (markdown)
  .replace(/#+\s*/g, '')              // Remove hash symbols (markdown headers)
  .replace(/\s+/g, ' ')               // Normalize whitespace
  .trim();
```

### Error Handling
- **API errors**: Check for `data.error` in OpenRouter responses
- **Malformed responses**: Validate response structure before processing
- **Graceful degradation**: Fall back to manual/simple methods when AI fails
- **Retry mechanism**: Exponential backoff with 3 attempts

## Implementation Notes

### Model Choice
- **Model**: `google/gemma-3-27b-it:free`
- **Rationale**: Free tier model suitable for educational use
- **Limitations**: Rate limiting requires batch processing and careful request management

### Rate Limiting Strategy
1. **Batch processing**: Combine multiple operations into single requests
2. **Two-passage system**: Process pairs of passages to reduce total API calls
3. **Fallback mechanisms**: Manual word selection when API unavailable
4. **Retry logic**: Handle temporary failures gracefully

### Security Considerations
- API keys loaded from environment variables via meta tags
- Keys excluded from version control via `.gitignore`
- HTTP-Referer header for request origin validation