/**
 * Comprehensive Test Report Generator
 * Analyzes test results and generates detailed reports
 */

class TestReportGenerator {
    constructor() {
        this.reportTemplates = {
            summary: this.generateSummaryReport.bind(this),
            detailed: this.generateDetailedReport.bind(this),
            comparison: this.generateComparisonReport.bind(this),
            performance: this.generatePerformanceReport.bind(this),
            markdown: this.generateMarkdownReport.bind(this)
        };
    }

    async generateAllReports(testResults, outputFormat = 'all') {
        const reports = {};
        
        if (outputFormat === 'all' || outputFormat === 'summary') {
            reports.summary = this.generateSummaryReport(testResults);
        }
        
        if (outputFormat === 'all' || outputFormat === 'detailed') {
            reports.detailed = this.generateDetailedReport(testResults);
        }
        
        if (outputFormat === 'all' || outputFormat === 'comparison') {
            reports.comparison = this.generateComparisonReport(testResults);
        }
        
        if (outputFormat === 'all' || outputFormat === 'performance') {
            reports.performance = this.generatePerformanceReport(testResults);
        }
        
        if (outputFormat === 'all' || outputFormat === 'markdown') {
            reports.markdown = this.generateMarkdownReport(testResults);
        }
        
        return reports;
    }

    generateSummaryReport(testResults) {
        const summary = {
            testOverview: {
                timestamp: testResults.timestamp,
                totalModels: testResults.tests.length,
                testDuration: this.calculateTotalTestDuration(testResults.tests),
                successfulTests: testResults.tests.filter(t => !t.error).length
            },
            topPerformers: this.getTopPerformers(testResults.tests),
            categoryAverages: this.calculateCategoryAverages(testResults.tests),
            recommendations: this.generateRecommendations(testResults.tests)
        };
        
        return summary;
    }

    generateDetailedReport(testResults) {
        const detailed = {
            testMetadata: {
                timestamp: testResults.timestamp,
                totalModels: testResults.tests.length,
                testFrameworkVersion: '1.0.0'
            },
            modelResults: testResults.tests.map(test => ({
                modelInfo: {
                    id: test.modelId,
                    name: test.modelName,
                    provider: test.provider
                },
                overallPerformance: {
                    score: test.overallScore,
                    totalTime: test.totalTime,
                    rank: this.calculateRank(test, testResults.tests)
                },
                wordSelection: this.analyzeWordSelection(test.wordSelection),
                contextualization: this.analyzeContextualization(test.contextualization),
                chatHints: this.analyzeChatHints(test.chatHints),
                errorAnalysis: this.analyzeErrors(test)
            }))
        };
        
        return detailed;
    }

    generateComparisonReport(testResults) {
        const validTests = testResults.tests.filter(t => !t.error);
        
        const comparison = {
            modelComparison: this.createModelComparisonMatrix(validTests),
            providerAnalysis: this.analyzeByProvider(validTests),
            performanceMetrics: {
                wordSelection: this.compareWordSelectionMetrics(validTests),
                contextualization: this.compareContextualizationMetrics(validTests),
                chatHints: this.compareChatHintMetrics(validTests),
                responseTime: this.compareResponseTimes(validTests)
            },
            recommendations: {
                bestOverall: this.getBestOverallModel(validTests),
                bestForWordSelection: this.getBestForTask(validTests, 'wordSelection'),
                bestForContextualization: this.getBestForTask(validTests, 'contextualization'),
                bestForChatHints: this.getBestForTask(validTests, 'chatHints'),
                fastestResponse: this.getFastestModel(validTests),
                mostReliable: this.getMostReliableModel(validTests)
            }
        };
        
        return comparison;
    }

    generatePerformanceReport(testResults) {
        const performance = {
            responseTimeAnalysis: this.analyzeResponseTimes(testResults.tests),
            successRateAnalysis: this.analyzeSuccessRates(testResults.tests),
            qualityMetrics: this.analyzeQualityMetrics(testResults.tests),
            scalabilityInsights: this.analyzeScalability(testResults.tests),
            reliabilityMetrics: this.analyzeReliability(testResults.tests)
        };
        
        return performance;
    }

