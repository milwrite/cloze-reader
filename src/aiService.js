class OpenRouterService {
  constructor() {
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    this.apiKey = this.getApiKey();
    this.model = 'google/gemma-3-27b-it:free';
  }

  getApiKey() {
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
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Cloze Reader'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{
            role: 'user',
            content: `You provide clues for word puzzles. You will be told the target word that players need to guess, but you must NEVER mention, spell, or reveal that word in your response. Follow the EXACT format requested. Be concise and direct about the target word without revealing it. Use plain text only - no bold, italics, asterisks, or markdown formatting. Stick to word limits.

${prompt}`
          }],
          max_tokens: 50,
          temperature: 0.6
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Check if data and choices exist before accessing
      if (!data || !data.choices || data.choices.length === 0) {
        console.error('Invalid API response structure:', data);
        return 'Unable to generate hint at this time';
      }
      
      // Check if message content exists
      if (!data.choices[0].message || !data.choices[0].message.content) {
        console.error('No content in API response');
        return 'Unable to generate hint at this time';
      }
      
      let content = data.choices[0].message.content.trim();
      
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
            model: this.model,
            messages: [{
              role: 'user',
              content: `You are a cluemaster vocabulary selector for educational cloze exercises. Select exactly ${count} words from this passage for a cloze exercise.

DIFFICULTY LEVEL ${level}:
${difficultyGuidance}

CLOZE DELETION PRINCIPLES:
- Select words that require understanding context and vocabulary to identify
- Choose words essential for comprehension that test language ability
- Target words where deletion creates meaningful cognitive gaps

REQUIREMENTS:
- Choose clear, properly-spelled words (no OCR errors like "andsatires")
- Select meaningful nouns, verbs, or adjectives (${wordLengthConstraint})
- Words must appear EXACTLY as written in the passage
- Avoid: capitalized words, ALL-CAPS words, function words, archaic terms, proper nouns, technical jargon
- Skip any words that look malformed or concatenated
- Avoid dated or potentially offensive terms
- NEVER select words from the first or last sentence/clause of the passage
- Choose words from the middle portions for better context dependency

Return ONLY a JSON array of the selected words.

Passage: "${passage}"`
            }],
            max_tokens: 100,
            temperature: 0.3
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
        
        // Check if response has expected structure
        if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
          console.error('Invalid word selection API response structure:', data);
          throw new Error('API response missing expected content');
        }
        
        const content = data.choices[0].message.content.trim();
        
        // Try to parse as JSON array
        try {
          const words = JSON.parse(content);
          if (Array.isArray(words)) {
            // Filter problematic words and validate word lengths based on level
            const problematicWords = ['negro', 'retard', 'retarded', 'nigger', 'chinaman', 'jap', 'gypsy', 'savage', 'primitive', 'heathen'];
            const validWords = words.filter(word => {
              const cleanWord = word.replace(/[^a-zA-Z]/g, '');
              const lowerWord = cleanWord.toLowerCase();
              
              // Skip problematic words
              if (problematicWords.includes(lowerWord)) return false;
              
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
            // Filter problematic words and validate word lengths
            const problematicWords = ['negro', 'retard', 'retarded', 'nigger', 'chinaman', 'jap', 'gypsy', 'savage', 'primitive', 'heathen'];
            const validWords = words.filter(word => {
              const cleanWord = word.replace(/[^a-zA-Z]/g, '');
              const lowerWord = cleanWord.toLowerCase();
              
              // Skip problematic words
              if (problematicWords.includes(lowerWord)) return false;
              
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
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Cloze Reader'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{
            role: 'user',
            content: `You process passages for cloze reading exercises. For each passage: 1) Select words for blanks, 2) Generate a contextual introduction. Return a JSON object with both passages' data.

DIFFICULTY LEVEL ${level}:
${difficultyGuidance}

Process these two passages for cloze exercises:

PASSAGE 1:
Title: "${book1.title}" by ${book1.author}
Text: "${passage1}"
Select ${blanksPerPassage} words for blanks.

PASSAGE 2:
Title: "${book2.title}" by ${book2.author}
Text: "${passage2}"
Select ${blanksPerPassage} words for blanks.

SELECTION RULES:
- Select EXACTLY ${blanksPerPassage} word${blanksPerPassage > 1 ? 's' : ''} per passage, no more, no less
- Choose meaningful nouns, verbs, or adjectives (${wordLengthConstraint})
- Avoid capitalized words, ALL-CAPS words, and table of contents entries
- Avoid dated or potentially offensive terms
- NEVER select words from the first or last sentence/clause of each passage
- Choose words from the middle portions for better context dependency
- Words must appear EXACTLY as written in the passage

For each passage return:
- "words": array of EXACTLY ${blanksPerPassage} selected word${blanksPerPassage > 1 ? 's' : ''} (exactly as they appear in the text)
- "context": one-sentence intro about the book/author

CRITICAL: The "words" array must contain exactly ${blanksPerPassage} element${blanksPerPassage > 1 ? 's' : ''} for each passage.

Return as JSON: {"passage1": {...}, "passage2": {...}}`
          }],
          max_tokens: 800,
          temperature: 0.5
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Check for error response
      if (data.error) {
        console.error('OpenRouter API error for batch processing:', data.error);
        throw new Error(`OpenRouter API error: ${data.error.message || JSON.stringify(data.error)}`);
      }
      
      // Check if response has expected structure
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        console.error('Invalid batch API response structure:', data);
        throw new Error('API response missing expected content');
      }
      
      const content = data.choices[0].message.content.trim();
      
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
        
        // Filter problematic words and validate word lengths based on level
        const validateWords = (words) => {
          const problematicWords = ['negro', 'retard', 'retarded', 'nigger', 'chinaman', 'jap', 'gypsy', 'savage', 'primitive', 'heathen'];
          return words.filter(word => {
            const cleanWord = word.replace(/[^a-zA-Z]/g, '');
            const lowerWord = cleanWord.toLowerCase();
            
            // Skip problematic words
            if (problematicWords.includes(lowerWord)) return false;
            
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
        
        parsed.passage1.words = validateWords(parsed.passage1.words);
        parsed.passage2.words = validateWords(parsed.passage2.words);
        
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
      console.error('Error processing passages:', error);
      throw error;
    }
  }

  async generateContextualization(title, author) {
    console.log('generateContextualization called for:', title, 'by', author);
    
    // Check for API key at runtime
    const currentKey = this.getApiKey();
    if (currentKey && !this.apiKey) {
      this.apiKey = currentKey;
    }
    
    console.log('API key available for contextualization:', !!this.apiKey);
    
    if (!this.apiKey) {
      console.log('No API key, returning fallback contextualization');
      return `📜 Practice with literature from ${author}'s "${title}"`;
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
            model: this.model,
            messages: [{
              role: 'user',
              content: `You are a historical and literary expert of public domain entries in Project Gutenberg. Write one factual sentence about "${title}" by ${author}. Focus on what type of work it is, when it was written, or its historical significance. Be accurate and concise.`
            }],
            max_tokens: 80,
            temperature: 0.2
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
        
        // Check if response has expected structure
        if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
          console.error('Invalid contextualization API response structure:', data);
          throw new Error('API response missing expected content');
        }
        
        let content = data.choices[0].message.content.trim();
        
        // Clean up AI response artifacts
        content = content
          .replace(/^\s*["']|["']\s*$/g, '')  // Remove leading/trailing quotes
          .replace(/^\s*[:;]+\s*/, '')        // Remove leading colons and semicolons
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
      return `📜 Practice with literature from ${author}'s "${title}"`;
    }
  }

}

export { OpenRouterService as AIService };