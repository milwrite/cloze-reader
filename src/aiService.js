// Local mode: the inference-arcade vLLM server (Gemma-4-E4B base + the
// cloze-reader LoRA adapter, OpenAI-compatible API). Proxy mode: the backend
// routes to Gemma-3-27B via OpenRouter. The shim endpoint is preferred: it
// answers the private-network preflights that browsers send when an HTTPS
// page calls localhost, which vLLM itself rejects.
const LOCAL_ENDPOINTS = [
  'http://localhost:11435', // inference-arcade shim (browser-safe CORS/PNA headers)
  'http://localhost:1234',  // direct vLLM (or any OpenAI-compatible server)
];
const LOCAL_MODEL_ID = 'cloze-reader';

class OpenRouterService {
  constructor() {
    // ?local=true forces local, ?local=false forces the proxy; with neither,
    // probe the local server and prefer it whenever the adapter is being served.
    const forced = this.checkForcedMode();
    this._setMode(forced === true);
    this._modeReady = forced === null ? this._detectLocalServer() : Promise.resolve();

    // Log once the probe has settled, so the console reflects the mode the
    // game will actually use rather than the pre-detection default.
    this._modeReady.then(() => console.log('🤖 AI Service initialized', {
      mode: this.isLocalMode ? 'Local LLM' : 'Backend Proxy',
      url: this.apiUrl,
      primaryModel: this.primaryModel,
      hintModel: this.hintModel
    }));
  }

  _setMode(isLocal, endpoint = LOCAL_ENDPOINTS[0]) {
    this.isLocalMode = isLocal;
    this.apiUrl = isLocal ? `${endpoint}/v1/chat/completions` : '/api/ai/chat';
    this.hintModel = isLocal ? LOCAL_MODEL_ID : 'google/gemma-3-27b-it';
    this.primaryModel = isLocal ? LOCAL_MODEL_ID : 'google/gemma-3-27b-it';
    this.model = this.primaryModel; // Default model for backward compatibility
    if (typeof window !== 'undefined') {
      window.__clozeAIMode = isLocal ? 'local' : 'proxy';
      window.dispatchEvent(new CustomEvent('cloze-ai-mode', { detail: { local: isLocal } }));
    }
  }

