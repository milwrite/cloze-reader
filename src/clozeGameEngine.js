// Core game logic for minimal cloze reader
import bookDataService from './bookDataService.js';
import { AIService } from './aiService.js';
import ChatService from './conversationManager.js';

const aiService = new AIService();

class ClozeGame {
  constructor() {
    this.currentBook = null;
    this.originalText = '';
    this.clozeText = '';
    this.blanks = [];
    this.userAnswers = [];
    this.score = 0;
    this.currentRound = 1;
    this.currentLevel = 1; // Track difficulty level separately from round
    this.contextualization = '';
    this.hints = [];
    this.chatService = new ChatService(aiService);
    this.lastResults = null; // Store results for answer revelation
  }

  async initialize() {
    try {
      await bookDataService.loadDataset();
      console.log('Game initialized successfully');
    } catch (error) {
      console.error('Failed to initialize game:', error);
      throw error;
    }
  }

  async startNewRound() {
    try {
      // Get a random book (now async with HF streaming)
      this.currentBook = await bookDataService.getRandomBook();
      
      // Extract a coherent passage avoiding fragmented text
      const fullText = this.currentBook.text;
      let passage = this.extractCoherentPassage(fullText);
      
      this.originalText = passage.trim();
      
      // Run AI calls in parallel for faster loading
      const [clozeResult, contextualizationResult] = await Promise.all([
        this.createClozeText(),
        this.generateContextualization()
      ]);
      
      return {
        title: this.currentBook.title,
        author: this.currentBook.author,
        text: this.clozeText,
        blanks: this.blanks,
        contextualization: this.contextualization,
        hints: this.hints
      };
    } catch (error) {
      console.error('Error starting new round:', error);
      throw error;
    }
  }

  extractCoherentPassage(text) {
    // Simple elegant solution: start from middle third of book where actual content is
    const textLength = text.length;
    const startFromMiddle = Math.floor(textLength * 0.3); // Skip first 30%
    const endAtThreeQuarters = Math.floor(textLength * 0.8); // Stop before last 20%
    
    // Random position in the middle section
    const availableLength = endAtThreeQuarters - startFromMiddle;
    const randomOffset = Math.floor(Math.random() * Math.max(0, availableLength - 1000));
    const startIndex = startFromMiddle + randomOffset;
    
    // Extract longer initial passage for better sentence completion
    let passage = text.substring(startIndex, startIndex + 1000);
    
    // Clean up start - find first complete sentence that starts with capital letter
    const firstSentenceMatch = passage.match(/[.!?]\s+([A-Z][^.!?]*)/);
    if (firstSentenceMatch && firstSentenceMatch.index < 200) {
      // Start from the capital letter after punctuation
      passage = passage.substring(firstSentenceMatch.index + firstSentenceMatch[0].length - firstSentenceMatch[1].length);
    } else {
      // If no good sentence break found, find first capital letter
      const firstCapitalMatch = passage.match(/[A-Z][^.!?]*/);
      if (firstCapitalMatch) {
        passage = passage.substring(firstCapitalMatch.index);
      }
    }
    
    // Clean up end - ensure we end at a complete sentence
    const sentences = passage.split(/(?<=[.!?])\s+/);
    if (sentences.length > 1) {
      // Remove the last sentence if it might be incomplete
      sentences.pop();
      passage = sentences.join(' ');
    }
    
    // Ensure minimum length
    if (passage.length < 400) {
      // Try again with different position if too short
      return this.extractCoherentPassage(text);
    }
    
    return passage.trim();
  }

