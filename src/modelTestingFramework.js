/**
 * Comprehensive Model Testing Framework for Cloze Reader
 * Tests all AI-powered features across different models
 */

class ModelTestingFramework {
    constructor() {
        this.models = [
            // OpenRouter Models
            { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openrouter' },
            { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openrouter' },
            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'openrouter' },
            { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'openrouter' },
            { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', provider: 'openrouter' },
            { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: 'openrouter' },
            { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'openrouter' },
            { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B', provider: 'openrouter' },
            { id: 'microsoft/phi-3-medium-4k-instruct', name: 'Phi-3 Medium', provider: 'openrouter' },
            { id: 'qwen/qwen-2-7b-instruct', name: 'Qwen 2 7B', provider: 'openrouter' },
            
            // Local LLM Models (LM Studio compatible)
            { id: 'local-llm', name: 'Local LLM (Auto-detect)', provider: 'local' },
            { id: 'gemma-3-12b', name: 'Gemma 3 12B (Local)', provider: 'local' },
            { id: 'llama-3.1-8b', name: 'Llama 3.1 8B (Local)', provider: 'local' },
            { id: 'mistral-7b', name: 'Mistral 7B (Local)', provider: 'local' },
            { id: 'qwen-2-7b', name: 'Qwen 2 7B (Local)', provider: 'local' },
            { id: 'phi-3-medium', name: 'Phi-3 Medium (Local)', provider: 'local' },
            { id: 'custom-local', name: 'Custom Local Model', provider: 'local' }
        ];
        
        this.testResults = {
            timestamp: new Date().toISOString(),
            tests: []
        };
        
        this.testPassages = [
            {
                text: "The old man sat by the fireplace, reading his favorite book. The flames danced in the hearth, casting shadows on the walls. He turned each page carefully, savoring every word of the ancient tale.",
                difficulty: 3,
                expectedWords: ['favorite', 'flames', 'shadows', 'carefully', 'ancient']
            },
            {
                text: "In the garden, colorful flowers bloomed under the warm sunshine. Bees buzzed from blossom to blossom, collecting nectar for their hive. The gardener watched with satisfaction as his hard work flourished.",
                difficulty: 2,
                expectedWords: ['colorful', 'warm', 'buzzed', 'collecting', 'satisfaction']
            },
            {
                text: "The protagonist's journey through the labyrinthine corridors revealed the edifice's architectural complexity. Each ornate chamber contained mysterious artifacts that suggested an ancient civilization's sophisticated understanding of mathematics and astronomy.",
                difficulty: 8,
                expectedWords: ['labyrinthine', 'edifice', 'architectural', 'ornate', 'artifacts', 'civilization', 'sophisticated']
            }
        ];
        
        this.chatQuestions = [
            { type: 'part_of_speech', prompt: 'What part of speech is this word?' },
            { type: 'sentence_role', prompt: 'What role does this word play in the sentence?' },
            { type: 'word_category', prompt: 'What category or type of word is this?' },
            { type: 'synonym', prompt: 'Can you suggest a synonym for this word?' }
        ];
    }

    async runComprehensiveTest(selectedModels = null) {
        const modelsToTest = selectedModels || this.models;
        console.log(`Starting comprehensive test of ${modelsToTest.length} models...`);
        
        for (const model of modelsToTest) {
            console.log(`\nTesting model: ${model.name}`);
            const modelResults = await this.testModel(model);
            this.testResults.tests.push(modelResults);
            
            // Save intermediate results
            await this.saveResults();
        }
        
        console.log('\nAll tests completed!');
        return this.testResults;
    }

    async testModel(model) {
        const startTime = Date.now();
        const results = {
            modelId: model.id,
            modelName: model.name,
            provider: model.provider,
            timestamp: new Date().toISOString(),
            totalTime: 0,
            wordSelection: {},
            contextualization: {},
            chatHints: {},
            errorRates: {},
            overallScore: 0
        };

        try {
            // Test word selection across different difficulty levels
            results.wordSelection = await this.testWordSelection(model);
            
            // Test contextualization
            results.contextualization = await this.testContextualization(model);
            
            // Test chat hint generation
            results.chatHints = await this.testChatHints(model);
            
            // Calculate overall metrics
            results.totalTime = Date.now() - startTime;
            results.overallScore = this.calculateOverallScore(results);
            
        } catch (error) {
            console.error(`Error testing model ${model.name}:`, error);
            results.error = error.message;
            results.overallScore = 0;
        }

        return results;
    }

    async testWordSelection(model) {
        const results = {
            tests: [],
            averageTime: 0,
            successRate: 0,
            qualityScore: 0,
            difficultyAccuracy: 0
        };

        let totalTime = 0;
        let successCount = 0;
        let qualitySum = 0;
        let difficultySum = 0;

        for (const passage of this.testPassages) {
            const testStart = Date.now();
            
            try {
                const words = await this.performWordSelection(model, passage);
                const testTime = Date.now() - testStart;
                totalTime += testTime;
                
                const test = {
                    passageLength: passage.text.length,
                    targetDifficulty: passage.difficulty,
                    responseTime: testTime,
                    selectedWords: words,
                    wordCount: words.length,
                    success: words.length > 0,
                    qualityScore: this.evaluateWordQuality(words, passage),
                    difficultyScore: this.evaluateDifficultyMatch(words, passage.difficulty)
                };
                
                results.tests.push(test);
                
                if (test.success) {
                    successCount++;
                    qualitySum += test.qualityScore;
                    difficultySum += test.difficultyScore;
                }
                
            } catch (error) {
                results.tests.push({
                    passageLength: passage.text.length,
                    targetDifficulty: passage.difficulty,
                    responseTime: Date.now() - testStart,
                    error: error.message,
                    success: false
                });
            }
            
            // Brief pause between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        results.averageTime = totalTime / this.testPassages.length;
        results.successRate = successCount / this.testPassages.length;
        results.qualityScore = successCount > 0 ? qualitySum / successCount : 0;
        results.difficultyAccuracy = successCount > 0 ? difficultySum / successCount : 0;

        return results;
    }

    async testContextualization(model) {
        const results = {
            tests: [],
            averageTime: 0,
            successRate: 0,
            relevanceScore: 0
        };

        const testBooks = [
            { title: 'Pride and Prejudice', author: 'Jane Austen' },
            { title: 'The Adventures of Tom Sawyer', author: 'Mark Twain' },
            { title: 'Moby Dick', author: 'Herman Melville' }
        ];

        let totalTime = 0;
        let successCount = 0;
        let relevanceSum = 0;

        for (const book of testBooks) {
            const testStart = Date.now();
            
            try {
                const context = await this.performContextualization(model, book);
                const testTime = Date.now() - testStart;
                totalTime += testTime;
                
                const test = {
                    bookTitle: book.title,
                    author: book.author,
                    responseTime: testTime,
                    contextLength: context.length,
                    success: context.length > 0,
                    relevanceScore: this.evaluateContextRelevance(context, book)
                };
                
                results.tests.push(test);
                
                if (test.success) {
                    successCount++;
                    relevanceSum += test.relevanceScore;
                }
                
            } catch (error) {
                results.tests.push({
                    bookTitle: book.title,
                    author: book.author,
                    responseTime: Date.now() - testStart,
                    error: error.message,
                    success: false
                });
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        results.averageTime = totalTime / testBooks.length;
        results.successRate = successCount / testBooks.length;
        results.relevanceScore = successCount > 0 ? relevanceSum / successCount : 0;

        return results;
    }

    async testChatHints(model) {
        const results = {
            tests: [],
            averageTime: 0,
            successRate: 0,
            helpfulnessScore: 0,
            questionTypePerformance: {}
        };

        const testWords = [
            { word: 'magnificent', sentence: 'The cathedral was truly magnificent.', difficulty: 5 },
            { word: 'whispered', sentence: 'She whispered the secret to her friend.', difficulty: 3 },
            { word: 'extraordinary', sentence: 'His performance was extraordinary.', difficulty: 7 }
        ];

        let totalTime = 0;
        let successCount = 0;
        let helpfulnessSum = 0;

        // Initialize question type tracking
        this.chatQuestions.forEach(q => {
            results.questionTypePerformance[q.type] = {
                tests: 0,
                successes: 0,
                averageScore: 0
            };
        });

        for (const testWord of testWords) {
            for (const question of this.chatQuestions) {
                const testStart = Date.now();
                
                try {
                    const hint = await this.performChatHint(model, testWord, question);
                    const testTime = Date.now() - testStart;
                    totalTime += testTime;
                    
                    const helpfulnessScore = this.evaluateHintHelpfulness(hint, testWord, question);
                    
                    const test = {
                        word: testWord.word,
                        questionType: question.type,
                        difficulty: testWord.difficulty,
                        responseTime: testTime,
                        hintLength: hint.length,
                        success: hint.length > 10, // Minimum meaningful response
                        helpfulnessScore: helpfulnessScore
                    };
                    
                    results.tests.push(test);
                    
                    // Update question type performance
                    const qtPerf = results.questionTypePerformance[question.type];
                    qtPerf.tests++;
                    
                    if (test.success) {
                        successCount++;
                        helpfulnessSum += helpfulnessScore;
                        qtPerf.successes++;
                        qtPerf.averageScore += helpfulnessScore;
                    }
                    
                } catch (error) {
                    results.tests.push({
                        word: testWord.word,
                        questionType: question.type,
                        difficulty: testWord.difficulty,
                        responseTime: Date.now() - testStart,
                        error: error.message,
                        success: false
                    });
                    
                    results.questionTypePerformance[question.type].tests++;
                }
                
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Calculate averages for question types
        Object.keys(results.questionTypePerformance).forEach(type => {
            const perf = results.questionTypePerformance[type];
            perf.successRate = perf.tests > 0 ? perf.successes / perf.tests : 0;
            perf.averageScore = perf.successes > 0 ? perf.averageScore / perf.successes : 0;
        });

        const totalTests = testWords.length * this.chatQuestions.length;
        results.averageTime = totalTime / totalTests;
        results.successRate = successCount / totalTests;
        results.helpfulnessScore = successCount > 0 ? helpfulnessSum / successCount : 0;

        return results;
    }

    async performWordSelection(model, passage) {
        // Create a temporary AI service instance for this model
        const aiService = await this.createModelAIService(model);
        
        const prompt = `Select ${Math.min(3, Math.floor(passage.difficulty / 2) + 1)} appropriate words to remove from this passage for a cloze exercise at difficulty level ${passage.difficulty}:

"${passage.text}"

Return only a JSON array of words, like: ["word1", "word2", "word3"]`;

        const response = await aiService.makeAIRequest(prompt);
        
        try {
            return JSON.parse(response);
        } catch {
            // Try to extract words from non-JSON response
            const matches = response.match(/\[.*?\]/);
            if (matches) {
                return JSON.parse(matches[0]);
            }
            return [];
        }
    }

    async performContextualization(model, book) {
        const aiService = await this.createModelAIService(model);
        
        const prompt = `Provide a brief historical and literary context for "${book.title}" by ${book.author}. Keep it concise and educational, suitable for language learners.`;

        return await aiService.makeAIRequest(prompt);
    }

    async performChatHint(model, testWord, question) {
        const aiService = await this.createModelAIService(model);
        
        const prompt = `You are helping a student understand a word in context. The word is "${testWord.word}" in the sentence: "${testWord.sentence}"

${question.prompt}

Provide a helpful hint without revealing the word directly. Keep your response concise and educational.`;

        return await aiService.makeAIRequest(prompt);
    }

    async createModelAIService(model) {
        // Use the testing AI service for better performance tracking
        const { TestAIService } = await import('./testAIService.js');
        
        const config = {
            modelId: model.id,
            provider: model.provider,
            isLocal: model.provider === 'local'
        };
        
        return new TestAIService(config);
    }

    async detectLocalModels() {
        // Attempt to detect available local models from LM Studio
        try {
            const response = await fetch('http://localhost:1234/v1/models');
            if (response.ok) {
                const data = await response.json();
                const detectedModels = data.data.map(model => ({
                    id: model.id,
                    name: `${model.id} (Local)`,
                    provider: 'local'
                }));
                
                // Update the local models list
                this.models = this.models.filter(m => m.provider !== 'local');
                this.models.push(...detectedModels);
                
                return detectedModels;
            }
        } catch (error) {
            console.log('No local LM Studio server detected on port 1234');
        }
        
        // Return default local models if detection fails
        return this.models.filter(m => m.provider === 'local');
    }

    async testLocalServerConnection() {
        try {
            const response = await fetch('http://localhost:1234/v1/models', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return {
                    connected: true,
                    models: data.data || [],
                    serverInfo: data
                };
            } else {
                return {
                    connected: false,
                    error: `HTTP ${response.status}: ${response.statusText}`
                };
            }
        } catch (error) {
            return {
                connected: false,
                error: error.message
            };
        }
    }

    evaluateWordQuality(words, passage) {
        if (!words || words.length === 0) return 0;
        
        let score = 0;
        const text = passage.text.toLowerCase();
        
        for (const word of words) {
            const wordLower = word.toLowerCase();
            
            // Check if word exists in passage
            if (text.includes(wordLower)) score += 20;
            
            // Check word length appropriateness
            const expectedMinLength = Math.max(4, passage.difficulty);
            const expectedMaxLength = Math.min(12, passage.difficulty + 6);
            
            if (word.length >= expectedMinLength && word.length <= expectedMaxLength) {
                score += 15;
            }
            
            // Avoid overly common words for higher difficulties
            const commonWords = ['the', 'and', 'but', 'for', 'are', 'was', 'his', 'her'];
            if (passage.difficulty > 5 && !commonWords.includes(wordLower)) {
                score += 10;
            }
        }
        
        return Math.min(100, score / words.length);
    }

    evaluateDifficultyMatch(words, targetDifficulty) {
        if (!words || words.length === 0) return 0;
        
        let score = 0;
        
        for (const word of words) {
            const wordLength = word.length;
            const expectedMin = Math.max(4, targetDifficulty);
            const expectedMax = Math.min(14, targetDifficulty + 6);
            
            if (wordLength >= expectedMin && wordLength <= expectedMax) {
                score += 100;
            } else {
                // Partial credit for close matches
                const distance = Math.min(
                    Math.abs(wordLength - expectedMin),
                    Math.abs(wordLength - expectedMax)
                );
                score += Math.max(0, 100 - (distance * 20));
            }
        }
        
        return score / words.length;
    }

    evaluateContextRelevance(context, book) {
        if (!context || context.length < 20) return 0;
        
        let score = 0;
        const contextLower = context.toLowerCase();
        
        // Check for book title mention
        if (contextLower.includes(book.title.toLowerCase())) score += 25;
        
        // Check for author mention
        if (contextLower.includes(book.author.toLowerCase().split(' ').pop())) score += 25;
        
        // Check for literary/historical terms
        const literaryTerms = ['novel', 'literature', 'author', 'published', 'century', 'period', 'style', 'theme'];
        const foundTerms = literaryTerms.filter(term => contextLower.includes(term));
        score += Math.min(30, foundTerms.length * 5);
        
        // Length appropriateness (100-500 chars is good)
        if (context.length >= 100 && context.length <= 500) score += 20;
        
        return Math.min(100, score);
    }

    evaluateHintHelpfulness(hint, testWord, question) {
        if (!hint || hint.length < 10) return 0;
        
        let score = 0;
        const hintLower = hint.toLowerCase();
        const wordLower = testWord.word.toLowerCase();
        
        // Penalize if the word is revealed directly
        if (hintLower.includes(wordLower)) {
            score -= 50;
        }
        
        // Check for question-appropriate responses
        switch (question.type) {
            case 'part_of_speech':
                const posTerms = ['noun', 'verb', 'adjective', 'adverb', 'pronoun'];
                if (posTerms.some(term => hintLower.includes(term))) score += 40;
                break;
                
            case 'sentence_role':
                const roleTerms = ['subject', 'object', 'predicate', 'modifier', 'describes'];
                if (roleTerms.some(term => hintLower.includes(term))) score += 40;
                break;
                
            case 'word_category':
                const categoryTerms = ['type', 'kind', 'category', 'group', 'family'];
                if (categoryTerms.some(term => hintLower.includes(term))) score += 40;
                break;
                
            case 'synonym':
                const synonymTerms = ['similar', 'means', 'like', 'same as', 'equivalent'];
                if (synonymTerms.some(term => hintLower.includes(term))) score += 40;
                break;
        }
        
        // Length appropriateness
        if (hint.length >= 20 && hint.length <= 200) score += 30;
        
        // Educational tone
        const educationalTerms = ['this word', 'in this context', 'here', 'sentence'];
        if (educationalTerms.some(term => hintLower.includes(term))) score += 20;
        
        return Math.max(0, Math.min(100, score));
    }

    calculateOverallScore(results) {
        const weights = {
            wordSelection: 0.4,
            contextualization: 0.3,
            chatHints: 0.3
        };
        
        let totalScore = 0;
        
        if (results.wordSelection.successRate !== undefined) {
            totalScore += results.wordSelection.successRate * 40 * weights.wordSelection;
        }
        
        if (results.contextualization.successRate !== undefined) {
            totalScore += results.contextualization.successRate * 50 * weights.contextualization;
        }
        
        if (results.chatHints.successRate !== undefined) {
            totalScore += results.chatHints.successRate * 60 * weights.chatHints;
        }
        
        // Bonus for consistent performance across all areas
        const allAreas = [results.wordSelection, results.contextualization, results.chatHints];
        const minSuccess = Math.min(...allAreas.map(area => area.successRate || 0));
        if (minSuccess > 0.8) totalScore += 10;
        
        return Math.min(100, totalScore);
    }

    async saveResults() {
        const csvContent = this.generateCSV();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `model_test_results_${timestamp}.csv`;
        
        // Browser environment - download file
        this.downloadCSV(csvContent, filename);
        
        console.log(`Results saved as ${filename}`);
        return filename;
    }

    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    generateCSV() {
        const headers = [
            'Model Name',
            'Model ID', 
            'Provider',
            'Timestamp',
            'Total Time (ms)',
            'Overall Score',
            'Word Selection Success Rate',
            'Word Selection Avg Time (ms)',
            'Word Selection Quality Score',
            'Word Selection Difficulty Accuracy',
            'Contextualization Success Rate',
            'Contextualization Avg Time (ms)',
            'Contextualization Relevance Score',
            'Chat Hints Success Rate',
            'Chat Hints Avg Time (ms)',
            'Chat Hints Helpfulness Score',
            'Part of Speech Success Rate',
            'Sentence Role Success Rate',
            'Word Category Success Rate',
            'Synonym Success Rate',
            'User Satisfaction Score',
            'Word Selection User Rating',
            'Passage Quality User Rating',
            'Hint Helpfulness User Rating',
            'Overall Experience User Rating',
            'User Comments Count',
            'Error Message'
        ];

        const rows = [headers.join(',')];

        for (const test of this.testResults.tests) {
            // Get user ranking data if available
            const userRankings = test.userRankings || {};
            const userSatisfaction = userRankings.overallUserSatisfaction || 0;
            const avgRatings = userRankings.averageRatings || {};
            const commentsCount = userRankings.comments?.length || 0;
            
            const row = [
                `"${test.modelName}"`,
                `"${test.modelId}"`,
                `"${test.provider}"`,
                `"${test.timestamp}"`,
                test.totalTime || 0,
                test.overallScore || 0,
                test.wordSelection?.successRate || 0,
                test.wordSelection?.averageTime || 0,
                test.wordSelection?.qualityScore || 0,
                test.wordSelection?.difficultyAccuracy || 0,
                test.contextualization?.successRate || 0,
                test.contextualization?.averageTime || 0,
                test.contextualization?.relevanceScore || 0,
                test.chatHints?.successRate || 0,
                test.chatHints?.averageTime || 0,
                test.chatHints?.helpfulnessScore || 0,
                test.chatHints?.questionTypePerformance?.part_of_speech?.successRate || 0,
                test.chatHints?.questionTypePerformance?.sentence_role?.successRate || 0,
                test.chatHints?.questionTypePerformance?.word_category?.successRate || 0,
                test.chatHints?.questionTypePerformance?.synonym?.successRate || 0,
                userSatisfaction.toFixed(2),
                avgRatings.word_selection?.toFixed(2) || 0,
                avgRatings.passage_quality?.toFixed(2) || 0,
                avgRatings.hint_helpfulness?.toFixed(2) || 0,
                avgRatings.overall_experience?.toFixed(2) || 0,
                commentsCount,
                `"${test.error || ''}"`
            ];
            
            rows.push(row.join(','));
        }

        return rows.join('\n');
    }
}

export { ModelTestingFramework };