  // Switch to local mode only if a server is up AND serving the fine-tuned
  // adapter — a foreign server on :1234 (e.g. LM Studio with another model)
  // would otherwise swallow requests for a model id it doesn't have.
  async _detectLocalServer() {
    for (const endpoint of LOCAL_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1500);
        const response = await fetch(`${endpoint}/v1/models`, { signal: controller.signal });
        clearTimeout(timer);
        const data = await response.json();
        if (data?.data?.some(m => m.id === LOCAL_MODEL_ID)) {
          this._setMode(true, endpoint);
          console.log(`🤖 Local model server detected — switching to ${LOCAL_MODEL_ID} at ${this.apiUrl}`);
          return;
        }
      } catch {
        // Endpoint not reachable; try the next one.
      }
    }
    // No local server found; stay on the backend proxy.
  }

  // All chat traffic funnels through here. If a local-mode request fails at
  // the network layer (server stopped, blocked preflight), fall back to the
  // backend proxy for the rest of the session and retry once.
  async _chatRequest(payload, options = {}) {
    const post = () => fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, model: this.model }),
      ...options,
    });
    try {
      return await post();
    } catch (error) {
      if (!this.isLocalMode) throw error;
      console.warn('🤖 Local model request failed — falling back to the backend proxy.', error);
      this._setMode(false);
      return post();
    }
  }

  // Helper: Extract content from API response (handles reasoning mode variants)
  _extractContentFromResponse(data) {
    const msg = data?.choices?.[0]?.message;
    if (!msg) return null;
    return msg.content || msg.reasoning || msg.reasoning_details?.[0]?.text || null;
  }

  // Helper: Build word map from passage for validation
  _createPassageWordMap(passage) {
    const passageWords = passage.split(/\s+/);
    const map = new Map();
    passageWords.forEach((word, idx) => {
      const clean = word.replace(/[^\w]/g, '');
      const lower = clean.toLowerCase();
      const isCapitalized = clean.length > 0 && clean[0] === clean[0].toUpperCase();
      if (!isCapitalized && idx >= 10) {
        if (!map.has(lower)) map.set(lower, []);
        map.get(lower).push(idx);
      }
    });
    return map;
  }

  // Helper: Validate words against passage and level constraints
  // Note: Length constraints relaxed to ensure playability - difficulty comes from
  // AI word selection prompts ("easy/common" vs "challenging"), not strict length limits
  _validateWords(words, passageWordMap, level, passageText = null) {
    return words.filter(word => {
      if (!/[a-zA-Z]/.test(word)) return false;
      const clean = word.replace(/[^a-zA-Z]/g, '');
      if (!clean.length) return false;
      if (/^(from|to|and)(the|a)$/i.test(clean)) return false;
      if (!passageWordMap.has(clean.toLowerCase())) return false;
      if (passageText && passageText.includes(word.toUpperCase()) && word === word.toUpperCase()) return false;
      // Relaxed: 4-12 letters for levels 1-4, 4-14 for level 5+
      // Matches manual fallback in clozeGameEngine.js selectWordsManually()
      if (level <= 4) return clean.length >= 4 && clean.length <= 12;
      return clean.length >= 4 && clean.length <= 14;
    });
  }

  // Helper: Clean up AI response artifacts
  _cleanupAIResponse(content) {
    return content
      .replace(/^\s*["']|["']\s*$/g, '')
      .replace(/^\s*[:;.!?]+\s*/, '')
      .replace(/\*+/g, '')
      .replace(/_+/g, '')
      .replace(/#+\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  checkForcedMode() {
    if (typeof window !== 'undefined' && window.location) {
      const local = new URLSearchParams(window.location.search).get('local');
      if (local === 'true') return true;
      if (local === 'false') return false;
    }
    return null;
  }

  getApiKey() {
    // Local mode uses placeholder; production proxies through backend (no client key needed)
    if (this.isLocalMode) {
      return 'local-mode-no-key';
    }
    return 'proxy-mode';
  }

  async retryRequest(requestFn, maxRetries = 3, delayMs = 500) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error; // Final attempt failed, throw the error
        }
        // Wait before retrying, with exponential backoff
        const delay = delayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async generateContextualHint(prompt) {
    await this._modeReady;
    try {
      const response = await this._chatRequest({
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
      
      // Check if message exists
      if (!data.choices[0].message) {
        console.error('No message in API response');
        return 'Unable to generate hint at this time';
      }

      // Extract content from response (handles reasoning mode variants)
      let content = this._extractContentFromResponse(data);

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
      return this._cleanupAIResponse(content);
    } catch (error) {
      console.error('Error generating contextual hint:', error);
      return 'Unable to generate hint at this time';
    }
  }


  async selectSignificantWords(passage, count, level = 1) {
    await this._modeReady;
    // Define level-based constraints (relaxed length to ensure playability)
    let wordLengthConstraint, difficultyGuidance;
    if (level <= 2) {
      wordLengthConstraint = "4-12 letters";
      difficultyGuidance = "Select EASY vocabulary words - common, everyday words that most readers know.";
    } else if (level <= 4) {
      wordLengthConstraint = "4-12 letters";
      difficultyGuidance = "Select MEDIUM difficulty words - mix of common and moderately challenging vocabulary.";
    } else {
      wordLengthConstraint = "4-14 letters";
      difficultyGuidance = "Select CHALLENGING words - sophisticated vocabulary that requires strong reading skills.";
    }

    try {
      return await this.retryRequest(async () => {
        const response = await this._chatRequest({
            messages: [{
              role: 'system',
              content: 'Select words for a cloze exercise. Return ONLY a JSON array of words, nothing else.'
            }, {
              role: 'user',
              content: `Select ${count} ${level <= 2 ? 'easy' : level <= 4 ? 'medium' : 'challenging'} words (${wordLengthConstraint}) from this passage.

CRITICAL RULES:
- Select EXACT words that appear in the passage (copy them exactly as written)
- ONLY select lowercase words (no capitalized words, no proper nouns)
- ONLY select words from the MIDDLE or END of the passage (skip the first ~10 words)
- Words must be ${wordLengthConstraint}
- Choose nouns, verbs, or adjectives
- AVOID compound words like "courthouse" or "steamboat" - choose single, verifiable words with semantic inbetweenness
- AVOID indexes, tables of contents, and capitalized content
- Return ONLY a JSON array like ["word1", "word2"]

Passage: "${passage}"`
            }],
            max_tokens: 200,
            temperature: 0.5,
            // Try to disable reasoning mode for word selection
            response_format: { type: "text" }
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
        
        // Check if response has expected structure
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          console.error('Invalid word selection API response structure:', data);
          console.error('Choices[0]:', data.choices?.[0]);
          throw new Error('API response missing expected structure');
        }
        
        // Extract content from response (handles reasoning mode variants)
        let content = this._extractContentFromResponse(data);

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
            // Create passage word map and validate words
            const passageWordMap = this._createPassageWordMap(passage);
            const validWords = this._validateWords(words, passageWordMap, level);

            if (validWords.length > 0) {
              return validWords.slice(0, count);
            } else {
              console.warn(`No words met requirements for level ${level}`);
              throw new Error(`No valid words for level ${level}`);
            }
          }
        } catch (e) {
          // If not valid JSON, try to extract words from the response
          const matches = content.match(/"([^"]+)"/g);
          if (matches) {
            const words = matches.map(m => m.replace(/"/g, ''));

            // Create passage word map and validate words
            const passageWordMap = this._createPassageWordMap(passage);
            const validWords = this._validateWords(words, passageWordMap, level);

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
    await this._modeReady;
    // Define level-based constraints (relaxed length to ensure playability)
    let wordLengthConstraint, difficultyGuidance;
    if (level <= 2) {
      wordLengthConstraint = "4-12 letters";
      difficultyGuidance = "Select EASY vocabulary words - common, everyday words that most readers know.";
    } else if (level <= 4) {
      wordLengthConstraint = "4-12 letters";
      difficultyGuidance = "Select MEDIUM difficulty words - mix of common and moderately challenging vocabulary.";
    } else {
      wordLengthConstraint = "4-14 letters";
      difficultyGuidance = "Select CHALLENGING words - sophisticated vocabulary that requires strong reading skills.";
    }

    try {
      // Add timeout controller to prevent aborted operations
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await this._chatRequest({
          messages: [{
            role: 'system',
            content: 'Process passages for cloze exercises. Return ONLY a JSON object.'
          }, {
            role: 'user',
            content: `Select ${blanksPerPassage} ${level <= 2 ? 'easy' : level <= 4 ? 'medium' : 'challenging'} words (${wordLengthConstraint}) from each passage.

CRITICAL RULES:
- ONLY select lowercase words (no capitalized words, no proper nouns)
- ONLY select words from the MIDDLE or END of each passage (skip the first ~10 words)
- Words must be ${wordLengthConstraint}
- AVOID compound words like "courthouse" or "steamboat" - choose single, verifiable words with semantic inbetweenness
- AVOID indexes, tables of contents, and capitalized content

Passage 1 ("${book1.title}" by ${book1.author}):
${passage1}

Passage 2 ("${book2.title}" by ${book2.author}):
${passage2}

Return JSON: {"passage1": {"words": [${blanksPerPassage} words], "context": "one sentence about book"}, "passage2": {"words": [${blanksPerPassage} words], "context": "one sentence about book"}}`
          }],
          max_tokens: 800,
          temperature: 0.5,
          response_format: { type: "text" }
      }, { signal: controller.signal });

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
      
      
      // Check if response has expected structure
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Invalid batch API response structure:', data);
        console.error('Choices[0]:', data.choices?.[0]);
        throw new Error('API response missing expected structure');
      }
      
      // Extract content from response (handles reasoning mode variants)
      let content = this._extractContentFromResponse(data);

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

        // Validate words using helper methods
        const map1 = this._createPassageWordMap(passage1);
        const map2 = this._createPassageWordMap(passage2);
        parsed.passage1.words = this._validateWords(parsed.passage1.words, map1, level, passage1);
        parsed.passage2.words = this._validateWords(parsed.passage2.words, map2, level, passage2);

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
    await this._modeReady;
    try {
      return await this.retryRequest(async () => {
        const response = await this._chatRequest({
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
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          console.error('Invalid contextualization API response structure:', data);
          console.error('Choices[0]:', data.choices?.[0]);
          throw new Error('API response missing expected structure');
        }
        
        // Extract content from response (handles reasoning mode variants)
        let content = this._extractContentFromResponse(data);

        if (!content) {
          console.error('No content found in context API response');
          throw new Error('API response missing content');
        }

        // Clean up AI response artifacts
        content = this._cleanupAIResponse(content.trim());

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
