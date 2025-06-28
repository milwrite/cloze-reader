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
    this.roundResults = []; // Store results for both passages in current round
    
    // Two-passage system properties
    this.currentBooks = []; // Array of two books per round
    this.passages = []; // Array of two passages per round
    this.currentPassageIndex = 0; // 0 for first passage, 1 for second
    
    // Level progression tracking
    this.roundsPassedAtCurrentLevel = 0; // Track successful rounds at current level
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
      // Get two books for this round based on current level criteria
      const book1 = await bookDataService.getBookByLevelCriteria(this.currentLevel);
      const book2 = await bookDataService.getBookByLevelCriteria(this.currentLevel);
      
      // Extract passages from both books
      const passage1 = this.extractCoherentPassage(book1.text);
      const passage2 = this.extractCoherentPassage(book2.text);
      
      // Store both books and passages
      this.currentBooks = [book1, book2];
      this.passages = [passage1.trim(), passage2.trim()];
      this.currentPassageIndex = 0;
      
      // Calculate blanks per passage based on level
      // Levels 1-5: 1 blank, Levels 6-10: 2 blanks, Level 11+: 3 blanks
      let blanksPerPassage;
      if (this.currentLevel <= 5) {
        blanksPerPassage = 1;
      } else if (this.currentLevel <= 10) {
        blanksPerPassage = 2;
      } else {
        blanksPerPassage = 3;
      }
      
      // Process both passages in a single API call
      try {
        const batchResult = await aiService.processBothPassages(
          passage1, book1, passage2, book2, blanksPerPassage, this.currentLevel
        );
        
        // Store the preprocessed data for both passages
        this.preprocessedData = batchResult;
        
        // Debug: Log what the AI returned
        console.log(`Level ${this.currentLevel}: Requested ${blanksPerPassage} blanks per passage`);
        console.log(`Passage 1 received ${batchResult.passage1.words.length} words:`, batchResult.passage1.words);
        console.log(`Passage 2 received ${batchResult.passage2.words.length} words:`, batchResult.passage2.words);
        
        // Set up first passage using preprocessed data
        this.currentBook = book1;
        this.originalText = this.passages[0];
        await this.createClozeTextFromPreprocessed(0);
        this.contextualization = this.preprocessedData.passage1.context;
        
      } catch (error) {
        console.warn('Batch processing failed, falling back to sequential:', error);
        // Fallback to sequential processing
        this.currentBook = book1;
        this.originalText = this.passages[0];
        await this.createClozeText();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.generateContextualization();
      }
      
      return {
        title: this.currentBook.title,
        author: this.currentBook.author,
        text: this.clozeText,
        blanks: this.blanks,
        contextualization: this.contextualization,
        hints: this.hints,
        passageNumber: 1,
        totalPassages: 2
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
    
    let attempts = 0;
    let passage = '';
    
    while (attempts < 5) {
      // Random position in the middle section
      const availableLength = endAtThreeQuarters - startFromMiddle;
      const randomOffset = Math.floor(Math.random() * Math.max(0, availableLength - 1000));
      const startIndex = startFromMiddle + randomOffset;
      
      // Extract longer initial passage for better sentence completion
      passage = text.substring(startIndex, startIndex + 1000);
    
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
      
      // Enhanced quality check based on narrative flow characteristics
      const words = passage.split(/\s+/);
      const totalWords = words.length;
      
      // Count various quality indicators
      const capsWords = words.filter(w => w.length > 1 && w === w.toUpperCase() && !/^\d+$/.test(w));
      const capsCount = capsWords.length;
      const numbersCount = words.filter(w => /\d/.test(w)).length;
      const shortWords = words.filter(w => w.length <= 3).length;
      const punctuationMarks = (passage.match(/[;:()[\]{}—–]/g) || []).length;
      const sentenceList = passage.split(/[.!?]+/).filter(s => s.trim().length > 10);
      const lines = passage.split('\n').filter(l => l.trim());
      
      // Debug logging for caps detection
      if (capsCount > 5) {
        console.log(`High caps count detected: ${capsCount}/${totalWords} words (${Math.round((capsCount/totalWords) * 100)}%)`);
        console.log(`Sample caps words:`, capsWords.slice(0, 10));
      }
      
      // Count excessive dashes (n-dashes, m-dashes, hyphens in sequence)
      const dashSequences = (passage.match(/[-—–]{3,}/g) || []).length;
      const totalDashes = (passage.match(/[-—–]/g) || []).length;
      
      // Count additional formatting patterns
      const asteriskSequences = (passage.match(/\*{3,}/g) || []).length;
      const asteriskLines = (passage.match(/^\s*\*+\s*$/gm) || []).length;
      const underscoreSequences = (passage.match(/_{3,}/g) || []).length;
      const equalSequences = (passage.match(/={3,}/g) || []).length;
      const pipeCount = (passage.match(/\|/g) || []).length;
      const numberedLines = (passage.match(/^\s*\d+[\.\)]\s/gm) || []).length;
      const parenthesesCount = (passage.match(/[()]/g) || []).length;
      const squareBrackets = (passage.match(/[\[\]]/g) || []).length;
      
      // Dictionary/glossary patterns
      const hashSymbols = (passage.match(/#/g) || []).length;
      const abbreviationPattern = /\b(n\.|adj\.|adv\.|v\.|pl\.|sg\.|cf\.|e\.g\.|i\.e\.|etc\.|vs\.|viz\.|OE\.|OFr\.|L\.|ME\.|NE\.|AN\.|ON\.|MDu\.|MLG\.|MHG\.|Ger\.|Du\.|Dan\.|Sw\.|Icel\.)\b/gi;
      const abbreviations = (passage.match(abbreviationPattern) || []).length;
      const etymologyBrackets = (passage.match(/\[[^\]]+\]/g) || []).length;
      const referenceNumbers = (passage.match(/\b[IVX]+\s+[abc]?\s*\d+/g) || []).length;
      const definitionPattern = /^[^.]+,\s*(n\.|adj\.|adv\.|v\.)/gm;
      const definitionLines = (passage.match(definitionPattern) || []).length;
      
      // Academic/reference patterns
      const citationPattern = /\(\d{4}\)|p\.\s*\d+|pp\.\s*\d+-\d+|vol\.\s*\d+|ch\.\s*\d+/gi;
      const citations = (passage.match(citationPattern) || []).length;
      const technicalTerms = ['etymology', 'phoneme', 'morpheme', 'lexicon', 'syntax', 'semantics', 'glossary', 'vocabulary', 'dialect', 'pronunciation'];
      const technicalTermCount = technicalTerms.reduce((count, term) => 
        count + (passage.match(new RegExp(term, 'gi')) || []).length, 0
      );
      
      // Check for repetitive patterns (common in indexes/TOCs)
      const repeatedPhrases = ['CONTENTS', 'CHAPTER', 'Volume', 'Vol.', 'Part', 'Book'];
      const repetitionCount = repeatedPhrases.reduce((count, phrase) => 
        count + (passage.match(new RegExp(phrase, 'gi')) || []).length, 0
      );
      
      // Check for title patterns (common in TOCs)
      const titlePattern = /^[A-Z][A-Z\s]+$/m;
      const titleLines = lines.filter(line => titlePattern.test(line.trim())).length;
      
      // Check for consecutive all-caps lines (title pages, copyright notices)
      let consecutiveCapsLines = 0;
      let maxConsecutiveCaps = 0;
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.length > 3 && trimmed === trimmed.toUpperCase() && !/^\d+$/.test(trimmed)) {
          consecutiveCapsLines++;
          maxConsecutiveCaps = Math.max(maxConsecutiveCaps, consecutiveCapsLines);
        } else {
          consecutiveCapsLines = 0;
        }
      });
      
      // Calculate quality ratios
      const capsRatio = capsCount / totalWords;
      const numbersRatio = numbersCount / totalWords;
      const shortWordRatio = shortWords / totalWords;
      const punctuationRatio = punctuationMarks / totalWords;
      const avgWordsPerSentence = totalWords / Math.max(1, sentenceList.length);
      const repetitionRatio = repetitionCount / totalWords;
      const titleLineRatio = titleLines / Math.max(1, lines.length);
      const dashRatio = totalDashes / totalWords;
      const parenthesesRatio = parenthesesCount / totalWords;
      const squareBracketRatio = squareBrackets / totalWords;
      const hashRatio = hashSymbols / totalWords;
      const abbreviationRatio = abbreviations / totalWords;
      const etymologyRatio = etymologyBrackets / totalWords;
      const definitionRatio = definitionLines / Math.max(1, lines.length);
      const technicalRatio = technicalTermCount / totalWords;
      
      // Stricter thresholds for higher levels
      const capsThreshold = this.currentLevel >= 3 ? 0.03 : 0.05;
      const numbersThreshold = this.currentLevel >= 3 ? 0.02 : 0.03;
      
      // Reject if passage shows signs of being technical/reference material
      let qualityScore = 0;
      let issues = [];
      
      // Immediate rejection for excessive caps (title pages, headers, etc)
      if (capsRatio > 0.15) {
        console.log(`Rejecting passage with excessive caps: ${Math.round(capsRatio * 100)}%`);
        attempts++;
        continue;
      }
      
      // Immediate rejection for consecutive all-caps lines (title pages, copyright)
      if (maxConsecutiveCaps >= 2) {
        console.log(`Rejecting passage with ${maxConsecutiveCaps} consecutive all-caps lines`);
        attempts++;
        continue;
      }
      
      if (capsRatio > capsThreshold) { qualityScore += capsRatio * 100; issues.push(`caps: ${Math.round(capsRatio * 100)}%`); }
      if (numbersRatio > numbersThreshold) { qualityScore += numbersRatio * 40; issues.push(`numbers: ${Math.round(numbersRatio * 100)}%`); }
      if (punctuationRatio > 0.08) { qualityScore += punctuationRatio * 15; issues.push(`punct: ${Math.round(punctuationRatio * 100)}%`); }
      if (avgWordsPerSentence < 8 || avgWordsPerSentence > 40) { qualityScore += 2; issues.push(`sent-len: ${Math.round(avgWordsPerSentence)}`); }
      if (shortWordRatio < 0.3) { qualityScore += 2; issues.push(`short-words: ${Math.round(shortWordRatio * 100)}%`); }
      if (repetitionRatio > 0.02) { qualityScore += repetitionRatio * 50; issues.push(`repetitive: ${Math.round(repetitionRatio * 100)}%`); }
      if (titleLineRatio > 0.2) { qualityScore += 5; issues.push(`title-lines: ${Math.round(titleLineRatio * 100)}%`); }
      if (dashSequences > 0) { qualityScore += dashSequences * 3; issues.push(`dash-sequences: ${dashSequences}`); }
      if (dashRatio > 0.02) { qualityScore += dashRatio * 25; issues.push(`dashes: ${Math.round(dashRatio * 100)}%`); }
      if (asteriskSequences > 0 || asteriskLines > 0) { qualityScore += (asteriskSequences + asteriskLines) * 2; issues.push(`asterisk-separators: ${asteriskSequences + asteriskLines}`); }
      if (underscoreSequences > 0) { qualityScore += underscoreSequences * 2; issues.push(`underscore-lines: ${underscoreSequences}`); }
      if (equalSequences > 0) { qualityScore += equalSequences * 2; issues.push(`equal-lines: ${equalSequences}`); }
      if (pipeCount > 5) { qualityScore += 3; issues.push(`table-formatting: ${pipeCount} pipes`); }
      if (numberedLines > 3) { qualityScore += 2; issues.push(`numbered-list: ${numberedLines} items`); }
      if (parenthesesRatio > 0.05) { qualityScore += 2; issues.push(`excessive-parentheses: ${Math.round(parenthesesRatio * 100)}%`); }
      if (squareBracketRatio > 0.02) { qualityScore += 2; issues.push(`excessive-brackets: ${Math.round(squareBracketRatio * 100)}%`); }
      
      // Dictionary/glossary/academic content detection
      if (hashRatio > 0.01) { qualityScore += hashRatio * 100; issues.push(`hash-symbols: ${hashSymbols}`); }
      if (abbreviationRatio > 0.03) { qualityScore += abbreviationRatio * 50; issues.push(`abbreviations: ${abbreviations}`); }
      if (etymologyRatio > 0.005) { qualityScore += etymologyRatio * 100; issues.push(`etymology-brackets: ${etymologyBrackets}`); }
      if (definitionRatio > 0.1) { qualityScore += definitionRatio * 20; issues.push(`definition-lines: ${Math.round(definitionRatio * 100)}%`); }
      if (referenceNumbers > 0) { qualityScore += referenceNumbers * 2; issues.push(`reference-numbers: ${referenceNumbers}`); }
      if (citations > 0) { qualityScore += citations * 2; issues.push(`citations: ${citations}`); }
      if (technicalRatio > 0.01) { qualityScore += technicalRatio * 30; issues.push(`technical-terms: ${technicalTermCount}`); }
      
      // Reject if quality score indicates technical/non-narrative content
      if (qualityScore > 3) {
        console.log(`Skipping low-quality passage (score: ${qualityScore.toFixed(1)}, issues: ${issues.join(', ')})`);
        attempts++;
        continue;
      }
      
      // Good passage found
      break;
    }
    
    // Ensure minimum length - if too short, return what we have rather than infinite recursion
    if (passage.length < 400) {
      console.warn('Short passage extracted, using fallback approach');
      // Try one more time with a simpler approach
      const simpleStart = text.indexOf('. ') + 2;
      if (simpleStart > 1 && simpleStart < text.length - 500) {
        passage = text.substring(simpleStart, simpleStart + 600);
        const lastPeriod = passage.lastIndexOf('.');
        if (lastPeriod > 200) {
          passage = passage.substring(0, lastPeriod + 1);
        }
      }
    }
    
    return passage.trim();
  }

  async createClozeTextFromPreprocessed(passageIndex) {
    // Use preprocessed word selection from batch API call
    const preprocessed = passageIndex === 0 ? this.preprocessedData.passage1 : this.preprocessedData.passage2;
    let selectedWords = preprocessed.words;
    
    // Calculate expected number of blanks based on level
    let expectedBlanks;
    if (this.currentLevel <= 5) {
      expectedBlanks = 1;
    } else if (this.currentLevel <= 10) {
      expectedBlanks = 2;
    } else {
      expectedBlanks = 3;
    }
    
    // Only use fallback if AI provided no words at all
    if (selectedWords.length === 0) {
      console.warn(`AI provided no words, using manual fallback selection`);
      const words = this.originalText.split(/\s+/);
      const fallbackWords = this.selectWordsManually(words, expectedBlanks);
      selectedWords = fallbackWords;
      console.log(`Fallback words:`, selectedWords);
    }
    
    // Limit selected words to expected number
    if (selectedWords.length > expectedBlanks) {
      console.log(`AI returned ${selectedWords.length} words but expected ${expectedBlanks}, limiting to ${expectedBlanks}`);
      selectedWords = selectedWords.slice(0, expectedBlanks);
    }
    
    // Split passage into words
    const words = this.originalText.split(/(\s+)/);
    const wordsOnly = words.filter(w => w.trim() !== '');
    
    // Find indices of selected words using flexible matching
    const selectedIndices = [];
    selectedWords.forEach((word, wordIdx) => {
      console.log(`Searching for word ${wordIdx + 1}/${selectedWords.length}: "${word}"`);
      
      // First try exact match (cleaned)
      let index = wordsOnly.findIndex((w, idx) => {
        const cleanW = w.replace(/[^\w]/g, '').toLowerCase();
        const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
        return cleanW === cleanWord && !selectedIndices.includes(idx);
      });
      
      if (index !== -1) {
        console.log(`✓ Found exact match: "${wordsOnly[index]}" at position ${index}`);
      } else {
        // Fallback to includes match if exact fails
        index = wordsOnly.findIndex((w, idx) => 
          w.toLowerCase().includes(word.toLowerCase()) && !selectedIndices.includes(idx)
        );
        
        if (index !== -1) {
          console.log(`✓ Found includes match: "${wordsOnly[index]}" at position ${index}`);
        } else {
          // Enhanced fallback: try base word matching (remove common suffixes)
          const baseWord = word.replace(/[^\w]/g, '').toLowerCase().replace(/(ed|ing|s|es|er|est)$/, '');
          if (baseWord.length > 2) {
            index = wordsOnly.findIndex((w, idx) => {
              const cleanW = w.replace(/[^\w]/g, '').toLowerCase();
              const baseW = cleanW.replace(/(ed|ing|s|es|er|est)$/, '');
              return baseW === baseWord && !selectedIndices.includes(idx);
            });
            
            if (index !== -1) {
              console.log(`✓ Found base word match: "${wordsOnly[index]}" at position ${index}`);
            }
          }
        }
      }
      
      if (index !== -1) {
        selectedIndices.push(index);
      } else {
        console.warn(`✗ Could not find word "${word}" in passage`);
      }
    });
    
    // Ensure we have at least the expected number of blanks
    if (selectedIndices.length < expectedBlanks) {
      console.warn(`Only found ${selectedIndices.length} words, need ${expectedBlanks}. Using fallback selection.`);
      const fallbackWords = this.selectWordsManually(wordsOnly, expectedBlanks - selectedIndices.length);
      
      // Add fallback word indices
      fallbackWords.forEach(fallbackWord => {
        const cleanFallback = fallbackWord.toLowerCase().replace(/[^\w]/g, '');
        const index = wordsOnly.findIndex((w, idx) => {
          const cleanW = w.replace(/[^\w]/g, '').toLowerCase();
          return cleanW === cleanFallback && !selectedIndices.includes(idx);
        });
        if (index !== -1) {
          selectedIndices.push(index);
        }
      });
    }
    
    // Create blanks
    this.blanks = [];
    this.hints = [];
    const clozeWords = [...wordsOnly];
    
    console.log(`Creating ${selectedIndices.length} blanks from ${selectedWords.length} selected words`);
    
    selectedIndices.forEach((wordIndex, blankIndex) => {
      const originalWord = wordsOnly[wordIndex];
      const cleanWord = originalWord.replace(/[^\w]/g, '');
      
      this.blanks.push({
        index: blankIndex,
        originalWord: cleanWord,
        wordIndex: wordIndex
      });
      
      // Initialize chat context for this word
      const wordContext = {
        originalWord: cleanWord,
        sentence: this.originalText,
        passage: this.originalText,
        bookTitle: this.currentBook.title,
        author: this.currentBook.author,
        year: this.currentBook.year,
        wordPosition: wordIndex,
        difficulty: this.calculateWordDifficulty(cleanWord, wordIndex, wordsOnly)
      };
      
      this.chatService.initializeWordContext(`blank_${blankIndex}`, wordContext);
      
      // Generate structural hint
      const hint = this.currentLevel <= 2
        ? `${cleanWord.length} letters, starts with "${cleanWord[0]}", ends with "${cleanWord[cleanWord.length - 1]}"`
        : `${cleanWord.length} letters, starts with "${cleanWord[0]}"`;
      this.hints.push({ index: blankIndex, hint });
      
      // Replace with placeholder
      clozeWords[wordIndex] = `___BLANK_${blankIndex}___`;
    });
    
    // Reconstruct text with original spacing
    let reconstructed = '';
    let wordIndex = 0;
    words.forEach(part => {
      if (part.trim() === '') {
        reconstructed += part;
      } else {
        reconstructed += clozeWords[wordIndex++];
      }
    });
    
    this.clozeText = reconstructed;
    this.userAnswers = new Array(this.blanks.length).fill('');
  }

  async createClozeText() {
    const words = this.originalText.split(' ');
    // Progressive difficulty: levels 1-5 = 1 blank, levels 6-10 = 2 blanks, level 11+ = 3 blanks
    let numberOfBlanks;
    if (this.currentLevel <= 5) {
      numberOfBlanks = 1;
    } else if (this.currentLevel <= 10) {
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
        numberOfBlanks,
        this.currentLevel
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
      
      // First try to find the word in the designated section (avoiding first 10 words and capitalized words)
      for (let i = Math.max(10, sectionStart); i < sectionEnd; i++) {
        const originalWord = words[i].replace(/[^\w]/g, '');
        const isCapitalized = originalWord.length > 0 && originalWord[0] === originalWord[0].toUpperCase();
        if (wordsLower[i] === cleanSignificant && !selectedIndices.includes(i) && !isCapitalized) {
          wordIndex = i;
          break;
        }
      }
      
      // If not found in section, look globally (but still avoid first 10 words and capitalized words)
      if (wordIndex === -1) {
        wordIndex = wordsLower.findIndex((word, idx) => {
          const originalWord = words[idx].replace(/[^\w]/g, '');
          const isCapitalized = originalWord.length > 0 && originalWord[0] === originalWord[0].toUpperCase();
          return word === cleanSignificant && !selectedIndices.includes(idx) && idx >= 10 && !isCapitalized;
        });
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
      
      // Try to match manual words (avoiding first 10 words and capitalized words)
      manualWords.forEach((manualWord, index) => {
        const cleanManual = manualWord.toLowerCase().replace(/[^\w]/g, '');
        const wordIndex = wordsLower.findIndex((word, idx) => {
          const originalWord = words[idx].replace(/[^\w]/g, '');
          const isCapitalized = originalWord.length > 0 && originalWord[0] === originalWord[0].toUpperCase();
          return word === cleanManual && !selectedIndices.includes(idx) && idx >= 10 && !isCapitalized;
        });
        
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
        year: this.currentBook.year,
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
      const originalCleanWord = word.replace(/[^\w]/g, '');
      // Skip capitalized words, function words, and words that are too short/long
      if (cleanWord.length > 3 && cleanWord.length <= 12 && 
          !functionWords.has(cleanWord) && 
          originalCleanWord[0] === originalCleanWord[0].toLowerCase()) {
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
        style="width: ${Math.max(50, blank.originalWord.length * 10)}px;">`;
      
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
    
    // Store results for round-level tracking
    this.roundResults[this.currentPassageIndex] = resultsData;

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

  async nextPassage() {
    try {
      // Move to the second passage in the current round
      if (this.currentPassageIndex === 0 && this.passages && this.passages.length > 1) {
        this.currentPassageIndex = 1;
        this.currentBook = this.currentBooks[1];
        this.originalText = this.passages[1];
        
        // Clear chat conversations for new passage
        this.chatService.clearConversations();
        
        // Clear last results (but keep roundResults for level advancement)
        this.lastResults = null;
        
        // Use preprocessed data if available
        if (this.preprocessedData && this.preprocessedData.passage2) {
          await this.createClozeTextFromPreprocessed(1);
          this.contextualization = this.preprocessedData.passage2.context;
        } else {
          // Fallback to sequential processing
          await this.createClozeText();
          await new Promise(resolve => setTimeout(resolve, 1000));
          await this.generateContextualization();
        }
        
        return {
          title: this.currentBook.title,
          author: this.currentBook.author,
          text: this.clozeText,
          blanks: this.blanks,
          contextualization: this.contextualization,
          hints: this.hints,
          passageNumber: 2,
          totalPassages: 2
        };
      } else {
        // If we're already on the second passage, move to next round
        return this.nextRound();
      }
    } catch (error) {
      console.error('Error loading next passage:', error);
      throw error;
    }
  }

  nextRound() {
    // Check if user passed the previous round based on overall round performance
    let roundPassed = false;
    if (this.roundResults.length === 2) {
      // Both passages completed - check if user passed at least one passage
      roundPassed = this.roundResults.some(result => result && result.passed);
    } else if (this.lastResults) {
      // Fallback to single passage result
      roundPassed = this.lastResults.passed;
    }
    
    // Always increment round counter
    this.currentRound++;
    
    // Track successful rounds and advance level after 2 successful rounds
    if (roundPassed) {
      this.roundsPassedAtCurrentLevel++;
      console.log(`Round passed! Total rounds passed at level ${this.currentLevel}: ${this.roundsPassedAtCurrentLevel}`);
      
      // Advance level after 2 successful rounds
      if (this.roundsPassedAtCurrentLevel >= 2) {
        this.currentLevel++;
        this.roundsPassedAtCurrentLevel = 0; // Reset counter for new level
        console.log(`Advancing to level ${this.currentLevel} after 2 successful rounds`);
      }
    } else {
      // Failed round - do not reset the counter, user must accumulate 2 passes
      console.log(`Round failed. Still need ${2 - this.roundsPassedAtCurrentLevel} more passed round(s) to advance from level ${this.currentLevel}`);
    }
    
    // Clear chat conversations for new round
    this.chatService.clearConversations();
    
    // Clear results since we're moving to new round
    this.lastResults = null;
    this.roundResults = [];
    
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
        <span class="inline-flex items-center">
          <input type="text" 
            class="cloze-input" 
            data-blank-index="${index}" 
            placeholder="${'_'.repeat(Math.max(3, blank.originalWord.length))}"
            style="width: ${Math.max(50, blank.originalWord.length * 10)}px;">
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