import { queryAppleBooks, appleCandidate, appleMatch } from './apple-books.js?v=0.8.0-rc7';
// Bookfolio V0.8.0 RC5: German-first catalogue lookup with provider-aware HTTP 429 pause.
// Requests contain bibliographic information only; no account keys or reading notes.
const FIELDS = ['cover_url', 'isbn', 'pages', 'published_year', 'language', 'description'];
export const META_FIELDS = FIELDS;

export function cleanText(value) {
  const plain = String(value || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
  return plain;
}
export function shortDescription(input, limit = 520) {
  const text = cleanText(input);
  if (text.length <= limit) return text;
  const sample = text.slice(0, limit + 1);
  const stops = [...sample.matchAll(/[.!?](?=\s|$)/g)].map(x => x.index + 1);
  const stop = stops.filter(n => n > 150 && n <= limit).pop();
  return stop ? sample.slice(0, stop).trim() : sample.slice(0, limit).replace(/\s+\S*$/, '').trim() + ' …';
}
const norm = text => String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('de')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function matchScore(book, candidate) {
  const title = norm(book.title), foundTitle = norm(candidate.title);
  if (!title || !foundTitle) return 0;
  const a = title.split(' ').filter(Boolean), b = foundTitle.split(' ').filter(Boolean);
  const overlap = a.filter(word => b.includes(word)).length / Math.max(1, a.length);
  const titleFit = title === foundTitle ? 1 : (foundTitle.startsWith(title + ' ') || title.startsWith(foundTitle + ' ')) ? .91 : overlap;
  const author = norm(book.author), ca = norm(candidate.author || (candidate.authors || []).join(' '));
  const candidateAuthors=(candidate.authors || [candidate.author]).map(norm);
  // Compare complete author names or their last name, not first names: "David"
  // alone must not identify a book as written by David Wengrow.
  const lastNames = String(book.author || '').split(/[,;]|\s+und\s+|\s+and\s+|\s+&\s+/i)
    .map(name=>norm(name).split(' ').at(-1)).filter(name=>name?.length>=3);
  const authorFit = !author ? .5 :
    (ca===author || ca.includes(author) || candidateAuthors.some(name=>name===author)) ? 1 :
    (lastNames.some(last=>candidateAuthors.some(name=>name.split(' ').at(-1)===last))) ? .9 : 0;
  const sameIsbn = book.isbn && (candidate.isbns || []).some(v => v.replace(/[^0-9X]/gi,'') === String(book.isbn).replace(/[^0-9X]/gi,''));
  if (sameIsbn) return 1;
  if (titleFit < .75 || (author && authorFit < .6)) return 0;
  return .65 * titleFit + .35 * authorFit;
}
export function missingFields(book) {
  return FIELDS.filter(key => book[key] === null || book[key] === undefined || book[key] === '');
}
export function makeMetadataPatch(book, candidate, { selectedCover = null, replaceCover = false } = {}) {
  const out = {};
  for (const key of FIELDS) {
    const value = key === 'cover_url' && selectedCover ? selectedCover : candidate[key];
    if (value === null || value === undefined || value === '') continue;
    if (key === 'cover_url' && replaceCover) { out.cover_url = value; continue; }
    if (book[key] === null || book[key] === undefined || book[key] === '') out[key] = value;
  }
  if (out.description) {
    out.description_source = candidate.description_source || '';
    out.description_source_url = candidate.description_source_url || '';
  }
  return out;
}
// Browsers cannot reliably set a User-Agent header. Respect the conservative
// anonymous Open Library limit instead, even for overlapping book lookups.
const queued = { openLibrary:Promise.resolve(), google:Promise.resolve() };
const nextRequest = { openLibrary:0, google:0 };
// Google's anonymous API can return HTTP 429 across independent title lookups.
// One denied request should not cause further searches or immediate retries.
const GOOGLE_PAUSE_KEY='bookfolio-google-books-paused-until';
let googlePauseUntil=0;
function googlePauseRemaining(){
  let stored=0;
  try{stored=Number(localStorage.getItem(GOOGLE_PAUSE_KEY))||0;}catch{}
  const until=Math.max(googlePauseUntil,stored);
  return Math.max(0,until-Date.now());
}
function pauseGoogle(response){
  const value=response.headers?.get?.('Retry-After');
  const numeric=Number(value);
  const delay= value && Number.isFinite(numeric) && numeric>0 ? numeric*1000 :
    value && Number.isFinite(Date.parse(value)) ? Date.parse(value)-Date.now() : 0;
  // 15 minutes unless the provider asks us to wait longer (max. 1 hour).
  const milliseconds=Math.min(60*60*1000,Math.max(15*60*1000,delay||0));
  googlePauseUntil=Date.now()+milliseconds;
  try{localStorage.setItem(GOOGLE_PAUSE_KEY,String(googlePauseUntil));}catch{}
}
const responseCache=new Map();
const wait = ms=>new Promise(resolve=>setTimeout(resolve,ms));
const originName = url=>new URL(url).hostname.includes('openlibrary.org')?'openLibrary':'google';
const providerName = name=>name==='openLibrary'?'Open Library':'Google Books';
function throttle(provider, signal) {
  const delay = provider==='openLibrary' ? 1200 : 800;
  const turn = queued[provider].catch(()=>{}).then(async()=>{
    if(signal?.aborted)throw new DOMException('Abgebrochen','AbortError');
    const remaining=Math.max(0,nextRequest[provider]-Date.now());
    if(remaining)await wait(remaining);
    if(signal?.aborted)throw new DOMException('Abgebrochen','AbortError');
    nextRequest[provider]=Date.now()+delay;
  });
  queued[provider]=turn.catch(()=>{});
  return turn;
}
function recordIssue(diagnostics, provider, reason, retryable=false) {
  if(!diagnostics)return;
  const message=`${providerName(provider)}: ${reason}`;
  if(!diagnostics.errors.includes(message))diagnostics.errors.push(message);
  if(retryable)diagnostics.retryable=true;
}
const newDiagnostics=()=>({errors:[],retryable:false,successful:0,requests:[]});
function traceRequest(diagnostics,url){
  if(!diagnostics)return null;
  const u=new URL(url),provider=originName(url);
  const kind=u.pathname.endsWith('/search.json')?'Treffersuche':
    /\/volumes\/[^/]+$/.test(u.pathname)?'Vollständiger Buchdatensatz':
    u.pathname.endsWith('/volumes')?'Treffersuche':
    u.pathname.endsWith('/editions.json')?'Ausgabenliste':'Werkbeschreibung';
  const row={provider:providerName(provider),kind,status:'Ausstehend',hits:null,described:null};
  if(diagnostics.requests.length<40)diagnostics.requests.push(row);
  return row;
}
function finishTrace(row,data,status){
  if(!row)return;
  row.status=status;
  const entries=data?.items||data?.docs||data?.entries;
  if(Array.isArray(entries)){
    row.hits=entries.length;
    row.described=entries.filter(item=>!!(item.volumeInfo?.description||item.description)).length;
  }else if(data){row.hits=1;row.described=Number(!!(data.volumeInfo?.description||data.description));}
}
const isGerman = book=>/^(de|ger|deutsch)/i.test(String(book?.language||''));

async function getJSON(url, signal, diagnostics=null) {
  const provider=originName(url);
  const cached=responseCache.get(url);
  if(cached && Date.now()-cached.at<10*60*1000){
    const trace=traceRequest(diagnostics,url);
    if(diagnostics)diagnostics.successful++;
    finishTrace(trace,cached.data,'Cache');
    return cached.data;
  }
  const paused=()=>provider==='google'&&googlePauseRemaining()>0;
  const pausedResult=()=>{
    if(!diagnostics?.googlePauseReported){
      const row=traceRequest(diagnostics,url);
      finishTrace(row,null,'Google Books pausiert (HTTP 429)');
      if(diagnostics)diagnostics.googlePauseReported=true;
    }
    recordIssue(diagnostics,'google','HTTP 429 – Zugriffslimit; 15 Minuten pausiert. Bitte später erneut suchen.',true);
    return null;
  };
  if(paused())return pausedResult();
  const trace=traceRequest(diagnostics,url);
  for(let attempt=0;attempt<3;attempt++){
    if(signal?.aborted)throw new DOMException('Abgebrochen','AbortError');
    await throttle(provider,signal);
    // Other requests may have received 429 while this one was queued.
    if(paused()){
      finishTrace(trace,null,'Wegen HTTP 429 nicht gesendet');
      recordIssue(diagnostics,'google','HTTP 429 – Zugriffslimit; 15 Minuten pausiert. Bitte später erneut suchen.',true);
      return null;
    }
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8500);
    const abort=()=>controller.abort();
    signal?.addEventListener('abort',abort,{once:true});
    try{
      const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
      if(response.status===404){finishTrace(trace,null,'HTTP 404');return null;}
      if(response.ok){
        const data=await response.json();
        if(responseCache.size>120)responseCache.delete(responseCache.keys().next().value);
        responseCache.set(url,{at:Date.now(),data});
        if(diagnostics)diagnostics.successful++;
        finishTrace(trace,data,'HTTP '+response.status);
        return data;
      }
      if(response.status===429 && provider==='google'){
        pauseGoogle(response);
        finishTrace(trace,null,'HTTP 429');
        recordIssue(diagnostics,provider,'HTTP 429 – Zugriffslimit; 15 Minuten pausiert. Bitte später erneut suchen.',true);
        return null;
      }
      if([429,502,503,504].includes(response.status) && attempt<2){
        const retryHeader=Number(response.headers?.get?.('Retry-After'));
        const retryDelay=Number.isFinite(retryHeader)&&retryHeader>0 ? Math.min(retryHeader*1000,6000) : 900*(attempt+1);
        await wait(retryDelay);continue;
      }
      finishTrace(trace,null,'HTTP '+response.status);
      recordIssue(diagnostics,provider,response.status===429?'Zugriffslimit erreicht':`HTTP ${response.status}`,[429,502,503,504].includes(response.status));
      return null;
    }catch(err){
      if(signal?.aborted)throw err;
      const timeoutHit=controller.signal.aborted;
      if(attempt<2){await wait(800*(attempt+1));continue;}
      finishTrace(trace,null,timeoutHit?'Zeitüberschreitung':'Netzwerkfehler');
      recordIssue(diagnostics,provider,timeoutHit?'Zeitüberschreitung':'Netzwerkfehler',true);
      return null;
    }finally{
      clearTimeout(timeout);signal?.removeEventListener('abort',abort);
    }
  }
  return null;
}
const year = v => Number(String(v || '').match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/)?.[1]) || null;
const olCover = id => id ? `https://covers.openlibrary.org/b/id/${Number(id)}-L.jpg` : '';
const safeImage = url => {
  try { const u = new URL(String(url).replace(/^http:/,'https:')); return u.protocol==='https:' ? u.toString() : ''; }
  catch { return ''; }
};
const olDesc = value => typeof value === 'string' ? value : (value?.value || '');