  async createClozeText() {
    const words = this.originalText.split(' ');
    // Progressive difficulty: levels 1-2 = 1 blank, levels 3-4 = 2 blanks, level 5+ = 3 blanks
    let numberOfBlanks;
    if (this.currentLevel <= 2) {
      numberOfBlanks = 1;
    } else if (this.currentLevel <= 4) {
      numberOfBlanks = 2;
    } else {
      numberOfBlanks = 3;
    }
    
    // Update chat service with current level
    this.chatService.setLevel(this.currentLevel);
    
    // Always use AI for word selection with fallback
    let significantWords;
    try {
      significantWords = await aiService.selectSignificantWords(
        this.originalText, 
        numberOfBlanks
      );
      console.log('AI selected words:', significantWords);
    } catch (error) {
      console.warn('AI word selection failed, using manual fallback:', error);
      significantWords = this.selectWordsManually(words, numberOfBlanks);
      console.log('Manual selected words:', significantWords);
    }
    
    // Ensure we have valid words
    if (!significantWords || significantWords.length === 0) {
      console.warn('No words selected, using emergency fallback');
      significantWords = this.selectWordsManually(words, numberOfBlanks);
    }

    // Find word indices for selected significant words, distributed throughout passage
    const selectedIndices = [];
    const wordsLower = words.map(w => w.toLowerCase().replace(/[^\w]/g, ''));
    
    // Create sections of the passage to ensure distribution
    const passageSections = this.dividePassageIntoSections(words.length, numberOfBlanks);
    
    significantWords.forEach((significantWord, index) => {
      // Clean the significant word for matching
      const cleanSignificant = significantWord.toLowerCase().replace(/[^\w]/g, '');
      
      // Look for the word within the appropriate section for better distribution
      const sectionStart = passageSections[index] ? passageSections[index].start : 0;
      const sectionEnd = passageSections[index] ? passageSections[index].end : words.length;
      
      let wordIndex = -1;
      
      // First try to find the word in the designated section (avoiding first 10 words)
      for (let i = Math.max(10, sectionStart); i < sectionEnd; i++) {
        if (wordsLower[i] === cleanSignificant && !selectedIndices.includes(i)) {
          wordIndex = i;
          break;
        }
      }
      
      // If not found in section, look globally (but still avoid first 10 words)
      if (wordIndex === -1) {
        wordIndex = wordsLower.findIndex((word, idx) => 
          word === cleanSignificant && !selectedIndices.includes(idx) && idx >= 10
        );
      }
      
      if (wordIndex !== -1) {
        selectedIndices.push(wordIndex);
      } else {
        console.warn(`Could not find word "${significantWord}" in passage`);
      }
    });
    
    // Log the matching results
    console.log(`Found ${selectedIndices.length} of ${significantWords.length} words in passage`);
    
    // If no words were matched, fall back to manual selection
    if (selectedIndices.length === 0) {
      console.warn('No AI words matched in passage, using manual selection');
      const manualWords = this.selectWordsManually(words, numberOfBlanks);
      
      // Try to match manual words (avoiding first 10 words)
      manualWords.forEach((manualWord, index) => {
        const cleanManual = manualWord.toLowerCase().replace(/[^\w]/g, '');
        const wordIndex = wordsLower.findIndex((word, idx) => 
          word === cleanManual && !selectedIndices.includes(idx) && idx >= 10
        );
        
        if (wordIndex !== -1) {
          selectedIndices.push(wordIndex);
        }
      });
      
      console.log(`After manual fallback: ${selectedIndices.length} words found`);
    }

    // Sort indices for easier processing
    selectedIndices.sort((a, b) => a - b);
    
    // Final safety check - if still no words found, pick random content words (avoiding first 10)
    if (selectedIndices.length === 0) {
      console.error('Critical: No words could be selected, using emergency fallback');
      const contentWords = words.map((word, idx) => ({ word: word.toLowerCase().replace(/[^\w]/g, ''), idx }))
        .filter(item => item.word.length > 3 && !['the', 'and', 'but', 'for', 'are', 'was'].includes(item.word) && item.idx >= 10)
        .slice(0, numberOfBlanks);
      
      selectedIndices.push(...contentWords.map(item => item.idx));
      console.log(`Emergency fallback selected ${selectedIndices.length} words`);
    }

    // Create blanks array and cloze text
    this.blanks = [];
    this.hints = [];
    const clozeWords = [...words];
    
    for (let i = 0; i < selectedIndices.length; i++) {
      const index = selectedIndices[i];
      const originalWord = words[index];
      const cleanWord = originalWord.replace(/[^\w]/g, '');
      
      const blankData = {
        index: i,
        originalWord: cleanWord,
        wordIndex: index
      };
      
      this.blanks.push(blankData);
      
      // Initialize chat context for this word
      const wordContext = {
        originalWord: cleanWord,
        sentence: this.originalText,
        passage: this.originalText,
        bookTitle: this.currentBook.title,
        author: this.currentBook.author,
        wordPosition: index,
        difficulty: this.calculateWordDifficulty(cleanWord, index, words)
      };
      
      this.chatService.initializeWordContext(`blank_${i}`, wordContext);
      
      // Generate structural hint based on level
      let structuralHint;
      if (this.currentLevel <= 2) {
        // Levels 1-2: show length, first letter, and last letter
        structuralHint = `${cleanWord.length} letters, starts with "${cleanWord[0]}", ends with "${cleanWord[cleanWord.length - 1]}"`;
      } else {
        // Level 3+: show length and first letter only
        structuralHint = `${cleanWord.length} letters, starts with "${cleanWord[0]}"`;
      }
      this.hints.push({ index: i, hint: structuralHint });
      
      // Replace word with input field placeholder
      clozeWords[index] = `___BLANK_${i}___`;
    }

    this.clozeText = clozeWords.join(' ');
    this.userAnswers = new Array(this.blanks.length).fill('');
    
    // Debug: Log the created cloze text
    console.log('Created cloze text:', this.clozeText);
    console.log('Number of blanks:', this.blanks.length);
    
    return true; // Return success indicator
  }

