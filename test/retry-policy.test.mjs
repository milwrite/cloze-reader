import test from 'node:test';
import assert from 'node:assert/strict';
import { AIService } from '../src/aiService.js';

// The retry rule on its own, without the constructor's network probe.
const service = Object.create(AIService.prototype);
const failure = (status, extra = {}) => Object.assign(new Error('failed'), status === undefined ? {} : { status, retryable: status === 503 }, extra);
async function attempts(error) {
  let calls = 0;
  await assert.rejects(service.retryRequest(async () => { calls++; throw error; }, undefined, 1));
  return calls;
}

test('a model request is asked again once at most, and only when it likely never reached a model', async () => {
  assert.equal(await attempts(failure(503)), 2, 'the server said unavailable');
  assert.equal(await attempts(new TypeError('Failed to fetch')), 2, 'the connection failed before any response');
});

test('timeouts, rate limits, 502/504 and unusable output are never asked again', async () => {
  for (const status of [400, 401, 403, 404, 408, 429, 500, 502, 504]) assert.equal(await attempts(failure(status)), 1, String(status));
  assert.equal(await attempts(Object.assign(new Error('timed out'), { name: 'TimeoutError' })), 1);
  assert.equal(await attempts(Object.assign(new Error('aborted'), { name: 'AbortError' })), 1);
  // A reply that came back but could not be used (empty, or words that fail validation) was already paid for.
  assert.equal(await attempts(new Error('No valid words in response')), 1);
  assert.equal(await attempts(Object.assign(new TypeError('bad shape'), { status: 200 })), 1);
});

test('the response check marks only 503 as retryable', async () => {
  for (const [status, retryable] of [[503, true], [502, false], [504, false], [500, false], [429, false], [408, false]]) {
    const error = await service._checkChatResponse(new Response('{}', { status })).then(() => null, e => e);
    assert.equal(error.status, status);
    assert.equal(error.retryable, retryable, String(status));
  }
});

test('a successful second attempt returns its value', async () => {
  let calls = 0;
  const value = await service.retryRequest(async () => { if (++calls === 1) throw failure(503); return 'words'; }, undefined, 1);
  assert.deepEqual([value, calls], ['words', 2]);
});