const bareTitle = title=>String(title||'').replace(/\s+(?:a novel|a thriller|ein roman|roman)$/i,'')
  .split(/\s+[:–—]\s+/)[0].trim();
const leadAuthor = author=>String(author||'').split(/[,;]|\s+und\s+|\s+and\s+|\s+&\s+/i)[0].trim();
const volumeCandidate = item=>{
  const v=item.volumeInfo||{};
  return {
    title:v.title||'', author:(v.authors||[]).join(', '), authors:v.authors||[],
    isbns:(v.industryIdentifiers||[]).map(x=>x.identifier),
    cover_url:safeImage(v.imageLinks?.thumbnail||v.imageLinks?.smallThumbnail),
    isbn:(v.industryIdentifiers||[]).find(x=>x.type==='ISBN_13')?.identifier||'',
    pages:v.pageCount||null, published_year:year(v.publishedDate),
    language:v.language==='de'?'Deutsch':v.language==='en'?'Englisch':'',
    description:shortDescription(v.description||''),description_source:'Google Books',
    description_source_url:safeImage(v.infoLink||''), source:'Google Books', volume_id:item.id||''
  };
};
const workCandidate = d=>({
  title:d.title,authors:d.author_name||[],author:(d.author_name||[]).join(', '),isbns:d.isbn||[],
  cover_url:olCover(d.cover_i),isbn:d.isbn?.[0]||'',pages:d.number_of_pages_median||null,
  published_year:d.first_publish_year||null,
  language:(d.language||[]).includes('ger')?'Deutsch':(d.language||[]).includes('eng')?'Englisch':'',
  work_key:/^(?:\/works\/)?OL\d+W$/.test(d.key||'') ? (d.key.startsWith('/')?d.key:`/works/${d.key}`) : '',source:'Open Library'
});
function classifyDescription(book, candidate) {
  return candidate.description ? (candidate.language==='Deutsch'?3 : candidate.language==='Englisch'?1:2) : 0;
}
function bestDescription(book, candidates, germanOnly=false) {
  return candidates.filter(c=>c.description&&matchScore(book,c)>=.75)
    .filter(c=>!germanOnly||c.language==='Deutsch')
    .sort((a,b)=>classifyDescription(book,b)-classifyDescription(book,a)||matchScore(book,b)-matchScore(book,a))[0]||null;
}
function catalogUnavailable(diagnostics){
  return diagnostics.successful===0 && diagnostics.errors.length>0;
}
function unavailableError(diagnostics){
  const err=new Error(`Buchkataloge nicht erreichbar (${diagnostics.errors.join('; ')}). Bitte später erneut versuchen.`);
  err.diagnostics=diagnostics;return err;
}

