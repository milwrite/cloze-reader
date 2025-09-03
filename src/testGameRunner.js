/**
 * Test Game Runner - Monitors and logs performance during game testing
 */

class TestGameRunner {
    constructor(modelConfig) {
        this.modelConfig = modelConfig;
        this.sessionData = {
            modelId: modelConfig.modelId,
            modelName: modelConfig.modelName,
            provider: modelConfig.provider,
            startTime: Date.now(),
            rounds: [],
            interactions: [],
            userRankings: [],
            performance: {
                wordSelectionRequests: 0,
                wordSelectionSuccess: 0,
                wordSelectionTime: 0,
                contextualizationRequests: 0,
                contextualizationSuccess: 0,
                contextualizationTime: 0,
                chatHintRequests: 0,
                chatHintSuccess: 0,
                chatHintTime: 0,
                errors: []
            }
        };
        
        this.originalAIService = null;
        this.setupInterception();
    }

    setupInterception() {
        // Intercept AI service calls to track performance
        if (window.aiService) {
            this.originalAIService = window.aiService;
            this.wrapAIService();
        }
        
        // Monitor for game events
        this.setupGameEventListeners();
    }

    wrapAIService() {
        const testRunner = this;
        
        // Wrap the makeAIRequest method
        const originalMakeAIRequest = this.originalAIService.makeAIRequest.bind(this.originalAIService);
        
        window.aiService.makeAIRequest = async function(prompt, options = {}) {
            const startTime = Date.now();
            const requestType = testRunner.classifyRequest(prompt);
            
            testRunner.logInteraction({
                type: 'ai_request_start',
                requestType: requestType,
                prompt: prompt.substring(0, 200) + '...',
                timestamp: Date.now()
            });
            
            try {
                const result = await originalMakeAIRequest(prompt, options);
                const responseTime = Date.now() - startTime;
                
                testRunner.updatePerformanceMetrics(requestType, true, responseTime);
                testRunner.logInteraction({
                    type: 'ai_request_success',
                    requestType: requestType,
                    responseTime: responseTime,
                    responseLength: result.length,
                    timestamp: Date.now()
                });
                
                return result;
            } catch (error) {
                const responseTime = Date.now() - startTime;
                
                testRunner.updatePerformanceMetrics(requestType, false, responseTime);
                testRunner.logInteraction({
                    type: 'ai_request_error',
                    requestType: requestType,
                    error: error.message,
                    responseTime: responseTime,
                    timestamp: Date.now()
                });
                
                testRunner.sessionData.performance.errors.push({
                    type: requestType,
                    error: error.message,
                    timestamp: Date.now()
                });
                
                throw error;
            }
        };
    }

    classifyRequest(prompt) {
        const promptLower = prompt.toLowerCase();
        
        if (promptLower.includes('select') && promptLower.includes('word')) {
            return 'word_selection';
        } else if (promptLower.includes('context') || promptLower.includes('background')) {
            return 'contextualization';
        } else if (promptLower.includes('hint') || promptLower.includes('help') || promptLower.includes('clue')) {
            return 'chat_hint';
        } else {
            return 'other';
        }
    }

    updatePerformanceMetrics(requestType, success, responseTime) {
        const perf = this.sessionData.performance;
        
        switch (requestType) {
            case 'word_selection':
                perf.wordSelectionRequests++;
                if (success) {
                    perf.wordSelectionSuccess++;
                    perf.wordSelectionTime += responseTime;
                }
                break;
                
            case 'contextualization':
                perf.contextualizationRequests++;
                if (success) {
                    perf.contextualizationSuccess++;
                    perf.contextualizationTime += responseTime;
                }
                break;
                
            case 'chat_hint':
                perf.chatHintRequests++;
                if (success) {
                    perf.chatHintSuccess++;
                    perf.chatHintTime += responseTime;
                }
                break;
        }
    }

