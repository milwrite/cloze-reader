import {suite,json,type SuiteEnv} from './suite';
interface Env extends SuiteEnv {LEGACY_DB:{prepare(sql:string):{all():Promise<{results:any[]}>}}}
export default {fetch(request:Request,env:Env){return suite(request,env,async(req)=>{
 const url=new URL(req.url),path=url.pathname;
 // Retain the current Railway dataset/Redis runtime while the game and CUNY artifacts live here.
 const allowed=(req.method==='GET'&&/^\/api\/(?:books\/(?:rows|splits)|leaderboard|health)$/.test(path))||(req.method==='POST'&&['/api/leaderboard/add','/api/analytics/passage'].includes(path));
 if(allowed){
  const headers=new Headers();if(req.headers.has('content-type'))headers.set('content-type',req.headers.get('content-type')!);
  const upstream=await fetch(env.LEGACY_ORIGIN+path+url.search,{method:req.method,headers,body:req.method==='GET'?undefined:req.body,signal:req.signal});
  // Old Cloudflare leaderboard remains visible alongside the active Railway history.
  if(path==='/api/leaderboard'&&upstream.ok){
   const data:any=await upstream.json();
   const old=await env.LEGACY_DB.prepare('SELECT initials,level,round,passages_passed,date FROM leaderboard ORDER BY level DESC,round DESC LIMIT 100').all();
   const rows=[...(data.leaderboard||[]),...old.results];
   const seen=new Set();data.leaderboard=rows.filter((r:any)=>{const key=JSON.stringify([r.initials,r.level,r.round,r.date]);if(seen.has(key))return false;seen.add(key);return true;}).sort((a:any,b:any)=>b.level-a.level||b.round-a.round).slice(0,100);
   return json(data);
  }
  return new Response(upstream.body,{status:upstream.status,headers:{'content-type':upstream.headers.get('content-type')||'application/json','cache-control':'no-store'}});
 }
 if(path.startsWith('/api/'))return json({error:'Not found'},404);
 return env.ASSETS.fetch(req);
 });}};
