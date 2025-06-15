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

### Level Progression Logic
- Players must pass **at least one passage** per round to advance levels
- Each round consists of two passages from different books
- Level advancement is determined after completing both passages

### Word Selection Constraints
- **Word Length**: 4-12 letters for all levels
- **Avoid**: Capitalized words, ALL-CAPS words, function words, archaic terms, proper nouns, technical jargon
- **Placement**: Never select words from first or last sentence/clause of passages
- **Focus**: Choose words from middle portions for better context dependency

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
      "content": "You are a cluemaster vocabulary selector for educational cloze exercises. Select exactly [COUNT] words from this passage for a cloze exercise.\n\nCLOZE DELETION PRINCIPLES:\n- Select words that require understanding context and vocabulary to identify\n- Choose words essential for comprehension that test language ability\n- Target words where deletion creates meaningful cognitive gaps\n\nREQUIREMENTS:\n- Choose clear, properly-spelled words (no OCR errors like \"andsatires\")\n- Select meaningful nouns, verbs, or adjectives (4-12 letters)\n- Words must appear EXACTLY as written in the passage\n- Avoid: capitalized words, ALL-CAPS words, function words, archaic terms, proper nouns, technical jargon\n- Skip any words that look malformed or concatenated\n- NEVER select words from the first or last sentence/clause of the passage\n- Choose words from the middle portions for better context dependency\n\nReturn ONLY a JSON array of the selected words.\n\nPassage: \"[PASSAGE_TEXT]\""
    }
  ],
  "max_tokens": 100,
  "temperature": 0.3
}
```

**Word Length Constraints:**
- All levels: 4-12 letters (consistent across all difficulty levels)

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
      "content": "Process these two passages for cloze exercises:\n\nPASSAGE 1:\nTitle: \"[BOOK1_TITLE]\" by [BOOK1_AUTHOR]\nText: \"[PASSAGE1_TEXT]\"\nSelect [COUNT] words for blanks.\n\nPASSAGE 2:\nTitle: \"[BOOK2_TITLE]\" by [BOOK2_AUTHOR]\nText: \"[PASSAGE2_TEXT]\"\nSelect [COUNT] words for blanks.\n\nSELECTION RULES:\n- Select EXACTLY [COUNT] word(s) per passage, no more, no less\n- Choose meaningful nouns, verbs, or adjectives (4-12 letters)\n- Avoid capitalized words, ALL-CAPS words, and table of contents entries\n- NEVER select words from the first or last sentence/clause of each passage\n- Choose words from the middle portions for better context dependency\n- Words must appear EXACTLY as written in the passage\n\nFor each passage return:\n- \"words\": array of EXACTLY [COUNT] selected word(s) (exactly as they appear in the text)\n- \"context\": one-sentence intro about the book/author\n\nCRITICAL: The \"words\" array must contain exactly [COUNT] element(s) for each passage.\n\nReturn as JSON: {\"passage1\": {...}, \"passage2\": {...}}"
    }
  ],
  "max_tokens": 800,
  "temperature": 0.5
}
```

**Word Selection Constraints:**
- All levels: 4-12 letters (consistent across all difficulty levels)
- Exact count enforcement with robust JSON parsing and error handling

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
1. **Markdown cleanup**: Remove ```json and ``` wrappers
2. **Trailing comma fixes**: Remove trailing commas from arrays (e.g., `["word",]` → `["word"]`)
3. **Direct parsing**: Attempt to parse cleaned response as JSON
4. **Structure validation**: Ensure required fields exist and are properly typed
5. **Empty string filtering**: Remove empty strings from word arrays
6. **Fallback extraction**: Use regex to extract partial data when parsing fails

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
- **Rationale**: Free tier model suitable for educational use with good performance
- **Limitations**: Rate limiting and occasional JSON formatting issues
- **Performance**: Handles batch processing well with proper prompt engineering

### Rate Limiting Strategy
1. **Batch processing**: Process two passages simultaneously in single API call
2. **Round-based progression**: Two passages per round reduces API calls by 50%
3. **Robust error handling**: JSON parsing fixes for malformed responses
4. **Fallback mechanisms**: Sequential processing when batch fails
5. **Retry logic**: Exponential backoff with 3 attempts for all requests

### Security Considerations
- API keys loaded from environment variables via meta tags
- Keys excluded from version control via `.gitignore`
- HTTP-Referer header for request origin validation