    setupGameEventListeners() {
        // Listen for game-specific events
        document.addEventListener('gameRoundStart', (event) => {
            this.logInteraction({
                type: 'round_start',
                level: event.detail.level,
                round: event.detail.round,
                timestamp: Date.now()
            });
        });

        document.addEventListener('gameRoundComplete', (event) => {
            const roundData = {
                level: event.detail.level,
                round: event.detail.round,
                score: event.detail.score,
                correctAnswers: event.detail.correctAnswers,
                totalBlanks: event.detail.totalBlanks,
                timeSpent: event.detail.timeSpent,
                timestamp: Date.now()
            };
            
            this.sessionData.rounds.push(roundData);
            
            // Store the current round index for user ranking association
            this.currentRoundIndex = this.sessionData.rounds.length - 1;
            
            this.logInteraction({
                type: 'round_complete',
                level: event.detail.level,
                round: event.detail.round,
                score: event.detail.score,
                timestamp: Date.now()
            });
        });

        document.addEventListener('userAnswer', (event) => {
            this.logInteraction({
                type: 'user_answer',
                word: event.detail.targetWord,
                userAnswer: event.detail.userAnswer,
                correct: event.detail.correct,
                timestamp: Date.now()
            });
        });

        document.addEventListener('chatInteraction', (event) => {
            this.logInteraction({
                type: 'chat_interaction',
                questionType: event.detail.questionType,
                word: event.detail.word,
                timestamp: Date.now()
            });
        });

        // Listen for user ranking events
        document.addEventListener('userRanking', (event) => {
            const rankingData = {
                ...event.detail,
                roundIndex: this.currentRoundIndex,
                roundDetails: this.sessionData.rounds[this.currentRoundIndex]
            };
            
            this.sessionData.userRankings.push(rankingData);
            
            this.logInteraction({
                type: 'user_ranking',
                averageRating: event.detail.averageRating,
                ratings: event.detail.ratings,
                timestamp: Date.now()
            });
        });
    }

    logInteraction(interaction) {
        this.sessionData.interactions.push(interaction);
        
        // Log to console for real-time monitoring
        console.log(`[TestRunner] ${interaction.type}:`, interaction);
    }

    generateReport() {
        const endTime = Date.now();
        const totalTime = endTime - this.sessionData.startTime;
        const perf = this.sessionData.performance;
        
        // Calculate user ranking summary
        const userRankingSummary = this.calculateUserRankingSummary();
        
        const report = {
            ...this.sessionData,
            endTime: endTime,
            totalSessionTime: totalTime,
            summary: {
                totalRounds: this.sessionData.rounds.length,
                averageScore: this.sessionData.rounds.length > 0 
                    ? this.sessionData.rounds.reduce((sum, round) => sum + round.score, 0) / this.sessionData.rounds.length 
                    : 0,
                wordSelectionSuccessRate: perf.wordSelectionRequests > 0 
                    ? perf.wordSelectionSuccess / perf.wordSelectionRequests 
                    : 0,
                wordSelectionAvgTime: perf.wordSelectionSuccess > 0 
                    ? perf.wordSelectionTime / perf.wordSelectionSuccess 
                    : 0,
                contextualizationSuccessRate: perf.contextualizationRequests > 0 
                    ? perf.contextualizationSuccess / perf.contextualizationRequests 
                    : 0,
                contextualizationAvgTime: perf.contextualizationSuccess > 0 
                    ? perf.contextualizationTime / perf.contextualizationSuccess 
                    : 0,
                chatHintSuccessRate: perf.chatHintRequests > 0 
                    ? perf.chatHintSuccess / perf.chatHintRequests 
                    : 0,
                chatHintAvgTime: perf.chatHintSuccess > 0 
                    ? perf.chatHintTime / perf.chatHintSuccess 
                    : 0,
                totalErrors: perf.errors.length,
                userRankingSummary: userRankingSummary
            }
        };
        
        return report;
    }

