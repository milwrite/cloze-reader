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
    
    // Create sentence with blank instead of revealing the word
    const sentenceWithBlank = sentence.replace(new RegExp(`\\b${word}\\b`, 'gi'), '____');
    
    try {
      // Build focused prompt using the conversation manager's logic
      const prompt = this.buildFocusedPrompt({
        ...context,
        sentence: sentenceWithBlank
      }, questionType, userInput);
      
      // Use the AI service as a simple API wrapper
      const aiResponse = await this.aiService.generateContextualHint(prompt);
      
      if (aiResponse && typeof aiResponse === 'string' && aiResponse.length > 10) {
        return aiResponse;
      }
    } catch (error) {
      console.warn('AI response failed:', error);
    }
    
    // Fallback - return enhanced fallback response without revealing word
    return this.getSimpleFallback(context, questionType);
  }

  // Build focused prompt for specific question types with level awareness
  buildFocusedPrompt(context, questionType, userInput) {
    const { sentence, bookTitle, author } = context;
    const baseContext = `From "${bookTitle}" by ${author}: "${sentence}"`;
    
    const prompts = {
      part_of_speech: `${baseContext}\n\nRespond with exactly: "This is a [noun/verb/adjective/adverb]" then add ONE simple clue about what type (e.g., "a thing", "an action", "describes something"). Maximum 15 words total. Do not reveal the word.`,
      
      sentence_role: `${baseContext}\n\nPoint to specific words around the blank. Format: "Look at 'the [word before] ____ [word after]' - what could [verb/function]?" Use only immediate neighboring words. Maximum 20 words.`,
      
      word_category: `${baseContext}\n\nStart with exactly "This is abstract" or "This is concrete." Then add ONE example: "Like [feelings/objects]" or "Think [size/type]". Maximum 12 words total.`,
      
      synonym: `${baseContext}\n\nFormat: "Try a word similar to [related word]" or "Another word for [concept]". Give ONE direct synonym or related concept only. Maximum 10 words.`
    };
    
    return prompts[questionType] || `${baseContext}\n\nProvide a helpful hint about the missing word without revealing it.`;
  }

  // Simple fallback responses
  getSimpleFallback(context, questionType) {
    const fallbacks = {
      part_of_speech: "Look at the surrounding words. Is it describing something, showing action, or naming something?",
      sentence_role: "Consider how this word connects to the other parts of the sentence.",
      word_category: "Think about whether this represents something concrete or an abstract idea.",
      synonym: "What other word could fit in this same spot with similar meaning?"
    };
    
    return {
      success: true,
      response: fallbacks[questionType] || "Consider the context and what word would make sense here.",
      questionType: questionType
    };
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