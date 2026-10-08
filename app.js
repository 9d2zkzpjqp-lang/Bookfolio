import { lookupBookMetadata, makeMetadataPatch, missingFields } from './metadata.js';
const CONFIG=window.BOOKSHELF_CONFIG||{},SUPABASE_JS_URL='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm',LOCAL_KEY='meine-bibliothek-v02';
const CURRENT_YEAR=new Date().getFullYear();
const STATUS_LABELS={all:'Alle',reading:'Lese ich',finished:'Gelesen',unread:'Ungelesen',wishlist:'Wunschliste',abandoned:'Abgebrochen'},FORMAT_LABELS={ebook:'E-Book',print:'Print',audiobook:'Hörbuch'},GENRE_COLORS=['#8b4d28','#c47a4c','#d7a86e','#8a6c57','#b69782','#d4c1ad','#6c5445','#a97758'],MONTHS=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const demoBooks=[
{id:'11111111-1111-4111-8111-111111111111',title:'Atomic Habits',author:'James Clear',isbn:'9780735211292',cover_url:'https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg',status:'reading',rating:4,pages:320,current_page:208,published_year:2018,started_at:'2026-10-04',finished_at:null,format:'ebook',language:'Deutsch',genres:['Sachbuch','Psychologie'],notes:'Praktische Ideen zu Gewohnheiten und kleinen, konsequenten Veränderungen.',created_at:'2026-10-04T09:00:00Z'},
{id:'22222222-2222-4222-8222-222222222222',title:'Dune',author:'Frank Herbert',isbn:'9780441172719',cover_url:'https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg',status:'finished',rating:5,pages:688,current_page:688,published_year:1965,started_at:'2026-04-12',finished_at:'2026-05-03',format:'ebook',language:'Deutsch',genres:['Science-Fiction','Klassiker'],notes:'Ein faszinierendes Universum mit politischen und ökologischen Ebenen.',created_at:'2026-04-12T08:00:00Z'},
{id:'33333333-3333-4333-8333-333333333333',title:'Sapiens',author:'Yuval Noah Harari',isbn:'9780062316097',cover_url:'https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg',status:'finished',rating:4,pages:464,current_page:464,published_year:2015,started_at:'2026-01-15',finished_at:'2026-02-02',format:'ebook',language:'Deutsch',genres:['Sachbuch','Geschichte'],notes:'',created_at:'2026-01-15T09:00:00Z'},
{id:'44444444-4444-4444-8444-444444444444',title:'Educated',author:'Tara Westover',isbn:'9780399590504',cover_url:'https://covers.openlibrary.org/b/isbn/9780399590504-L.jpg',status:'finished',rating:5,pages:352,current_page:352,published_year:2018,started_at:'2026-03-01',finished_at:'2026-03-18',format:'ebook',language:'Englisch',genres:['Biografie'],notes:'',created_at:'2026-03-01T09:00:00Z'},
{id:'55555555-5555-4555-8555-555555555555',title:'The Midnight Library',author:'Matt Haig',isbn:'9780525559474',cover_url:'https://covers.openlibrary.org/b/isbn/9780525559474-L.jpg',status:'finished',rating:3,pages:304,current_page:304,published_year:2020,started_at:'2026-06-04',finished_at:'2026-06-16',format:'ebook',language:'Englisch',genres:['Roman','Fantasy'],notes:'',created_at:'2026-06-04T09:00:00Z'},
{id:'66666666-6666-4666-8666-666666666666',title:'Klara and the Sun',author:'Kazuo Ishiguro',isbn:'9780593318171',cover_url:'https://covers.openlibrary.org/b/isbn/9780593318171-L.jpg',status:'finished',rating:4,pages:320,current_page:320,published_year:2021,started_at:'2026-07-07',finished_at:'2026-07-26',format:'ebook',language:'Englisch',genres:['Roman','Science-Fiction'],notes:'',created_at:'2026-07-07T09:00:00Z'},
{id:'77777777-7777-4777-8777-777777777777',title:'Project Hail Mary',author:'Andy Weir',isbn:'9780593135204',cover_url:'https://covers.openlibrary.org/b/isbn/9780593135204-L.jpg',status:'finished',rating:5,pages:496,current_page:496,published_year:2021,started_at:'2026-08-04',finished_at:'2026-08-20',format:'ebook',language:'Deutsch',genres:['Science-Fiction'],notes:'',created_at:'2026-08-04T09:00:00Z'},
{id:'88888888-8888-4888-8888-888888888888',title:'Thinking, Fast and Slow',author:'Daniel Kahneman',isbn:'9780374533557',cover_url:'https://covers.openlibrary.org/b/isbn/9780374533557-L.jpg',status:'unread',rating:null,pages:499,current_page:0,published_year:2011,started_at:null,finished_at:null,format:'ebook',language:'Englisch',genres:['Sachbuch','Psychologie'],notes:'',created_at:'2026-09-02T09:00:00Z'},
{id:'99999999-9999-4999-8999-999999999999',title:'The Nickel Boys',author:'Colson Whitehead',isbn:'9780385537070',cover_url:'https://covers.openlibrary.org/b/isbn/9780385537070-L.jpg',status:'finished',rating:5,pages:224,current_page:224,published_year:2019,started_at:'2026-09-04',finished_at:'2026-09-12',format:'ebook',language:'Englisch',genres:['Roman','Geschichte'],notes:'',created_at:'2026-09-04T09:00:00Z'},
{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'The Song of Achilles',author:'Madeline Miller',isbn:'9780062060624',cover_url:'https://covers.openlibrary.org/b/isbn/9780062060624-L.jpg',status:'wishlist',rating:null,pages:378,current_page:0,published_year:2011,started_at:null,finished_at:null,format:'ebook',language:'Englisch',genres:['Roman','Historisch'],notes:'',created_at:'2026-09-27T09:00:00Z'}];
const state={books:[],activeFilter:'all',activeFormat:'all',activeAuthor:'all',searchQuery:'',sort:'recent',currentView:'library',statsYear:CURRENT_YEAR,activeBookId:null,supabase:null,user:null,syncMode:'local',searchAbort:null,quotes:[],quoteTargetBookId:null,metadataBatchCursor:0,metadataResult:null,metadataBookId:null,metadataCoverChoice:null,metadataBusy:false,metadataBatchBusy:false};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)],esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])),safeDate=v=>v?new Date(`${v}T12:00:00`):null,fmtDate=v=>v?new Intl.DateTimeFormat('de-DE',{day:'numeric',month:'long',year:'numeric'}).format(safeDate(v)):'–',uuid=()=>{if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const a=new Uint8Array(16);crypto.getRandomValues(a);a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;const h=[...a].map(x=>x.toString(16).padStart(2,'0')).join('');return[h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-')};
function loadLocal(){try{const x=JSON.parse(localStorage.getItem(LOCAL_KEY)||'null');if(Array.isArray(x)){state.books=x}else{state.books=CONFIG.useDemoData===false?[]:structuredClone(demoBooks)}}catch{state.books=CONFIG.useDemoData===false?[]:structuredClone(demoBooks)}}function saveLocal(){localStorage.setItem(LOCAL_KEY,JSON.stringify(state.books))}function toast(m){const e=$('#toast');e.textContent=m;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2200)}
async function initSupabase(){if(!CONFIG.supabaseUrl||!CONFIG.supabasePublishableKey){updateSyncCard();return}try{const{createClient}=await import(SUPABASE_JS_URL);state.supabase=createClient(CONFIG.supabaseUrl,CONFIG.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const{data}=await state.supabase.auth.getSession();state.user=data.session?.user||null;state.supabase.auth.onAuthStateChange((_e,s)=>{state.user=s?.user||null;updateSyncCard()});if(state.user)await pullFromSupabase();updateSyncCard()}catch(e){console.warn(e);state.syncMode='local';updateSyncCard()}}
async function pullFromSupabase(){if(!state.supabase||!state.user)return;const{data,error}=await state.supabase.from(CONFIG.tableName||'books').select('*').order('created_at',{ascending:false});if(error){console.warn(error);toast('Supabase konnte nicht geladen werden');return}const remote=(data||[]).map(normalizeBook),local=[...state.books],remoteIds=new Set(remote.map(b=>b.id)),onlyLocal=local.filter(b=>!remoteIds.has(b.id)&&!remote.some(r=>duplicateBook(r,b)));if(onlyLocal.length){const rows=onlyLocal.map(b=>({...b,user_id:state.user.id}));const{error:pushError}=await state.supabase.from(CONFIG.tableName||'books').upsert(rows,{onConflict:'id'});if(pushError){console.warn(pushError);toast('Lokale Bücher konnten nicht vollständig synchronisiert werden')}else remote.unshift(...onlyLocal)}state.books=remote;state.syncMode='supabase';saveLocal();await pullQuotesFromSupabase(local);renderAll()}
async function persistBook(book){saveLocal();if(!state.supabase||!state.user)return;const{error}=await state.supabase.from(CONFIG.tableName||'books').upsert({...book,user_id:state.user.id},{onConflict:'id'});if(error){console.warn(error);toast('Lokal gespeichert · Sync fehlgeschlagen')}}async function removeBook(id){state.books=state.books.filter(b=>b.id!==id);saveLocal();if(state.supabase&&state.user){const{error}=await state.supabase.from(CONFIG.tableName||'books').delete().eq('id',id);if(error)console.warn(error)}closeOverlays();renderAll();toast('Buch gelöscht')}
function normalizeBook(b){return{rating:null,pages:null,current_page:0,published_year:null,started_at:null,finished_at:null,format:'ebook',language:'Deutsch',genres:[],notes:'',description:'',description_source:'',description_source_url:'',status:'unread',created_at:new Date().toISOString(),...b,genres:Array.isArray(b.genres)?b.genres:[]}}
function filteredBooks(){let b=[...state.books];if(state.activeFilter!=='all')b=b.filter(x=>x.status===state.activeFilter);if(state.activeFormat!=='all')b=b.filter(x=>x.format===state.activeFormat);if(state.activeAuthor!=='all')b=b.filter(x=>(x.author||'').trim().toLocaleLowerCase('de-DE')===state.activeAuthor.toLocaleLowerCase('de-DE'));const q=state.searchQuery.trim().toLowerCase();if(q)b=b.filter(x=>[x.title,x.author,...(x.genres||[])].some(y=>String(y||'').toLowerCase().includes(q)));b.sort((a,c)=>state.sort==='title'?a.title.localeCompare(c.title,'de'):state.sort==='author'?(a.author||'').localeCompare(c.author||'','de'):state.sort==='rating'?(c.rating||0)-(a.rating||0):state.sort==='finished'?String(c.finished_at||'').localeCompare(String(a.finished_at||'')):String(c.created_at||'').localeCompare(String(a.created_at||'')));return b}
function renderAll(){renderLibrary();renderStats();updateNav();updateSyncCard()}
function fallbackCover(book){return`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#d8c8b8"/><text x="50%" y="45%" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#604a3b">${(book.title||'Buch').replace(/[&<>]/g,'')}</text></svg>`)}`}function coverImg(b,c=''){const f=fallbackCover(b);return`<img class="${c}" src="${esc(b.cover_url||f)}" alt="Cover von ${esc(b.title)}" onerror="this.onerror=null;this.src='${f}'">`}
function renderLibrary(){const year=CURRENT_YEAR,done=state.books.filter(b=>b.finished_at?.startsWith(String(year))).length;$('#libraryMeta').textContent=`${state.books.length} Bücher · ${done} dieses Jahr`;const authorBar=$('#activeAuthorBar');authorBar.classList.toggle('hidden',state.activeAuthor==='all');authorBar.innerHTML=state.activeAuthor==='all'?'':`<span>Autorfilter:</span><button data-action="clear-author" aria-label="Autorfilter entfernen">${esc(state.activeAuthor)} ×</button>`;$$('#statusFilters .chip').forEach(c=>c.classList.toggle('active',c.dataset.filter===state.activeFilter));const reading=state.books.filter(b=>b.status==='reading').slice(0,3);$('#currentReadingSection').classList.toggle('hidden',!reading.length);$('#currentReadingCards').innerHTML=reading.map(b=>{const pct=b.pages?Math.min(100,Math.round((b.current_page||0)/b.pages*100)):0,rem=b.pages?Math.max(0,b.pages-(b.current_page||0)):null,quick=b.pages?`<div class="quick-progress" data-quick-control><span>Seite</span><input data-quick-page="${b.id}" type="number" inputmode="numeric" min="0" max="${b.pages}" value="${b.current_page||0}" aria-label="Aktuelle Seite in ${esc(b.title)}"><span class="quick-progress-total">/ ${b.pages}</span></div>`:'';return`<article class="current-card" data-book-id="${b.id}">${coverImg(b)}<div class="current-card-main"><p class="eyebrow">Gerade lese ich</p><h3>${esc(b.title)}</h3><p class="author">${esc(b.author||'')}</p><div class="progress-track"><span style="width:${pct}%"></span></div><div class="progress-meta"><span>${pct}%</span><span>${rem!==null?`noch ca. ${rem} Seiten`:fmtDate(b.started_at)}</span></div>${quick}</div></article>`}).join('');const books=filteredBooks();$('#bookGrid').innerHTML=books.map(b=>`<article class="book-card" data-book-id="${b.id}"><div class="cover-wrap">${coverImg(b)}${b.status==='reading'?'<span class="cover-badge">Lese ich</span>':''}</div><h3>${esc(b.title)}</h3><p>${esc(b.author||'')}</p></article>`).join('');$('#emptyState').classList.toggle('hidden',!!books.length)}
function openBook(id){state.activeBookId=id;renderDetail();openSheet('#detailSheet')}
function renderSummarySection(b){const value=String(b.description||'').trim();if(!value)return '';const source=String(b.description_source||'').trim();let safeUrl='';try{const u=new URL(b.description_source_url||'');if(u.protocol==='https:')safeUrl=u.href}catch{}return `<section class="detail-block book-summary"><div class="summary-header"><h3>Kurzinhalt</h3>${source?`<span class="summary-source">${safeUrl?`<a href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer">${esc(source)} ↗</a>`:esc(source)}</span>`:''}</div><p class="summary-text ${value.length>230?'is-collapsed':''}" id="bookSummaryText">${esc(value)}</p>${value.length>230?'<button class="text-button summary-more" data-action="expand-summary" aria-expanded="false">Mehr anzeigen</button>':''}</section>`}function renderDetail(){const b=state.books.find(x=>x.id===state.activeBookId);if(!b)return;const stars='★'.repeat(Math.round(b.rating||0))+'☆'.repeat(5-Math.round(b.rating||0)),tags=(b.genres||[]).map(g=>`<span class="tag">${esc(g)}</span>`).join(''),progressFact=b.status==='reading'&&b.pages?`<div class="fact-row"><dt>Aktuelle Seite</dt><dd>${b.current_page||0} / ${b.pages}</dd></div>`:'';$('#detailContent').innerHTML=`<div class="detail-hero"><button class="detail-close-button" data-action="close-detail" aria-label="Zurück zur Bibliothek"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"></path></svg></button><div class="detail-hero-bg" style="background-image:url('${esc(b.cover_url||'')}')"></div>${coverImg(b,'detail-cover')}</div><div class="detail-body"><div class="detail-topline"><div class="detail-title"><h2>${esc(b.title)}</h2><p class="author"><button class="author-link" data-author-open="${encodeURIComponent(b.author||'')}" aria-label="Alle Bücher von ${esc(b.author||'')} anzeigen">${esc(b.author||'')}</button></p><div class="rating-line">${stars} <span>${b.rating?`${Number(b.rating).toFixed(1)} / 5`:'Noch nicht bewertet'}</span></div></div><div class="book-menu-area"><button class="icon-button" data-action="book-menu-toggle" aria-label="Buchmenü öffnen">•••</button><div class="book-menu hidden" id="bookMenu"><button data-meta-action="open" type="button">Cover &amp; Buchdaten ergänzen</button><button data-action="edit-book" type="button">Bearbeiten</button></div></div></div>${tags?`<div class="tag-row">${tags}</div>`:''}<div class="status-row" data-action="cycle-status"><strong>✓ ${esc(STATUS_LABELS[b.status]||b.status)}</strong><span>›</span></div><dl class="detail-facts"><div class="fact-row"><dt>Startdatum</dt><dd>${fmtDate(b.started_at)}</dd></div><div class="fact-row"><dt>Enddatum</dt><dd>${fmtDate(b.finished_at)}</dd></div><div class="fact-row"><dt>Seitenzahl</dt><dd>${b.pages||'–'}</dd></div>${progressFact}<div class="fact-row"><dt>Format</dt><dd>${esc(FORMAT_LABELS[b.format]||b.format||'–')}</dd></div><div class="fact-row"><dt>Sprache</dt><dd>${esc(b.language||'–')}</dd></div><div class="fact-row"><dt>Erscheinungsjahr</dt><dd>${b.published_year||'–'}</dd></div><div class="fact-row"><dt>ISBN</dt><dd>${esc(b.isbn||'–')}</dd></div></dl>${renderSummarySection(b)}<div class="detail-block"><h3>Meine Notizen</h3><div class="notes-box">${esc(b.notes||'Noch keine Notizen.')}</div></div>${renderQuotePreview(b)}<div class="detail-actions"><button class="small-button" data-meta-action="open">Buchdaten ergänzen</button><button class="small-button" data-action="edit-book">Bearbeiten</button><button class="small-button" data-action="mark-finished">Als gelesen markieren</button><button class="small-button danger-button" data-action="delete-book">Löschen</button></div></div>`}
function editBookInline(){const b=state.books.find(x=>x.id===state.activeBookId);if(!b)return;const commonTags=['Roman','Sachbuch','Geschichte','Politik','Biografie','Science-Fiction','Fantasy','Krimi','Psychologie','Gesellschaft','Wissenschaft','Reise','Klassiker','Gegenwart','USA','Deutschland'],knownTags=[...new Set([...commonTags,...state.books.flatMap(x=>x.genres||[])])].sort((a,c)=>a.localeCompare(c,'de')),selectedTags=[...(b.genres||[])];$('#detailContent').innerHTML=`<div class="sheet-header"><div><p class="eyebrow">Buch bearbeiten</p><h2>${esc(b.title)}</h2></div><button class="icon-button" data-action="detail-back">×</button></div><form id="editBookForm" class="manual-form"><label>Titel<input name="title" value="${esc(b.title)}" required></label><label>Autor<input name="author" value="${esc(b.author||'')}"></label><label>Status<select name="status" class="select-field">${Object.entries(STATUS_LABELS).filter(([k])=>k!=='all').map(([k,v])=>`<option value="${k}" ${b.status===k?'selected':''}>${v}</option>`).join('')}</select></label><div class="rating-field"><span class="field-label">Bewertung</span><div class="rating-picker" role="radiogroup" aria-label="Bewertung"><input name="rating" type="hidden" value="${b.rating??''}">${[1,2,3,4,5].map(n=>`<button type="button" role="radio" class="star-button" data-rating-value="${n}" aria-label="${n} ${n===1?'Stern':'Sterne'}">★</button>`).join('')}<button type="button" class="rating-clear" data-rating-clear aria-label="Bewertung löschen">×</button></div></div><div class="form-grid-two date-grid"><label>Startdatum<input name="started_at" type="date" value="${b.started_at||''}"></label><label>Enddatum<input name="finished_at" type="date" value="${b.finished_at||''}"></label></div><div class="form-grid-two"><label>Seitenzahl<input name="pages" type="number" min="0" value="${b.pages||''}"></label><label>Aktuelle Seite<input name="current_page" type="number" min="0" value="${b.current_page||0}"></label></div><div class="form-grid-two"><label>Format<select name="format" class="select-field">${Object.entries(FORMAT_LABELS).map(([k,v])=>`<option value="${k}" ${b.format===k?'selected':''}>${v}</option>`).join('')}</select></label><label>Sprache<input name="language" value="${esc(b.language||'')}"></label></div><div class="tag-field"><span class="field-label">Schlagwörter <small>optional</small></span><div id="tagEditor" class="tag-editor"><div id="editTagChips" class="tag-editor-chips"></div><input id="editTagInput" type="text" autocomplete="off" placeholder="Tippen und Enter …"></div><div id="tagSuggestions" class="tag-suggestions hidden"></div></div><label>Kurzinhalt <small>(optional, öffentliches Buchwissen)</small><textarea name="description" rows="4" placeholder="Kurze Inhaltsangabe …">${esc(b.description||'')}</textarea></label><label>Notizen<textarea name="notes" rows="4">${esc(b.notes||'')}</textarea></label><div class="form-actions"><button class="primary-button compact-save" type="submit">Speichern</button></div></form>`;const form=$('#editBookForm'),ratingInput=form.querySelector('[name="rating"]'),ratingButtons=[...form.querySelectorAll('[data-rating-value]')],ratingClear=form.querySelector('[data-rating-clear]'),tagInput=$('#editTagInput'),tagChips=$('#editTagChips'),tagSuggestions=$('#tagSuggestions');function paintRating(){const val=Number(ratingInput.value)||0;ratingButtons.forEach(btn=>{const n=Number(btn.dataset.ratingValue);btn.classList.toggle('active',n<=val);btn.setAttribute('aria-checked',n===val?'true':'false')});ratingClear.classList.toggle('hidden',!val)}function setRating(value){ratingInput.value=value||'';paintRating()}ratingButtons.forEach(btn=>btn.addEventListener('click',()=>setRating(Number(btn.dataset.ratingValue))));ratingClear.addEventListener('click',()=>setRating(null));paintRating();function renderTags(){tagChips.innerHTML=selectedTags.map((tag,i)=>`<span class="editable-tag">${esc(tag)}<button type="button" data-remove-tag="${i}" aria-label="${esc(tag)} entfernen">×</button></span>`).join('')}function hideTagSuggestions(){tagSuggestions.classList.add('hidden');tagSuggestions.innerHTML=''}function showTagSuggestions(){const q=tagInput.value.trim().toLowerCase(),matches=knownTags.filter(tag=>!selectedTags.some(x=>x.toLowerCase()===tag.toLowerCase())&&(!q||tag.toLowerCase().includes(q))).slice(0,6),typed=tagInput.value.trim(),custom=typed&&!knownTags.some(tag=>tag.toLowerCase()===typed.toLowerCase())&&!selectedTags.some(tag=>tag.toLowerCase()===typed.toLowerCase())?typed:'';const items=[...(custom?[custom]:[]),...matches];if(!items.length){hideTagSuggestions();return}tagSuggestions.innerHTML=items.map((tag,i)=>`<button type="button" data-tag-suggestion="${esc(tag)}">${i===0&&custom?'＋ ':''}${esc(tag)}</button>`).join('');tagSuggestions.classList.remove('hidden')}function addTag(value){const tag=String(value||'').trim().replace(/^,+|,+$/g,'');if(!tag)return;if(!selectedTags.some(x=>x.toLowerCase()===tag.toLowerCase()))selectedTags.push(tag);tagInput.value='';renderTags();hideTagSuggestions()}tagInput.addEventListener('input',showTagSuggestions);tagInput.addEventListener('focus',showTagSuggestions);tagInput.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();addTag(tagInput.value)}else if(e.key==='Backspace'&&!tagInput.value&&selectedTags.length){selectedTags.pop();renderTags()}});tagSuggestions.addEventListener('mousedown',e=>{const btn=e.target.closest('[data-tag-suggestion]');if(btn){e.preventDefault();addTag(btn.dataset.tagSuggestion);tagInput.focus()}});tagChips.addEventListener('click',e=>{const btn=e.target.closest('[data-remove-tag]');if(btn){selectedTags.splice(Number(btn.dataset.removeTag),1);renderTags();showTagSuggestions()}});renderTags();form.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);Object.assign(b,{title:f.get('title').trim(),author:f.get('author').trim(),status:f.get('status'),rating:f.get('rating')?Number(f.get('rating')):null,started_at:f.get('started_at')||null,finished_at:f.get('finished_at')||null,pages:f.get('pages')?Number(f.get('pages')):null,current_page:f.get('current_page')?Number(f.get('current_page')):0,format:f.get('format'),language:f.get('language').trim(),genres:selectedTags,notes:f.get('notes').trim()});const newDescription=String(f.get('description')||'').trim();if(newDescription!==(b.description||'')){b.description=newDescription;b.description_source=newDescription?'Eigener Text':'';b.description_source_url=''}await persistBook(b);renderAll();renderDetail();toast('Gespeichert')})}
function cycleStatus(){const b=state.books.find(x=>x.id===state.activeBookId);if(!b)return;const seq=['unread','reading','finished','wishlist'],i=seq.indexOf(b.status);b.status=seq[(i+1)%seq.length];if(b.status==='reading'&&!b.started_at)b.started_at=new Date().toISOString().slice(0,10);if(b.status==='finished'){b.finished_at=b.finished_at||new Date().toISOString().slice(0,10);b.current_page=b.pages||b.current_page}persistBook(b);renderAll();renderDetail()}
function renderStats(){const y=state.statsYear;$('#statsYear').textContent=y;const books=state.books.filter(b=>b.finished_at?.startsWith(String(y))&&b.status==='finished'),pages=books.reduce((s,b)=>s+(Number(b.pages)||0),0),ratings=books.filter(b=>Number(b.rating)>0).map(b=>Number(b.rating)),avg=ratings.length?ratings.reduce((a,b)=>a+b,0)/ratings.length:0,durations=books.map(b=>daysBetween(b.started_at,b.finished_at)).filter(n=>Number.isFinite(n)&&n>=0),avgDays=durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length):0;$('#statsKpis').innerHTML=[['▥',books.length,'Bücher'],['▤',pages.toLocaleString('de-DE'),'Seiten'],['★',avg?avg.toFixed(1).replace('.',','):'–','Ø Bewertung'],['◷',avgDays||'–','Ø Tage pro Buch']].map(([i,v,l])=>`<div class="kpi-card"><div class="kpi-icon">${i}</div><strong>${v}</strong><span>${l}</span></div>`).join('');const counts=Array(12).fill(0);books.forEach(b=>counts[safeDate(b.finished_at).getMonth()]++);const mx=Math.max(...counts,1);$('#monthlyChart').innerHTML=counts.map((v,i)=>`<div class="month-bar-wrap"><span class="month-value">${v||''}</span><div class="month-bar" style="height:${Math.max(2,v/mx*100)}%"></div><span class="month-label">${MONTHS[i]}</span></div>`).join('');const gc={};books.forEach(b=>(b.genres||[]).forEach(g=>gc[g]=(gc[g]||0)+1));const genres=Object.entries(gc).sort((a,b)=>b[1]-a[1]).slice(0,7),gt=genres.reduce((s,[,n])=>s+n,0)||1;let cur=0;const stops=genres.map(([,n],i)=>{const st=cur;cur+=n/gt*100;return`${GENRE_COLORS[i%GENRE_COLORS.length]} ${st}% ${cur}%`});$('#genreDonut').style.background=stops.length?`conic-gradient(${stops.join(',')})`:'conic-gradient(#ddd 0 100%)';$('#genreTotal').textContent=books.length;$('#genreLegend').innerHTML=genres.length?genres.map(([g,n],i)=>`<div class="genre-item"><span class="genre-dot" style="--genre-color:${GENRE_COLORS[i%GENRE_COLORS.length]}"></span><span>${esc(g)}</span><span>${Math.round(n/gt*100)}%</span></div>`).join(''):'<p class="muted small">Noch keine Genre-Daten.</p>';const dist=[5,4,3,2,1].map(r=>[r,books.filter(b=>Math.round(b.rating||0)===r).length]),dm=Math.max(...dist.map(([,n])=>n),1);$('#ratingDistribution').innerHTML=dist.map(([r,n])=>`<div class="rating-row"><span>${r} ★</span><div class="rating-track"><div class="rating-fill" style="width:${n/dm*100}%"></div></div><span>${n}</span></div>`).join('');const fav=[...books].filter(b=>b.rating).sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,6);$('#favouriteBooks').innerHTML=fav.length?fav.map(b=>`<div class="favourite-cover" data-book-id="${b.id}">${coverImg(b)}<p>${esc(b.title)}</p></div>`).join(''):'<p class="muted small">Noch keine bewerteten Bücher in diesem Jahr.</p>';const longest=[...books].sort((a,b)=>(b.pages||0)-(a.pages||0))[0],shortest=[...books].filter(b=>b.pages).sort((a,b)=>(a.pages||0)-(b.pages||0))[0],topAuthor=topFrequency(books.map(b=>b.author).filter(Boolean));$('#insightsGrid').innerHTML=[['Meistgelesener Autor',topAuthor||'–'],['Längstes Buch',longest?`${longest.title} · ${longest.pages} S.`:'–'],['Kürzestes Buch',shortest?`${shortest.title} · ${shortest.pages} S.`:'–']].map(([l,v])=>`<div class="insight"><span>${l}</span><strong>${esc(v)}</strong></div>`).join('')}
function daysBetween(a,b){if(!a||!b)return NaN;return Math.round((safeDate(b)-safeDate(a))/86400000)+1}function topFrequency(a){const c={};a.forEach(x=>c[x]=(c[x]||0)+1);return Object.entries(c).sort((x,y)=>y[1]-x[1])[0]?.[0]}
function showView(v){state.currentView=v;$$('.view').forEach(x=>x.classList.remove('active'));$(`#${v}View`).classList.add('active');updateNav();scrollTo({top:0,behavior:'smooth'})}function updateNav(){$$('.nav-item[data-nav]').forEach(n=>n.classList.toggle('active',n.dataset.nav===state.currentView))}function openSheet(s){closeOverlays(false);$('#scrim').classList.remove('hidden');const sh=$(s);sh.classList.add('open');sh.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}function closeOverlays(h=true){$$('.sheet.open').forEach(s=>{s.classList.remove('open');s.setAttribute('aria-hidden','true')});if(h)$('#scrim').classList.add('hidden');document.body.style.overflow=''}
function switchAddMode(m){$$('.segment').forEach(s=>s.classList.toggle('active',s.dataset.addMode===m));$$('.add-panel').forEach(p=>p.classList.remove('active'));$(`#add${m[0].toUpperCase()+m.slice(1)}Panel`).classList.add('active')}
function renderSearchResults(results){const box=$('#searchResults');box._results=results;box._coverVariants=null;box.innerHTML=results.length?results.map((r,i)=>`<article class="search-result" data-result-index="${i}">${coverImg(r)}<div><h3>${esc(r.title)}</h3><p>${esc(r.author)}</p><p>${r.published_year||'–'}${r.pages?` · ${r.pages} Seiten`:''}${r._edition_count>1?` · ${r._edition_count} Auflagen`:''}</p></div><span class="chev">›</span></article>`).join(''):'<p class="hint">Keine passenden Bücher gefunden.</p>'}
async function searchOpenLibrary(q){const box=$('#searchResults');if(q.trim().length<2){box.innerHTML='<p class="hint">Tippe mindestens zwei Zeichen ein.</p>';return}if(state.searchAbort)state.searchAbort.abort();state.searchAbort=new AbortController();box.innerHTML='<div class="search-loading">Suche …</div>';try{const fields='key,title,author_name,first_publish_year,isbn,cover_i,edition_count,number_of_pages_median,language,subject',res=await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=${encodeURIComponent(fields)}`,{signal:state.searchAbort.signal});if(!res.ok)throw 0;const j=await res.json(),results=(j.docs||[]).map(d=>({title:d.title,author:(d.author_name||[])[0]||'',published_year:d.first_publish_year||null,isbn:(d.isbn||[])[0]||'',pages:d.number_of_pages_median||null,cover_url:d.cover_i?`https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`:'',language:(d.language||[]).includes('ger')?'Deutsch':(d.language||[]).includes('eng')?'Englisch':'',genres:normalizeSubjects(d.subject||[]),_work_key:d.key||'',_cover_id:d.cover_i||null,_edition_count:d.edition_count||0}));renderSearchResults(results)}catch(e){if(e.name!=='AbortError')box.innerHTML='<p class="hint">Die Buchsuche ist gerade nicht erreichbar. Manuelles Hinzufügen funktioniert weiterhin.</p>'}}
function parseEditionYear(v){const m=String(v||'').match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);return m?Number(m[1]):null}
function editionLanguage(ed){const keys=(ed.languages||[]).map(x=>String(x?.key||x||''));return keys.some(x=>x.endsWith('/ger'))?'Deutsch':keys.some(x=>x.endsWith('/eng'))?'Englisch':''}
async function chooseCoverForSearchResult(i){const box=$('#searchResults'),r=box._results?.[i];if(!r)return;box.innerHTML='<div class="search-loading">Auflagen und Cover werden geladen …</div>';let variants=[];try{const workId=String(r._work_key||'').replace(/^\/works\//,'').replace(/^\//,'');if(workId){const res=await fetch(`https://openlibrary.org/works/${encodeURIComponent(workId)}/editions.json?limit=40`);if(res.ok){const data=await res.json(),seen=new Set();for(const ed of data.entries||[]){for(const coverId of (ed.covers||[]).slice(0,3)){if(!coverId||seen.has(coverId))continue;seen.add(coverId);variants.push({cover_url:`https://covers.openlibrary.org/b/id/${coverId}-L.jpg`,isbn:(ed.isbn_13||ed.isbn_10||[])[0]||'',pages:ed.number_of_pages||null,published_year:parseEditionYear(ed.publish_date),language:editionLanguage(ed),publisher:(ed.publishers||[])[0]||''});if(variants.length>=12)break}if(variants.length>=12)break}}}}catch(e){console.warn(e)}if(r.cover_url&&!variants.some(v=>v.cover_url===r.cover_url))variants.unshift({cover_url:r.cover_url,isbn:r.isbn,pages:r.pages,published_year:r.published_year,language:r.language,publisher:''});if(variants.length<=1){await finalizeSearchAdd(i,variants[0]||null);return}box._coverVariants=variants;box._coverResultIndex=i;box.innerHTML=`<div class="cover-picker-head"><button class="text-button cover-back" data-action="back-to-search-results">‹ Treffer</button><div><p class="eyebrow">Auflage auswählen</p><h3>${esc(r.title)}</h3><p class="muted">${esc(r.author)}</p></div></div><p class="hint">Tippe auf das Cover, das deiner Ausgabe am besten entspricht.</p><div class="cover-choice-grid">${variants.map((v,n)=>`<button class="cover-choice" data-cover-choice="${n}" aria-label="Cover ${n+1} wählen"><img src="${esc(v.cover_url)}" alt="Covervariante ${n+1}"><span>${v.published_year||''}${v.publisher?` · ${esc(v.publisher)}`:''}</span></button>`).join('')}</div>`}
async function finalizeSearchAdd(resultIndex,variant=null){const r=$('#searchResults')._results?.[resultIndex];if(!r)return;const clean={title:r.title,author:r.author,published_year:variant?.published_year||r.published_year,isbn:variant?.isbn||r.isbn,pages:variant?.pages||r.pages,cover_url:variant?.cover_url||r.cover_url,language:variant?.language||r.language,genres:r.genres};const b=normalizeBook({id:uuid(),...clean,status:'unread',format:'ebook',created_at:new Date().toISOString()});state.books.unshift(b);await persistBook(b);closeOverlays();renderAll();toast('Zur Bibliothek hinzugefügt');void autoCompleteNewBook(b)}
function normalizeSubjects(s){const map=[['fiction','Roman'],['science fiction','Science-Fiction'],['history','Geschichte'],['biography','Biografie'],['politic','Politik'],['fantasy','Fantasy'],['psycholog','Psychologie'],['crime','Krimi']],out=[];for(const x of s.slice(0,25)){const l=String(x).toLowerCase();for(const[n,label]of map)if(l.includes(n)&&!out.includes(label))out.push(label)}return out.slice(0,3)}async function lookupIsbn(){const isbn=$('#isbnInput').value.replace(/[^0-9Xx]/g,'');if(!isbn)return;switchAddMode('search');$('#bookSearchInput').value=isbn;await searchOpenLibrary(`isbn:${isbn}`)}async function addFromSearch(i){await chooseCoverForSearchResult(i)}async function addManual(f){const x=new FormData(f),b=normalizeBook({id:uuid(),title:x.get('title').trim(),author:x.get('author').trim(),pages:x.get('pages')?Number(x.get('pages')):null,published_year:x.get('published_year')?Number(x.get('published_year')):null,cover_url:x.get('cover_url').trim(),created_at:new Date().toISOString()});state.books.unshift(b);await persistBook(b);f.reset();closeOverlays();renderAll();toast('Zur Bibliothek hinzugefügt');void autoCompleteNewBook(b)}
function groupedAuthors(){const g=new Map();for(const b of state.books){const name=(b.author||'').trim();if(!name)continue;const k=name.toLocaleLowerCase('de-DE');if(!g.has(k))g.set(k,{name,books:[]});g.get(k).books.push(b)}return [...g.values()].sort((a,b)=>a.name.localeCompare(b.name,'de'))}
function renderAuthors(){const groups=groupedAuthors();$('#authorsContent').innerHTML=`<div class="sheet-header"><div><p class="eyebrow">Deine Bibliothek</p><h2>Autorinnen & Autoren</h2><p class="author-profile-summary">${groups.length} Namen · ${state.books.length} Bücher</p></div><button class="icon-button" data-action="close-overlays" aria-label="Schließen">×</button></div><div class="authors-list">${groups.map(g=>`<button class="author-list-item" data-author-open="${encodeURIComponent(g.name)}"><span class="author-mini-covers">${g.books.slice(0,2).map(b=>`<img src="${esc(b.cover_url||'')}" alt="" loading="lazy">`).join('')}</span><span><strong>${esc(g.name)}</strong><small>${g.books.length} ${g.books.length===1?'Buch':'Bücher'} · ${g.books.filter(b=>b.status==='finished').length} gelesen</small></span><span class="chev">›</span></button>`).join('')||'<p class="muted">Noch keine Autoren vorhanden.</p>'}</div>`}
function renderAuthorProfile(name){const items=state.books.filter(b=>(b.author||'').trim().toLocaleLowerCase('de-DE')===name.toLocaleLowerCase('de-DE'));const finished=items.filter(b=>b.status==='finished').length;$('#authorsContent').innerHTML=`<div class="sheet-header"><div><button class="text-button author-back" data-action="back-to-authors">‹ Alle Autoren</button><p class="eyebrow">Autorenübersicht</p><h2>${esc(name)}</h2><p class="author-profile-summary">${items.length} ${items.length===1?'Buch':'Bücher'} · ${finished} gelesen</p></div><button class="icon-button" data-action="close-overlays" aria-label="Schließen">×</button></div><button class="small-button" data-author-filter="${encodeURIComponent(name)}">Nur diese Bücher anzeigen</button><div class="author-book-list">${items.sort((a,b)=>String(b.finished_at||b.created_at).localeCompare(String(a.finished_at||a.created_at))).map(b=>`<button class="author-book-item" data-book-id="${esc(b.id)}"><img src="${esc(b.cover_url||'')}" alt="Cover ${esc(b.title)}" loading="lazy"><span class="author-book-info"><strong>${esc(b.title)}</strong><small>${esc(STATUS_LABELS[b.status]||b.status)}${b.finished_at?' · '+fmtDate(b.finished_at):''}${b.pages?' · '+b.pages+' Seiten':''}</small></span><span class="chev">›</span></button>`).join('')}</div>`}
function renderOverlayFilters(){$('#overlayStatusFilters').innerHTML=Object.entries(STATUS_LABELS).filter(([k])=>k!=='abandoned').map(([k,v])=>`<button class="chip ${state.activeFilter===k?'active':''}" data-overlay-status="${k}">${v}</button>`).join('');$('#formatFilters').innerHTML=[['all','Alle'],...Object.entries(FORMAT_LABELS)].map(([k,v])=>`<button class="chip ${state.activeFormat===k?'active':''}" data-overlay-format="${k}">${v}</button>`).join('');const authors=[...new Set(state.books.map(b=>(b.author||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));$('#authorSelect').innerHTML='<option value="all">Alle Autoren</option>'+authors.map(a=>`<option value="${esc(a)}" ${state.activeAuthor===a?'selected':''}>${esc(a)} (${state.books.filter(b=>b.author===a).length})</option>`).join('');$('#globalSearchInput').value=state.searchQuery;$('#sortSelect').value=state.sort}
function updateSyncCard(){const e=$('#syncStatusCard');if(!e)return;if(state.supabase&&state.user){e.innerHTML=`<h3>Synchronisation</h3><div class="sync-pill"><span class="sync-dot online"></span> Supabase · angemeldet</div><p class="muted small" style="margin-top:9px">${esc(state.user.email||'')}</p>`;$('#signOutButton')?.classList.remove('hidden')}else if(CONFIG.supabaseUrl&&CONFIG.supabasePublishableKey){e.innerHTML='<h3>Synchronisation</h3><div class="sync-pill"><span class="sync-dot"></span> Supabase bereit · nicht angemeldet</div>';$('#signOutButton')?.classList.add('hidden')}else{e.innerHTML='<h3>Synchronisation</h3><div class="sync-pill"><span class="sync-dot"></span> Lokaler Demo-Modus</div><p class="muted small" style="margin-top:9px">Alle Änderungen bleiben auf diesem Gerät gespeichert, bis Supabase verbunden wird.</p>';$('#signOutButton')?.classList.add('hidden')}$('#authControls')?.classList.toggle('hidden',!!state.user);$('#passwordChangeSection')?.classList.toggle('hidden',!state.user)}
function authFeedback(message,isError=false){const el=$('#authFeedback');if(el){el.textContent=message;el.classList.toggle('auth-error',isError)}if(isError)toast(message)}
function rememberAuthEmail(email){try{localStorage.setItem('bookfolio-login-email',email)}catch{}}
function getAuthEmail(){return $('#authEmail')?.value.trim()||''}
function parseVerificationLink(raw,projectUrl){
  let u;
  try{u=new URL(String(raw||'').trim())}catch{throw Error('Bitte den vollständigen Link aus der Anmelde-E-Mail einfügen.')}
  const expected=new URL(projectUrl);
  if(u.protocol!=='https:'||u.origin!==expected.origin||u.pathname!=='/auth/v1/verify')throw Error('Dieser Link gehört nicht zur Bookfolio-Supabase-Anmeldung.');
  const hash=u.searchParams.get('token_hash')||u.searchParams.get('token');
  const t=u.searchParams.get('type')||'email';
  if(!hash||!/^[A-Za-z0-9_-]+$/.test(hash))throw Error('Im Link fehlt ein gültiges Anmeldetoken.');
  if(!['email','magiclink','signup'].includes(t))throw Error('Das ist kein unterstützter E-Mail-Anmeldelink.');
  return {token_hash:hash,type:t};
}
async function sendMagicLink(email){
  if(!state.supabase){authFeedback('Supabase ist noch nicht bereit.',true);return}
  rememberAuthEmail(email);
  const btn=$('#authForm button[type=submit]');if(btn)btn.disabled=true;
  try{
    const {error}=await state.supabase.auth.signInWithOtp({email,options:{emailRedirectTo:new URL('./',location.href).href}});
    if(error)throw error;
    authFeedback('E-Mail ist unterwegs. Den Code hier eingeben oder den Link in Mail kopieren und unten einfügen.');
  }catch(e){console.warn('Anmelde-E-Mail fehlgeschlagen',e?.message);authFeedback('E-Mail konnte nicht gesendet werden. Bitte Adresse prüfen und später erneut versuchen.',true)}
  finally{if(btn)btn.disabled=false}
}
async function finishAppLogin(result){
  if(!result?.user&&!result?.session?.user){const {data}=await state.supabase.auth.getSession();if(!data?.session?.user)throw Error('Keine aktive Sitzung zurückgegeben.')}
  state.user=result?.user||result?.session?.user||state.user;
  authFeedback('Anmeldung erfolgreich. Deine Bücher werden synchronisiert.');
  updateSyncCard();
  await pullFromSupabase();
}
async function verifyEmailCode(email,token){
  if(!state.supabase){authFeedback('Supabase ist noch nicht bereit.',true);return}
  if(!/^[0-9]{6,8}$/.test(token)){authFeedback('Bitte den vollständigen Zahlencode eingeben.',true);return}
  const btn=$('#authOtpForm button[type=submit]');if(btn)btn.disabled=true;
  try{
    const {data,error}=await state.supabase.auth.verifyOtp({email,token,type:'email'});
    if(error)throw error;
    $('#authOtpCode').value='';
    await finishAppLogin(data);
  }catch(e){console.warn('Anmeldecode ungültig',e?.message);authFeedback('Der Code ist ungültig oder abgelaufen. Bitte neuen Code anfordern.',true)}
  finally{if(btn)btn.disabled=false}
}
async function verifyCopiedMagicLink(raw){
  if(!state.supabase){authFeedback('Supabase ist noch nicht bereit.',true);return}
  const btn=$('#authLinkForm button[type=submit]');if(btn)btn.disabled=true;
  try{
    const payload=parseVerificationLink(raw,CONFIG.supabaseUrl);
    const {data,error}=await state.supabase.auth.verifyOtp(payload);
    if(error)throw error;
    $('#authLinkInput').value='';
    await finishAppLogin(data);
  }catch(e){console.warn('Anmeldelink ungültig',e?.message);authFeedback(e?.message?.includes('Bookfolio-Supabase')||e?.message?.startsWith('Bitte den vollständigen')||e?.message?.startsWith('Im Link')||e?.message?.startsWith('Das ist kein')?e.message:'Link abgelaufen oder bereits geöffnet. Bitte neue E-Mail anfordern und den Link kopieren, ohne ihn anzutippen.',true)}
  finally{if(btn)btn.disabled=false}
}

// Passwort-Anmeldung für dasselbe Konto wie der bisherige Magic Link.
// Passwörter werden ausschließlich an Supabase Auth geschickt, nie in localStorage oder Bücherdaten geschrieben.
function passwordFeedback(target,message,isError=false){
  const el=$(target);if(!el)return;
  el.textContent=message;el.classList.toggle('auth-error',isError);
}
async function signInBookfolioWithPassword(email,password){
  if(!state.supabase){passwordFeedback('#passwordLoginFeedback','Supabase ist noch nicht bereit.',true);return}
  if(!email||!password){passwordFeedback('#passwordLoginFeedback','E-Mail und Passwort eingeben.',true);return}
  const button=$('#passwordLoginForm button[type=submit]');if(button)button.disabled=true;
  passwordFeedback('#passwordLoginFeedback','Anmeldung wird geprüft …');
  try{
    const {data,error}=await state.supabase.auth.signInWithPassword({email,password});
    if(error)throw error;
    rememberAuthEmail(email);
    $('#passwordLoginPassword').value='';
    await finishAppLogin(data);
    passwordFeedback('#passwordLoginFeedback','Angemeldet. Deine Bücher werden synchronisiert.');
    toast('Mit Passwort angemeldet');
  }catch(error){
    console.warn('Passwort-Anmeldung fehlgeschlagen',error?.name||'AuthError');
    passwordFeedback('#passwordLoginFeedback','Anmeldung nicht möglich. Bitte E-Mail und Passwort prüfen. Falls du noch keines eingerichtet hast, melde dich zunächst in deiner bereits angemeldeten Browser-Sitzung an.',true);
  }finally{if(button)button.disabled=false}
}
async function setBookfolioPassword(password,confirmation){
  if(!state.supabase||!state.user){passwordFeedback('#passwordChangeFeedback','Bitte zuerst in deinem bestehenden Konto anmelden.',true);return}
  if(password.length<12){passwordFeedback('#passwordChangeFeedback','Bitte ein Passwort mit mindestens 12 Zeichen wählen.',true);return}
  if(password!==confirmation){passwordFeedback('#passwordChangeFeedback','Die beiden Passwörter stimmen nicht überein.',true);return}
  const button=$('#passwordChangeForm button[type=submit]');if(button)button.disabled=true;
  passwordFeedback('#passwordChangeFeedback','Passwort wird gespeichert …');
  try{
    const {error}=await state.supabase.auth.updateUser({password});
    if(error)throw error;
    $('#passwordChangeForm').reset();
    passwordFeedback('#passwordChangeFeedback','Passwort gespeichert. Du kannst dich jetzt in deiner Home-Bildschirm-App mit derselben E-Mail-Adresse und diesem Passwort anmelden.');
    toast('Passwort gespeichert');
  }catch(error){
    console.warn('Passwort-Änderung fehlgeschlagen',error?.name||'AuthError');
    const requiresReauth=String(error?.message||'').toLowerCase().includes('reauth');
    passwordFeedback('#passwordChangeFeedback',requiresReauth?'Supabase verlangt eine erneute Bestätigung deiner Anmeldung. Bitte melde dich erneut an und versuche es anschließend.':'Passwort konnte nicht gespeichert werden. Bitte prüfe die Supabase-Passwortregeln und versuche es erneut.',true);
  }finally{if(button)button.disabled=false}
}
function exportJson(){const blob=new Blob([JSON.stringify(state.books,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`meine-bibliothek-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}const IMPORT_FIELDS=['id','title','author','isbn','cover_url','status','rating','pages','current_page','published_year','started_at','finished_at','format','language','genres','notes','description','description_source','description_source_url','created_at'];
function duplicateBook(a,b){const ax=String(a.isbn||'').replace(/[^0-9X]/gi,''),bx=String(b.isbn||'').replace(/[^0-9X]/gi,'');if(ax&&bx)return ax===bx;const norm=x=>String(x||'').normalize('NFKC').toLocaleLowerCase('de-DE').replace(/[^\p{L}\p{N}]/gu,'');return norm(a.title)===norm(b.title)&&norm(a.author)===norm(b.author)}
async function importJson(file){try{const rows=JSON.parse(await file.text());if(!Array.isArray(rows))throw Error('Format');const good=rows.map(r=>{if(!r||!String(r.title||'').trim())throw Error('Titel fehlt');const clean=Object.fromEntries(IMPORT_FIELDS.filter(k=>Object.hasOwn(r,k)).map(k=>[k,r[k]]));clean.id=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(clean.id||'')?clean.id:uuid();return normalizeBook(clean)});const fresh=[];let duplicates=0;for(const b of good){if([...state.books,...fresh].some(old=>duplicateBook(old,b)||old.id===b.id)){duplicates++;continue}fresh.push(b)}if(!fresh.length){toast(`${duplicates} bereits vorhanden · nichts überschrieben`);return}state.books=[...fresh,...state.books];saveLocal();renderAll();if(state.supabase&&state.user){const payload=fresh.map(b=>({...b,user_id:state.user.id})),{error}=await state.supabase.from(CONFIG.tableName||'books').upsert(payload,{onConflict:'id'});if(error){console.warn(error);toast(`${fresh.length} lokal importiert · Online-Sync fehlgeschlagen`);return}}toast(`${fresh.length} Bücher übernommen${duplicates?` · ${duplicates} schon vorhanden`:''}`)}catch(e){console.warn(e);toast('Importdatei nicht lesbar')}}
function bindEvents(){document.addEventListener('click',async e=>{if(e.target.closest('[data-quick-control]'))return;const coverChoice=e.target.closest('[data-cover-choice]');if(coverChoice){const box=$('#searchResults'),variant=box._coverVariants?.[Number(coverChoice.dataset.coverChoice)],resultIndex=box._coverResultIndex;if(variant&&Number.isInteger(resultIndex))await finalizeSearchAdd(resultIndex,variant);return}const authorChoice=e.target.closest('[data-author-open]');if(authorChoice){const name=decodeURIComponent(authorChoice.dataset.authorOpen||'');renderAuthorProfile(name);openSheet('#authorsSheet');return}const authorFilter=e.target.closest('[data-author-filter]');if(authorFilter){state.activeAuthor=decodeURIComponent(authorFilter.dataset.authorFilter||'');closeOverlays();showView('library');renderLibrary();return}const card=e.target.closest('[data-book-id]');if(card){openBook(card.dataset.bookId);return}const result=e.target.closest('[data-result-index]');if(result){await addFromSearch(Number(result.dataset.resultIndex));return}const filter=e.target.closest('[data-filter]');if(filter){state.activeFilter=filter.dataset.filter;renderLibrary();return}const ovs=e.target.closest('[data-overlay-status]');if(ovs){state.activeFilter=ovs.dataset.overlayStatus;renderOverlayFilters();return}const ovf=e.target.closest('[data-overlay-format]');if(ovf){state.activeFormat=ovf.dataset.overlayFormat;renderOverlayFilters();return}const nav=e.target.closest('[data-nav]');if(nav){showView(nav.dataset.nav);return}const seg=e.target.closest('[data-add-mode]');if(seg){switchAddMode(seg.dataset.addMode);return}const a=e.target.closest('[data-action]')?.dataset.action;if(!a)return;if(a==='open-add'){openSheet('#addSheet');setTimeout(()=>$('#bookSearchInput').focus(),300)}else if(a==='open-stats')showView('stats');else if(a==='open-global-search'){renderOverlayFilters();openSheet('#searchSheet');setTimeout(()=>$('#globalSearchInput').focus(),300)}else if(a==='open-settings'){updateSyncCard();openSheet('#settingsSheet')}else if(a==='open-authors'){renderAuthors();openSheet('#authorsSheet')}else if(a==='back-to-authors'){renderAuthors()}else if(a==='clear-author'){state.activeAuthor='all';renderLibrary()}else if(a==='close-overlays'||a==='close-detail')closeOverlays();else if(a==='back-to-search-results'){renderSearchResults($('#searchResults')._results||[])}else if(a==='lookup-isbn')await lookupIsbn();else if(a==='apply-search'){state.searchQuery=$('#globalSearchInput').value;state.sort=$('#sortSelect').value;state.activeAuthor=$('#authorSelect').value;closeOverlays();showView('library');renderLibrary()}else if(a==='stats-prev-year'){state.statsYear--;renderStats()}else if(a==='stats-next-year'){state.statsYear++;renderStats()}else if(a==='edit-book')editBookInline();else if(a==='detail-back')renderDetail();else if(a==='cycle-status')cycleStatus();else if(a==='mark-finished'){const b=state.books.find(x=>x.id===state.activeBookId);if(b){b.status='finished';b.finished_at=b.finished_at||new Date().toISOString().slice(0,10);b.current_page=b.pages||b.current_page;await persistBook(b);renderAll();renderDetail();toast('Als gelesen markiert')}}else if(a==='delete-book'){if(confirm('Dieses Buch wirklich löschen?'))await removeBook(state.activeBookId)}else if(a==='export-json')exportJson();else if(a==='sign-out'){if(state.supabase)await state.supabase.auth.signOut();state.user=null;updateSyncCard();toast('Abgemeldet')}else if(a==='book-menu-toggle')$('#bookMenu')?.classList.toggle('hidden');else if(a==='expand-summary'){const text=$('#bookSummaryText'),btn=e.target.closest('[data-action]');if(text){const collapsed=text.classList.toggle('is-collapsed');btn.textContent=collapsed?'Mehr anzeigen':'Weniger anzeigen';btn.setAttribute('aria-expanded',String(!collapsed))}}});document.addEventListener('change',async e=>{const input=e.target.closest('[data-quick-page]');if(!input)return;const b=state.books.find(x=>x.id===input.dataset.quickPage);if(!b)return;let n=Number(input.value);if(!Number.isFinite(n))n=b.current_page||0;n=Math.max(0,Math.round(n));if(b.pages)n=Math.min(n,b.pages);b.current_page=n;await persistBook(b);renderLibrary();toast(`Seite ${n} gespeichert`)});document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-quick-page]')){e.preventDefault();e.target.blur()}});let t;$('#bookSearchInput').addEventListener('input',e=>{clearTimeout(t);t=setTimeout(()=>searchOpenLibrary(e.target.value),260)});$('#clearBookSearch').addEventListener('click',()=>{$('#bookSearchInput').value='';$('#searchResults').innerHTML='';$('#bookSearchInput').focus()});$('#manualAddForm').addEventListener('submit',e=>{e.preventDefault();addManual(e.currentTarget)});$('#passwordLoginForm').addEventListener('submit',e=>{e.preventDefault();const email=$('#passwordLoginEmail').value.trim(),pass=$('#passwordLoginPassword').value;signInBookfolioWithPassword(email,pass)});$('#passwordChangeForm').addEventListener('submit',e=>{e.preventDefault();setBookfolioPassword($('#passwordNew').value,$('#passwordConfirm').value)});$('#authForm').addEventListener('submit',e=>{e.preventDefault();const m=$('#authEmail').value.trim();if(m)sendMagicLink(m)});$('#authOtpForm').addEventListener('submit',e=>{e.preventDefault();verifyEmailCode(getAuthEmail(),$('#authOtpCode').value.trim())});$('#authLinkForm').addEventListener('submit',e=>{e.preventDefault();verifyCopiedMagicLink($('#authLinkInput').value.trim())});$('#backupProxyFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importCompleteBackup(f);e.target.value=''});$('#importFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importJson(f);e.target.value=''})}

async function persistMetadataPatch(book,patch){
  if(!Object.keys(patch).length)return false;
  if(state.supabase&&state.user){
    const {error}=await state.supabase.from(CONFIG.tableName||'books').update(patch).eq('id',book.id);
    if(error)throw error;
  }
  Object.assign(book,patch);saveLocal();renderLibrary();
  if(state.activeBookId===book.id && $('#detailSheet').getAttribute('aria-hidden')==='false')renderDetail();
  return true;
}
async function autoCompleteNewBook(book){
  if(!navigator.onLine||!state.books.some(x=>x.id===book.id))return;
  try{
    const proposal=await lookupBookMetadata(book);
    if(!proposal)return;
    const patch=makeMetadataPatch(book,proposal);
    // A title search cannot identify the user's exact edition; do not guess a new ISBN.
    if(!book.isbn)delete patch.isbn;
    await persistMetadataPatch(book,patch);
  }catch(err){console.debug('Metadaten später ergänzen',err)}
}
function metadataStatus(message){const el=$('#metadataBatchStatus');if(el)el.textContent=message;}
function previewMetadata(){
  const book=state.books.find(b=>b.id===state.metadataBookId),result=state.metadataResult,box=$('#metadataContent');
  if(!book||!box)return;
  if(!result){box.innerHTML=`<div class="sheet-header"><div><p class="eyebrow">Buchdaten</p><h2>${esc(book.title)}</h2></div><button class="icon-button" data-action="close-overlays" aria-label="Schließen">×</button></div><p class="hint">${state.metadataBusy?'Wir suchen Cover und Beschreibungen …':'Keine eindeutigen Buchdaten gefunden. Du kannst Angaben weiterhin manuell bearbeiten.'}</p>${!state.metadataBusy?'<button class="small-button" data-meta-action="edit">Manuell bearbeiten</button>':''}`;return;}
  const selected=state.metadataCoverChoice;
  const choices=result.variants||[];
  const patch=makeMetadataPatch(book,result,{selectedCover:selected,replaceCover:!!selected&&selected!==book.cover_url});
  const entries=[['cover_url','Cover'],['description','Kurzinhalt'],['isbn','ISBN'],['pages','Seitenzahl'],['published_year','Erscheinungsjahr'],['language','Sprache']];
  const labels=entries.filter(([key])=>patch[key]!==undefined).map(([key,label])=>`<li><strong>${label}</strong><span>${key==='description'?'Kurze Inhaltsangabe':key==='cover_url'?'Ausgewähltes Cover':esc(String(patch[key]))}</span></li>`).join('');
  box.innerHTML=`<div class="sheet-header"><div><p class="eyebrow">Buchdaten vervollständigen</p><h2>${esc(book.title)}</h2><p class="muted">${esc(book.author||'')}</p></div><button class="icon-button" data-action="close-overlays" aria-label="Schließen">×</button></div>
    <p class="hint">Gefunden: ${esc(result.matched_title||'')} · ${esc(result.matched_author||'')}. Vorhandene Angaben bleiben erhalten; nur ein bewusst ausgewähltes Cover wird ersetzt.</p>
    ${choices.length?`<h3 class="metadata-label">Cover auswählen <span>(optional)</span></h3><div class="metadata-cover-grid"><button class="metadata-cover-choice ${!selected?'selected':''}" data-meta-action="keep-cover"><span class="metadata-cover-old">${book.cover_url?coverImg(book):'—'}</span><small>${book.cover_url?'Bisheriges Cover':'Kein Cover ändern'}</small></button>${choices.slice(0,6).map((c,i)=>`<button class="metadata-cover-choice ${selected===c.url?'selected':''}" data-meta-action="select-cover" data-cover-index="${i}"><img src="${esc(c.url)}" alt="Cover-Variante ${i+1}" loading="lazy"><small>${esc(c.label||'Ausgabe')}</small></button>`).join('')}</div>`:''}
    <h3 class="metadata-label">Kurzinhalt</h3><div class="metadata-description">${esc(book.description||result.description||'Keine Beschreibung gefunden.')}</div>${result.description_source?`<p class="muted small">Quelle: ${esc(result.description_source)}${book.description?' (eigene vorhandene Beschreibung bleibt)':''}</p>`:''}
    <h3 class="metadata-label">Was wird ergänzt?</h3>${labels?`<ul class="metadata-field-list">${labels}</ul>`:'<p class="hint">Keine fehlenden Angaben gefunden. Wähle oben ein anderes Cover, um es auszutauschen.</p>'}
    <button class="primary-button metadata-submit" data-meta-action="apply" ${!labels?'disabled':''}>${labels?'Ausgewählte Buchdaten übernehmen':'Nichts zu ergänzen'}</button>`;
}
async function openMetadataReview(id){
  const book=state.books.find(b=>b.id===id);if(!book)return;
  state.metadataBookId=id;state.metadataResult=null;state.metadataCoverChoice=null;state.metadataBusy=true;
  openSheet('#metadataSheet');previewMetadata();
  try{const result=await lookupBookMetadata(book,{withVariants:true});if(state.metadataBookId!==id)return;state.metadataResult=result;}
  catch(err){console.warn(err);toast('Suche fehlgeschlagen')}
  finally{if(state.metadataBookId===id){state.metadataBusy=false;previewMetadata()}}
}
async function applyMetadataReview(){
  const book=state.books.find(b=>b.id===state.metadataBookId),proposal=state.metadataResult;
  if(!book||!proposal||state.metadataBusy)return;
  const selected=state.metadataCoverChoice;
  const patch=makeMetadataPatch(book,proposal,{selectedCover:selected,replaceCover:!!selected&&selected!==book.cover_url});
  if(!Object.keys(patch).length){toast('Nichts zu ergänzen');return;}
  state.metadataBusy=true;
  try{await persistMetadataPatch(book,patch);state.metadataResult=null;state.metadataCoverChoice=null;closeOverlays();openBook(book.id);toast('Buchdaten ergänzt')}
  catch(err){console.warn(err);toast('Speichern fehlgeschlagen – bitte erneut versuchen')}
  finally{state.metadataBusy=false}
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function bulkMetadata(){
  if(state.metadataBatchBusy)return;
  const items=state.books.filter(b=>missingFields(b).length>0);const start=items.length?state.metadataBatchCursor%items.length:0;const batch=items.length<=12?items:[...items.slice(start,start+12),...items.slice(0,Math.max(0,12-(items.length-start)))];
  if(!batch.length){metadataStatus('Alle vorhandenen Buchdaten sind vollständig.');return;}
  if(!confirm(`${batch.length} Bücher auf fehlende Cover, Buchangaben und Kurzbeschreibungen prüfen? Vorhandene Felder, Bewertungen, Lesedaten und Zitate bleiben unverändert.${items.length>12?' Weitere Bücher können danach geprüft werden.':''}`))return;
  state.metadataBatchBusy=true;let updated=0,unmatched=0,failed=0;
  const btn=$('[data-meta-action="bulk"]');if(btn)btn.disabled=true;
  for(let i=0;i<batch.length;i++){
    const book=batch[i];metadataStatus(`Prüfe ${i+1} von ${batch.length}: ${book.title} …`);
    try{
      const result=await lookupBookMetadata(book);
      if(!result){unmatched++;continue;}
      const patch=makeMetadataPatch(book,result);
      if(!book.isbn)delete patch.isbn;
      if(Object.keys(patch).length){await persistMetadataPatch(book,patch);updated++;}else unmatched++;
    }catch(err){console.warn('Metadaten',book.title,err);failed++}
    await sleep(300);
  }
  state.metadataBatchBusy=false;state.metadataBatchCursor=items.length>12?(start+batch.length)%items.length:0;if(btn)btn.disabled=false;
  metadataStatus(`${updated} Bücher ergänzt · ${unmatched} ohne neue Daten${failed?` · ${failed} Fehler`:''}. ${items.length>batch.length?'Weitere Bücher beim nächsten Durchlauf möglich.':''}`);
  toast(`${updated} Bücher ergänzt`);
}
function bindMetadataEvents(){
  document.addEventListener('click',async e=>{
    const btn=e.target.closest('[data-meta-action]');if(!btn)return;
    e.preventDefault();e.stopPropagation();
    const action=btn.dataset.metaAction;
    if(action==='open')await openMetadataReview(state.activeBookId);
    else if(action==='keep-cover'){state.metadataCoverChoice=null;previewMetadata()}
    else if(action==='select-cover'){const c=state.metadataResult?.variants?.[Number(btn.dataset.coverIndex)];if(c){state.metadataCoverChoice=c.url;previewMetadata()}}
    else if(action==='apply')await applyMetadataReview();
    else if(action==='bulk')await bulkMetadata();
    else if(action==='edit'){closeOverlays();openBook(state.metadataBookId);editBookInline()}
  },true);
}
async function boot(){loadLocal();loadLocalQuotes();try{const email=localStorage.getItem('bookfolio-login-email');if(email&&$('#authEmail'))$('#authEmail').value=email;if(email&&$('#passwordLoginEmail'))$('#passwordLoginEmail').value=email}catch{}bindEvents();bindQuoteEvents();bindMetadataEvents();renderAll();await initSupabase();if(!CONFIG.previewMode&&'serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{})}

// Bookfolio V0.7 — private quotes and per-book imports, optional Supabase sync.
// This file is appended to app.js at build time, sharing the same module scope.
const QUOTE_KEY = 'meine-bibliothek-zitate-v06';
let quoteImportDraft = null;
let quoteImportTarget = null;
function loadLocalQuotes(){try{const a=JSON.parse(localStorage.getItem(QUOTE_KEY)||'[]');state.quotes=Array.isArray(a)?a:[]}catch{state.quotes=[]}}
function saveLocalQuotes(){try{localStorage.setItem(QUOTE_KEY,JSON.stringify(state.quotes))}catch(err){console.warn(err);toast('Gerätespeicher voll – bitte Backup sichern')}}
function qsFor(bookId){return state.quotes.filter(q=>q.book_id===bookId)}
async function pullQuotesFromSupabase(previousBooks=[]){
  if(!state.user || !state.supabase)return;
  const {data,error}=await state.supabase.from('book_quotes').select('*').order('created_at',{ascending:true});
  if(error){console.warn(error);toast('Zitate-Synchronisierung derzeit nicht möglich');return;}
  const remote=data||[],extra=[];
  for(const q of state.quotes){
    let b=state.books.find(b=>b.id===q.book_id);
    if(!b){const old=previousBooks.find(b=>b.id===q.book_id);if(old)b=state.books.find(now=>duplicateBook(now,old));}
    if(!b)continue;
    q.book_id=b.id;
    if(!remote.some(r=>r.book_id===b.id && r.fingerprint===q.fingerprint))extra.push({...q,user_id:state.user.id});
  }
  if(extra.length){
    const {error:pushErr}=await state.supabase.from('book_quotes').upsert(extra,{onConflict:'user_id,book_id,fingerprint',ignoreDuplicates:true});
    if(pushErr){console.warn(pushErr);toast('Zitate nur lokal gesichert · Sync fehlgeschlagen')}
    else remote.push(...extra);
  }
  const keys=new Set(remote.map(q=>`${q.book_id}/${q.fingerprint}`));
  state.quotes=[...remote,...state.quotes.filter(q=>!keys.has(`${q.book_id}/${q.fingerprint}`))];
  saveLocalQuotes();
}
async function saveQuotes(quotes){
  state.quotes.push(...quotes);
  saveLocalQuotes();
  if(state.supabase&&state.user){
    const payload=quotes.map(q=>({...q,user_id:state.user.id}));
    const {error}=await state.supabase.from('book_quotes').upsert(payload,{onConflict:'user_id,book_id,fingerprint',ignoreDuplicates:true});
    if(error){console.warn(error);toast('Lokal gespeichert · Zitate-Sync fehlgeschlagen');return false;}
  }
  return true;
}
async function removeQuote(id){
  const q=state.quotes.find(q=>q.id===id);if(!q)return;
  if(state.supabase&&state.user){
    const {error}=await state.supabase.from('book_quotes').delete().eq('id',id);
    if(error){console.warn(error);toast('Löschen online nicht möglich');return;}
  }
  state.quotes=state.quotes.filter(q=>q.id!==id);saveLocalQuotes();
  renderQuotesSheet(q.book_id);renderDetail();toast('Zitat entfernt');
}
function renderQuotePreview(book){
  const qs=qsFor(book.id),last=qs[0];
  return `<section class="detail-block quote-summary">
    <div class="quote-heading"><div><p class="eyebrow">Fundstellen</p><h3>Markierungen & Zitate <span class="quote-count">${qs.length||''}</span></h3></div><button class="quote-mini-button" data-quote-action="pick-file" data-quote-book="${esc(book.id)}" aria-label="Markierungen importieren">＋</button></div>
    ${last?`<button class="quote-peek" data-quote-action="open-quotes" data-quote-book="${esc(book.id)}"><span class="quote-mark">“</span><span>${esc(last.body.slice(0,185))}${last.body.length>185?' …':''}</span><span class="quote-peek-foot">Alle ${qs.length} anzeigen →</span></button>`:`<button class="quote-peek empty-quote" data-quote-action="pick-file" data-quote-book="${esc(book.id)}">Noch keine Markierungen. TXT oder Markdown importieren <span>↗</span></button>`}
  </section>`;
}
function quoteMeta(q){
  const bits=[];
  if(q.marked_at){const d=q.marked_at.match(/^(\d{4})-(\d{2})-(\d{2})T(\d\d):(\d\d)$/);if(d)bits.push(`${d[3]}.${d[2]}.${d[1]} · ${d[4]}:${d[5]}`)}
  bits.push(q.source==='tolino'?'Tolino':q.source==='yomu'?'Yomu':'Eigene Notiz');
  return bits.join(' · ');
}
function renderQuotesSheet(bookId){
  const b=state.books.find(x=>x.id===bookId);if(!b)return;
  state.quoteTargetBookId=bookId;
  const qs=qsFor(bookId);
  const groups=[];
  for(const q of qs){const chapter=q.chapter?.trim()||'Ohne Kapitelangabe';let g=groups.find(g=>g.name===chapter);if(!g){g={name:chapter,quotes:[]};groups.push(g);}g.quotes.push(q)}
  $('#quotesContent').innerHTML=`<header class="sheet-header quotes-header"><div><p class="eyebrow">${esc(b.author||'Meine Bibliothek')}</p><h2>Markierungen</h2><p class="muted small">${esc(b.title)} · ${qs.length} ${qs.length===1?'Zitat':'Zitate'}</p></div><button class="icon-button" data-quote-action="back-detail" aria-label="Zurück zum Buch">×</button></header>
  <div class="quotes-toolbar"><button class="small-button" data-quote-action="pick-file" data-quote-book="${esc(bookId)}">↥ Import</button><button class="small-button" data-quote-action="add-manual">＋ Zitat</button><button class="quote-text-button" data-quote-action="export-md">Markdown ↓</button></div>
  ${!qs.length?'<div class="empty-quotes">Noch keine Zitate. Importiere eine Tolino-TXT- oder Yomu-Markdown-Datei oder ergänze ein eigenes Zitat.</div>':groups.map(g=>`<section class="quote-chapter"><h3>${esc(g.name)}</h3>${g.quotes.map(q=>`<article class="quote-card" data-quote-id="${esc(q.id)}"><div class="quote-card-text">${esc(q.body).replace(/\n/g,'<br>')}</div><div class="quote-card-meta"><span>${esc(quoteMeta(q))}</span><div>${q.source_url?.startsWith('yomu://content/annotation/')?`<a href="${esc(q.source_url)}" class="quote-source-link">Yomu ↗</a>`:''}<button class="quote-remove" data-quote-action="delete" data-quote-id="${esc(q.id)}" title="Zitat löschen">×</button></div></div></article>`).join('')}</section>`).join('')}`;
}
function openQuotes(bookId){renderQuotesSheet(bookId);openSheet('#quotesSheet')}
function bookMatchScore(b, parsed){
  const a=QuoteParser.norm(b.title),t=QuoteParser.norm(parsed.title),author=QuoteParser.norm(b.author),au=QuoteParser.norm(parsed.author);
  if(!a||!t)return 0;
  const score=a===t?8:(a.includes(t)||t.includes(a)?3:0);
  return score+(author&&au?(author===au?6:author.includes(au)||au.includes(author)?2:0):0);
}
function chooseMatchingBook(parsed){
  const ranked=state.books.map(b=>({b,score:bookMatchScore(b,parsed)})).sort((x,y)=>y.score-x.score);
  return ranked[0]?.score>=8?ranked[0].b:null;
}
async function importQuoteFile(file){
  if(!file)return;
  if(!/\.(txt|md)$/i.test(file.name)){toast('Bitte TXT oder Markdown wählen');return;}
  try {
    const parsed=QuoteParser.parse(await file.text(),file.name);
    const preferred=state.books.find(b=>b.id===quoteImportTarget)||chooseMatchingBook(parsed);
    quoteImportDraft={...parsed,filename:file.name};
    const options=state.books.slice().sort((a,b)=>bookMatchScore(b,parsed)-bookMatchScore(a,parsed)||a.title.localeCompare(b.title,'de'));
    const sameAsTarget=preferred&&bookMatchScore(preferred,parsed)<3;
    $('#quotesImportContent').innerHTML=`<div class="sheet-header"><div><p class="eyebrow">Datei erkannt · ${parsed.format==='yomu'?'Yomu':'Tolino / Notulator'}</p><h2>Markierungen importieren</h2></div><button class="icon-button" data-action="close-overlays" aria-label="Schließen">×</button></div>
      <div class="quote-import-summary"><strong>${esc(parsed.title)}</strong><span>${esc(parsed.author||'Autor unbekannt')} · ${parsed.highlights.length} Markierungen</span></div>
      <label class="quote-import-book-label">Zu welchem Buch?<select id="quoteImportBook" class="select-field">
        <option value="__new__" ${!preferred?'selected':''}>＋ Neues Buch aus Export anlegen</option>
        ${options.map(b=>`<option value="${esc(b.id)}" ${preferred?.id===b.id?'selected':''}>${esc(b.title)} · ${esc(b.author||'—')}</option>`).join('')}
      </select></label>
      ${sameAsTarget?'<p class="quote-warning">Titel und Autor unterscheiden sich vom ausgewählten Buch. Bitte die Zuordnung prüfen.</p>':''}
      <div class="quote-import-samples"><p class="eyebrow">Vorschau</p>${parsed.highlights.slice(0,3).map(q=>`<div><strong>${esc(q.chapter||'Zitat')}</strong><p>${esc(q.text.slice(0,160))}${q.text.length>160?' …':''}</p></div>`).join('')}</div>
      <button class="primary-button" data-quote-action="confirm-import">${parsed.highlights.length} Markierungen übernehmen</button>`;
    openSheet('#quotesImportSheet');
  } catch(err){console.warn(err);toast(err.message||'Datei konnte nicht gelesen werden')}
}
async function enrichBookFromOpenLibrary(book){
  return autoCompleteNewBook(book);
}
async function confirmQuoteImport(){
  if(!quoteImportDraft)return;
  const parsed=quoteImportDraft;
  const chosen=$('#quoteImportBook').value;
  let book=state.books.find(b=>b.id===chosen);
  if(!book){
    book=normalizeBook({id:uuid(),title:parsed.title||'Unbekannter Titel',author:parsed.author||'',format:'ebook',status:'unread',created_at:new Date().toISOString()});
    state.books.unshift(book);await persistBook(book);
    enrichBookFromOpenLibrary(book);
  }else if(bookMatchScore(book,parsed)<3){
    if(!confirm(`Die Exportdatei heißt „${parsed.title}“, das gewählte Buch „${book.title}“. Trotzdem zuordnen?`))return;
  }
  const known=new Set(qsFor(book.id).map(q=>q.fingerprint));
  const now=Date.now();const fresh=[];
  for(const item of parsed.highlights){
    if(known.has(item.fingerprint))continue;known.add(item.fingerprint);
    fresh.push({id:uuid(),book_id:book.id,body:item.text,chapter:item.chapter||'',marked_at:item.marked_at||null,source:item.source,source_url:item.source_url||null,location:item.location||null,fingerprint:item.fingerprint,created_at:new Date(now+fresh.length).toISOString()});
  }
  if(fresh.length) await saveQuotes(fresh);
  quoteImportDraft=null;quoteImportTarget=null;
  renderAll();openQuotes(book.id);toast(`${fresh.length} Markierungen übernommen${parsed.highlights.length-fresh.length?` · ${parsed.highlights.length-fresh.length} bereits vorhanden`:''}`);
}
function openManualQuote(){
  const b=state.books.find(b=>b.id===state.quoteTargetBookId);if(!b)return;
  $('#quotesContent').innerHTML=`<div class="sheet-header"><div><p class="eyebrow">${esc(b.title)}</p><h2>Zitat hinzufügen</h2></div><button class="icon-button" data-quote-action="return-list" aria-label="Zurück">×</button></div>
    <form id="manualQuoteForm" class="manual-form quote-manual-form"><label>Zitat<textarea name="body" rows="6" required placeholder="Text des Zitats …"></textarea></label><label>Kapitel / Fundstelle <small>optional</small><input name="chapter" placeholder="Kapitelname"></label><button class="primary-button" type="submit">Zitat speichern</button></form>`;
}
async function saveManualQuote(form){
  const f=new FormData(form),body=String(f.get('body')||'').trim(),chapter=String(f.get('chapter')||'').trim();
  if(!body)return;
  const fingerprint=QuoteParser.fingerprint(body),bid=state.quoteTargetBookId;
  if(qsFor(bid).some(q=>q.fingerprint===fingerprint)){toast('Zitat ist schon vorhanden');return;}
  await saveQuotes([{id:uuid(),book_id:bid,body,chapter,source:'manual',source_url:null,location:null,marked_at:null,fingerprint,created_at:new Date().toISOString()}]);
  renderQuotesSheet(bid);renderDetail();toast('Zitat gespeichert');
}
function saveDownload(filename,text,type){
  const blob=new Blob([text],{type}),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(href),1500);
}
function exportQuotesMd(bookId){
  const book=state.books.find(b=>b.id===bookId);if(!book)return;
  let md=`# ${book.title}\n\n${book.author||''}\n\n## Markierungen\n\n`;
  for(const q of qsFor(bookId))md+=`${q.chapter?'### '+q.chapter+'\n\n':''}${q.body.split('\n').map(l=>'> '+l).join('\n')}\n\n_${quoteMeta(q)}_\n\n---\n\n`;
  saveDownload((book.title||'Zitate').replace(/[\\/:*?"<>|]/g,'-')+' - Markierungen.md',md,'text/markdown;charset=utf-8');
}
function exportCompleteBackup(){saveDownload(`meine-bibliothek-komplett-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({format:'meine-bibliothek-v06',books:state.books,quotes:state.quotes},null,2),'application/json')}
async function importCompleteBackup(file){
  try{
    const obj=JSON.parse(await file.text());if(obj?.format!=='meine-bibliothek-v06'||!Array.isArray(obj.books)||!Array.isArray(obj.quotes))throw Error('Bitte ein vollständiges V0.6-Backup wählen');
    const newBooks=[]; const idMap=new Map();
    for(const raw of obj.books){if(!raw.title)continue;const old=state.books.find(b=>b.id===raw.id||duplicateBook(b,raw));
      if(old){idMap.set(raw.id,old.id);continue;}
      const clean=Object.fromEntries(IMPORT_FIELDS.filter(k=>Object.hasOwn(raw,k)).map(k=>[k,raw[k]]));
      clean.id=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(clean.id||'')?clean.id:uuid();
      const book=normalizeBook(clean);newBooks.push(book);idMap.set(raw.id,book.id);
    }
    const allBooks=[...state.books,...newBooks],already=new Set(state.quotes.map(q=>`${q.book_id}/${q.fingerprint}`)),qs=[];
    for(const item of obj.quotes){const bookId=idMap.get(item.book_id)||item.book_id;if(!allBooks.some(b=>b.id===bookId)||!String(item.body||'').trim())continue;
      const f=QuoteParser.fingerprint(item.body),key=`${bookId}/${f}`;if(already.has(key))continue;already.add(key);
      qs.push({id:uuid(),book_id:bookId,body:String(item.body),chapter:String(item.chapter||''),marked_at:item.marked_at||null,source:['tolino','yomu','manual'].includes(item.source)?item.source:'manual',source_url:item.source_url||null,location:item.location||null,fingerprint:f,created_at:item.created_at||new Date().toISOString()});
    }
    state.books.unshift(...newBooks);saveLocal();
    if(state.user&&state.supabase&&newBooks.length){const {error}=await state.supabase.from(CONFIG.tableName||'books').upsert(newBooks.map(b=>({...b,user_id:state.user.id})),{onConflict:'id'});if(error)toast('Bücher lokal gesichert · Online-Sync fehlgeschlagen')}
    if(qs.length)await saveQuotes(qs);
    renderAll();toast(`${newBooks.length} Bücher, ${qs.length} Zitate ergänzt`);
  }catch(e){console.warn(e);toast(e.message||'Backup nicht lesbar')}
}
function bindQuoteEvents(){
  document.addEventListener('click',async e=>{
    const btn=e.target.closest('[data-quote-action]');if(!btn)return;
    e.preventDefault();e.stopPropagation();
    const action=btn.dataset.quoteAction;
    if(action==='pick-file'){
      quoteImportTarget=btn.dataset.quoteBook||null;
      $('#quotesFile').value='';$('#quotesFile').click();
    }else if(action==='open-quotes')openQuotes(btn.dataset.quoteBook);
    else if(action==='back-detail'){openBook(state.quoteTargetBookId)}
    else if(action==='return-list')renderQuotesSheet(state.quoteTargetBookId);
    else if(action==='confirm-import')await confirmQuoteImport();
    else if(action==='add-manual')openManualQuote();
    else if(action==='export-md')exportQuotesMd(state.quoteTargetBookId);
    else if(action==='delete'){if(confirm('Dieses Zitat löschen?'))await removeQuote(btn.dataset.quoteId)}
    else if(action==='export-full')exportCompleteBackup();
  },true);
  $('#quotesFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(f)await importQuoteFile(f);e.target.value=''});
  $('#completeBackupFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(f)await importCompleteBackup(f);e.target.value=''});
  $('#quotesSheet').addEventListener('submit',async e=>{if(e.target.id!=='manualQuoteForm')return;e.preventDefault();await saveManualQuote(e.target)});
}

boot();
