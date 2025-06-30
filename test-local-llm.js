#!/usr/bin/env node

// Stress test for local LLM on port 1234
// Tests word selection functionality with Gutenberg passages

import http from 'http';

// Sample Gutenberg passages for testing
const testPassages = [
  "The sun was shining brightly on the sea, shining with all his might. He did his very best to make the billows smooth and bright. And this was odd, because it was the middle of the night.",
  "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity.",
  "In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole, filled with the ends of worms and an oozy smell, nor yet a dry, bare, sandy hole with nothing in it to sit down on.",
  "Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little.",
  "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be."
];

// Word selection prompt template (based on cloze reader's format)
function createWordSelectionPrompt(passage, level = 1) {
  const wordCount = level < 6 ? 1 : level < 11 ? 2 : 3;
  const minLength = level < 3 ? 4 : 5;
  const maxLength = level < 3 ? 7 : level < 5 ? 10 : 14;
  
  return {
    model: "gemma-3-12b",
    messages: [
      {
        role: "system",
        content: "You are a vocabulary expert who selects appropriate words for cloze exercises."
      },
      {
        role: "user",
        content: `Select ${wordCount} word${wordCount > 1 ? 's' : ''} from this passage for a cloze exercise.

Passage: "${passage}"

Requirements:
- Select exactly ${wordCount} different word${wordCount > 1 ? 's' : ''}
- Each word must be ${minLength}-${maxLength} letters long
- Words must be meaningful nouns, verbs, adjectives, or adverbs
- Avoid pronouns, articles, and common words
- Return ONLY the selected word${wordCount > 1 ? 's' : ''}, ${wordCount > 1 ? 'comma-separated' : 'nothing else'}

Selected word${wordCount > 1 ? 's' : ''}:`
      }
    ],
    temperature: 0.7,
    max_tokens: 50
  };
}

// Function to make HTTP request to local LLM
function testLLMConnection(passage, testNumber) {
  return new Promise((resolve, reject) => {
    const prompt = createWordSelectionPrompt(passage, Math.floor(Math.random() * 10) + 1);
    const data = JSON.stringify(prompt);
    
    const options = {
      hostname: 'localhost',
      port: 1234,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    console.log(`\n=== Test ${testNumber} ===`);
    console.log(`Passage: "${passage.substring(0, 80)}..."`);
    console.log(`Sending request to http://localhost:1234/v1/chat/completions`);
    
    const startTime = Date.now();
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        const elapsed = Date.now() - startTime;
        console.log(`Response received in ${elapsed}ms`);
        console.log(`Status: ${res.statusCode}`);
        
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
            const selectedWords = parsed.choices[0].message.content.trim();
            console.log(`Selected words: ${selectedWords}`);
            console.log(`✓ Test ${testNumber} PASSED`);
            resolve({ success: true, words: selectedWords, time: elapsed });
          } else {
            console.log(`Response structure unexpected:`, parsed);
            resolve({ success: false, error: 'Invalid response structure', time: elapsed });
          }
        } catch (error) {
          console.log(`Failed to parse response:`, error.message);
          console.log(`Raw response:`, responseData.substring(0, 200));
          resolve({ success: false, error: error.message, time: elapsed });
        }
      });
    });
    
    req.on('error', (error) => {
      const elapsed = Date.now() - startTime;
      console.log(`✗ Test ${testNumber} FAILED - Connection error after ${elapsed}ms`);
      console.log(`Error: ${error.message}`);
      resolve({ success: false, error: error.message, time: elapsed });
    });
    
    req.write(data);
    req.end();
  });
}

// Run stress test
async function runStressTest() {
  console.log('Starting stress test for Gemma-3-12b on localhost:1234');
  console.log('Testing word selection for cloze reader game...\n');
  
  const results = [];
  
  // Test each passage
  for (let i = 0; i < testPassages.length; i++) {
    const result = await testLLMConnection(testPassages[i], i + 1);
    results.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n=== STRESS TEST SUMMARY ===');
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
  
  console.log(`Total tests: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  console.log(`Average response time: ${avgTime.toFixed(0)}ms`);
  console.log(`Success rate: ${(successful / results.length * 100).toFixed(1)}%`);
  
  if (successful === results.length) {
    console.log('\n✓ All tests passed! The Gemma-3-12b server is functioning correctly for cloze reader.');
  } else if (successful > 0) {
    console.log('\n⚠ Some tests passed. The server is partially functional.');
  } else {
    console.log('\n✗ All tests failed. Please check if the server is running on port 1234.');
  }
}

// Run the test
runStressTest().catch(console.error);