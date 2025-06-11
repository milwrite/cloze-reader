// Chat service for contextual, personalized hints
class ChatService {
  constructor(aiService) {
    this.aiService = aiService;
    this.conversations = new Map(); // blankId -> conversation history
    this.wordContexts = new Map(); // blankId -> detailed context
    this.blankQuestions = new Map(); // blankId -> Set of used question types (per-blank tracking)
    this.currentLevel = 1; // Track current difficulty level
    
    // Distinct, non-overlapping question set
    this.questions = [
      { text: "What is its part of speech?", type: "part_of_speech" },
      { text: "What role does it play in the sentence?", type: "sentence_role" },
      { text: "Is it abstract or a person, place, or thing?", type: "word_category" },
      { text: "What is a synonym for this word?", type: "synonym" }
    ];
  }

  // Initialize chat context for a specific blank
  initializeWordContext(blankId, wordData) {
    const context = {
      blankId,
      targetWord: wordData.originalWord,
      sentence: wordData.sentence,
      fullPassage: wordData.passage,
      bookTitle: wordData.bookTitle,
      author: wordData.author,
      wordPosition: wordData.wordPosition,
      difficulty: wordData.difficulty,
      previousAttempts: [],
      userQuestions: [],
      hintLevel: 0 // Progressive hint difficulty
    };
    
    this.wordContexts.set(blankId, context);
    this.conversations.set(blankId, []);
    return context;
  }

  // Per-blank question tracking with level awareness
  async askQuestion(blankId, questionType, userInput = '') {
    const context = this.wordContexts.get(blankId);
    
    if (!context) {
      return {
        error: true,
        message: "Context not found for this word."
      };
    }

    // Mark question as used for this specific blank
    if (!this.blankQuestions.has(blankId)) {
      this.blankQuestions.set(blankId, new Set());
    }
    this.blankQuestions.get(blankId).add(questionType);

    try {
      const response = await this.generateSpecificResponse(context, questionType, userInput);
      return {
        success: true,
        response: response,
        questionType: questionType
      };
    } catch (error) {
      console.error('Chat error:', error);
      return this.getSimpleFallback(context, questionType);
    }
  }

  // Generate specific response based on question type
  async generateSpecificResponse(context, questionType, userInput) {
    const word = context.targetWord;
    const sentence = context.sentence;
    const bookTitle = context.bookTitle;
    const author = context.author;
    
    try {
      // Use the enhanced contextual hint generation
      const aiResponse = await this.aiService.generateContextualHint(
        questionType, 
        word, 
        sentence, 
        bookTitle, 
        author
      );
      
      if (aiResponse && typeof aiResponse === 'string' && aiResponse.length > 10) {
        return aiResponse;
      }
    } catch (error) {
      console.warn('AI response failed:', error);
    }
    
    // Fallback - return enhanced fallback response
    return this.aiService.getEnhancedFallback(questionType, word, sentence, bookTitle);
  }

