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
    return '';
  }

  setApiKey(key) {
    this.apiKey = key;
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

  async getContextualization(title, author, passage) {
    if (!this.apiKey) {
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
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error getting contextualization:', error);
      return `📚 Practice with classic literature from ${author}'s "${title}"`;
    }
  }
}

export { OpenRouterService as AIService };