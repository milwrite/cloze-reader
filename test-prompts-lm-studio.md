# Gemma-3-27b Model Integration Guide for Cloze Reader

## Part 1: Step-by-Step API Request Processing

### 1. Initial Request Reception
When the Cloze Reader application makes an API request through OpenRouter:

1. **Authentication**: Verify Bearer token from `Authorization` header
2. **Request Type Detection**: Identify the operation type based on prompt content
3. **Parameter Extraction**: Parse temperature, max_tokens, and message content
4. **Rate Limiting Check**: Ensure request complies with free tier limits

### 2. Word Selection Request Processing

**When Temperature = 0.3 and prompt contains "CLOZE DELETION PRINCIPLES":**

1. **Parse Passage**: Extract the text passage from the system message
2. **Identify Difficulty Level**: 
   - Level 1-2: Target 4-7 letter words (easy vocabulary)
   - Level 3-4: Target 4-10 letter words (medium difficulty)
   - Level 5+: Target 5-14 letter words (challenging vocabulary)
3. **Select Words**:
   - Identify significant vocabulary words (nouns, verbs, adjectives, adverbs)
   - Avoid proper nouns, numbers, articles, and function words
   - Ensure words are contextually important for comprehension
4. **Format Response**: Return JSON array of selected words
5. **Validate**: Ensure all words exist in the original passage

### 3. Batch Processing Request

**When Temperature = 0.5 and prompt contains two passages:**

1. **Parse Both Passages**: Extract passage1 and passage2 from the prompt
2. **Process Each Passage**:
   - Apply word selection logic for each based on difficulty level
   - Generate one-sentence contextualization for each book
3. **Format Response**: Return structured JSON with both passages' data
4. **Ensure Consistency**: Words must match exactly as they appear in passages

### 4. Contextualization Request

**When Temperature = 0.2 and prompt asks for book context:**

1. **Extract Book Information**: Parse title and author from prompt
2. **Generate Context**: Create one factual sentence about:
   - Type of work (novel, short story, essay)
   - Historical period when written
   - Literary significance or genre
3. **Keep Concise**: Limit to 80 tokens maximum
4. **Avoid Speculation**: Only include verifiable information

### 5. Chat Hint Request

**When Temperature = 0.6 and prompt includes "word puzzles":**

1. **Identify Question Type**:
   - `part_of_speech`: Grammar category identification
   - `sentence_role`: Function in the sentence
   - `word_category`: Abstract/concrete classification
   - `synonym`: Alternative word suggestion
2. **Parse Target Word**: Extract the hidden word (NEVER reveal it)
3. **Generate Appropriate Hint**:
   - Follow exact format requested
   - Stay within 50 token limit
   - Use plain text only, no formatting
4. **Validate**: Ensure hint doesn't contain or spell out the target word

### 6. Response Formatting Rules

1. **JSON Responses**: 
   - Word selection: Clean array format `["word1", "word2"]`
   - Batch processing: Nested object structure
   - No markdown code blocks unless specifically requested

2. **Text Responses**:
   - Contextualization: Single sentence, no formatting
   - Chat hints: Plain text, follows exact format requested

3. **Error Handling**:
   - Invalid requests: Return graceful error messages
   - Missing parameters: Use sensible defaults
   - Malformed input: Attempt to parse intent

## Part 2: LM Studio Testing Configuration

### System Prompt
```
You are a specialized AI assistant for the Cloze Reader educational application. You help create vocabulary exercises by selecting appropriate words from text passages and providing contextual hints without revealing answers. Always respond in the exact format requested, using plain JSON or text as specified. Never use markdown formatting unless explicitly requested.
```

### Temperature Settings
- **Word Selection**: 0.3
- **Batch Processing**: 0.5
- **Contextualization**: 0.2
- **Chat Hints**: 0.6

### Response Length Limits
- **Word Selection**: 100 tokens
- **Batch Processing**: 800 tokens
- **Contextualization**: 80 tokens
- **Chat Hints**: 50 tokens

### Test Prompts

#### 1. Word Selection Test (Level 1-2 Easy)
```json
{
  "messages": [
    {
      "role": "system",
      "content": "CLOZE DELETION PRINCIPLES:\n- Select words that require understanding context and vocabulary to identify\n- Choose words essential for comprehension that test language ability\n- Target words where deletion creates meaningful cognitive gaps\n\nFrom the following passage, select exactly 1 word that is important for reading comprehension.\n\nDifficulty level 1-2: Focus on easier vocabulary (4-7 letters) like common nouns, simple verbs, and basic adjectives.\n\nRETURN ONLY A JSON ARRAY OF YOUR SELECTED WORDS. Select words that appear EXACTLY as written in the passage.\n\nPassage:\nThe old woman lived in a small cottage by the forest. Every morning, she would walk to the village market to buy fresh bread."
    }
  ],
  "temperature": 0.3,
  "max_tokens": 100
}
```

