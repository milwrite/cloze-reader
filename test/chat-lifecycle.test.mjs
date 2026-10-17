import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = {location: {origin: 'https://cloze.example'}};
const {default: ChatUI} = await import('../src/chatInterface.js');

function pendingHint() {
  let complete;
  const response = new Promise(resolve => { complete = resolve; });
  const rendered = [], recorded = [];
  const chat = Object.assign(Object.create(ChatUI.prototype), {
    activeChatBlank: 0, isOpen: true, historyVersion: 0, messageHistory: new Map(),
    game: {getSuggestedQuestionsForBlank: () => [{type:'grammar', text:'Part of speech?'}], askQuestionAboutBlank: () => response},
    analytics: {recordHint: (index, type) => recorded.push([index, type])},
    getCurrentBlankInput: () => '', showTypingIndicator() {}, hideTypingIndicator() {}, loadQuestionButtons() {},
    displayMessage: (_sender, text) => rendered.push(text),
  });
  return {chat, rendered, recorded, complete: () => complete({success:true, response:'An adjective.'})};
}

for (const nextBlank of [null, 1]) {
  test(`a pending reply stays with its word after ${nextBlank === null ? 'closing' : 'switching'} help`, async () => {
    const {chat, rendered, recorded, complete} = pendingHint();
    const request = chat.askQuestion('grammar');
    chat.activeChatBlank = nextBlank;
    chat.isOpen = nextBlank !== null;
    complete();
    await request;
    assert.deepEqual(chat.messageHistory.get('blank_0').map(message => message.content), ['Part of speech?', 'An adjective.']);
    assert.equal(chat.messageHistory.has('blank_1'), false);
    assert.deepEqual(rendered, ['Part of speech?']);
    assert.deepEqual(recorded, [[0, 'grammar']]);
  });
}

test('a reply from a previous round does not enter the new round', async () => {
  const {chat, recorded, complete} = pendingHint();
  const request = chat.askQuestion('grammar');
  chat.clearChatHistory();
  complete();
  await request;
  assert.equal(chat.messageHistory.size, 0);
  assert.deepEqual(recorded, []);
});
