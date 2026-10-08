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
  const lastNames = author.split(' ').filter(w => w.length > 3);
  const authorFit = !author ? .5 : ca === author ? 1 : (lastNames.some(w => ca.split(' ').includes(w)) ? .9 : 0);
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
  const params = new URLSearchParams({title:book.title, limit:'8', fields:'key,title,author_name,cover_i,isbn,number_of_pages_median,first_publish_year,language'});
  if (book.author) params.set('author',book.author);
  const [olSearch, googleSearch] = await Promise.all([
    getJSON(`https://openlibrary.org/search.json?${params}`, signal),
    getJSON(`https://www.googleapis.com/books/v1/volumes?${new URLSearchParams({q: isbn ? `isbn:${isbn}` : `intitle:${book.title} ${book.author ? `inauthor:${book.author}` : ''}`,maxResults:'12',printType:'books'})}`,signal)
  ]);
  const olMatches = (olSearch?.docs||[]).map(d=>({
    title:d.title, authors:d.author_name||[], author:(d.author_name||[]).join(' '), isbns:d.isbn||[],
    cover_url:olCover(d.cover_i), isbn:d.isbn?.[0]||'', pages:d.number_of_pages_median||null,
    published_year:d.first_publish_year||null,
    language:(d.language||[]).includes('ger')?'Deutsch':(d.language||[]).includes('eng')?'Englisch':'',
    work_key:/^\/works\/OL\d+W$/.test(d.key||'')?d.key:'', source:'Open Library'
  })).map(x=>({...x,score:matchScore(book,x)})).filter(x=>x.score>=.75).sort((a,b)=>b.score-a.score);
  const gbMatches = (googleSearch?.items||[]).map(item=>{
    const v=item.volumeInfo||{};
    return {title:v.title||'',author:(v.authors||[]).join(' '),authors:v.authors||[],
      isbns:(v.industryIdentifiers||[]).map(x=>x.identifier),cover_url:safeImage(v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail),
      isbn:(v.industryIdentifiers||[]).find(x=>x.type==='ISBN_13')?.identifier||'',pages:v.pageCount||null,
      published_year:year(v.publishedDate), language:v.language==='de'?'Deutsch':v.language==='en'?'Englisch':'',
      description:shortDescription(v.description||''), description_source:'Google Books',
      description_source_url:safeImage(v.infoLink||''),source:'Google Books'};
  }).map(x=>({...x,score:matchScore(book,x)})).filter(x=>x.score>=.75).sort((a,b)=>b.score-a.score);
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
