# Cloze Reader Model Testing Framework

A comprehensive testing system for evaluating AI models across all tasks in the Cloze Reader application, including both OpenRouter and local LLM (LM Studio) models.

## Features

### 🎯 Comprehensive Testing
- **Word Selection Testing**: Evaluates vocabulary selection accuracy, difficulty matching, and response quality
- **Contextualization Testing**: Tests historical and literary context generation for books and authors
- **Chat Hints Testing**: Assesses all 4 question types (part of speech, sentence role, word category, synonym)
- **Performance Monitoring**: Tracks response times, success rates, and error patterns
- **User Satisfaction Ratings**: Collect user feedback on model performance after each round

### 🏠 Local LLM Support
- **LM Studio Integration**: Auto-detects models running on port 1234
- **Real-time Status**: Shows connection status and available models
- **Response Cleaning**: Handles local LLM output artifacts automatically
- **Fallback Testing**: Graceful handling when local server is unavailable

### 📊 Advanced Analytics
- **Multi-format Reports**: JSON, CSV, and Markdown outputs
- **Performance Comparisons**: Side-by-side model analysis
- **Quality Scoring**: Detailed evaluation metrics for each task
- **Interactive Game Testing**: Real-time performance monitoring during gameplay
- **User Ranking Integration**: 5-star ratings for word selection, passage quality, hint helpfulness, and overall experience

## Quick Start

### 1. Start the Testing Interface
```bash
# Start development server
make dev
# or
python local-server.py 8000

# Open testing interface
open http://localhost:8000/model-testing.html
```

### 2. Setup Local LLM (Optional)
```bash
# Start LM Studio server on port 1234
# Load your preferred model (e.g., Gemma-3-12b, Llama-3.1-8b)
# The framework will auto-detect available models
```

### 3. Run Tests
1. Select models to test (OpenRouter and/or local models)
2. Click "Start Comprehensive Test" for full evaluation
3. Or click "Test Selected Model in Game" for interactive testing
4. Results are automatically saved to the `/output` folder

## Test Results

### CSV Output Format
Results are saved as timestamped CSV files with columns for:
- Model performance metrics (overall score, success rates)
- Response time analytics (average, min, max)
- Task-specific scores (word selection, contextualization, chat hints)
- Error rates and reliability metrics
- User satisfaction ratings (1-5 stars per category)
- User comments and feedback count

### Game Testing Output
Interactive game sessions generate JSON reports with:
- Real-time AI interaction logs
- User performance analytics
- Response time breakdowns
- Error tracking and categorization
- User satisfaction ratings per round
- Qualitative feedback and comments

## Model Categories

### OpenRouter Models
- GPT-4o, GPT-4o Mini
- Claude 3.5 Sonnet, Claude 3 Haiku
- Gemini Pro 1.5
- Llama 3.1 (8B, 70B)
- Mistral 7B, Phi-3 Medium, Qwen 2 7B

### Local LLM Models (LM Studio)
- Auto-detected from running server
- Supports any OpenAI-compatible model
- Common options: Gemma-3-12b, Llama-3.1-8b, Mistral-7b

## Testing Methodology

### Word Selection Evaluation
- **Accuracy**: Words exist in source passage
- **Difficulty Matching**: Length and complexity appropriate for level
- **Quality Scoring**: Avoids overly common words at higher difficulties
- **Performance**: Response time and success rate tracking
- **User Rating**: 5-star scale for vocabulary appropriateness

### Contextualization Assessment
- **Relevance**: Mentions book title, author, historical context
- **Educational Value**: Appropriate for language learners
- **Completeness**: Balanced length (100-500 characters)
- **Literary Terms**: Uses appropriate academic vocabulary
- **User Rating**: Passage quality and educational value scoring

### Chat Hints Analysis
- **Question Type Coverage**: All 4 hint categories tested
- **Educational Appropriateness**: Helps without revealing answers
- **Response Quality**: Clear, concise, and helpful explanations
- **Consistency**: Performance across different question types
- **User Rating**: Helpfulness and clarity of AI hints

### User Experience Rating
After each round, users can rate:
- **Word Selection Quality** (1-5 stars)
- **Passage Selection** (1-5 stars)
- **Hint Helpfulness** (1-5 stars)
- **Overall Experience** (1-5 stars)
- **Optional Comments** for detailed feedback

## Architecture

### Core Components
- **ModelTestingFramework**: Main testing orchestrator
- **TestAIService**: Performance-tracking AI service wrapper
- **TestGameRunner**: Real-time game session monitoring
- **TestReportGenerator**: Multi-format report generation

### File Structure
```
src/
├── modelTestingFramework.js    # Main testing logic
├── testAIService.js           # AI service wrapper
├── testGameRunner.js          # Game monitoring
└── testReportGenerator.js     # Report generation

model-testing.html             # Testing interface UI
output/                        # Test results folder
```

## Usage Examples

### Automated Testing
```javascript
import { ModelTestingFramework } from './src/modelTestingFramework.js';

const framework = new ModelTestingFramework();
const results = await framework.runComprehensiveTest();
console.log('Results saved to output folder');
```

### Custom Model Testing
```javascript
const customModel = {
    id: 'my-local-model',
    name: 'Custom Local Model',
    provider: 'local'
};

const result = await framework.testModel(customModel);
```

### Report Generation
```javascript
import { TestReportGenerator } from './src/testReportGenerator.js';

const generator = new TestReportGenerator();
const reports = await generator.generateAllReports(testResults);
// Generates JSON, CSV, and Markdown reports
```

## Integration with Existing Codebase

The testing framework integrates seamlessly with the existing Cloze Reader architecture:

- **aiService.js**: Framework uses the same AI service patterns
- **conversationManager.js**: Chat hint testing leverages existing conversation logic
- **clozeGameEngine.js**: Game testing monitors actual game interactions
- **bookDataService.js**: Uses same book data and quality filtering

## Troubleshooting

### Local LLM Issues
- Ensure LM Studio is running on port 1234
- Check that a model is loaded and ready
- Verify CORS is enabled in LM Studio settings

### API Key Issues
- OpenRouter API key must be set via environment variable or meta tag
- Local models don't require API keys

### Performance Issues
- Large model testing can take 10-30 minutes
- Consider testing fewer models or specific categories
- Monitor network connectivity for OpenRouter models

## Contributing

The testing framework is designed to be extensible:

1. Add new model providers in `ModelTestingFramework.constructor()`
2. Extend evaluation metrics in the respective `evaluate*` methods
3. Add new report formats in `TestReportGenerator`
4. Enhance UI components in `model-testing.html`

## Results Interpretation

### Overall Scores
- **90-100**: Excellent performance across all tasks
- **80-89**: Very good with minor weaknesses
- **70-79**: Good performance with some limitations
- **60-69**: Adequate but needs improvement
- **Below 60**: Poor performance, not recommended

### Success Rate Thresholds
- **Word Selection**: >80% for production use
- **Contextualization**: >90% for educational content
- **Chat Hints**: >85% for effective tutoring

Use these benchmarks to select the best model for your specific needs and performance requirements.