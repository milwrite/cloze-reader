class OpenRouterService {
  constructor() {
    // Check for local LLM mode
    this.isLocalMode = this.checkLocalMode();
    this.apiUrl = this.isLocalMode ? 'http://localhost:1234/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
    this.apiKey = this.getApiKey();
    
    // Single model configuration: Gemma-3-27b for all operations
    this.hintModel = this.isLocalMode ? 'gemma-3-12b' : 'google/gemma-3-27b-it';
    this.primaryModel = this.isLocalMode ? 'gemma-3-12b' : 'google/gemma-3-27b-it';
    this.model = this.primaryModel; // Default model for backward compatibility
    
    console.log('AI Service initialized:', {
      mode: this.isLocalMode ? 'Local LLM' : 'OpenRouter',
      url: this.apiUrl,
      primaryModel: this.primaryModel,
      hintModel: this.hintModel
    });
  }
  
  checkLocalMode() {
    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('local') === 'true';
    }
    return false;
  }

  getApiKey() {
    // Local mode doesn't need API key
    if (this.isLocalMode) {
      return 'local-mode-no-key';
    }
    if (typeof process !== 'undefined' && process.env && process.env.OPENROUTER_API_KEY) {
      return process.env.OPENROUTER_API_KEY;
    }
    if (typeof window !== 'undefined' && window.OPENROUTER_API_KEY) {
      return window.OPENROUTER_API_KEY;
    }
    // console.warn('No API key found in getApiKey()');
    return '';
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  async retryRequest(requestFn, maxRetries = 3, delayMs = 500) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        console.log(`API request attempt ${attempt}/${maxRetries} failed:`, error.message);
        if (attempt === maxRetries) {
          throw error; // Final attempt failed, throw the error
        }
        // Wait before retrying, with exponential backoff
        const delay = delayMs * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async generateContextualHint(prompt) {
    // Check for API key at runtime
    const currentKey = this.getApiKey();
    if (currentKey && !this.apiKey) {
      this.apiKey = currentKey;
    }
    
    if (!this.apiKey) {
      return 'API key required for hints';
    }

    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Only add auth headers for OpenRouter
      if (!this.isLocalMode) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'Cloze Reader';
      }
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.hintModel,  // Use Gemma-3-27b for hints
          messages: [{
            role: 'system',
            content: 'You are a helpful assistant that provides hints for word puzzles. Never reveal the answer word directly.'
          }, {
            role: 'user',
            content: prompt
          }],
          max_tokens: 150,
          temperature: 0.7,
          // Try to disable reasoning mode for hints
          response_format: { type: "text" }
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('Hint API response:', JSON.stringify(data, null, 2));
      
      // Check if data and choices exist before accessing
      if (!data || !data.choices || data.choices.length === 0) {
        console.error('Invalid API response structure:', data);
        return 'Unable to generate hint at this time';
      }
      
      // Check if message exists
      if (!data.choices[0].message) {
        console.error('No message in API response');
        return 'Unable to generate hint at this time';
      }
      
      // OSS-20B model returns content in 'reasoning' field when using reasoning mode
      let content = data.choices[0].message.content || '';
      
      // If content is empty, check for reasoning field
      if (!content && data.choices[0].message.reasoning) {
        content = data.choices[0].message.reasoning;
      }
      
      // Still no content? Check reasoning_details
      if (!content && data.choices[0].message.reasoning_details?.length > 0) {
        content = data.choices[0].message.reasoning_details[0].text;
      }
      
      if (!content) {
        console.error('No content found in hint response');
        // Provide a generic hint based on the prompt type
        if (prompt.toLowerCase().includes('synonym')) {
          return 'Think of a word that means something similar';
        } else if (prompt.toLowerCase().includes('definition')) {
          return 'Consider what this word means in context';
        } else if (prompt.toLowerCase().includes('category')) {
          return 'Think about what type or category this word belongs to';
        } else {
          return 'Consider the context around the blank';
        }
      }
      
      content = content.trim();
      
      // For OSS-20B, extract hint from reasoning text if needed
      if (content.includes('The user') || content.includes('We need to')) {
        // This looks like reasoning text, try to extract the actual hint
        // Look for text about synonyms, definitions, or clues
        const hintPatterns = [
          /synonym[s]?.*?(?:is|are|include[s]?|would be)\s+([^.]+)/i,
          /means?\s+([^.]+)/i,
          /refers? to\s+([^.]+)/i,
          /describes?\s+([^.]+)/i,
        ];
        
        for (const pattern of hintPatterns) {
          const match = content.match(pattern);
          if (match) {
            content = match[1];
            break;
          }
        }
        
        // If still has reasoning markers, just return a fallback
        if (content.includes('The user') || content.includes('We need to')) {
          return 'Think about words that mean something similar';
        }
      }
      
      // Clean up AI response artifacts  
      content = content
        .replace(/^\s*["']|["']\s*$/g, '')  // Remove leading/trailing quotes
        .replace(/^\s*[:;]+\s*/, '')        // Remove leading colons and semicolons
        .replace(/\*+/g, '')                // Remove asterisks (markdown bold/italic)
        .replace(/_+/g, '')                 // Remove underscores (markdown)
        .replace(/#+\s*/g, '')              // Remove hash symbols (markdown headers)
        .replace(/\s+/g, ' ')               // Normalize whitespace
        .trim();
      
      return content;
    } catch (error) {
      console.error('Error generating contextual hint:', error);
      return 'Unable to generate hint at this time';
    }
  }


  async selectSignificantWords(passage, count, level = 1) {
    console.log('selectSignificantWords called with count:', count, 'level:', level);
    
    // Check for API key at runtime in case it was loaded after initialization
    const currentKey = this.getApiKey();
    if (currentKey && !this.apiKey) {
      this.apiKey = currentKey;
    }
    
    console.log('API key available:', !!this.apiKey);
    
    if (!this.apiKey) {
      console.error('No API key for word selection');
      throw new Error('API key required for word selection');
    }

    // Define level-based constraints
    let wordLengthConstraint, difficultyGuidance;
    if (level <= 2) {
      wordLengthConstraint = "EXACTLY 4-7 letters (no words longer than 7 letters)";
      difficultyGuidance = "Select EASY vocabulary words - common, everyday words that most readers know. NEVER select words longer than 7 letters.";
    } else if (level <= 4) {
      wordLengthConstraint = "EXACTLY 4-10 letters (no words longer than 10 letters)";
      difficultyGuidance = "Select MEDIUM difficulty words - mix of common and moderately challenging vocabulary. NEVER select words longer than 10 letters.";
    } else {
      wordLengthConstraint = "5-14 letters";
      difficultyGuidance = "Select CHALLENGING words - sophisticated vocabulary that requires strong reading skills";
    }

    try {
      return await this.retryRequest(async () => {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Cloze Reader'
          },
          body: JSON.stringify({
            model: this.primaryModel,  // Use Gemma-3-12b for word selection
            messages: [{
              role: 'system',
              content: 'Select words for a cloze exercise. Return ONLY a JSON array of words, nothing else.'
            }, {
              role: 'user',
              content: `Select ${count} ${level <= 2 ? 'easy' : level <= 4 ? 'medium' : 'challenging'} words (${wordLengthConstraint}) from this passage. Choose meaningful nouns, verbs, or adjectives. Avoid capitalized words and proper nouns.

Passage: "${passage}"`
            }],
            max_tokens: 200,
            temperature: 0.5,
            // Try to disable reasoning mode for word selection
            response_format: { type: "text" }
          })
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        
        // Check for OpenRouter error response
        if (data.error) {
          console.error('OpenRouter API error for word selection:', data.error);
          throw new Error(`OpenRouter API error: ${data.error.message || JSON.stringify(data.error)}`);
        }
        
        // Log the full response to debug structure
        console.log('Full API response:', JSON.stringify(data, null, 2));
        
        // Check if response has expected structure
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          console.error('Invalid word selection API response structure:', data);
          console.error('Choices[0]:', data.choices?.[0]);
          throw new Error('API response missing expected structure');
        }
        
        // OSS-20B model returns content in 'reasoning' field when using reasoning mode
        let content = data.choices[0].message.content || '';
        
        // If content is empty, check for reasoning field
        if (!content && data.choices[0].message.reasoning) {
          content = data.choices[0].message.reasoning;
        }
        
        // Still no content? Check reasoning_details
        if (!content && data.choices[0].message.reasoning_details?.length > 0) {
          content = data.choices[0].message.reasoning_details[0].text;
        }
        
        if (!content) {
          console.error('No content found in API response');
          throw new Error('API response missing content');
        }
        
        content = content.trim();
        
        // Clean up local LLM artifacts
        if (this.isLocalMode) {
          content = this.cleanLocalLLMResponse(content);
        }
        
        // Try to parse as JSON array
        try {
          let words;
          
          // Try to parse JSON first
          try {
            // Check if content contains JSON array anywhere in it
            const jsonMatch = content.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
              words = JSON.parse(jsonMatch[0]);
            } else {
              words = JSON.parse(content);
            }
          } catch {
            // If not JSON, check if this is reasoning text from OSS-20B
            if (content.includes('pick') || content.includes('Let\'s')) {
              // Extract words from reasoning text
              // Look for quoted words or words after "pick"
              const quotedWords = content.match(/"([^"]+)"/g);
              if (quotedWords) {
                words = quotedWords.map(w => w.replace(/"/g, ''));
              } else {
                // Look for pattern like "Let's pick 'word'" or "pick word"
                const pickMatch = content.match(/pick\s+['"]?(\w+)['"]?/i);
                if (pickMatch) {
                  words = [pickMatch[1]];
                } else {
                  // For local LLM, try comma-separated
                  if (this.isLocalMode && content.includes(',')) {
                    words = content.split(',').map(w => w.trim());
                  } else {
                    // Single word
                    words = [content.trim()];
                  }
                }
              }
            } else if (this.isLocalMode) {
              // For local LLM, try comma-separated
              if (content.includes(',')) {
                words = content.split(',').map(w => w.trim());
              } else {
                // Single word
                words = [content.trim()];
              }
            } else {
              throw new Error('Could not parse words from response');
            }
          }
          
          if (Array.isArray(words)) {
            // Create passage word array with position and capitalization info (matches clozeGameEngine logic)
            const passageWords = passage.split(/\s+/);
            const passageWordMap = new Map();

            passageWords.forEach((word, idx) => {
              const cleanOriginal = word.replace(/[^\w]/g, '');
              const cleanLower = cleanOriginal.toLowerCase();
              const isCapitalized = cleanOriginal.length > 0 && cleanOriginal[0] === cleanOriginal[0].toUpperCase();

              // Only track non-capitalized words after position 10 (matches game engine constraints)
              if (!isCapitalized && idx >= 10) {
                if (!passageWordMap.has(cleanLower)) {
                  passageWordMap.set(cleanLower, []);
                }
                passageWordMap.get(cleanLower).push(idx);
              }
            });

            // Validate word lengths based on level and passage presence
            const validWords = words.filter(word => {
              // First check if the word contains at least one letter
              if (!/[a-zA-Z]/.test(word)) {
                console.log(`❌ Rejecting non-alphabetic word: "${word}"`);
                return false;
              }

              const cleanWord = word.replace(/[^a-zA-Z]/g, '');

              // If cleanWord is empty after removing non-letters, reject
              if (cleanWord.length === 0) {
                console.log(`❌ Rejecting word with no letters: "${word}"`);
                return false;
              }

              // Check if word exists as non-capitalized word after position 10 (matches game engine)
              if (!passageWordMap.has(cleanWord.toLowerCase())) {
                console.log(`❌ Rejecting word not matchable in passage: "${word}" (capitalized or in first 10 words)`);
                return false;
              }

              // Check length constraints
              if (level <= 2) {
                return cleanWord.length >= 4 && cleanWord.length <= 7;
              } else if (level <= 4) {
                return cleanWord.length >= 4 && cleanWord.length <= 10;
              } else {
                return cleanWord.length >= 5 && cleanWord.length <= 14;
              }
            });
            
            if (validWords.length > 0) {
              console.log(`✅ Level ${level} word validation: ${validWords.length}/${words.length} words passed`);
              return validWords.slice(0, count);
            } else {
              console.warn(`❌ Level ${level}: No words met length requirements, rejecting all`);
              throw new Error(`No valid words for level ${level}`);
            }
          }
        } catch (e) {
          // If not valid JSON, try to extract words from the response
          const matches = content.match(/"([^"]+)"/g);
          if (matches) {
            const words = matches.map(m => m.replace(/"/g, ''));

            // Create passage word array with position and capitalization info (matches clozeGameEngine logic)
            const passageWords = passage.split(/\s+/);
            const passageWordMap = new Map();

            passageWords.forEach((word, idx) => {
              const cleanOriginal = word.replace(/[^\w]/g, '');
              const cleanLower = cleanOriginal.toLowerCase();
              const isCapitalized = cleanOriginal.length > 0 && cleanOriginal[0] === cleanOriginal[0].toUpperCase();

              // Only track non-capitalized words after position 10 (matches game engine constraints)
              if (!isCapitalized && idx >= 10) {
                if (!passageWordMap.has(cleanLower)) {
                  passageWordMap.set(cleanLower, []);
                }
                passageWordMap.get(cleanLower).push(idx);
              }
            });

            // Validate word lengths and passage presence
            const validWords = words.filter(word => {
              // First check if the word contains at least one letter
              if (!/[a-zA-Z]/.test(word)) {
                console.log(`❌ Rejecting non-alphabetic word: "${word}"`);
                return false;
              }

              const cleanWord = word.replace(/[^a-zA-Z]/g, '');

              // If cleanWord is empty after removing non-letters, reject
              if (cleanWord.length === 0) {
                console.log(`❌ Rejecting word with no letters: "${word}"`);
                return false;
              }

              // Check if word exists as non-capitalized word after position 10 (matches game engine)
              if (!passageWordMap.has(cleanWord.toLowerCase())) {
                console.log(`❌ Rejecting word not matchable in passage: "${word}" (capitalized or in first 10 words)`);
                return false;
              }

              // Check length constraints
              if (level <= 2) {
                return cleanWord.length >= 4 && cleanWord.length <= 7;
              } else if (level <= 4) {
                return cleanWord.length >= 4 && cleanWord.length <= 10;
              } else {
                return cleanWord.length >= 5 && cleanWord.length <= 14;
              }
            });
            
            if (validWords.length > 0) {
              return validWords.slice(0, count);
            } else {
              throw new Error(`No valid words for level ${level}`);
            }
          }
        }
        
        throw new Error('Failed to parse AI response');
      });
    } catch (error) {
      console.error('Error selecting words with AI:', error);
      throw error;
    }
  }

  async processBothPassages(passage1, book1, passage2, book2, blanksPerPassage, level = 1) {
    // Process both passages in a single API call to avoid rate limits
    const currentKey = this.getApiKey();
    if (currentKey && !this.apiKey) {
      this.apiKey = currentKey;
    }
    
    if (!this.apiKey) {
      throw new Error('API key required for passage processing');
    }

    // Define level-based constraints
    let wordLengthConstraint, difficultyGuidance;
    if (level <= 2) {
      wordLengthConstraint = "EXACTLY 4-7 letters (no words longer than 7 letters)";
      difficultyGuidance = "Select EASY vocabulary words - common, everyday words that most readers know. NEVER select words longer than 7 letters.";
    } else if (level <= 4) {
      wordLengthConstraint = "EXACTLY 4-10 letters (no words longer than 10 letters)";
      difficultyGuidance = "Select MEDIUM difficulty words - mix of common and moderately challenging vocabulary. NEVER select words longer than 10 letters.";
    } else {
      wordLengthConstraint = "5-14 letters";
      difficultyGuidance = "Select CHALLENGING words - sophisticated vocabulary that requires strong reading skills";
    }

    try {
      // Add timeout controller to prevent aborted operations
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Only add auth headers for OpenRouter
      if (!this.isLocalMode) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'Cloze Reader';
      }
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.primaryModel,  // Use Gemma-3-12b for batch processing
          messages: [{
            role: 'system',
            content: 'Process passages for cloze exercises. Return ONLY a JSON object.'
          }, {
            role: 'user',
            content: `Select ${blanksPerPassage} ${level <= 2 ? 'easy' : level <= 4 ? 'medium' : 'challenging'} words (${wordLengthConstraint}) from each passage.

Passage 1 ("${book1.title}" by ${book1.author}):
${passage1}

Passage 2 ("${book2.title}" by ${book2.author}):
${passage2}

Return JSON: {"passage1": {"words": [${blanksPerPassage} words], "context": "one sentence about book"}, "passage2": {"words": [${blanksPerPassage} words], "context": "one sentence about book"}}`
          }],
          max_tokens: 800,
          temperature: 0.5,
          response_format: { type: "text" }
        })
      });

      // Clear timeout on successful response
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Check for error response
      if (data.error) {
        console.error('OpenRouter API error for batch processing:', data.error);
        throw new Error(`OpenRouter API error: ${data.error.message || JSON.stringify(data.error)}`);
      }
      
      console.log('Batch API response:', JSON.stringify(data, null, 2));
      
      // Check if response has expected structure
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Invalid batch API response structure:', data);
        console.error('Choices[0]:', data.choices?.[0]);
        throw new Error('API response missing expected structure');
      }
      
      // OSS-20B model returns content in 'reasoning' field when using reasoning mode
      let content = data.choices[0].message.content || '';
      
      // If content is empty, check for reasoning field
      if (!content && data.choices[0].message.reasoning) {
        content = data.choices[0].message.reasoning;
      }
      
      // Still no content? Check reasoning_details
      if (!content && data.choices[0].message.reasoning_details?.length > 0) {
        content = data.choices[0].message.reasoning_details[0].text;
      }
      
      if (!content) {
        console.error('No content found in batch API response');
        throw new Error('API response missing content');
      }
      
      content = content.trim();
      
      try {
        // Try to extract JSON from the response
        // Sometimes the model returns JSON wrapped in markdown code blocks
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
        let jsonString = jsonMatch ? jsonMatch[1] : content;
        
        // Clean up the JSON string
        jsonString = jsonString
          .replace(/^\s*```json\s*/, '')
          .replace(/\s*```\s*$/, '')
          .trim();
        
        // Try to fix common JSON issues
        // Fix trailing commas in arrays
        jsonString = jsonString.replace(/,(\s*])/g, '$1');
        
        // Check for truncated strings (unterminated quotes)
        const quoteCount = (jsonString.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          // Add missing closing quote
          jsonString += '"';
        }
        
        // Check if JSON is truncated (missing closing braces)
        const openBraces = (jsonString.match(/{/g) || []).length;
        const closeBraces = (jsonString.match(/}/g) || []).length;
        
        if (openBraces > closeBraces) {
          // Add missing closing braces
          jsonString += '}'.repeat(openBraces - closeBraces);
        }
        
        // Remove any trailing garbage after the last closing brace
        const lastBrace = jsonString.lastIndexOf('}');
        if (lastBrace !== -1 && lastBrace < jsonString.length - 1) {
          jsonString = jsonString.substring(0, lastBrace + 1);
        }
        
        const parsed = JSON.parse(jsonString);
        
        // Validate the structure
        if (!parsed.passage1 || !parsed.passage2) {
          console.error('Parsed response missing expected structure:', parsed);
          throw new Error('Response missing passage1 or passage2');
        }
        
        // Ensure words arrays exist and are arrays
        if (!Array.isArray(parsed.passage1.words)) {
          parsed.passage1.words = [];
        }
        if (!Array.isArray(parsed.passage2.words)) {
          parsed.passage2.words = [];
        }
        
        // Filter out empty strings from words arrays (caused by trailing commas)
        parsed.passage1.words = parsed.passage1.words.filter(word => word && word.trim() !== '');
        parsed.passage2.words = parsed.passage2.words.filter(word => word && word.trim() !== '');
        
        // Validate word lengths based on level and passage presence
        const validateWords = (words, passageText) => {
          // Create passage word array with position and capitalization info (matches clozeGameEngine logic)
          const passageWords = passageText.split(/\s+/);
          const passageWordMap = new Map();

          passageWords.forEach((word, idx) => {
            const cleanOriginal = word.replace(/[^\w]/g, '');
            const cleanLower = cleanOriginal.toLowerCase();
            const isCapitalized = cleanOriginal.length > 0 && cleanOriginal[0] === cleanOriginal[0].toUpperCase();

            // Only track non-capitalized words after position 10 (matches game engine constraints)
            if (!isCapitalized && idx >= 10) {
              if (!passageWordMap.has(cleanLower)) {
                passageWordMap.set(cleanLower, []);
              }
              passageWordMap.get(cleanLower).push(idx);
            }
          });

          return words.filter(word => {
            // First check if the word contains at least one letter
            if (!/[a-zA-Z]/.test(word)) {
              console.log(`❌ Rejecting non-alphabetic word: "${word}"`);
              return false;
            }

            const cleanWord = word.replace(/[^a-zA-Z]/g, '');

            // If cleanWord is empty after removing non-letters, reject
            if (cleanWord.length === 0) {
              console.log(`❌ Rejecting word with no letters: "${word}"`);
              return false;
            }

            // Check if word exists as non-capitalized word after position 10 (matches game engine)
            if (!passageWordMap.has(cleanWord.toLowerCase())) {
              console.log(`❌ Rejecting word not matchable in passage: "${word}" (capitalized or in first 10 words)`);
              return false;
            }

            // Check if word appears in all caps in the passage (like "VOLUME")
            if (passageText.includes(word.toUpperCase()) && word === word.toUpperCase()) {
              console.log(`Skipping all-caps word: ${word}`);
              return false;
            }

            // Check length constraints
            if (level <= 2) {
              return cleanWord.length >= 4 && cleanWord.length <= 7;
            } else if (level <= 4) {
              return cleanWord.length >= 4 && cleanWord.length <= 10;
            } else {
              return cleanWord.length >= 5 && cleanWord.length <= 14;
            }
          });
        };
        
        const originalP1Count = parsed.passage1.words.length;
        const originalP2Count = parsed.passage2.words.length;
        
        parsed.passage1.words = validateWords(parsed.passage1.words, passage1);
        parsed.passage2.words = validateWords(parsed.passage2.words, passage2);
        
        console.log(`✅ Level ${level} batch validation: P1 ${parsed.passage1.words.length}/${originalP1Count}, P2 ${parsed.passage2.words.length}/${originalP2Count} words passed`);
        
        return parsed;
      } catch (e) {
        console.error('Failed to parse batch response:', e);
        console.error('Raw content:', content);
        
        // Try to extract any usable data from the partial response
        try {
          // Extract passage contexts using regex
          const context1Match = content.match(/"context":\s*"([^"]+)"/);
          const context2Match = content.match(/"passage2"[\s\S]*?"context":\s*"([^"]+)"/);
          
          // Extract words arrays using regex
          const words1Match = content.match(/"words":\s*\[([^\]]+)\]/);
          const words2Match = content.match(/"passage2"[\s\S]*?"words":\s*\[([^\]]+)\]/);
          
          const extractWords = (match) => {
            if (!match) return [];
            try {
              return JSON.parse(`[${match[1]}]`);
            } catch {
              return match[1].split(',').map(w => w.trim().replace(/['"]/g, ''));
            }
          };
          
          return {
            passage1: { 
              words: extractWords(words1Match), 
              context: context1Match ? context1Match[1] : `From "${book1.title}" by ${book1.author}` 
            },
            passage2: { 
              words: extractWords(words2Match), 
              context: context2Match ? context2Match[1] : `From "${book2.title}" by ${book2.author}` 
            }
          };
        } catch (extractError) {
          console.error('Failed to extract partial data:', extractError);
          throw new Error('Invalid API response format');
        }
      }
    } catch (error) {
      // Clear timeout in error case too
      if (typeof timeoutId !== 'undefined') {
        clearTimeout(timeoutId);
      }
      
      // Handle specific abort error
      if (error.name === 'AbortError') {
        console.error('Batch processing timed out after 15 seconds');
        throw new Error('Request timed out - falling back to sequential processing');
      }
      
      console.error('Error processing passages:', error);
      throw error;
    }
  }

  async generateContextualization(title, author, passage) {
    console.log('generateContextualization called for:', title, 'by', author);

    // Check for API key at runtime
    const currentKey = this.getApiKey();
    if (currentKey && !this.apiKey) {
      this.apiKey = currentKey;
    }

    console.log('API key available for contextualization:', !!this.apiKey);

    if (!this.apiKey) {
      console.log('No API key, returning fallback contextualization');
      return `A passage from ${author}'s "${title}"`;
    }

    try {
      return await this.retryRequest(async () => {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Cloze Reader'
          },
          body: JSON.stringify({
            model: this.primaryModel,  // Use Gemma-3-27b for contextualization
            messages: [{
              role: 'system',
              content: 'Provide a single contextual insight about the passage: historical context, literary technique, thematic observation, or relevant fact. Be specific and direct. Maximum 25 words. Do not use dashes or em-dashes. Output ONLY the insight itself with no preamble, acknowledgments, or meta-commentary.'
            }, {
              role: 'user',
              content: `From "${title}" by ${author}:\n\n${passage}`
            }],
            max_tokens: 150,
            temperature: 0.7,
            response_format: { type: "text" }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Contextualization API error:', response.status, errorText);
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        
        // Check for OpenRouter error response
        if (data.error) {
          console.error('OpenRouter API error for contextualization:', data.error);
          throw new Error(`OpenRouter API error: ${data.error.message || JSON.stringify(data.error)}`);
        }
        
        console.log('Context API response:', JSON.stringify(data, null, 2));
        
        // Check if response has expected structure
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          console.error('Invalid contextualization API response structure:', data);
          console.error('Choices[0]:', data.choices?.[0]);
          throw new Error('API response missing expected structure');
        }
        
        // OSS-20B model returns content in 'reasoning' field when using reasoning mode
        let content = data.choices[0].message.content || '';
        
        // If content is empty, check for reasoning field
        if (!content && data.choices[0].message.reasoning) {
          content = data.choices[0].message.reasoning;
        }
        
        // Still no content? Check reasoning_details
        if (!content && data.choices[0].message.reasoning_details?.length > 0) {
          content = data.choices[0].message.reasoning_details[0].text;
        }
        
        if (!content) {
          console.error('No content found in context API response');
          throw new Error('API response missing content');
        }
        
        content = content.trim();

        // Clean up AI response artifacts
        content = content
          .replace(/^\s*["']|["']\s*$/g, '')  // Remove leading/trailing quotes
          .replace(/^\s*[:;.!?]+\s*/, '')     // Remove leading punctuation
          .replace(/\*+/g, '')                // Remove asterisks (markdown bold/italic)
          .replace(/_+/g, '')                 // Remove underscores (markdown)
          .replace(/#+\s*/g, '')              // Remove hash symbols (markdown headers)
          .replace(/\s+/g, ' ')               // Normalize whitespace
          .trim();
        
        console.log('Contextualization received:', content);
        return content;
      });
    } catch (error) {
      console.error('Error getting contextualization:', error);
      return `A passage from ${author}'s "${title}"`;
    }
  }

  cleanLocalLLMResponse(content) {
    // Remove common artifacts from local LLM responses
    return content
      .replace(/\["?/g, '')       // Remove opening bracket and quote
      .replace(/"?\]/g, '')       // Remove closing quote and bracket  
      .replace(/^[>"|']+/g, '')   // Remove leading > or quotes
      .replace(/[>"|']+$/g, '')   // Remove trailing > or quotes
      .replace(/\\n/g, ' ')       // Replace escaped newlines
      .trim();
  }
}

export { OpenRouterService as AIService };
