/* Quote import parsing: Yomu Markdown and book-specific tolino/Notulator TXT.
   All parsing happens in the browser; raw files are never uploaded. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.QuoteParser = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const tidy = text => String(text || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').trim();
  const norm = text => tidy(text).normalize('NFKC').toLocaleLowerCase('de-DE').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  function fingerprint(text) {
    const value = norm(text);
    let a = 2166136261, b = 2246822519;
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      a = Math.imul(a ^ c, 16777619) >>> 0;
      b = Math.imul(b ^ c, 1597334677) >>> 0;
    }
    return [a,b,value.length].map(n=>n.toString(16).padStart(8, '0')).join('');
  }
  function dateValue(input) {
    const m = tidy(input).match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4}),?\s+(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    if (+m[1]<1 || +m[1]>31 || +m[2]<1 || +m[2]>12) return null;
    return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}`;
  }
  function parseHeader(line, fallback) {
    const x = tidy(line).replace(/^#\s*/, '');
    const m = x.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    if (m) {
      const name=m[2].includes(',')?m[2].split(',').map(p=>p.trim()).reverse().join(' '):m[2].trim();
      return {title:m[1].trim(),author:name};
    }
    return {title:x || fallback, author:''};
  }
  function parseYomu(md, filename) {
    const input=tidy(md), lines=input.split('\n');
    const info=parseHeader(lines[0],filename.replace(/\.md$/i,''));
    const highlights=[];
    let chapter='', block=[];
    function flush() {
      if (!block.length) return;
      const s=block.join('\n'); block=[];
      const date=s.match(/\*\*(\d{1,2}\.\d{1,2}\.\d{2,4},?\s+\d{1,2}:\d{2})\*\*/);
      const url=s.match(/\[Link\]\((yomu:\/\/content\/annotation\/[a-z0-9-]+)\)/i);
      const quoted=s.split('\n').filter(l=>/^\s*>/.test(l)).map(l=>l.replace(/^\s*>\s?/, '')).join('\n').trim();
      if (!quoted) return;
      highlights.push({text:quoted,chapter,marked_at:dateValue(date?.[1]),source:'yomu',source_url:url?.[1]||null,location:null});
    }
    let inside=false;
    for (const line of lines) {
      if (!inside) { if (/^##\s+Anmerkungen\s*$/.test(line)) inside=true; continue; }
      if (/^###\s+/.test(line)) { flush(); chapter=line.replace(/^###\s+/, '').trim(); continue; }
      if (/^---\s*$/.test(line)) { flush(); continue; }
      block.push(line);
    }
    flush();
    return {...info,format:'yomu',highlights};
  }
  function parseNotulator(txt, filename) {
    const lines=tidy(txt).split('\n');
    const info=parseHeader(lines[0],filename.replace(/\.txt$/i,''));
    const highlights=[];
    let chapter='',inNotes=false,parts=[],date=null;
    function flush() {
      const text=tidy(parts.join('\n'));
      if(text && date) highlights.push({text,chapter,marked_at:dateValue(date),source:'tolino',source_url:null,location:null});
      parts=[]; date=null;
    }
    for (let i=1; i<lines.length; i++) {
      const line=lines[i];
      if (!inNotes) { if(/^Anmerkungen\s*$/.test(line)) inNotes=true; continue; }
      if (/^#\s+/.test(line)) { flush();chapter=line.replace(/^#\s+/, '').trim(); continue; }
      const d=line.match(/^\s*-\s*(\d{1,2}\.\d{1,2}\.\d{2,4},?\s+\d{1,2}:\d{2})\s*$/);
      if (d) {flush();date=d[1];continue;}
      if(date && (line.trim() || parts.length)) parts.push(line);
    }
    flush();
    return {...info,format:'tolino',highlights};
  }
  function parse(text, filename='') {
    if(text.length > 2_000_000) throw Error('Datei ist zu groß (max. 2 MB).');
    const isMd = /\.md$/i.test(filename) || /^#\s+[^\n]+\n[\s\S]*?\n##\s+Anmerkungen\b/.test(text);
    const output = isMd ? parseYomu(text, filename) : parseNotulator(text, filename);
    if (!output.highlights.length) throw Error('Keine Markierungen erkannt. Unterstützt werden Yomu-Markdown und die TXT-Einzelausgabe von Notulator.');
    output.highlights=output.highlights.map(q=>({...q,fingerprint:fingerprint(q.text)}));
    return output;
  }
  return {parse, norm, fingerprint};
});