  dividePassageIntoSections(totalWords, numberOfBlanks) {
    const sections = [];
    const sectionSize = Math.floor(totalWords / numberOfBlanks);
    
    for (let i = 0; i < numberOfBlanks; i++) {
      const start = i * sectionSize;
      const end = i === numberOfBlanks - 1 ? totalWords : (i + 1) * sectionSize;
      sections.push({ start, end });
    }
    
    return sections;
  }

  selectWordsManually(words, numberOfBlanks) {
    // Fallback manual word selection - avoid function words completely
    const functionWords = new Set([
      // Articles
      'the', 'a', 'an',
      // Prepositions  
      'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after',
      // Conjunctions
      'and', 'or', 'but', 'so', 'yet', 'nor', 'because', 'since', 'although', 'if', 'when', 'while',
      // Pronouns
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
      'this', 'that', 'these', 'those', 'who', 'what', 'which', 'whom', 'whose',
      // Auxiliary verbs
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall'
    ]);

    // Get content words with their indices for better distribution
    const contentWordIndices = [];
    words.forEach((word, index) => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      if (cleanWord.length > 3 && cleanWord.length <= 10 && !functionWords.has(cleanWord)) {
        contentWordIndices.push({ word: cleanWord, index });
      }
    });

    // Distribute selection across sections
    const passageSections = this.dividePassageIntoSections(words.length, numberOfBlanks);
    const selectedWords = [];
    
    for (let i = 0; i < numberOfBlanks && i < passageSections.length; i++) {
      const section = passageSections[i];
      const sectionWords = contentWordIndices.filter(item => 
        item.index >= section.start && item.index < section.end
      );
      
      if (sectionWords.length > 0) {
        const randomIndex = Math.floor(Math.random() * sectionWords.length);
        selectedWords.push(sectionWords[randomIndex].word);
      }
    }

