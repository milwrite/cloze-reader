import test from 'node:test';
import assert from 'node:assert/strict';
import bookDataService from '../src/bookDataService.js';

test('a resumed exercise can choose its next passage without startup initialization', async () => {
  const library = new bookDataService.constructor();
  let loads = 0;
  library.initializeStreaming = async () => { loads++; };

  assert.equal(library.isLoaded, false);
  const next = await library.getBookByLevelCriteria(2);
  assert.ok(next.title);
  assert.ok(next.text.length > 100);
  assert.equal(library.isLoaded, true);
  assert.equal(loads, 1);
  await library.getBookByLevelCriteria(2);
  assert.equal(loads, 1, 'an initialized library is reused on later rounds');
});
