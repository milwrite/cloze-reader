import test from 'node:test';
import assert from 'node:assert/strict';
import AccountWork, {snapshot, restore} from '../src/accountWork.js';

function appFixture() {
 const input={value:'systems',disabled:true,className:'cloze-input correct'};
 const app={game:{originalText:'Reading systems',clozeText:'Reading ____',blanks:[{word:'systems'}],currentRound:2,currentLevel:1,score:100,currentBook:{title:'Example',author:'Writer',text:'Do not copy the entire book'},lockedBlanks:new Set([0]),chatService:{conversations:new Map([['blank-0',[{role:'user',content:'A hint?'}]]]),wordContexts:new Map([['blank-0',{attempts:new Set(['letters'])}]])}},chatUI:{messageHistory:new Map([['blank_0',[{sender:'Cluemaster',content:'A plural noun',isUser:false}] ]])},currentHints:['Plural noun'],elements:{passageContent:{querySelectorAll:()=>[input]},result:{textContent:'Correct'},nextBtn:{classList:{contains:()=>false,toggle(){}}},submitBtn:{style:{display:'none'},textContent:'Submit'}},resetUI(){},displayRound(){},updateSubmitButton(){},showLoading(){}};
 return {app,input};
}

test('exercise round trip preserves answers, progress and nested hint conversations without book payloads',async()=>{
 const source=appFixture(),content=snapshot(source.app),target=appFixture();
 target.input.value='';target.app.game.lockedBlanks.clear();target.app.game.chatService={};
 assert.equal(content.record.game.currentBook.text,undefined);
 await restore(target.app,JSON.parse(JSON.stringify(content)));
 assert.equal(target.input.value,'systems');assert.equal(target.input.disabled,true);
 assert.deepEqual(target.app.game.lockedBlanks,new Set([0]));
 assert.deepEqual(target.app.game.chatService.conversations,source.app.game.chatService.conversations);
 assert.deepEqual(target.app.game.chatService.wordContexts,source.app.game.chatService.wordContexts);
 assert.deepEqual(target.app.chatUI.messageHistory,source.app.chatUI.messageHistory);
 assert.equal(target.app.game.score,100);assert.equal(target.app.game.currentRound,2);
 assert.deepEqual(target.app.currentHints,['Plural noun']);
});

test('queued saves use the returned revision and capture changes made during a request',async()=>{
 const {app,input}=appFixture(),work=new AccountWork(app),writes=[];
 work.ready=true;work.authenticated=true;work.status={};
 const original=globalThis.history;globalThis.history={replaceState(){}};
 let release;const firstRequest=new Promise(resolve=>release=resolve);
 work.api=async(_path,_method,body)=>{writes.push(body);if(writes.length===1)await firstRequest;return {item:{revision:writes.length}};};
 try {
  const first=work.save();await Promise.resolve();input.value='revised';const second=work.save();release();
  assert.equal(await first,true);assert.equal(await second,true);
  assert.deepEqual(writes.map(w=>w.expectedRevision),[0,1]);
  assert.deepEqual(writes.map(w=>w.content.record.inputs[0].value),['systems','revised']);
  await work.save();assert.equal(writes.length,2);
 }finally{globalThis.history=original;}
});

test('failed save keeps the current exercise and prevents advancing the round',async()=>{
 const {app}=appFixture(),work=new AccountWork(app);work.ready=true;work.authenticated=true;work.status={};
 const id=work.id;work.api=async()=>{throw new Error('This exercise changed in another tab.');};
 assert.equal(await work.newRound(),false);assert.equal(work.id,id);assert.equal(work.revision,0);
 assert.match(work.status.textContent,/another tab/);
});