**Expected Output Schema:**
```json
{
  "type": "array",
  "items": {
    "type": "string",
    "minLength": 4,
    "maxLength": 7
  },
  "minItems": 1,
  "maxItems": 1
}
```

#### 2. Batch Processing Test (Level 3-4 Medium)
```json
{
  "messages": [
    {
      "role": "system",
      "content": "Process these two passages for a cloze reading exercise:\n\nPASSAGE 1 (Pride and Prejudice by Jane Austen):\nIt is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n\nPASSAGE 2 (A Tale of Two Cities by Charles Dickens):\nIt was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.\n\nFor each passage:\n1. Select 1 word for difficulty level 3-4 (medium vocabulary, 4-10 letters)\n2. Write ONE sentence about the book/author\n\nReturn a JSON object with this structure:\n{\n  \"passage1\": {\n    \"words\": [selected words],\n    \"context\": \"One sentence about the book\"\n  },\n  \"passage2\": {\n    \"words\": [selected words],\n    \"context\": \"One sentence about the book\"\n  }\n}"
    }
  ],
  "temperature": 0.5,
  "max_tokens": 800
}
```

**Expected Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "passage1": {
      "type": "object",
      "properties": {
        "words": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1,
          "maxItems": 1
        },
        "context": {
          "type": "string",
          "maxLength": 150
        }
      },
      "required": ["words", "context"]
    },
    "passage2": {
      "type": "object",
      "properties": {
        "words": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1,
          "maxItems": 1
        },
        "context": {
          "type": "string",
          "maxLength": 150
        }
      },
      "required": ["words", "context"]
    }
  },
  "required": ["passage1", "passage2"]
}
```

#### 3. Contextualization Test
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Write one factual sentence about 'The Adventures of Sherlock Holmes' by Arthur Conan Doyle. Focus on what type of work it is, when it was written, or its historical significance. Keep it under 20 words and conversational."
    }
  ],
  "temperature": 0.2,
  "max_tokens": 80
}
```

**Expected Output:** Plain text string, no JSON structure required.

#### 4. Chat Hint Test (Part of Speech)
```json
{
  "messages": [
    {
      "role": "system",
      "content": "You provide clues for word puzzles. You will be told the target word that players need to guess, but you must NEVER mention, spell, or reveal that word in your response. Follow the EXACT format requested. Be concise and direct about the target word without revealing it. Use plain text only - no bold, italics, asterisks, or markdown formatting. Stick to word limits."
    },
    {
      "role": "user",
      "content": "The target word is 'walked'. The sentence is: 'Every morning, she would _____ to the village market to buy fresh bread.'\n\nQuestion type: part_of_speech\n\nIdentify what part of speech fits in this blank. Answer in 2-5 words. Format: 'It's a/an [part of speech]'"
    }
  ],
  "temperature": 0.6,
  "max_tokens": 50
}
```

**Expected Output:** Plain text following format "It's a/an [part of speech]"

#### 5. Chat Hint Test (Synonym)
```json
{
  "messages": [
    {
      "role": "system",
      "content": "You provide clues for word puzzles. You will be told the target word that players need to guess, but you must NEVER mention, spell, or reveal that word in your response. Follow the EXACT format requested. Be concise and direct about the target word without revealing it. Use plain text only - no bold, italics, asterisks, or markdown formatting. Stick to word limits."
    },
    {
      "role": "user",
      "content": "The target word is 'cottage'. The sentence is: 'The old woman lived in a small _____ by the forest.'\n\nQuestion type: synonym\n\nSuggest a different word that could replace the blank. Answer in 1-3 words only."
    }
  ],
  "temperature": 0.6,
  "max_tokens": 50
}
```

**Expected Output:** Plain text with 1-3 word synonym

### LM Studio Configuration

1. **Model Selection**: Load gemma-3-27b or equivalent model
2. **Context Length**: Set to at least 4096 tokens
3. **GPU Layers**: Maximize based on available VRAM
4. **Batch Size**: 512 for optimal performance
5. **Prompt Format**: Use ChatML or model's native format

### Testing Checklist

- [ ] Verify JSON responses are clean (no markdown blocks)
- [ ] Check word selections match passage exactly
- [ ] Ensure hints never reveal target words
- [ ] Validate response stays within token limits
- [ ] Test difficulty level word length constraints
- [ ] Confirm batch processing handles both passages
- [ ] Verify contextualization produces factual content
- [ ] Test all four hint question types