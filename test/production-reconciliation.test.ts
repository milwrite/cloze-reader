import test from 'node:test';
import assert from 'node:assert/strict';
import candidate from '../worker/index.ts';
import serving from './fixtures/production-20260911.js';

const origin = 'https://cloze.ailab-452.workers.dev';
const valid = {messages:[{role:'user',content:'A small hint, please.'}],max_tokens:200,temperature:0.5};
const scenarios = [
  {name:'public configuration',path:'/api/config'},
  {name:'anonymous session',path:'/api/session'},
  {name:'private work still requires identity',path:'/api/work/entries'},
  {name:'valid guest generation uses Workers AI',body:valid},
  {name:'a session outage cannot break public generation',body:valid,session:true},
  {name:'invalid JSON',raw:'{'},
  {name:'empty messages',body:{messages:[]}},
  {name:'invalid message role',body:{messages:[{role:'tool',content:'No'}]}},
  {name:'streaming refused',body:{...valid,stream:true}},
  {name:'excessive budget refused',body:{...valid,max_tokens:2049}},
  {name:'invalid temperature refused',body:{...valid,temperature:4}},
  {name:'rate limit enforced',body:valid,limited:true},
  {name:'empty model response refused',body:valid,empty:true},
  {name:'provider error returned',body:valid,providerError:true},
  {name:'cross-origin request refused',body:valid,crossOrigin:true},
];

for (const scenario of scenarios) {
  test(`recovered Worker matches serving code: ${scenario.name}`,async()=>{
    async function run(worker:any) {
      const calls:any[]=[];
      const env={
        PUBLIC_ORIGIN:origin,APP_ID:'cloze',RELEASE:'reconciliation',
        CLOZE_MODEL:'@cf/google/gemma-4-26b-a4b-it',
        REQUEST_LIMIT:{limit:async()=>({success:!scenario.limited})},
        IDENTITY:{identities:async()=>{throw new Error('Identity unavailable');}},
        WORK_ACCOUNTS:{register:async()=>({})},
        AI:{run:async(model:string,input:any)=>{
          calls.push({model,input});
          if(scenario.providerError)throw new Error('Unavailable');
          return {response:scenario.empty?' ':'Look at the verb.',usage:{completion_tokens:5}};
        }},
        ASSETS:{fetch:async()=>new Response('page')},
      };
      const path=scenario.path||'/api/ai/chat';
      const headers:any={origin:scenario.crossOrigin?'https://unrelated.example':origin,'content-type':'application/json'};
      if(scenario.session)headers.cookie='__Host-cloze-session=fixture';
      const request=new Request(origin+path,{method:scenario.path?'GET':'POST',headers,body:scenario.path?undefined:scenario.raw??JSON.stringify(scenario.body)});
      const response=await worker.fetch(request,env);
      return {status:response.status,body:await response.json(),calls};
    }
    const live=await run(serving),restored=await run(candidate);
    assert.deepEqual(restored,live);
    if(scenario.name==='valid guest generation uses Workers AI') {
      assert.equal(restored.status,200);
      assert.equal(restored.calls.length,1);
      assert.equal(restored.calls[0].model,'@cf/google/gemma-4-26b-a4b-it');
      assert.equal(restored.calls[0].input.chat_template_kwargs.enable_thinking,false);
    }
  });
}
