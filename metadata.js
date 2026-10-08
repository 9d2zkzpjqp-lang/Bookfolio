// Bookfolio V0.7: metadata lookup. No account keys or personal data leave the app.
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
  const lastName=author.split(' ').filter(Boolean).at(-1)||'';
  const authorFit = !author ? .5 :
    (ca===author || ca.includes(author) || candidateAuthors.some(name=>name===author)) ? 1 :
    (lastName.length>=3 && candidateAuthors.some(name=>name.split(' ').at(-1)===lastName)) ? .9 : 0;
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
async function getJSON(url, signal) {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 7000);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once:true });
  try {
    if (signal?.aborted) return null;
    const res = await fetch(url, { signal:controller.signal, headers:{ Accept:'application/json' } });
    return res.ok ? await res.json() : null;
  } catch { return null; }
  finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
const year = v => Number(String(v || '').match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/)?.[1]) || null;
const olCover = id => id ? `https://covers.openlibrary.org/b/id/${Number(id)}-L.jpg` : '';
const safeImage = url => {
  try { const u = new URL(String(url).replace(/^http:/,'https:')); return u.protocol==='https:' ? u.toString() : ''; }
  catch { return ''; }
};
const olDesc = value => typeof value === 'string' ? value : (value?.value || '');

export async function lookupBookMetadata(book, {signal, withVariants = false} = {}) {
  if (!book?.title) return null;
  const isbn = String(book.isbn || '').replace(/[^0-9X]/gi,'');
  const fields = 'key,title,author_name,cover_i,isbn,number_of_pages_median,first_publish_year,language';
  const params = new URLSearchParams({title:book.title, limit:'12', fields});
  if (book.author) params.set('author',book.author);
  let [olSearch, googleSearch] = await Promise.all([
    getJSON(`https://openlibrary.org/search.json?${params}`, signal),
    getJSON(`https://www.googleapis.com/books/v1/volumes?${new URLSearchParams({q: isbn ? `isbn:${isbn}` : `intitle:${book.title} ${book.author ? `inauthor:${book.author}` : ''}`,maxResults:'12',printType:'books'})}`,signal)
  ]);
  // A catalog may only index the FIRST of several authors. Example: a book
  // stored as "Anfänge — David Wengrow" is cataloged under Graeber & Wengrow.
  // Validate candidates LOCALLY after querying title-only to avoid false matches.
  const parseOL = search => (search?.docs||[]).map(d=>({
    title:d.title, authors:d.author_name||[], author:(d.author_name||[]).join(' '), isbns:d.isbn||[],
    cover_url:olCover(d.cover_i), isbn:d.isbn?.[0]||'', pages:d.number_of_pages_median||null,
    published_year:d.first_publish_year||null,
    language:(d.language||[]).includes('ger')?'Deutsch':(d.language||[]).includes('eng')?'Englisch':'',
    work_key:/^\/works\/OL\d+W$/.test(d.key||'')?d.key:'', source:'Open Library'
  })).map(x=>({...x,score:matchScore(book,x)})).filter(x=>x.score>=.75).sort((a,b)=>b.score-a.score);
  const parseGB = search => (search?.items||[]).map(item=>{
    const v=item.volumeInfo||{};
    return {title:v.title||'',author:(v.authors||[]).join(' '),authors:v.authors||[],
      isbns:(v.industryIdentifiers||[]).map(x=>x.identifier),cover_url:safeImage(v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail),
      isbn:(v.industryIdentifiers||[]).find(x=>x.type==='ISBN_13')?.identifier||'',pages:v.pageCount||null,
      published_year:year(v.publishedDate), language:v.language==='de'?'Deutsch':v.language==='en'?'Englisch':'',
      description:shortDescription(v.description||''), description_source:'Google Books',
      description_source_url:safeImage(v.infoLink||''),source:'Google Books'};
  }).map(x=>({...x,score:matchScore(book,x)})).filter(x=>x.score>=.75).sort((a,b)=>b.score-a.score);

  let olMatches = parseOL(olSearch), gbMatches = parseGB(googleSearch);
  // Retry a broader title-only query independently for each catalog that did
  // not produce a trustworthy match. Keep the same local title/author filter.
  if (!olMatches.length || !gbMatches.length) {
    const titleOnly = new URLSearchParams({title:book.title,limit:'30',fields});
    const googleTitle = new URLSearchParams({q:`intitle:${book.title}`,maxResults:'30',printType:'books'});
    const [olWide,gbWide] = await Promise.all([
      olMatches.length ? Promise.resolve(null) : getJSON(`https://openlibrary.org/search.json?${titleOnly}`, signal),
      gbMatches.length ? Promise.resolve(null) : getJSON(`https://www.googleapis.com/books/v1/volumes?${googleTitle}`,signal)
    ]);
    olSearch ||= olWide; googleSearch ||= gbWide;
    if (!olMatches.length) olMatches = parseOL(olWide);
    if (!gbMatches.length) gbMatches = parseGB(gbWide);
  }
  if (!olMatches.length && !gbMatches.length) {
    // Last chance: general full-text search, useful for punctuation and
    // multilingual catalog entries where the title field is incomplete.
    const familyName=norm(book.author).split(' ').filter(Boolean).pop()||'';
    const q=[book.title,familyName].filter(Boolean).join(' ');
    const [olWide,gbWide]=await Promise.all([
      getJSON(`https://openlibrary.org/search.json?${new URLSearchParams({q,limit:'30',fields})}`,signal),
      getJSON(`https://www.googleapis.com/books/v1/volumes?${new URLSearchParams({q,maxResults:'25',printType:'books'})}`,signal)
    ]);
    olSearch ||= olWide;googleSearch ||= gbWide;
    olMatches=parseOL(olWide);gbMatches=parseGB(gbWide);
  }
  if (!olSearch && !googleSearch) throw new Error('Keine Verbindung zu Open Library oder Google Books');
  let bestOL=olMatches[0]||null,bestGB=gbMatches[0]||null;
  if (!bestOL && !bestGB) return null;
  // Search gives the work/edition. Fetch the full work record for its description.
  let work = null;
  if (bestOL?.work_key) work = await getJSON(`https://openlibrary.org${bestOL.work_key}.json`, signal);
  const variants = [];
  const addCover = (url,label='') => {url=safeImage(url);if(url && !variants.some(v=>v.url===url))variants.push({url,label});};
  addCover(bestOL?.cover_url,'Open Library');
  addCover(bestGB?.cover_url,'Google Books');
  for (const x of olMatches.slice(1,5)) addCover(x.cover_url,'Weitere Ausgabe');
  if (withVariants && bestOL?.work_key) {
    const editions = await getJSON(`https://openlibrary.org${bestOL.work_key}/editions.json?limit=35`,signal);
    for(const ed of editions?.entries||[]) {
      for(const cover of (ed.covers||[]).slice(0,2)) addCover(olCover(cover),year(ed.publish_date)||'Weitere Ausgabe');
      if(variants.length>=8)break;
    }
  }
  const fromWork = shortDescription(olDesc(work?.description));
  const gbGerman = gbMatches.find(x=>x.description && x.language==='Deutsch');
  const chosenDescription = gbGerman || (bestGB?.description ? bestGB : null);
  const description = chosenDescription?.description || fromWork;
  const descSource = chosenDescription ? chosenDescription.description_source : (fromWork ? 'Open Library' : '');
  const descSourceUrl = chosenDescription ? chosenDescription.description_source_url : (fromWork && bestOL?.work_key ? `https://openlibrary.org${bestOL.work_key}` : '');
  return {
    cover_url:bestOL?.cover_url || bestGB?.cover_url || '',
    isbn:bestOL?.isbn || bestGB?.isbn || '',
    pages:bestOL?.pages || bestGB?.pages || null,
    published_year:bestOL?.published_year || bestGB?.published_year || null,
    language:bestOL?.language || bestGB?.language || '',
    description,description_source:descSource,description_source_url:descSourceUrl,
    variants:variants.slice(0,8),matched_title:bestOL?.title||bestGB.title,
    matched_author:bestOL?.author||bestGB.author,confidence:Math.max(bestOL?.score||0,bestGB?.score||0)
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
export async function searchBookCatalog(query, {signal} = {}) {
  const term = String(query || '').trim().slice(0, 150);
  if (term.length < 2) return [];
  const isbn = term.replace(/[^0-9X]/gi, '');
  const isIsbn = /^\d{10}(?:\d{3})?$/.test(isbn) && /^[\dX\s-]+$/i.test(term);
  const fields = 'key,title,author_name,cover_i,isbn,number_of_pages_median,first_publish_year,language';
  const ol = new URLSearchParams({q: isIsbn ? `isbn:${isbn}` : term,fields,limit:'30'});
  const gb = new URLSearchParams({q: isIsbn ? `isbn:${isbn}` : term,maxResults:'30',printType:'books'});
  // Open Library supports Solr prefix matching; query a partial single-word name
  // in parallel rather than relying on Google's spelling correction.
  const tail=term.match(/[\p{L}]{4,}$/u)?.[0];
  const prefix = !isIsbn && tail ?
    new URLSearchParams({q:`${term.slice(0,-tail.length)}${tail}*`,fields,limit:'30'}) : null;
  const [olData, gbData, prefixData] = await Promise.all([
    getJSON(`https://openlibrary.org/search.json?${ol}`,signal),
    getJSON(`https://www.googleapis.com/books/v1/volumes?${gb}`,signal),
    prefix ? getJSON(`https://openlibrary.org/search.json?${prefix}`,signal) : Promise.resolve(null)
  ]);
  if (!olData && !gbData && !prefixData) throw new Error('Beide Buchkataloge sind momentan nicht erreichbar.');
  const all = [];
  for (const d of [...(olData?.docs || []),...(prefixData?.docs || [])]) {
    if (!d.title) continue;
    all.push({
      source:'Open Library',title:d.title,author:(d.author_name || []).join(', '),authors:d.author_name||[],
      isbn:d.isbn?.[0]||'',isbns:d.isbn||[],cover_url:olCover(d.cover_i),
      pages:d.number_of_pages_median||null,published_year:d.first_publish_year||null,
      language:(d.language||[]).includes('ger')?'Deutsch':(d.language||[]).includes('eng')?'Englisch':'',
      work_key:/^(?:\/works\/)?OL\d+W$/.test(d.key||'') ? (d.key.startsWith('/')?d.key:`/works/${d.key}`) : ''
    });
  }
  for (const item of gbData?.items || []) {
    const d=item.volumeInfo||{};
    if (!d.title) continue;
    all.push({
      source:'Google Books',title:d.title,author:(d.authors||[]).join(', '),authors:d.authors||[],
      isbn:(d.industryIdentifiers||[]).find(x=>x.type==='ISBN_13')?.identifier || (d.industryIdentifiers||[])[0]?.identifier || '',
      isbns:(d.industryIdentifiers||[]).map(x=>x.identifier),cover_url:safeImage(d.imageLinks?.thumbnail||d.imageLinks?.smallThumbnail),
      pages:d.pageCount||null,published_year:year(d.publishedDate),language:d.language==='de'?'Deutsch':d.language==='en'?'Englisch':'',
      description:shortDescription(d.description||''),description_source:'Google Books',description_source_url:safeImage(d.infoLink||''),
      volume_id:item.id||''
    });
  }
  const unique = new Set();
  return all.map(c=>({...c,relevance:manualQueryFit(term,c)}))
    .filter(c=>c.relevance>0)
    .sort((a,b)=>b.relevance-a.relevance || Number(!!b.cover_url)-Number(!!a.cover_url))
    .filter(c=>{
      const key=c.work_key ? `ol:${c.work_key}` : `${c.source}:${norm(c.title)}:${norm(c.author)}`;
      if(unique.has(key))return false;unique.add(key);return true;
    }).slice(0,18);
}

// Fetch details ONLY for the result explicitly selected by the user. Never
// silently substitute the first title/author match from an automatic lookup.
export async function lookupSelectedCatalogBook(candidate, {signal} = {}) {
  if (!candidate?.title) return null;
  let description = candidate.description || '';
  let description_source = candidate.description_source || '';
  let description_source_url = candidate.description_source_url || '';
  const variants = [], seen = new Set();
  const add = (url,label) => {url=safeImage(url);if(url&&!seen.has(url)){seen.add(url);variants.push({url,label});}};
  add(candidate.cover_url,candidate.source);
  if(candidate.source==='Open Library' && candidate.work_key){
    const [work,editions] = await Promise.all([
      getJSON(`https://openlibrary.org${candidate.work_key}.json`,signal),
      getJSON(`https://openlibrary.org${candidate.work_key}/editions.json?limit=35`,signal)
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
  return {...candidate,
    cover_url:candidate.cover_url || variants[0]?.url || '',
    variants:variants.slice(0,8),
    description,description_source,description_source_url,
    matched_title:candidate.title,matched_author:candidate.author,
    selected_manually:true
  };
}
