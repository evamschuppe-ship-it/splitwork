import JSZip from 'jszip';

// Reads a teacher's assignment brief (.docx or .pptx) in the browser and turns
// its headings, slide titles and numbered parts into project sections.

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function paragraphs(xml, pTag, tTag) {
  const pRe = new RegExp(`<${pTag}[ >][\\s\\S]*?</${pTag}>`, 'g');
  const tRe = new RegExp(`<${tTag}(?: [^>]*)?>([\\s\\S]*?)</${tTag}>`, 'g');
  const out = [];
  for (const p of xml.match(pRe) ?? []) {
    let text = '';
    let m;
    tRe.lastIndex = 0;
    while ((m = tRe.exec(p))) text += m[1];
    text = decode(text).replace(/\s+/g, ' ').trim();
    if (text) out.push({ xml: p, text });
  }
  return out;
}

async function readDocx(zip) {
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('This Word file looks empty or damaged.');
  return paragraphs(xml, 'w:p', 'w:t').map(({ xml: p, text }) => {
    const style = (p.match(/<w:pStyle w:val="([^"]+)"/) ?? [])[1] ?? '';
    const isTitle = /^(title|subtitle)$/i.test(style);
    const bold = /<w:b\/>|<w:b w:val="(1|true)"\/>/.test(p);
    return {
      text,
      title: isTitle,
      heading: isTitle || /heading|t[ií]tulo/i.test(style) || (bold && text.length <= 70),
      list: /<w:numPr>/.test(p),
    };
  });
}

async function readPptx(zip) {
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  if (!slides.length) throw new Error('This PowerPoint file has no slides.');
  const blocks = [];
  for (const name of slides) {
    const xml = await zip.file(name).async('string');
    for (const shape of xml.match(/<p:sp>[\s\S]*?<\/p:sp>|<p:sp [\s\S]*?<\/p:sp>/g) ?? []) {
      const isTitle = /<p:ph[^>]*type="(title|ctrTitle)"/.test(shape);
      for (const { text } of paragraphs(shape, 'a:p', 'a:t')) {
        blocks.push({ text, title: isTitle && name.endsWith('slide1.xml'), heading: isTitle, list: !isTitle });
      }
    }
  }
  return blocks;
}

const KEYWORDS = [
  [/data|survey|interview|research|collect|experiment/i, 4],
  [/analy|findings|results|evaluat/i, 4],
  [/financ|budget|cost|revenue|valuation/i, 4],
  [/prototype|design|build|implement|develop|code/i, 4],
  [/literature|background|context|theory/i, 3],
  [/method/i, 3],
  [/market|competit|swot|pestel|industry|customer|stakeholder/i, 3],
  [/recommend|solution|strategy|proposal|plan\b/i, 3],
  [/presentation|slides|deck|pitch|poster|video|demo/i, 3],
  [/case|problem|issue|challenge/i, 3],
  [/introduc|executive summary|abstract|overview of the company/i, 2],
  [/conclu|reflection|discussion|limitations|lessons/i, 2],
  [/reference|bibliograph|citation|appendi|formatting/i, 1],
  [/report|essay|paper|chapter|section|part\s*[0-9ivx]+|task\s*\d|deliverable|question\s*\d|component/i, 3],
];

const SKIP = /^(agenda|contents|table of contents|index|thank you|thanks|questions\??|q\s*&\s*a|about|contact|office hours|learning (objectives|outcomes)|objectives|course|syllabus|important|notes?|reminder|welcome|grading|rubric|assessment criteria|evaluation criteria|academic integrity|plagiarism|late submission|submission (guidelines|instructions)|format(ting)? requirements|due date|deadline|group work|teams?|instructions?|deliverables?|your tasks|tasks|requirements|components|structure|outline|what (you|to) (need to )?(do|submit|deliver))\b/i;

function clean(text) {
  return text
    .replace(/^\s*(?:[-•▪●◦*]|\(?[0-9]{1,2}[.)]|\(?[a-h][.)]|[ivx]{1,4}[.)])\s+/i, '')
    .replace(/[:.\s]+$/, '')
    .trim();
}

function weightFor(text) {
  const pct = text.match(/(\d{1,3})\s*%/);
  if (pct) return Math.max(1, Math.min(5, Math.round(Number(pct[1]) / 6)));
  for (const [re, w] of KEYWORDS) if (re.test(text)) return w;
  return 3;
}

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  ene: 0, abr: 3, ago: 7, dic: 11,
};
const MONTH_RE = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|abr|ago|dic)[a-zé]*';

