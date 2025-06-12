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
    const fallback = this.getSimpleFallback(context, questionType);
    return fallback.response;
  }

  // Build focused prompt for specific question types with level awareness
  buildFocusedPrompt(context, questionType, userInput) {
    const { sentence, bookTitle, author } = context;
    const baseContext = `From "${bookTitle}" by ${author}: "${sentence}"`;
    
    const prompts = {
      part_of_speech: `${baseContext}\n\nFor this cloze game, identify the part of speech needed in the blank. Respond exactly: "This is a [noun/verb/adjective/adverb]" then add ONE clue about its function. Maximum 15 words. No bold text or markdown.`,
      
      sentence_role: `${baseContext}\n\nFor this cloze game, analyze the blank's sentence role. Format: "Look at [word before] ____ [word after] - what fits here?" Focus on immediate context. Maximum 18 words. No markdown.`,
      
      word_category: `${baseContext}\n\nFor this cloze game, categorize the missing word. Start exactly: "This is abstract" or "This is concrete" then add ONE example. Maximum 12 words. No bold or italics.`,
      
      synonym: `${baseContext}\n\nFor this cloze game, give a synonym clue. Format: "Try a word similar to [related concept]" or "Another word for [meaning]". Maximum 10 words. No markdown formatting.`
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