    generateMarkdownReport(testResults) {
        const summary = this.generateSummaryReport(testResults);
        const comparison = this.generateComparisonReport(testResults);
        
        let markdown = `# Cloze Reader Model Testing Report\n\n`;
        markdown += `**Generated:** ${new Date().toLocaleString()}\n`;
        markdown += `**Test Timestamp:** ${testResults.timestamp}\n`;
        markdown += `**Models Tested:** ${testResults.tests.length}\n\n`;
        
        // Executive Summary
        markdown += `## Executive Summary\n\n`;
        markdown += `- **Successful Tests:** ${summary.testOverview.successfulTests}/${summary.testOverview.totalModels}\n`;
        markdown += `- **Best Overall Model:** ${comparison.recommendations.bestOverall.name} (${comparison.recommendations.bestOverall.score.toFixed(1)}/100)\n`;
        markdown += `- **Average Response Time:** ${this.formatTime(this.calculateAverageResponseTime(testResults.tests))}\n\n`;
        
        // Top Performers
        markdown += `## Top Performers\n\n`;
        markdown += `| Rank | Model | Score | Provider |\n`;
        markdown += `|------|-------|-------|----------|\n`;
        summary.topPerformers.forEach((model, index) => {
            markdown += `| ${index + 1} | ${model.name} | ${model.score.toFixed(1)} | ${model.provider} |\n`;
        });
        markdown += `\n`;
        
        // Performance by Category
        markdown += `## Performance by Category\n\n`;
        markdown += `### Word Selection\n`;
        markdown += `- **Best:** ${comparison.recommendations.bestForWordSelection.name} (${(comparison.recommendations.bestForWordSelection.successRate * 100).toFixed(1)}% success rate)\n`;
        markdown += `- **Average Success Rate:** ${(summary.categoryAverages.wordSelection.successRate * 100).toFixed(1)}%\n`;
        markdown += `- **Average Response Time:** ${this.formatTime(summary.categoryAverages.wordSelection.averageTime)}\n\n`;
        
        markdown += `### Contextualization\n`;
        markdown += `- **Best:** ${comparison.recommendations.bestForContextualization.name} (${(comparison.recommendations.bestForContextualization.successRate * 100).toFixed(1)}% success rate)\n`;
        markdown += `- **Average Success Rate:** ${(summary.categoryAverages.contextualization.successRate * 100).toFixed(1)}%\n`;
        markdown += `- **Average Response Time:** ${this.formatTime(summary.categoryAverages.contextualization.averageTime)}\n\n`;
        
        markdown += `### Chat Hints\n`;
        markdown += `- **Best:** ${comparison.recommendations.bestForChatHints.name} (${(comparison.recommendations.bestForChatHints.successRate * 100).toFixed(1)}% success rate)\n`;
        markdown += `- **Average Success Rate:** ${(summary.categoryAverages.chatHints.successRate * 100).toFixed(1)}%\n`;
        markdown += `- **Average Response Time:** ${this.formatTime(summary.categoryAverages.chatHints.averageTime)}\n\n`;
        
        // Add user rankings section if available
        const hasUserRankings = testResults.tests.some(t => t.userRankings?.totalRankings > 0);
        if (hasUserRankings) {
            markdown += `## User Satisfaction Ratings\n\n`;
            markdown += `| Model | Overall Satisfaction | Word Selection | Passage Quality | Hint Helpfulness | Overall Experience |\n`;
            markdown += `|-------|---------------------|----------------|-----------------|------------------|--------------------|\n`;
            
            testResults.tests.forEach(test => {
                if (test.userRankings?.totalRankings > 0) {
                    const ur = test.userRankings;
                    const avg = ur.averageRatings || {};
                    markdown += `| ${test.modelName} | ${ur.overallUserSatisfaction.toFixed(1)}/5 | ${(avg.word_selection || 0).toFixed(1)} | ${(avg.passage_quality || 0).toFixed(1)} | ${(avg.hint_helpfulness || 0).toFixed(1)} | ${(avg.overall_experience || 0).toFixed(1)} |\n`;
                }
            });
            markdown += `\n`;
            
            // Add user comments if any
            const allComments = testResults.tests
                .filter(t => t.userRankings?.comments?.length > 0)
                .flatMap(t => t.userRankings.comments.map(c => ({ ...c, model: t.modelName })));
            
            if (allComments.length > 0) {
                markdown += `### User Comments\n\n`;
                allComments.forEach(comment => {
                    markdown += `- **${comment.model}** (Rating: ${comment.averageRating.toFixed(1)}): "${comment.comment}"\n`;
                });
                markdown += `\n`;
            }
        }
        
        // Detailed Results
        markdown += `## Detailed Results\n\n`;
        testResults.tests.forEach(test => {
            if (!test.error) {
                markdown += `### ${test.modelName}\n`;
                markdown += `- **Provider:** ${test.provider}\n`;
                markdown += `- **Overall Score:** ${test.overallScore.toFixed(1)}/100\n`;
                markdown += `- **Total Time:** ${this.formatTime(test.totalTime)}\n`;
                markdown += `- **Word Selection:** ${(test.wordSelection?.successRate * 100 || 0).toFixed(1)}% success\n`;
                markdown += `- **Contextualization:** ${(test.contextualization?.successRate * 100 || 0).toFixed(1)}% success\n`;
                markdown += `- **Chat Hints:** ${(test.chatHints?.successRate * 100 || 0).toFixed(1)}% success\n\n`;
            }
        });
        
        // Recommendations
        markdown += `## Recommendations\n\n`;
        summary.recommendations.forEach(rec => {
            markdown += `- ${rec}\n`;
        });
        
        return markdown;
    }

