// CUNY session handoff and app-scoped storage. Identity tokens stay in private RPC.
export type Identity = {ok:true;appJwt:string;gatewayJwt:string;workspaceJwt:string|null};
export interface SuiteEnv {
  ASSETS:{fetch(request:Request):Promise<Response>};
  IDENTITY:{begin(challenge:string,state:string):Promise<{url:string}>;redeem(code:string,verifier:string):Promise<{ok:boolean;token?:string;expiresAt?:number;status?:number}>;identities(token:string):Promise<Identity|{ok:false;status:number}>;revoke(token:string):Promise<unknown>};
  WORK_ACCOUNTS:{register():Promise<unknown>;fetch(request:Request):Promise<Response>};
  WORKSPACE:{fetch(request:Request):Promise<Response>};
  AI:{run(model:string,input:Record<string,unknown>):Promise<any>};
  REQUEST_LIMIT:{limit(input:{key:string}):Promise<{success:boolean}>};
  PUBLIC_ORIGIN:string;APP_ID:string;RELEASE:string;LEGACY_ORIGIN:string;CLOZE_MODEL:string;
}
const TOOLS='https://tools.ailab.gc.cuny.edu';
const secure={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
export const json=(body:unknown,status=200)=>Response.json(body,{status,headers:secure});
const random=()=>btoa(String.fromCharCode(...Array.from(crypto.getRandomValues(new Uint8Array(32))))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const cookie=(name:string,value:string,seconds:number)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
const getCookie=(r:Request,n:string)=>r.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(n+'='))?.slice(n.length+1)||'';
const nextPath=(s:string|null)=>s && s.length<500 && /^\/(?:\?|$|my-work(?:[/?#]|$))/.test(s) && !/[\\\r\n]/.test(s)?s:'/';
const redirect=(location:string,cookies:string[]=[])=>{const h=new Headers({...secure,location});for(const c of cookies)h.append('set-cookie',c);return new Response(null,{status:302,headers:h});};
export function accountRequest(request:Request,path:string,identity:Identity,hub=false,body?:unknown,method?:string){
  const url=new URL(TOOLS+path);if(!path.includes('?'))url.search=new URL(request.url).search;
  const headers=new Headers({'x-cail-identity-jwt':hub?identity.workspaceJwt!:identity.appJwt});
  const verb=method||request.method;
  if(!['GET','HEAD'].includes(verb)){headers.set('origin',TOOLS);headers.set('content-type','application/json');}
  return new Request(url,{method:verb,headers,body:body===undefined?(verb==='GET'||verb==='HEAD'?undefined:request.body):JSON.stringify(body),signal:request.signal});
}
export async function boundedBody(request:Request){
  const bytes=await request.arrayBuffer();if(bytes.byteLength>200000)throw new Error('Request too large');return JSON.parse(new TextDecoder().decode(bytes));
}
export async function suite(request:Request,env:SuiteEnv,app:(request:Request,identity:Identity|null)=>Promise<Response>):Promise<Response>{
 const url=new URL(request.url),path=url.pathname,sessionName='__Host-'+env.APP_ID+'-session',loginName='__Host-'+env.APP_ID+'-login';
 if(!['GET','HEAD','OPTIONS'].includes(request.method)&&(request.headers.get('origin')!==env.PUBLIC_ORIGIN||request.headers.get('sec-fetch-site')==='cross-site'))return json({error:{message:'Reload this page before continuing.'}},403);
 try{
  if(path==='/auth/start'){
   if(request.method!=='GET')return json({error:'Method not allowed'},405);
   if(!(await env.REQUEST_LIMIT.limit({key:'login:'+request.headers.get('cf-connecting-ip')})).success)return json({error:'Try again shortly'},429);
   const verifier=random(),state=random(),digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
   const challenge=btoa(String.fromCharCode(...Array.from(digest))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
   const result=await env.IDENTITY.begin(challenge,state),target=new URL(result.url);
   if(target.origin!==TOOLS||target.pathname!=='/worker-login')throw new Error('Invalid login target');
   return redirect(result.url,[cookie(loginName,encodeURIComponent(JSON.stringify({verifier,state,next:nextPath(url.searchParams.get('next'))})),600)]);
  }
  if(path==='/auth/callback'){
   if(request.method!=='GET')return json({error:'Method not allowed'},405);
   const raw=getCookie(request,loginName);if(!raw||raw.length>1500)return json({error:'Login expired'},401);
   const pending=JSON.parse(decodeURIComponent(raw));
   if(!/^[A-Za-z0-9_-]{43}$/.test(pending.verifier)||!/^[A-Za-z0-9_-]{43}$/.test(pending.state)||pending.state!==url.searchParams.get('state'))return json({error:'Login expired'},401);
   const result=await env.IDENTITY.redeem(url.searchParams.get('code')||'',pending.verifier);
   if(!result.ok||!result.token||!result.expiresAt)return json({error:'Login expired'},result.status||401);
   return redirect(nextPath(pending.next),[cookie(sessionName,result.token,Math.max(0,Math.floor((result.expiresAt-Date.now())/1000))),cookie(loginName,'',0)]);
  }
  const token=getCookie(request,sessionName);
  if(path==='/auth/logout'){
   if(request.method!=='POST')return json({error:'Method not allowed'},405);
   if(token)await env.IDENTITY.revoke(token);return redirect('/',[cookie(sessionName,'',0)]);
  }
  if(path==='/health'){await env.WORK_ACCOUNTS.register();return json({ok:true,app:env.APP_ID,release:env.RELEASE,accounts:'cail-work-accounts'});}
  const requiresIdentity=path==='/api/session'||path==='/api/auth/me'||path.startsWith('/api/work/')||path.startsWith('/my-work')||url.searchParams.has('work');
  const result=token&&requiresIdentity?await env.IDENTITY.identities(token):null;
  const identity=result?.ok?result:null;
  if(result&&!result.ok&&result.status!==401)return json({error:{message:'CUNY access is temporarily unavailable.'}},result.status);
  if(path==='/api/config')return json({model:env.CLOZE_MODEL,provider:'workers-ai',requiresLogin:false});
  if(path==='/api/session')return json({authenticated:Boolean(identity)});
  if(path==='/api/auth/me')return identity?json({userId:1,username:'CUNY'}):json({error:'CUNY Login required'},401);
  if(path.startsWith('/my-work')||url.searchParams.has('work')){
   if(!identity)return redirect('/auth/start?next='+encodeURIComponent(path+url.search));
   if(path.startsWith('/my-work'))return identity.workspaceJwt?env.WORKSPACE.fetch(accountRequest(request,path,identity,true)):json({error:'CUNY access required'},403);
  }
  if(path.startsWith('/api/work/'))return identity?env.WORK_ACCOUNTS.fetch(accountRequest(request,path,identity)):json({error:{message:'CUNY Login required'}},401);
  if(path==='/api/ai/chat'){
   if(request.method!=='POST')return json({error:'Method not allowed'},405);
   if(!(await env.REQUEST_LIMIT.limit({key:'ai:'+request.headers.get('cf-connecting-ip')})).success)return json({error:'Try again shortly'},429);
   let body;
   try { body=await boundedBody(request); }
   catch { return json({error:{message:'Invalid JSON request'}},400); }
   if(!body || !Array.isArray(body.messages) || body.messages.length===0 || body.messages.length>300 || body.messages.some((m:any)=>!m || !['system','user','assistant'].includes(m.role) || typeof m.content!=='string'))
    return json({error:{message:'Invalid model request'}},400);
   if(body.stream===true)return json({error:{message:'Use a complete response for this exercise.'}},400);
   const maxTokens=body.max_tokens??800,temperature=body.temperature??0.7;
   if(!Number.isInteger(maxTokens)||maxTokens<1||maxTokens>2048||typeof temperature!=='number'||!Number.isFinite(temperature)||temperature<0||temperature>2)
    return json({error:{message:'Invalid generation settings'}},400);
   const result=await env.AI.run(env.CLOZE_MODEL,{
    messages:body.messages,max_tokens:maxTokens,temperature,stream:false,
    chat_template_kwargs:{enable_thinking:false}
   });
   const content=result?.choices?.[0]?.message?.content??result?.response;
   if(typeof content!=='string'||!content.trim())return json({error:{message:'The model returned an empty response.'}},502);
   return json({model:env.CLOZE_MODEL,choices:[{index:0,message:{role:'assistant',content},finish_reason:result?.choices?.[0]?.finish_reason??'stop'}],...(result?.usage?{usage:result.usage}:{})});
  }
  return await app(request,identity);
 }catch{return json({error:{message:'The service is temporarily unavailable. Please retry.'}},503);}
}
