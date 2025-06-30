import { AIService } from './src/aiService.js';

// Force local mode
const originalSearch = window.location.search;
window.location.search = '?local=true';

const ai = new AIService();

console.log('Testing direct AI connection...');
console.log('Config:', {
  url: ai.apiUrl,
  model: ai.model,
  isLocal: ai.isLocalMode
});

const testPassage = "The ancient library contained thousands of manuscripts, each one carefully preserved by generations of scholars who dedicated their lives to knowledge.";

try {
  console.log('\nTesting word selection...');
  const words = await ai.selectSignificantWords(testPassage, 2, 3);
  console.log('Selected words:', words);
  console.log('✅ Success!');
} catch (error) {
  console.error('❌ Error:', error.message);
}

// Restore original search
window.location.search = originalSearch;