    // Fill remaining slots if needed
    while (selectedWords.length < numberOfBlanks && contentWordIndices.length > 0) {
      const availableWords = contentWordIndices
        .map(item => item.word)
        .filter(word => !selectedWords.includes(word));
      
      if (availableWords.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableWords.length);
        selectedWords.push(availableWords[randomIndex]);
      } else {
        break;
      }
    }

    return selectedWords;
  }

  async generateContextualization() {
    // Always use AI for contextualization
    try {
      this.contextualization = await aiService.generateContextualization(
        this.currentBook.title,
        this.currentBook.author
      );
      return this.contextualization;
    } catch (error) {
      console.warn('AI contextualization failed, using fallback:', error);
      this.contextualization = `"${this.currentBook.title}" by ${this.currentBook.author} - A classic work of literature.`;
      return this.contextualization;
    }
  }

  renderClozeText() {
    let html = this.clozeText;
    
    this.blanks.forEach((blank, index) => {
      const inputHtml = `<input type="text" 
        class="cloze-input" 
        data-blank-index="${index}" 
        placeholder="${'_'.repeat(Math.max(3, blank.originalWord.length))}"
        style="width: ${Math.max(80, blank.originalWord.length * 12)}px;">`;
      
      html = html.replace(`___BLANK_${index}___`, inputHtml);
    });

    return html;
  }

  submitAnswers(answers) {
    this.userAnswers = answers;
    let correctCount = 0;
    const results = [];

    this.blanks.forEach((blank, index) => {
      const userAnswer = answers[index].trim().toLowerCase();
      const correctAnswer = blank.originalWord.toLowerCase();
      const isCorrect = userAnswer === correctAnswer;
      
      if (isCorrect) correctCount++;
      
      results.push({
        blankIndex: index,
        userAnswer: answers[index],
        correctAnswer: blank.originalWord,
        isCorrect
      });
    });

    const scorePercentage = Math.round((correctCount / this.blanks.length) * 100);
    this.score = scorePercentage;
    
    // Calculate pass requirements based on number of blanks
    const totalBlanks = this.blanks.length;
    const requiredCorrect = this.calculateRequiredCorrect(totalBlanks);
    const passed = correctCount >= requiredCorrect;

    const resultsData = {
      correct: correctCount,
      total: this.blanks.length,
      percentage: scorePercentage,
      passed: passed,
      results,
      canAdvanceLevel: passed,
      shouldRevealAnswers: !passed,
      requiredCorrect: requiredCorrect,
      currentLevel: this.currentLevel
    };

    // Store results for potential answer revelation
    this.lastResults = resultsData;

    return resultsData;
  }

  // Calculate required correct answers based on total blanks
  calculateRequiredCorrect(totalBlanks) {
    if (totalBlanks === 1) {
      // Level 1: Must get the single word correct
      return 1;
    } else if (totalBlanks % 2 === 1) {
      // Odd number of blanks (3, 5, etc.): require all but one
      return totalBlanks - 1;
    } else {
      // Even number of blanks: require all correct
      return totalBlanks;
    }
  }

  showAnswers() {
    return this.blanks.map(blank => ({
      index: blank.index,
      word: blank.originalWord
    }));
  }

  nextRound() {
    // Check if user passed the previous round
    const passed = this.lastResults && this.lastResults.passed;
    
    // Always increment round counter
    this.currentRound++;
    
    // Only advance level if user passed
    if (passed) {
      this.currentLevel++;
    }
    // If failed, stay at same level
    
    // Clear chat conversations for new round
    this.chatService.clearConversations();
    
    // Clear last results since we're moving to new round
    this.lastResults = null;
    
    return this.startNewRound();
  }

  // Get answers for current round (for revelation when switching passages)
  getCurrentAnswers() {
    if (!this.lastResults) return null;
    
    return {
      hasResults: true,
      passed: this.lastResults.passed,
      shouldRevealAnswers: this.lastResults.shouldRevealAnswers,
      currentLevel: this.lastResults.currentLevel,
      requiredCorrect: this.lastResults.requiredCorrect,
      answers: this.blanks.map(blank => ({
        index: blank.index,
        correctAnswer: blank.originalWord,
        userAnswer: this.lastResults.results[blank.index]?.userAnswer || '',
        isCorrect: this.lastResults.results[blank.index]?.isCorrect || false
      }))
    };
  }

  // Calculate difficulty of a word based on various factors
  calculateWordDifficulty(word, position, allWords) {
    let difficulty = 1;
    
    // Length factor
    if (word.length > 8) difficulty += 2;
    else if (word.length > 5) difficulty += 1;
    
    // Position factor (middle words might be harder)
    const relativePosition = position / allWords.length;
    if (relativePosition > 0.3 && relativePosition < 0.7) difficulty += 1;
    
    // Complexity factors
    if (word.includes('ing') || word.includes('ed')) difficulty += 0.5;
    if (word.includes('tion') || word.includes('sion')) difficulty += 1;
    
    // Current level factor
    difficulty += (this.currentLevel - 1) * 0.5;
    
    return Math.min(5, Math.max(1, Math.round(difficulty)));
  }

  // Simple, clean hint with just essential info based on level
  generateContextualFallbackHint(word, wordIndex, allWords) {
    if (this.currentLevel <= 2) {
      return `${word.length} letters, starts with "${word[0]}", ends with "${word[word.length - 1]}"`;
    } else {
      return `${word.length} letters, starts with "${word[0]}"`;
    }
  }

  // Chat functionality methods
  async askQuestionAboutBlank(blankIndex, questionType, currentInput = '') {
    const blankId = `blank_${blankIndex}`;
    return await this.chatService.askQuestion(blankId, questionType, currentInput);
  }

  getSuggestedQuestionsForBlank(blankIndex) {
    const blankId = `blank_${blankIndex}`;
    return this.chatService.getSuggestedQuestions(blankId);
  }


  // Enhanced render method to include chat buttons
  renderClozeTextWithChat() {
    let html = this.clozeText;
    
    this.blanks.forEach((blank, index) => {
      const chatButtonId = `chat-btn-${index}`;
      const inputHtml = `
        <span class="inline-flex items-center gap-1">
          <input type="text" 
            class="cloze-input" 
            data-blank-index="${index}" 
            placeholder="${'_'.repeat(Math.max(3, blank.originalWord.length))}"
            style="width: ${Math.max(80, blank.originalWord.length * 12)}px;">
          <button id="${chatButtonId}" 
            class="chat-button text-blue-500 hover:text-blue-700 text-sm" 
            data-blank-index="${index}"
            title="Ask question about this word">
            💬
          </button>
        </span>`;
      
      html = html.replace(`___BLANK_${index}___`, inputHtml);
    });

    return html;
  }
}

export default ClozeGame;