    // Helper methods for analysis
    calculateTotalTestDuration(tests) {
        return tests.reduce((total, test) => total + (test.totalTime || 0), 0);
    }

    getTopPerformers(tests, limit = 5) {
        return tests
            .filter(t => !t.error && t.overallScore)
            .sort((a, b) => b.overallScore - a.overallScore)
            .slice(0, limit)
            .map(test => ({
                name: test.modelName,
                score: test.overallScore,
                provider: test.provider
            }));
    }

    calculateCategoryAverages(tests) {
        const validTests = tests.filter(t => !t.error);
        
        return {
            wordSelection: this.calculateCategoryAverage(validTests, 'wordSelection'),
            contextualization: this.calculateCategoryAverage(validTests, 'contextualization'),
            chatHints: this.calculateCategoryAverage(validTests, 'chatHints')
        };
    }

    calculateCategoryAverage(tests, category) {
        const validCategoryTests = tests.filter(t => t[category]);
        
        if (validCategoryTests.length === 0) {
            return { successRate: 0, averageTime: 0, qualityScore: 0 };
        }
        
        return {
            successRate: validCategoryTests.reduce((sum, t) => sum + (t[category].successRate || 0), 0) / validCategoryTests.length,
            averageTime: validCategoryTests.reduce((sum, t) => sum + (t[category].averageTime || 0), 0) / validCategoryTests.length,
            qualityScore: validCategoryTests.reduce((sum, t) => sum + (t[category].qualityScore || t[category].relevanceScore || t[category].helpfulnessScore || 0), 0) / validCategoryTests.length
        };
    }

    generateRecommendations(tests) {
        const recommendations = [];
        const validTests = tests.filter(t => !t.error);
        
        if (validTests.length === 0) {
            return ['No successful tests to generate recommendations.'];
        }
        
        const bestOverall = validTests.reduce((best, test) => 
            test.overallScore > best.overallScore ? test : best
        );
        
        recommendations.push(`For overall best performance, use ${bestOverall.modelName} (${bestOverall.provider})`);
        
        // Provider-specific recommendations
        const providerPerformance = this.analyzeByProvider(validTests);
        const bestProvider = Object.keys(providerPerformance)
            .reduce((best, provider) => 
                providerPerformance[provider].averageScore > providerPerformance[best]?.averageScore ? provider : best
            );
        
        recommendations.push(`${bestProvider} models show the best average performance`);
        
        // Speed vs quality trade-offs
        const fastestGoodModel = validTests
            .filter(t => t.overallScore > 70)
            .sort((a, b) => a.totalTime - b.totalTime)[0];
        
        if (fastestGoodModel) {
            recommendations.push(`For fastest good performance, consider ${fastestGoodModel.modelName}`);
        }
        
        return recommendations;
    }

    analyzeByProvider(tests) {
        const providerGroups = {};
        
        tests.forEach(test => {
            if (!providerGroups[test.provider]) {
                providerGroups[test.provider] = [];
            }
            providerGroups[test.provider].push(test);
        });
        
        const analysis = {};
        Object.keys(providerGroups).forEach(provider => {
            const providerTests = providerGroups[provider];
            analysis[provider] = {
                count: providerTests.length,
                averageScore: providerTests.reduce((sum, t) => sum + t.overallScore, 0) / providerTests.length,
                averageTime: providerTests.reduce((sum, t) => sum + t.totalTime, 0) / providerTests.length,
                successRate: providerTests.filter(t => !t.error).length / providerTests.length
            };
        });
        
        return analysis;
    }

