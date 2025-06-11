class OpenRouterService {
  constructor() {
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    this.apiKey = this.getApiKey();
    this.model = 'google/gemma-3-27b-it:free';
    
    // Focused tool definitions for specific, non-overlapping question types
    this.questionTools = {
      part_of_speech: {
        name: 'identify_part_of_speech',
        description: 'Identify the grammatical category directly and clearly',
        parameters: {
          type: 'object',
          properties: {
            hint: { type: 'string', description: 'Direct answer: "This is a [noun/verb/adjective/adverb]" then add a simple, concrete clue about what type (e.g., "a thing", "an action", "describes something")' }
          },
          required: ['hint']
        }
      },
      sentence_role: {
        name: 'explain_sentence_role',
        description: 'Explain the structural function using context clues',
        parameters: {
          type: 'object',
          properties: {
            hint: { type: 'string', description: 'Point to specific words around the blank. Example: "Look at \'the whole ___ consisting of\' - what could contain something?" Focus on the immediate context.' }
          },
          required: ['hint']
        }
      },
      word_category: {
        name: 'categorize_word',
        description: 'State clearly if abstract or concrete',
        parameters: {
          type: 'object',
          properties: {
            hint: { type: 'string', description: 'Start simple: "This is abstract/concrete." Then give a relatable example or size clue: "Think about something very big/small" or "Like feelings/objects"' }
          },
          required: ['hint']
        }
      },
      synonym: {
        name: 'provide_synonym',
        description: 'Give clear synonym or similar word',
        parameters: {
          type: 'object',
          properties: {
            hint: { type: 'string', description: 'Direct synonyms or word families: "Try a word similar to [related word]" or "Think of another word for [meaning]"' }
          },
          required: ['hint']
        }
      }
    };
  }

  getApiKey() {
    if (typeof process !== 'undefined' && process.env && process.env.OPENROUTER_API_KEY) {
      return process.env.OPENROUTER_API_KEY;
    }
    if (typeof window !== 'undefined' && window.OPENROUTER_API_KEY) {
      return window.OPENROUTER_API_KEY;
    }
    console.warn('No API key found in getApiKey()');
    return '';
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  async generateContextualHint(questionType, word, sentence, bookTitle, wordContext) {
    // Check for API key at runtime
    const currentKey = this.getApiKey();
    if (currentKey && !this.apiKey) {
      this.apiKey = currentKey;
    }
    
    if (!this.apiKey) {
      return this.getEnhancedFallback(questionType, word, sentence, bookTitle);
    }

    try {
      // Get the appropriate tool for this question type
      const tool = this.questionTools[questionType];
      if (!tool) {
        console.warn(`Unknown question type: ${questionType}`);
        return this.getEnhancedFallback(questionType, word, sentence, bookTitle);
      }

      // Create sophisticated tool-calling prompt
      const systemPrompt = `You are an educational reading tutor using structured responses. You must respond using the provided tool to give focused, helpful hints without revealing the answer directly.

Context: This is from "${bookTitle}" - classic literature requiring thoughtful analysis.

Current word to help with: "${word}"
Sentence context: "${sentence}"

Use the ${tool.name} tool to provide an appropriate educational hint.`;

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
            role: 'system',
            content: systemPrompt
          }, {
            role: 'user',
            content: `Help me understand the word that fits in this context using the ${tool.name} tool.`
          }],
          tools: [{
            type: 'function',
            function: tool
          }],
          tool_choice: {
            type: 'function',
            function: { name: tool.name }
          },
          max_tokens: 200,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract tool call response
      const message = data.choices[0].message;
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        if (toolCall.function && toolCall.function.arguments) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            return args.hint || this.getEnhancedFallback(questionType, word, sentence, bookTitle);
          } catch (parseError) {
            console.warn('Failed to parse tool call arguments:', parseError);
          }
        }
      }
      
      // Fallback to message content if tool call failed
      return message.content?.trim() || this.getEnhancedFallback(questionType, word, sentence, bookTitle);
      
    } catch (error) {
      console.error('Error generating contextual hint:', error);
      return this.getEnhancedFallback(questionType, word, sentence, bookTitle);
    }
  }

  getEnhancedFallback(questionType, word, sentence, bookTitle) {
    const fallbacks = {
      part_of_speech: `Consider what "${word}" is doing in the sentence. Is it a person, place, thing (noun), an action (verb), or describing something (adjective)?`,
      sentence_role: `Look at how "${word}" connects to other words around it. What is its job in making the sentence complete?`,
      word_category: `Think about whether "${word}" is something you can touch or see (concrete) or an idea/feeling (abstract).`,
      synonym: `What other word could replace "${word}" and keep the same meaning in this sentence?`
    };
    
    return fallbacks[questionType] || `Think about what "${word}" means in this classic literature context.`;
  }

  async getContextualHint(passage, wordToReplace, context) {
    if (!this.apiKey) {
      return 'API key required for contextual hints';
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
            content: `In this passage: "${passage}"
            
The word "${wordToReplace}" has been replaced with a blank. Give me a helpful hint about what word fits here, considering the context: "${context}".

Provide a brief, educational hint that helps understand the word without giving it away directly.`
          }],
          max_tokens: 150,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error getting contextual hint:', error);
      return 'Unable to generate hint at this time';
    }
  }

  async selectSignificantWords(passage, count) {
    console.log('selectSignificantWords called with count:', count);
    
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
            role: 'system',
            content: 'You are an educational assistant that selects meaningful words from passages for cloze reading exercises. Select words that are important for comprehension and appropriate for the difficulty level.'
          }, {
            role: 'user',
            content: `From this passage, select exactly ${count} meaningful words to create blanks for a cloze reading exercise. The words should be distributed throughout the passage and be important for understanding the text. Return ONLY the words as a JSON array, nothing else.

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
      const content = data.choices[0].message.content.trim();
      
      // Try to parse as JSON array
      try {
        const words = JSON.parse(content);
        if (Array.isArray(words)) {
          return words.slice(0, count);
        }
      } catch (e) {
        // If not valid JSON, try to extract words from the response
        const matches = content.match(/"([^"]+)"/g);
        if (matches) {
          return matches.map(m => m.replace(/"/g, '')).slice(0, count);
        }
      }
      
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error selecting words with AI:', error);
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
      return `📚 Practice with classic literature from ${author}'s "${title}"`;
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
            role: 'system',
            content: 'You are a literary expert. Provide exactly 1 short sentence about this classic work. Be factual and concise. No exaggerative language.'
          }, {
            role: 'user',
            content: `Describe "${title}" by ${author} in one factual sentence.`
          }],
          max_tokens: 50,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Contextualization API error:', response.status, errorText);
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content.trim();
      console.log('Contextualization received:', content);
      return content;
    } catch (error) {
      console.error('Error getting contextualization:', error);
      return `📚 Practice with classic literature from ${author}'s "${title}"`;
    }
  }

  async getContextualization(title, author, passage) {
    console.log('getContextualization called for:', title, 'by', author);
    
    // Check for API key at runtime
    const currentKey = this.getApiKey();
    if (currentKey && !this.apiKey) {
      this.apiKey = currentKey;
    }
    
    console.log('API key available for contextualization:', !!this.apiKey);
    
    if (!this.apiKey) {
      console.log('No API key, returning fallback contextualization');
      return `📚 Practice with classic literature from ${author}'s "${title}"`;
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
            role: 'system',
            content: 'You are a literary expert providing brief educational context about classic literature. Always respond with exactly 2 sentences, no more. Avoid exaggerative adverbs. Be factual and restrained.'
          }, {
            role: 'user',
            content: `Provide educational context for this passage from "${title}" by ${author}: "${passage}"`
          }],
          max_tokens: 100,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Contextualization API error:', response.status, errorText);
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content.trim();
      console.log('Contextualization received:', content);
      return content;
    } catch (error) {
      console.error('Error getting contextualization:', error);
      return `📚 Practice with classic literature from ${author}'s "${title}"`;
    }
  }
}

export { OpenRouterService as AIService };