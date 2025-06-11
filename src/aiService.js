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
            role: 'system',
            content: 'You provide clues for word puzzles. Give useful information about grammar, meaning, or context. Keep responses short and focused. Never reveal the actual word.'
          }, {
            role: 'user',
            content: prompt
          }],
          max_tokens: 100,
          temperature: 0.6
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating contextual hint:', error);
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
            content: 'You are a literary expert. Provide exactly 1 short, factual sentence about this classic work. Be accurate and concise. Do not add fictional details or characters.'
          }, {
            role: 'user',
            content: `Write one factual sentence about "${title}" by ${author}. Focus on what type of work it is, when it was written, or its historical significance.`
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