function toIso(y, m, d) {
  const dt = new Date(Number(y), m, Number(d));
  if (dt.getMonth() !== m) return null;
  return `${dt.getFullYear()}-${String(m + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function findDueDate(full) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const patterns = [
    [new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:de\\s+)?${MONTH_RE}\\.?,?\\s+(?:de\\s+)?(20\\d{2})\\b`, 'gi'), (m) => toIso(m[3], MONTHS[m[2].toLowerCase()], m[1])],
    [new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, 'gi'), (m) => toIso(m[3], MONTHS[m[1].toLowerCase()], m[2])],
    [/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g, (m) => toIso(m[1], Number(m[2]) - 1, m[3])],
    [/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/g, (m) => toIso(m[3], Number(m[2]) - 1, m[1])],
  ];
  const found = [];
  for (const [re, parse] of patterns) {
    for (const m of full.matchAll(re)) {
      const iso = parse(m);
      if (!iso || new Date(`${iso}T00:00:00`) <= today) continue;
      const before = full.slice(Math.max(0, m.index - 80), m.index);
      found.push({ iso, index: m.index, near: /due|deadline|submi|hand in|entrega|fecha l[ií]mite/i.test(before) });
    }
  }
  const near = found.filter((f) => f.near).sort((a, b) => a.index - b.index);
  return near.length ? near[near.length - 1].iso : null;
}

function findTeamSize(full) {
  const m = full.match(/\b(?:groups?|teams?)\s+of\s+(\d{1,2})/i)
    ?? full.match(/\b(\d{1,2})\s*(?:-|–|to)\s*\d{1,2}\s+(?:students|members|people)/i)
    ?? full.match(/\b(\d{1,2})\s+(?:students|members|people)\s+(?:per|in each)\s+(?:group|team)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 2 && n <= 12 ? n : null;
}

export async function readBrief(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'doc' || ext === 'ppt') {
    throw new Error('Old .doc/.ppt files cannot be read. Open it and "Save as" .docx or .pptx, then try again.');
  }
  if (ext !== 'docx' && ext !== 'pptx') throw new Error('Please upload a Word (.docx) or PowerPoint (.pptx) file.');
  if (file.size > 20 * 1024 * 1024) throw new Error('File is larger than 20 MB.');

  let zip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error('Could not open this file. Is it a real .docx/.pptx?');
  }
  const blocks = ext === 'docx' ? await readDocx(zip) : await readPptx(zip);
  const full = blocks.map((b) => b.text).join('\n');

  const seen = new Set();
  const pick = (strict) => {
    const out = [];
    for (const b of blocks) {
      if (!(b.heading || b.list) || b.title) continue;
      const text = clean(b.text);
      if (text.length < 3 || text.length > 90 || SKIP.test(text)) continue;
      if (strict && !KEYWORDS.some(([re]) => re.test(text))) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ title: text.slice(0, 120), w: weightFor(text) });
    }
    return out;
  };
  let sections = pick(true);
  if (sections.length < 3) sections = sections.concat(pick(false));
  sections = sections.slice(0, 12);

  const titleBlock = blocks.find((b) => b.title) ?? blocks.find((b) => b.heading);
  return {
    fileName: file.name,
    title: titleBlock ? clean(titleBlock.text).slice(0, 120) : '',
    sections,
    dueDate: findDueDate(full),
    teamSize: findTeamSize(full),
    hasPresentation: /presentation|present (in|to)|slides|pitch/i.test(full),
  };
}

// Turns the chosen sections into tasks + milestones spread over the timeline.
export function buildItems(sections, hasPresentation) {
  const n = sections.length;
  const items = [{ t: 'Kickoff: read the brief together & confirm the split', k: 'milestone', w: 1, p: 0.05 }];
  sections.forEach((s, i) => {
    items.push({ t: s.title, k: 'section', w: s.w, p: Math.round((0.3 + 0.4 * (n === 1 ? 1 : i / (n - 1))) * 100) / 100 });
  });
  items.push({ t: 'Draft complete: merge all sections into one file', k: 'milestone', w: 1, p: 0.75 });
  items.push({ t: 'Edit for one voice & check every point of the brief', k: 'section', w: 2, p: 0.86 });
  if (hasPresentation && !sections.some((s) => /presentation|slides|deck|pitch/i.test(s.title))) {
    items.push({ t: 'Slide deck for the presentation', k: 'section', w: 3, p: 0.86 });
  }
  if (hasPresentation) items.push({ t: 'Full rehearsal', k: 'milestone', w: 1, p: 0.94 });
  items.push({ t: 'Final check & submit', k: 'milestone', w: 1, p: 1 });
  return items;
}
