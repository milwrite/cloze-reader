import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.ts';
const origin='https://cloze.ailab-452.workers.dev';
test('server key funds generation without entering configuration or saved-work identity',async()=>{
 const env:any={PUBLIC_ORIGIN:origin,APP_ID:'cloze',CLOZE_MODEL:'@cf/deepseek-ai/deepseek-v4-flash-0731',CAIL_GATEWAY_KEY:'server-only-fixture',
  REQUEST_LIMIT:{limit:async()=>({success:true})},
  AI:{run:async()=>{throw new Error('must use gateway');}},
  IDENTITY:{identities:async()=>({ok:true,appJwt:'owner-app',gatewayJwt:'user-inference',workspaceJwt:null})},
  WORK_ACCOUNTS:{fetch:async(r:Request)=>{assert.equal(r.headers.get('x-cail-identity-jwt'),'owner-app');assert.equal(r.headers.get('authorization'),null);return Response.json({saved:true});}},
  GATEWAY:{fetch:async(r:Request)=>{
   assert.equal(r.headers.get('authorization'),'Bearer server-only-fixture');
   const body:any=await r.json();assert.equal(body.model,'deepseek-v4-flash-0731');assert.equal(body.chat_template_kwargs.enable_thinking,false);
   assert.ok(r.signal instanceof AbortSignal);
   return Response.json({choices:[{message:{content:'A useful hint.'}}],usage:{completion_tokens:5}});
  }}
 };
 const response=await worker.fetch(new Request(origin+'/api/ai/chat',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Help with this sentence.'}]})}),env);
 assert.equal(response.status,200);assert.equal((await response.json() as any).choices[0].message.content,'A useful hint.');
 const config=await worker.fetch(new Request(origin+'/api/config'),env);assert.ok(!(await config.text()).includes(env.CAIL_GATEWAY_KEY));
 const saved=await worker.fetch(new Request(origin+'/api/work/entries',{headers:{cookie:'__Host-cloze-session=valid'}}),env);assert.equal(saved.status,200);
 const denied=await worker.fetch(new Request(origin+'/api/work/entries'),env);assert.equal(denied.status,401);
});