// The ISBN often identifies an edition whose catalogue record has no blurb.
// Retry by work/title and author, and take the synopsis from a *different*
// edition only after validating that it is the same title and author.
// The Google Books search endpoint can omit a synopsis even if the book's
// individual volume record has one. Ask for full details of a few strictly
// title/author-matched volumes before concluding that no synopsis exists.
async function getFullGoogleDescription(book, candidates, signal, diagnostics) {
  const seen = new Set();
  const matches = candidates.filter(c => c.volume_id && matchScore(book,c) >= .75 && !c.description)
    .sort((a,b) => Number(b.language==='Deutsch')-Number(a.language==='Deutsch') || matchScore(book,b)-matchScore(book,a));
  let best = null;
  for (const candidate of matches) {
    if (seen.size >= 8 || signal?.aborted || googlePauseRemaining()>0) break;
    if (seen.has(candidate.volume_id)) continue;
    seen.add(candidate.volume_id);
    if (!/^[\w-]+$/.test(candidate.volume_id)) continue;
    const full = await getJSON(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(candidate.volume_id)}`,signal,diagnostics);
    if (!full) continue;
    const enriched = volumeCandidate(full);
    if (!enriched.description || matchScore(book,enriched)<.75)continue;
    if (!best || classifyDescription(book,enriched)>classifyDescription(book,best))best=enriched;
    if (enriched.language==='Deutsch' || !isGerman(book))break;
  }
  return best;
}

async function findAlternateGoogleDescription(book,signal,diagnostics=newDiagnostics(),startingCandidates=[]){
  let best=bestDescription(book,startingCandidates);
  if(best?.language==='Deutsch')return best;
  const title=bareTitle(book.title), author=leadAuthor(book.author);
  const queries=[
    {q:`intitle:${title}${author?` inauthor:${author}`:''}`,langRestrict:'de'},
    {q:[title,author].filter(Boolean).join(' '),langRestrict:'de'},
    {q:`intitle:${title}`,langRestrict:'de'},
    {q:`intitle:${title}${author?` inauthor:${author}`:''}`},
    {q:[title,author].filter(Boolean).join(' ')}
  ];
  const candidates=[...startingCandidates];
  for(const params of queries){
    if(signal?.aborted || googlePauseRemaining()>0)break;
    if(!params.q.trim())continue;
    const search=await getJSON(`https://www.googleapis.com/books/v1/volumes?${new URLSearchParams({...params,maxResults:'30',printType:'books'})}`,signal,diagnostics);
    const editions=(search?.items||[]).map(volumeCandidate);
    candidates.push(...editions);
    const found=bestDescription(book,editions);
    if(found?.language==='Deutsch')return found;
    if(found&&(!best||classifyDescription(book,found)>classifyDescription(book,best)))best=found;
    if(best && !params.langRestrict && !isGerman(book))break;
  }
  // A full-volume response may contain a description omitted in search results.
  // Keep this bounded (max. eight detail requests) to avoid unnecessary traffic.
  if (!best || (isGerman(book) && best.language!=='Deutsch')){
    const fromDetails=await getFullGoogleDescription(book,candidates,signal,diagnostics);
    if(fromDetails&&(!best||classifyDescription(book,fromDetails)>classifyDescription(book,best)))best=fromDetails;
  }
  return best;
}

