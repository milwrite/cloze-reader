// One saved exercise includes the passage, blanks, answers, progress, and hint conversations.
const fields=['originalText','clozeText','blanks','userAnswers','score','currentRound','currentLevel','contextualization','hints','lastResults','passagesPassedAtCurrentLevel','attemptCounts'];
const encode=value=>JSON.parse(JSON.stringify(value,(_key,v)=>v instanceof Map?{map:[...v]}:v instanceof Set?{set:[...v]}:v));
const decode=value=>JSON.parse(JSON.stringify(value),(_key,v)=>v&&typeof v==='object'?(Array.isArray(v.map)&&Object.keys(v).length===1?new Map(v.map):Array.isArray(v.set)&&Object.keys(v).length===1?new Set(v.set):v):v);
export function snapshot(app){
 const game=app.game,record={game:{},chat:{},inputs:[...app.elements.passageContent.querySelectorAll('.cloze-input')].map(i=>({value:i.value,disabled:i.disabled,className:i.className})),ui:{currentResults:app.currentResults,isRetrying:app.isRetrying,lastRevealWasSkip:app.lastRevealWasSkip,currentHints:app.currentHints||[],result:app.elements.result.textContent,nextVisible:!app.elements.nextBtn.classList.contains('hidden'),submitVisible:app.elements.submitBtn.style.display!=='none',submitText:app.elements.submitBtn.textContent}};
 for(const field of fields)record.game[field]=game[field];
 record.game.currentBook=game.currentBook?{title:game.currentBook.title,author:game.currentBook.author,year:game.currentBook.year||null}:null;
 record.game.lockedBlanks=game.lockedBlanks;
 record.chatUI={messageHistory:app.chatUI?.messageHistory||new Map()};
 for(const key of ['conversations','wordContexts','blankQuestions','currentLevel'])record.chat[key]=game.chatService[key];
 return {schemaVersion:1,contributions:[],text:game.originalText||'',reading:'',settings:{},record:encode(record)};
}
export async function restore(app,content){
 const record=decode(content.record);
 if(!record.game||typeof record.game.originalText!=='string'||!Array.isArray(record.game.blanks)||!record.game.currentBook)throw new Error('This file does not contain a saved Cloze exercise.');
 for(const key of fields)app.game[key]=record.game[key];
 app.game.currentBook=record.game.currentBook;app.game.lockedBlanks=record.game.lockedBlanks instanceof Set?record.game.lockedBlanks:new Set();
 for(const key of ['conversations','wordContexts','blankQuestions','currentLevel'])if(record.chat?.[key]!==undefined)app.game.chatService[key]=record.chat[key];
 app.resetUI();
 app.displayRound({title:app.game.currentBook.title,author:app.game.currentBook.author,blanks:app.game.blanks,contextualization:app.game.contextualization,hints:app.game.hints});
 Object.assign(app,{currentResults:record.ui?.currentResults||null,isRetrying:!!record.ui?.isRetrying,lastRevealWasSkip:!!record.ui?.lastRevealWasSkip,currentHints:record.ui?.currentHints||app.game.hints});
 [...app.elements.passageContent.querySelectorAll('.cloze-input')].forEach((input,index)=>{const saved=record.inputs?.[index];if(saved){input.value=saved.value;input.disabled=saved.disabled;input.className=saved.className;}});
 app.elements.result.textContent=record.ui?.result||'';
 app.elements.nextBtn.classList.toggle('hidden',!record.ui?.nextVisible);
 app.elements.submitBtn.style.display=record.ui?.submitVisible===false?'none':'inline-block';
 app.elements.submitBtn.textContent=record.ui?.submitText||'Submit';
 if(app.chatUI)app.chatUI.messageHistory=record.chatUI?.messageHistory instanceof Map?record.chatUI.messageHistory:new Map();
 app.updateSubmitButton();app.showLoading(false);
}
export default class AccountWork {
 constructor(app){this.app=app;this.id=crypto.randomUUID();this.revision=0;this.previous='';this.pending=Promise.resolve(true);this.ready=false;this.authenticated=false;}
 async api(path,method='GET',body){const response=await fetch('/api/work'+path,{method,headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw new Error(data.error?.message||'Your exercise could not be saved.');return data;}
 async initialize(){
  const nav=document.createElement('nav');nav.className='suite-account';nav.setAttribute('aria-label','CUNY account');
  this.link=document.createElement('a');this.link.textContent='CUNY Login';this.link.href='/auth/start?next=/';
  this.status=document.createElement('span');this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');nav.append(this.status,this.link);document.body.prepend(nav);
  try {
   const response=await fetch('/api/session');
   this.authenticated=response.ok && (await response.json()).authenticated===true;
  } catch { this.authenticated=false; }
  if(this.authenticated){this.link.textContent='My work';this.link.href='/my-work/';}
  this.link.onclick=async e=>{e.preventDefault();if(await this.save())location.assign(this.link.href);};
  window.addEventListener('beforeunload',event=>{if(this.authenticated&&this.ready&&this.app.game.originalText&&JSON.stringify(snapshot(this.app))!==this.previous){event.preventDefault();event.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void this.save();});
  if(this.authenticated){
   const label=document.createElement('label');label.textContent='Import';label.style.cursor='pointer';const file=document.createElement('input');file.type='file';file.accept='.json';file.hidden=true;label.append(file);nav.append(label);
   file.onchange=async()=>{const selected=file.files[0];if(!selected)return;if(selected.size>192000){this.status.textContent='The exercise file is too large.';return;}try{const data=JSON.parse(await selected.text());const content=data.content||data;if(!content.record?.game)throw new Error('Choose a Cloze exercise export.');if(!await this.save())return;await restore(this.app,content);this.id=crypto.randomUUID();this.revision=0;this.previous='';await this.save();}catch(error){this.status.textContent=error.message;}finally{file.value='';}};
  }
  const id=new URLSearchParams(location.search).get('work');
  if(id){const {item}=await this.api('/entries/'+encodeURIComponent(id));await restore(this.app,item.content);this.id=item.id;this.revision=item.revision;this.previous=JSON.stringify(snapshot(this.app));this.ready=true;return true;}
  // A guest's current round survives the CUNY handoff without moving browser credentials.
  let draft;try{draft=JSON.parse(sessionStorage.getItem('cloze-login-draft')||'null');}catch{}
  if(draft){await restore(this.app,draft);sessionStorage.removeItem('cloze-login-draft');this.ready=true;await this.save();return true;}
  this.ready=true;return false;
 }
 changed(){clearTimeout(this.timer);this.timer=setTimeout(()=>void this.save(),500);}
 save(){
  clearTimeout(this.timer);
  this.pending=this.pending.then(async()=>{
   if(!this.ready||!this.app.game.originalText)return true;
   const content=snapshot(this.app),serialized=JSON.stringify(content);
   if(!this.authenticated){sessionStorage.setItem('cloze-login-draft',serialized);return true;}
   if(serialized===this.previous)return true;
   try{this.status.textContent='Saving…';const {item}=await this.api('/entries','PUT',{id:this.id,app:'cloze',kind:'exercise',title:(this.app.game.currentBook.title+' · Round '+this.app.game.currentRound).slice(0,120),expectedRevision:this.revision,content});this.revision=item.revision;this.previous=serialized;this.status.textContent='Saved';history.replaceState(null,'','/?work='+encodeURIComponent(this.id));return true;}
   catch(error){this.status.textContent=error.message;return false;}
  }).catch(error=>{this.status.textContent=error.message;return false;});return this.pending;
 }
 async newRound(){if(!await this.save())return false;this.id=crypto.randomUUID();this.revision=0;this.previous='';return true;}
}
