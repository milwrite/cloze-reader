/**
 * Testing-specific AI Service wrapper
 * Extends the main AI service with testing capabilities
 */

class TestAIService {
    constructor(config) {
        this.modelId = config.modelId;
        this.provider = config.provider;
        this.isLocal = config.isLocal || config.provider === 'local';
        this.baseUrl = this.isLocal ? 'http://localhost:1234' : 'https://openrouter.ai/api/v1';
        this.apiKey = this.isLocal ? 'test-key' : this.getApiKey();
        
        // Performance tracking
        this.requestCount = 0;
        this.totalResponseTime = 0;
        this.errorCount = 0;
        this.lastError = null;
    }

    getApiKey() {
        // Try to get API key from meta tag (injected by server)
        const metaTag = document.querySelector('meta[name="openrouter-api-key"]');
        if (metaTag) {
            return metaTag.content;
        }
        
        // Fallback to environment variable (for Node.js testing)
        if (typeof process !== 'undefined' && process.env) {
            return process.env.OPENROUTER_API_KEY;
        }
        
        return null;
    }

    async makeAIRequest(prompt, options = {}) {
        const startTime = Date.now();
        this.requestCount++;
        
        try {
            const response = await this.performRequest(prompt, options);
            this.totalResponseTime += Date.now() - startTime;
            return response;
        } catch (error) {
            this.errorCount++;
            this.lastError = error;
            this.totalResponseTime += Date.now() - startTime;
            throw error;
        }
    }

    async performRequest(prompt, options = {}) {
        const requestBody = {
            model: this.modelId,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: options.maxTokens || 500,
            temperature: options.temperature || 0.7,
            top_p: options.topP || 0.9
        };

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
        };

        if (!this.isLocal) {
            headers['HTTP-Referer'] = window.location.origin;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.choices || data.choices.length === 0) {
                throw new Error('No response from AI service');
            }

            let content = data.choices[0].message.content;
            
            // Clean up local LLM response artifacts
            if (this.isLocal) {
                content = this.cleanLocalLLMResponse(content);
            }

            return content;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    cleanLocalLLMResponse(content) {
        // Remove common local LLM artifacts
        content = content.replace(/^\[.*?\]\s*/, ''); // Remove leading brackets
        content = content.replace(/\s*\[.*?\]$/, ''); // Remove trailing brackets
        content = content.replace(/^"(.*)"$/, '$1'); // Remove surrounding quotes
        content = content.replace(/\\n/g, '\n'); // Fix escaped newlines
        content = content.replace(/\\"/g, '"'); // Fix escaped quotes
        
        return content.trim();
    }

    // Performance metrics
    getAverageResponseTime() {
        return this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0;
    }

    getErrorRate() {
        return this.requestCount > 0 ? this.errorCount / this.requestCount : 0;
    }

    getPerformanceStats() {
        return {
            requestCount: this.requestCount,
            totalResponseTime: this.totalResponseTime,
            averageResponseTime: this.getAverageResponseTime(),
            errorCount: this.errorCount,
            errorRate: this.getErrorRate(),
            lastError: this.lastError?.message || null
        };
    }

    reset() {
        this.requestCount = 0;
        this.totalResponseTime = 0;
        this.errorCount = 0;
        this.lastError = null;
    }
}

export { TestAIService };