export async function lookupBookMetadata(book, {signal, withVariants = false} = {}) {
  if (!book?.title) return null;
  const diagnostics=newDiagnostics();
  const isbn=String(book.isbn||'').replace(/[^0-9X]/gi,'');
  const fields='key,title,author_name,cover_i,isbn,number_of_pages_median,first_publish_year,language';
  const olParams=new URLSearchParams({title:book.title,limit:'12',fields});
  if(book.author)olParams.set('author',leadAuthor(book.author));
  // One Apple search + one Open Library search first. Google is last resort.
  const [appleRaw,olInitial]=await Promise.all([
    queryAppleBooks([bareTitle(book.title),leadAuthor(book.author)].filter(Boolean).join(' '),{signal,diagnostics}),
    getJSON(`https://openlibrary.org/search.json?${olParams}`,signal,diagnostics)
  ]);
  const parseOL=data=>(data?.docs||[]).map(workCandidate).map(c=>({...c,score:matchScore(book,c)})).filter(c=>c.score>=.75).sort((a,b)=>b.score-a.score);
  const apples=appleRaw.map(appleCandidate).map((c,i)=>({...c,score:appleMatch(book,appleRaw[i])}))
    .filter(c=>c.score>=.78).sort((a,b)=>b.score-a.score || Number(!!b.description)-Number(!!a.description) || Number(!!b.cover_url)-Number(!!a.cover_url));
  let olMatches=parseOL(olInitial);
  if(!olMatches.length){
    const wide=await getJSON(`https://openlibrary.org/search.json?${new URLSearchParams({title:book.title,limit:'25',fields})}`,signal,diagnostics);
    olMatches=parseOL(wide);
  }
  let bestApple=apples[0]||null,bestOL=olMatches[0]||null,bestGB=null,gbMatches=[];
  const missingPrimary=!(bestApple?.cover_url||book.cover_url)||!(bestApple?.description||book.description);
  // Avoid hammering Google Books if Apple has already supplied cover + text.
  if(missingPrimary){
    const gParams=new URLSearchParams({q:isbn?`isbn:${isbn}`:[bareTitle(book.title),leadAuthor(book.author)].join(' '),maxResults:'20',printType:'books'});
    const google=await getJSON(`https://www.googleapis.com/books/v1/volumes?${gParams}`,signal,diagnostics);
    gbMatches=(google?.items||[]).map(volumeCandidate).map(c=>({...c,score:matchScore(book,c)})).filter(c=>c.score>=.75).sort((a,b)=>b.score-a.score);
    bestGB=gbMatches[0]||null;
  }
  if(!bestApple&&!bestOL&&!bestGB){
    if(catalogUnavailable(diagnostics))throw unavailableError(diagnostics);
    return null;
  }
  const variants=[];
  const addCover=(url,label)=>{url=safeImage(url);if(url&&!variants.some(v=>v.url===url))variants.push({url,label});};
  for(const c of apples.slice(0,5))addCover(c.cover_url,'Apple Books');
  addCover(bestOL?.cover_url,'Open Library');addCover(bestGB?.cover_url,'Google Books');
  for(const c of olMatches.slice(1,5))addCover(c.cover_url,'Andere Ausgabe');
  if(withVariants&&bestOL?.work_key){
    const editions=await getJSON(`https://openlibrary.org${bestOL.work_key}/editions.json?limit=25`,signal,diagnostics);
    for(const ed of editions?.entries||[]){
      for(const cover of (ed.covers||[]).slice(0,2))addCover(olCover(cover),ed.publish_date||'Andere Ausgabe');
      if(variants.length>=8)break;
    }
  }
  let description=bestApple?.description||bestGB?.description||'';
  let source=bestApple?.description?'Apple Books':bestGB?.description?'Google Books':'';
  let sourceUrl=bestApple?.description?bestApple.description_source_url:bestGB?.description?bestGB.description_source_url:'';
  if(!description&&bestOL?.work_key){
    const work=await getJSON(`https://openlibrary.org${bestOL.work_key}.json`,signal,diagnostics);
    description=shortDescription(olDesc(work?.description));
    if(description){source='Open Library';sourceUrl=`https://openlibrary.org${bestOL.work_key}`;}
  }
  if(!description&&bestGB){
    const alt=await findAlternateGoogleDescription(book,signal,diagnostics,gbMatches);
    if(alt?.description){description=alt.description;source=alt.description_source;sourceUrl=alt.description_source_url;}
  }
  const principal=bestApple||bestOL||bestGB;
  return {
    cover_url:bestApple?.cover_url||bestOL?.cover_url||bestGB?.cover_url||'',
    // Do not invent an Apple ISBN. Open Library's ISBN may refer to another edition.
    isbn:isbn||'',
    pages:bestOL?.pages||bestGB?.pages||null,
    published_year:bestOL?.published_year||bestGB?.published_year||bestApple?.published_year||null,
    language:book.language||bestOL?.language||bestGB?.language||bestApple?.language||'',
    description,description_source:source,description_source_url:sourceUrl,
    variants:variants.slice(0,8),matched_title:principal.title,matched_author:principal.author,
    confidence:principal.score,description_language:source==='Apple Books'?'':bestGB?.language||'',
    description_status:description?'found':diagnostics.errors.length?'request_failed':'not_in_catalog',
    lookup_warnings:diagnostics.errors,
    lookup_diagnostics:{requests:diagnostics.requests,matches:{apple:apples.length,openLibrary:olMatches.length,google:gbMatches.length,googleWithDescription:gbMatches.filter(c=>c.description).length}}
  };
}

