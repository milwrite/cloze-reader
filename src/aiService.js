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
      const prompts = {
        part_of_speech: `What part of speech is the word "${word}" in this sentence: "${sentence}"? Provide a clear, direct answer.`,
        sentence_role: `What grammatical role does "${word}" play in this sentence: "${sentence}"? Focus on its function.`,
        word_category: `Is "${word}" an abstract or concrete noun? Explain briefly with an example.`,
        synonym: `What's a good synonym for "${word}" that would fit in this sentence: "${sentence}"?`
      };

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
            content: 'You are a helpful reading tutor. Provide clear, educational answers that help students learn without giving away the answer directly.'
          }, {
            role: 'user',
            content: prompts[questionType] || `Help me understand the word "${word}" in this context: "${sentence}"`
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