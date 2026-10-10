import { normalizeBookDescription } from './description-text.js?v=0.8.0-rc8';
// Bookfolio RC7 – Apple Books via the public iTunes Search API (JSONP).
// JSONP is needed for browser/Safari compatibility, including installed PWAs.
// Queries contain title/author/ISBN search terms only. No Supabase credentials.
const cache = new Map();
let sequence = 0, queue = Promise.resolve(), nextAllowed = 0;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const httpsUrl = value => {try { const url=new URL(String(value||'').replace(/^http:/i,'https:'));return url.protocol==='https:'&&!url.username&&!url.password ? url.toString():'';} catch{return '';} };

function trace(diagnostics, status, data) {
  if (!diagnostics) return;
  const results = Array.isArray(data?.results) ? data.results : [];
  diagnostics.requests?.push({provider:'Apple Books',kind:'Treffersuche',status,
    hits:status==='HTTP 200'||status==='Cache' ? results.length:null,
    described:status==='HTTP 200'||status==='Cache' ? results.filter(x=>!!x.description).length:null});
  if (status==='HTTP 200'||status==='Cache') diagnostics.successful++;
  else if(status!=='Abgebrochen'){
    const message='Apple Books: '+status;
    if(!diagnostics.errors.includes(message))diagnostics.errors.push(message);
  }
}
function requestJSONP(url, signal, timeoutMs=11000) {
  return new Promise((resolve, reject) => {
    if(signal?.aborted){reject(new DOMException('Abgebrochen','AbortError'));return;}
    const name='__bookfolioApple_'+(++sequence);
    const script=document.createElement('script');
    let complete=false;
    const cleanup=(error,data)=>{
      if(complete)return;
      complete=true;clearTimeout(timer);
      signal?.removeEventListener('abort',onAbort);
      delete window[name];script.remove();
      if(error)reject(error);else resolve(data);
    };
    const onAbort=()=>cleanup(new DOMException('Abgebrochen','AbortError'));
    const timer=setTimeout(()=>cleanup(Error('Zeitüberschreitung')),timeoutMs);
    signal?.addEventListener('abort',onAbort,{once:true});
    window[name]=data=>cleanup(null,data);
    script.onerror=()=>cleanup(Error('Netzwerkfehler'));
    script.async=true;
    script.referrerPolicy='no-referrer';
    script.src=url+'&callback='+encodeURIComponent(name);
    document.head.append(script);
  });
}
export async function queryAppleBooks(term,{signal,diagnostics,limit=25}={}){
  const query=String(term||'').trim().slice(0,150);
  if(query.length<2)return [];
  const url='https://itunes.apple.com/search?'+new URLSearchParams({term:query,media:'ebook',entity:'ebook',country:'DE',limit:String(Math.min(40,Math.max(1,limit)))});
  const cached=cache.get(url);
  if(cached && Date.now()-cached.at<10*60*1000){trace(diagnostics,'Cache',cached.data);return cached.data.results||[];}
  const task=queue.catch(()=>{}).then(async()=>{
    const delay=Math.max(0,nextAllowed-Date.now());if(delay)await wait(delay);
    if(signal?.aborted)throw new DOMException('Abgebrochen','AbortError');
    nextAllowed=Date.now()+900;
    const data=await requestJSONP(url,signal);
    if(!Array.isArray(data?.results))throw Error('Ungültige API-Antwort');
    if(cache.size>80)cache.delete(cache.keys().next().value);
    cache.set(url,{at:Date.now(),data});
    trace(diagnostics,'HTTP 200',data);
    return data.results;
  });
  queue=task.catch(()=>{});
  try{return await task;}
  catch(error){
    if(error?.name==='AbortError')throw error;
    trace(diagnostics,error.message||'Netzwerkfehler');
    return [];
  }
}
function appleAuthor(item){
  // iTunes artistName sometimes appends translators, e.g.
  // "Colson Whitehead & Nikolaus Stingl". Keep the first credited name as
  // primary author; never silently replace an existing user's authors.
  return String(item.artistName||'').split(/\s+(?:&|und|and)\s+/i)[0].trim();
}
export function appleCandidate(item){
  const original=String(item.artworkUrl512||item.artworkUrl100||item.artworkUrl60||'');
  const image=httpsUrl(original.replace(/100x100bb(?=\.)/,'600x600bb').replace(/100x100-75(?=\.)/,'600x600bb'));
  const title=String(item.trackName||item.collectionName||'').trim();
  const rawDescription=String(item.description||'');
  // Decode numeric and named HTML entities; preserve catalogue paragraphs.
  const description=normalizeBookDescription(rawDescription).slice(0,4000);
  const displayAuthor=appleAuthor(item);
  const knownLanguage=String(item.language||'').toLowerCase();
  return {source:'Apple Books',title,author:displayAuthor,authors:displayAuthor?[displayAuthor]:[],
    source_artist:String(item.artistName||''),apple_id:String(item.trackId||item.collectionId||''),
    cover_url:image, description,description_source:description?'Apple Books':'',
    description_source_url:httpsUrl(item.trackViewUrl||item.collectionViewUrl),
    isbn:'',isbns:[],pages:null,published_year:Number(String(item.releaseDate||'').slice(0,4))||null,
    language:knownLanguage==='de'?'Deutsch':knownLanguage==='en'?'Englisch':''};
}
export function appleMatch(book,item){
  const candidate=appleCandidate(item);
  const title=normalize(book.title),found=normalize(candidate.title);
  const author=normalize(book.author),rawArtist=normalize(item.artistName);
  if(!title||!found)return 0;
  const titleFit=title===found?1:(found.startsWith(title+' ')||title.startsWith(found+' '))?.9:
    title.split(' ').filter(t=>found.split(' ').includes(t)).length/Math.max(1,title.split(' ').length);
  if(titleFit<.77)return 0;
  const last=author.split(' ').at(-1);
  const authorFit=!author?.5:(rawArtist.includes(author)|| (last?.length>=4&&rawArtist.split(' ').includes(last)))?1:0;
  if(author&&authorFit===0)return 0;
  return .75*titleFit+.25*authorFit;
}