// Manual catalogue search: unlike automatic matching, show plausible candidates to
// the reader. A shortened surname such as "Wengro" can match "Wengrow".
function manualQueryFit(query, candidate) {
  const terms = norm(query).split(' ').filter(Boolean);
  if (!terms.length) return 0;
  const title = norm(candidate.title), authors = norm((candidate.authors || []).join(' ') || candidate.author);
  const words = `${title} ${authors}`.split(' ').filter(Boolean);
  const matched = terms.filter(term => words.some(word => word === term || word.startsWith(term))).length;
  const isbns = [candidate.isbn,...(candidate.isbns||[])].map(x=>String(x||'').replace(/[^0-9X]/gi, ''));
  const searchedIsbn=query.replace(/[-\s]/g,'');
  const isbnMatch = /^\d{10,13}$/.test(searchedIsbn) && isbns.some(x=>x===searchedIsbn);
  if (isbnMatch) return 10;
  if (!matched) return 0;
  return matched / terms.length + (title.includes(norm(query)) ? .20 : 0) + (authors.includes(norm(query)) ? .12 : 0);
}
export async function searchBookCatalog(query,{signal}={}){
  const term=String(query||'').trim().slice(0,150);
  if(term.length<2)return [];
  const isbn=term.replace(/[^0-9X]/gi,'');
  const isIsbn=/^\d{10}(?:\d{3})?$/.test(isbn)&&/^[\dX\s-]+$/i.test(term);
  const fields='key,title,author_name,cover_i,isbn,number_of_pages_median,first_publish_year,language';
  const diagnostics=newDiagnostics();
  const [appleResults,olData]=await Promise.all([
    isIsbn?Promise.resolve([]):queryAppleBooks(term,{signal,diagnostics}),
    getJSON(`https://openlibrary.org/search.json?${new URLSearchParams({q:isIsbn?`isbn:${isbn}`:term,fields,limit:'35'})}`,signal,diagnostics)
  ]);
  const all=appleResults.map(appleCandidate);
  for(const d of olData?.docs||[]){
    if(!d.title)continue;
    all.push({...workCandidate(d),source:'Open Library'});
  }
  if(!all.length){
    // Only ask Google when both primary catalogues did not find a candidate.
    const gData=await getJSON(`https://www.googleapis.com/books/v1/volumes?${new URLSearchParams({q:isIsbn?`isbn:${isbn}`:term,maxResults:'20',printType:'books'})}`,signal,diagnostics);
    all.push(...(gData?.items||[]).map(volumeCandidate));
  }
  if(!all.length&&catalogUnavailable(diagnostics))throw unavailableError(diagnostics);
  const unique=new Set();
  return all.map(c=>({...c,relevance:manualQueryFit(term,c)}))
    .filter(c=>c.relevance>0)
    .sort((a,b)=>b.relevance-a.relevance||Number(!!b.description)-Number(!!a.description)||Number(!!b.cover_url)-Number(!!a.cover_url))
    .filter(c=>{
      const key=c.apple_id?`apple:${c.apple_id}`:c.work_key?`ol:${c.work_key}`:`${c.source}:${norm(c.title)}:${norm(c.author)}`;
      if(unique.has(key))return false;unique.add(key);return true;
    }).slice(0,24);
}