    calculateUserRankingSummary() {
        if (this.sessionData.userRankings.length === 0) {
            return null;
        }

        const categories = ['word_selection', 'passage_quality', 'hint_helpfulness', 'overall_experience'];
        const summary = {
            totalRankings: this.sessionData.userRankings.length,
            averageRatings: {},
            categoryBreakdown: {},
            comments: [],
            overallUserSatisfaction: 0
        };

        // Calculate average ratings per category
        categories.forEach(category => {
            const ratings = this.sessionData.userRankings
                .map(r => r.ratings[category])
                .filter(r => r !== undefined);
            
            if (ratings.length > 0) {
                summary.averageRatings[category] = 
                    ratings.reduce((a, b) => a + b, 0) / ratings.length;
                
                // Distribution of ratings
                summary.categoryBreakdown[category] = {
                    1: ratings.filter(r => r === 1).length,
                    2: ratings.filter(r => r === 2).length,
                    3: ratings.filter(r => r === 3).length,
                    4: ratings.filter(r => r === 4).length,
                    5: ratings.filter(r => r === 5).length
                };
            }
        });

        // Calculate overall satisfaction
        const allRatings = this.sessionData.userRankings
            .map(r => r.averageRating)
            .filter(r => r !== undefined);
        
        if (allRatings.length > 0) {
            summary.overallUserSatisfaction = 
                allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
        }

        // Collect comments with context
        summary.comments = this.sessionData.userRankings
            .filter(r => r.comments)
            .map(r => ({
                timestamp: r.timestamp,
                comment: r.comments,
                averageRating: r.averageRating,
                roundLevel: r.roundDetails?.level,
                roundScore: r.roundDetails?.score
            }));

        return summary;
    }

    async saveReport() {
        const report = this.generateReport();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `game_test_${this.modelConfig.modelId.replace(/[\/\\:]/g, '_')}_${timestamp}.json`;
        
        try {
            // Try to save via browser download
            this.downloadReport(report, filename);
            
            // Also try to save to output folder if possible (server-side)
            await this.saveToServer(report, filename);
            
            console.log(`Test report saved: ${filename}`);
            return filename;
        } catch (error) {
            console.error('Error saving test report:', error);
            return null;
        }
    }

    downloadReport(report, filename) {
        const jsonString = JSON.stringify(report, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async saveToServer(report, filename) {
        try {
            const response = await fetch('/api/save-test-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: filename,
                    data: report
                })
            });
            
            if (!response.ok) {
                throw new Error(`Server save failed: ${response.status}`);
            }
        } catch (error) {
            console.log('Server save not available, using browser download only');
        }
    }

    // Utility methods for analysis
    getWordSelectionAnalytics() {
        const wordSelectionInteractions = this.sessionData.interactions.filter(
            i => i.type === 'ai_request_success' && i.requestType === 'word_selection'
        );
        
        return {
            count: wordSelectionInteractions.length,
            averageResponseTime: wordSelectionInteractions.length > 0 
                ? wordSelectionInteractions.reduce((sum, i) => sum + i.responseTime, 0) / wordSelectionInteractions.length 
                : 0,
            averageResponseLength: wordSelectionInteractions.length > 0 
                ? wordSelectionInteractions.reduce((sum, i) => sum + i.responseLength, 0) / wordSelectionInteractions.length 
                : 0
        };
    }

    getChatHintAnalytics() {
        const chatHintInteractions = this.sessionData.interactions.filter(
            i => i.type === 'chat_interaction'
        );
        
        const questionTypes = {};
        chatHintInteractions.forEach(interaction => {
            const type = interaction.questionType || 'unknown';
            questionTypes[type] = (questionTypes[type] || 0) + 1;
        });
        
        return {
            totalHints: chatHintInteractions.length,
            questionTypeBreakdown: questionTypes
        };
    }

    getUserPerformanceAnalytics() {
        const answerInteractions = this.sessionData.interactions.filter(
            i => i.type === 'user_answer'
        );
        
        const correctAnswers = answerInteractions.filter(i => i.correct).length;
        
        return {
            totalAnswers: answerInteractions.length,
            correctAnswers: correctAnswers,
            accuracy: answerInteractions.length > 0 ? correctAnswers / answerInteractions.length : 0
        };
    }
}

// Initialize test runner if in test mode
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('testMode') === 'true') {
        const modelId = urlParams.get('testModel');
        const isLocal = urlParams.get('local') === 'true';
        
        if (modelId) {
            window.testGameRunner = new TestGameRunner({
                modelId: modelId,
                modelName: modelId,
                provider: isLocal ? 'local' : 'openrouter'
            });
            
            console.log('Test Game Runner initialized for model:', modelId);
            
            // Add end session button
            const endButton = document.createElement('button');
            endButton.textContent = 'End Test Session';
            endButton.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 1000;
                padding: 10px 15px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            `;
            
            endButton.addEventListener('click', async () => {
                const filename = await window.testGameRunner.saveReport();
                alert(`Test session ended. Report saved as: ${filename}`);
                window.close();
            });
            
            document.body.appendChild(endButton);
        }
    }
});

export { TestGameRunner };