    getBestOverallModel(tests) {
        return tests.reduce((best, test) => 
            test.overallScore > best.overallScore ? {
                name: test.modelName,
                score: test.overallScore,
                provider: test.provider
            } : best
        , { name: '', score: 0, provider: '' });
    }

    getBestForTask(tests, taskName) {
        const validTests = tests.filter(t => t[taskName] && t[taskName].successRate !== undefined);
        
        if (validTests.length === 0) {
            return { name: 'N/A', successRate: 0, provider: '' };
        }
        
        return validTests.reduce((best, test) => 
            test[taskName].successRate > best.successRate ? {
                name: test.modelName,
                successRate: test[taskName].successRate,
                provider: test.provider
            } : best
        , { name: '', successRate: 0, provider: '' });
    }

    getFastestModel(tests) {
        return tests.reduce((fastest, test) => 
            test.totalTime < fastest.time ? {
                name: test.modelName,
                time: test.totalTime,
                provider: test.provider
            } : fastest
        , { name: '', time: Infinity, provider: '' });
    }

    getMostReliableModel(tests) {
        // Model with fewest errors and highest success rates across all tasks
        const reliability = tests.map(test => {
            const wordSelectionReliability = test.wordSelection?.successRate || 0;
            const contextualizationReliability = test.contextualization?.successRate || 0;
            const chatHintReliability = test.chatHints?.successRate || 0;
            
            const overallReliability = (wordSelectionReliability + contextualizationReliability + chatHintReliability) / 3;
            
            return {
                name: test.modelName,
                reliability: overallReliability,
                provider: test.provider
            };
        });
        
        return reliability.reduce((most, test) => 
            test.reliability > most.reliability ? test : most
        , { name: '', reliability: 0, provider: '' });
    }

    calculateAverageResponseTime(tests) {
        const validTests = tests.filter(t => t.totalTime);
        return validTests.reduce((sum, t) => sum + t.totalTime, 0) / validTests.length;
    }

    formatTime(milliseconds) {
        if (milliseconds < 1000) {
            return `${milliseconds.toFixed(0)}ms`;
        } else if (milliseconds < 60000) {
            return `${(milliseconds / 1000).toFixed(1)}s`;
        } else {
            return `${(milliseconds / 60000).toFixed(1)}m`;
        }
    }

    async saveReports(reports, baseFilename) {
        const savedFiles = [];
        
        for (const [type, content] of Object.entries(reports)) {
            const filename = `${baseFilename}_${type}`;
            let fileContent, extension;
            
            if (type === 'markdown') {
                fileContent = content;
                extension = '.md';
            } else {
                fileContent = JSON.stringify(content, null, 2);
                extension = '.json';
            }
            
            try {
                await this.saveFile(`${filename}${extension}`, fileContent);
                savedFiles.push(`${filename}${extension}`);
            } catch (error) {
                console.error(`Error saving ${filename}:`, error);
            }
        }
        
        return savedFiles;
    }

    async saveFile(filename, content) {
        // Try to save via browser download
        const blob = new Blob([content], { 
            type: filename.endsWith('.md') ? 'text/markdown' : 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Stub methods for detailed analysis (implement as needed)
    analyzeWordSelection(data) { return data; }
    analyzeContextualization(data) { return data; }
    analyzeChatHints(data) { return data; }
    analyzeErrors(test) { return test.error ? [test.error] : []; }
    calculateRank(test, allTests) { 
        const sorted = allTests.filter(t => !t.error).sort((a, b) => b.overallScore - a.overallScore);
        return sorted.findIndex(t => t.modelId === test.modelId) + 1;
    }
    createModelComparisonMatrix(tests) { return {}; }
    compareWordSelectionMetrics(tests) { return {}; }
    compareContextualizationMetrics(tests) { return {}; }
    compareChatHintMetrics(tests) { return {}; }
    compareResponseTimes(tests) { return {}; }
    analyzeResponseTimes(tests) { return {}; }
    analyzeSuccessRates(tests) { return {}; }
    analyzeQualityMetrics(tests) { return {}; }
    analyzeScalability(tests) { return {}; }
    analyzeReliability(tests) { return {}; }
}

export { TestReportGenerator };