  // Build focused prompt for specific question types with level awareness
  buildFocusedPrompt(context, questionType, userInput) {
    const { sentence, bookTitle, author, targetWord } = context;
    const level = this.currentLevel;
    
    // Level 1 questions - Basic identification
    if (level === 1) {
      const prompts = {
        'basic_grammar': `What type of word (person/place/thing or action word) fits in the blank in: "${sentence}"? Keep it simple.`,
        'letter_hint': `The missing word is "${targetWord}". Tell me it starts with "${targetWord[0]}" without revealing the full word.`,
        'length_hint': `The missing word has ${targetWord.length} letters. Mention this fact helpfully.`,
        'category_hint': `Is the missing word in "${sentence}" a person, place, thing, or action? Give a simple answer.`,
        'basic_clue': `Give a very simple hint about the missing word in: "${sentence}". Make it easy to understand.`
      };
      return prompts[questionType] || prompts['basic_clue'];
    }
    
    // Level 2 questions - Contextual understanding
    if (level === 2) {
      const prompts = {
        'grammar_analysis': `In "${bookTitle}", what part of speech (noun, verb, adjective, etc.) is needed in: "${sentence}"? Explain simply.`,
        'contextual_meaning': `What does the missing word mean in this context from "${bookTitle}": "${sentence}"? Explain without revealing it.`,
        'synonym_clue': `Give a synonym or similar word to the one missing in: "${sentence}". Don't reveal the exact word.`,
        'narrative_connection': `How does the missing word connect to the story in "${bookTitle}"? Context: "${sentence}"`,
        'emotional_context': `What feeling or mood does the missing word express in: "${sentence}"?`
      };
      return prompts[questionType] || prompts['contextual_meaning'];
    }
    
    // Level 3+ questions - Literary analysis
    const prompts = {
      'deep_grammar': `Analyze the grammatical function of the missing word in this passage from "${bookTitle}" by ${author}: "${sentence}"`,
      'literary_analysis': `What literary significance does the missing word have in "${bookTitle}"? Context: "${sentence}"`,
      'authorial_intent': `What would ${author} intend with the word choice here in "${bookTitle}": "${sentence}"?`,
      'comparative_analysis': `How does this word usage compare to similar passages in "${bookTitle}"? Context: "${sentence}"`,
      'style_analysis': `Explain the stylistic choice of the missing word in ${author}'s writing: "${sentence}"`
    };
    
    return prompts[questionType] || prompts['literary_analysis'];
  }

  // Simple fallback responses
  getSimpleFallback(context, questionType) {
    // Use the enhanced fallback from HuggingFace service
    return this.aiService.getEnhancedFallback(
      questionType, 
      context.targetWord, 
      context.sentence, 
      context.bookTitle
    );
  }

  // Helper method to get words before the target word
  getWordsBefore(sentence, targetWord, count = 3) {
    const words = sentence.split(/\s+/);
    const targetIndex = words.findIndex(word => 
      word.toLowerCase().replace(/[^\w]/g, '') === targetWord.toLowerCase()
    );
    
    if (targetIndex === -1) return "";
    
    const startIndex = Math.max(0, targetIndex - count);
    return words.slice(startIndex, targetIndex).join(' ');
  }

  // Helper method to get words after the target word
  getWordsAfter(sentence, targetWord, count = 3) {
    const words = sentence.split(/\s+/);
    const targetIndex = words.findIndex(word => 
      word.toLowerCase().replace(/[^\w]/g, '') === targetWord.toLowerCase()
    );
    
    if (targetIndex === -1) return "";
    
    const endIndex = Math.min(words.length, targetIndex + count + 1);
    return words.slice(targetIndex + 1, endIndex).join(' ');
  }

  // Process AI response to ensure quality and safety
  processAIResponse(rawResponse, targetWord) {
    let processed = rawResponse.trim();
    
    // Remove any accidental word reveals
    const variations = this.generateWordVariations(targetWord);
    variations.forEach(variation => {
      const regex = new RegExp(`\\b${variation}\\b`, 'gi');
      processed = processed.replace(regex, '[the word]');
    });
    
    return processed;
  }

  // Generate word variations to avoid accidental reveals
  generateWordVariations(word) {
    const variations = [word.toLowerCase()];
    
    // Add common variations
    if (word.endsWith('ing')) {
      variations.push(word.slice(0, -3));
    }
    if (word.endsWith('ed')) {
      variations.push(word.slice(0, -2));
    }
    if (word.endsWith('s')) {
      variations.push(word.slice(0, -1));
    }
    
    return variations;
  }

  // Clear conversations and reset tracking
  clearConversations() {
    this.conversations.clear();
    this.wordContexts.clear();
    this.blankQuestions.clear();
  }

  // Set current level for question selection
  setLevel(level) {
    this.currentLevel = level;
  }

  // Get suggested questions for a specific blank
  getSuggestedQuestions(blankId) {
    const usedQuestions = this.blankQuestions.get(blankId) || new Set();
    
    return this.questions.map(q => ({
      ...q,
      used: usedQuestions.has(q.type)
    }));
  }

  // Reset for new game (clears everything including across-game state)
  resetForNewGame() {
    this.clearConversations();
    this.currentLevel = 1;
  }
}

export default ChatService;