// Fetch details ONLY for the result explicitly selected by the user. Never
// silently substitute the first title/author match from an automatic lookup.
export async function lookupSelectedCatalogBook(candidate, {signal} = {}) {
  if (!candidate?.title) return null;
  const diagnostics=newDiagnostics();
  let description = candidate.description || '';
  let description_source = candidate.description_source || '';
  let description_source_url = candidate.description_source_url || '';
  const variants = [], seen = new Set();
  const add = (url,label) => {url=safeImage(url);if(url&&!seen.has(url)){seen.add(url);variants.push({url,label});}};
  add(candidate.cover_url,candidate.source);
  if(candidate.source==='Open Library' && candidate.work_key){
    const [work,editions] = await Promise.all([
      getJSON(`https://openlibrary.org${candidate.work_key}.json`,signal,diagnostics),
      getJSON(`https://openlibrary.org${candidate.work_key}/editions.json?limit=35`,signal,diagnostics)
    ]);
    if (!description) {
      description=shortDescription(olDesc(work?.description));
      if(description){description_source='Open Library';description_source_url=`https://openlibrary.org${candidate.work_key}`;}
    }
    for(const ed of editions?.entries||[]){
      for(const cover of (ed.covers||[]).slice(0,2))add(olCover(cover),ed.publish_date || 'Weitere Ausgabe');
      if(variants.length>=8)break;
    }
  }
  let description_language = candidate.language||'';
  if (!description && candidate.source==='Google Books' && candidate.volume_id) {
    const full=await getJSON(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(candidate.volume_id)}`,signal,diagnostics);
    const detail=full ? volumeCandidate(full) : null;
    if(detail?.description && matchScore(candidate,detail)>=.75){
      description=detail.description;
      description_source=detail.description_source;
      description_source_url=detail.description_source_url;
      description_language=detail.language;
    }
  }
  if (candidate.source!=='Apple Books' && (!description || (isGerman(candidate) && description_language==='Englisch'))) {
    const otherEdition = await findAlternateGoogleDescription(candidate,signal,diagnostics);
    if (otherEdition && (!description || otherEdition.language==='Deutsch')) {
      description=otherEdition.description;
      description_source=otherEdition.description_source;
      description_source_url=otherEdition.description_source_url;
      description_language=otherEdition.language;
    }
  }
  return {...candidate,
    cover_url:candidate.cover_url || variants[0]?.url || '',
    variants:variants.slice(0,8),
    description,description_source,description_source_url,description_language,
    description_status:description?'found':diagnostics.errors.length?'request_failed':'not_in_catalog',
    lookup_warnings:diagnostics.errors,
    matched_title:candidate.title,matched_author:candidate.author,
    selected_manually:true
  };
}
