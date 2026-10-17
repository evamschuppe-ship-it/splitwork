// Turns a list of sections into an ownership-based plan: each teammate owns a
// self-contained part (all steps of it), one teammate is the editor who joins
// the parts at the end, and shared milestones belong to everyone (slot 0).

export const TEMPLATE_SECTIONS = {
  'Standard Research & Presentation': {
    presentation: true,
    sections: [
      ['Literature review — theme A', 3], ['Literature review — theme B', 3], ['Research method', 2],
      ['Data collection', 4], ['Data analysis & findings', 4], ['Introduction', 1], ['Conclusion', 1], ['References', 1],
    ],
  },
  'Lab Report': {
    presentation: false,
    sections: [
      ['Background & hypothesis', 2], ['Methods', 3], ['Run experiment & record data', 5], ['Data analysis & figures', 4],
      ['Results', 3], ['Discussion', 3], ['Introduction & abstract', 2], ['References', 1],
    ],
  },
  'Case Study Analysis': {
    presentation: true,
    sections: [
      ['Company & industry background', 3], ['Problem diagnosis', 3], ['Financial analysis', 4], ['Options & evaluation', 4],
      ['Recommendation & implementation plan', 3], ['Executive summary', 1], ['References', 1],
    ],
  },
  'Software Project': {
    presentation: true,
    sections: [
      ['Wireframes & UI design', 3], ['Database & backend', 5], ['Frontend screens', 5], ['Testing & bug fixes', 3],
      ['README & documentation', 2],
    ],
  },
};

const FRAMING = /introduc|executive summary|abstract|conclu|preface|cover page|foreword/i;
const REFERENCES = /reference|bibliograph|citation|appendi|formatting/i;
const PRESENTATION = /presentation|slides|deck|pitch|poster|video|demo\b|rehears|speaker notes/i;

// Sections in the same family that are different steps (stages) depend on each
// other, so they must stay with one person.
const FAMILIES = [
  ['build', /prototype|wirefram|ui design|build|implement|develop|code|frontend|backend|database|testing|bug|mvp|readme|documentation/i],
  ['evidence', /data|survey|interview|experiment|sample|results|findings|method|figures/i],
  ['foundation', /literature|background|theory|hypothesis/i],
];

const STAGES = [
  [0, /literature|background|context|theory|hypothesis/i],
  [1, /method|design|wirefram|plan\b/i],
  [3, /analy|results|findings|testing|evaluat|figures/i],
  [4, /recommend|strategy|discussion|implication|implementation plan|readme|documentation/i],
];

function stageOf(title) {
  for (const [s, re] of STAGES) if (re.test(title)) return s;
  return 2;
}

function familyOf(title) {
  for (const [f, re] of FAMILIES) if (re.test(title)) return f;
  return null;
}

const round2 = (x) => Math.round(x * 100) / 100;

export function planProject({ sections, teamSize, presentation }) {
  const n = Math.max(1, Math.min(12, Number(teamSize) || 4));
  const items = [];
  const editor = n >= 2 ? n : 1;

  const framing = [];
  let hasPres = Boolean(presentation);
  const content = [];
  sections.forEach((s, i) => {
    const w = Math.max(1, Math.min(5, Math.round(s.w || 3)));
    if (FRAMING.test(s.title)) framing.push({ title: s.title, w });
    else if (REFERENCES.test(s.title)) { /* each owner cites their own part; editor compiles */ }
    else if (PRESENTATION.test(s.title)) hasPres = true;
    else content.push({ title: s.title, w, order: i, stage: stageOf(s.title), family: familyOf(s.title) });
  });

  // Group dependent steps of the same family; everything else stands alone.
  const groups = [];
  const byFamily = {};
  for (const c of content) {
    if (c.family) (byFamily[c.family] ??= []).push(c);
    else groups.push({ secs: [c] });
  }
  for (const secs of Object.values(byFamily)) {
    if (new Set(secs.map((s) => s.stage)).size > 1) groups.push({ secs });
    else secs.forEach((s) => groups.push({ secs: [s] }));
  }
  groups.forEach((g) => { g.w = g.secs.reduce((a, s) => a + s.w, 0); g.k = 1; });

  // Editor work (fixed) — used for the balance target.
  const editorTasks = [
    { t: 'Set up the shared doc: headings, template & where each part goes', k: 'admin', w: 1, p: 0.08 },
    ...framing.map((f, i) => ({ t: `${f.title} (written once all parts are in)`, k: 'section', w: f.w, p: round2(0.78 + 0.02 * i) })),
    { t: 'Merge all parts & edit the document into one voice', k: 'section', w: 2, p: 0.86 },
    { t: 'Compile the reference list & check formatting', k: 'section', w: 1, p: 0.88 },
  ];
  if (hasPres) editorTasks.push({ t: 'Assemble everyone\'s slides into one consistent deck', k: 'section', w: 1, p: 0.9 });
  const editorW = editorTasks.reduce((a, t) => a + t.w, 0);

  // Split too-big groups by sub-topic so nobody waits on anyone else.
  if (n >= 2 && groups.length) {
    const totalW = groups.reduce((a, g) => a + g.w, 0) + editorW;
    const target = totalW / n;
    for (const g of groups) {
      if (g.w > target * 1.3) g.k = Math.min(n, Math.max(2, Math.round(g.w / target)));
    }
    const contentBins = n - 1;
    while (groups.reduce((a, g) => a + g.k, 0) < contentBins) {
      const g = groups.filter((x) => x.w / x.k >= 2).sort((a, b) => b.w / b.k - a.w / a.k)[0];
      if (!g) break;
      g.k += 1;
    }
  }
  const expand = () => {
    const parts = [];
    groups.forEach((g, gi) => {
      for (let i = 1; i <= g.k; i++) {
        const label = g.k > 1 ? ` — part ${i} of ${g.k} (split by sub-topic at kickoff)` : '';
        const secs = g.secs.map((x) => ({ ...x, title: x.title + label, w: Math.max(1, Math.round(x.w / g.k)) }));
        parts.push({ secs, gi, w: secs.reduce((a, x) => a + x.w, 0) });
      }
    });
    return parts;
  };
  const pack = (parts) => {
    const loads = Array(n + 1).fill(0);
    loads[editor] += n >= 2 ? editorW : 0;
    const owned = Array.from({ length: n + 1 }, () => []);
    const ownedGroups = Array.from({ length: n + 1 }, () => new Set());
    [...parts].sort((a, b) => b.w - a.w).forEach((part) => {
      let best = 1;
      for (let x = 2; x <= n; x++) if (loads[x] < loads[best]) best = x;
      loads[best] += part.w;
      owned[best].push(...part.secs);
      ownedGroups[best].add(part.gi);
    });
    return { loads, owned, ownedGroups, max: Math.max(...loads.slice(1)) };
  };

  // Pack parts into teammates, heaviest first, editor pre-loaded; keep splitting
  // the heaviest teammate's biggest group while that lowers the heaviest load.
  let packed = pack(expand());
  for (let guard = 0; n >= 2 && guard < 20; guard++) {
    const heavy = packed.loads.indexOf(packed.max, 1);
    const cand = [...packed.ownedGroups[heavy]].map((gi) => groups[gi])
      .filter((g) => g.k < n && g.w / g.k >= 2)
      .sort((a, b) => b.w / b.k - a.w / a.k)[0];
    if (!cand) break;
    cand.k += 1;
    const next = pack(expand());
    if (next.max < packed.max) packed = next;
    else { cand.k -= 1; break; }
  }
  const { owned } = packed;

  // Each owner works through their own steps in order, independent of others.
  for (let slot = 1; slot <= n; slot++) {
    const mine = owned[slot].sort((a, b) => a.stage - b.stage || a.order - b.order);
    const total = mine.reduce((a, s) => a + s.w, 0);
    let cum = 0;
    for (const s of mine) {
      cum += s.w;
      items.push({ t: s.title, k: 'section', w: s.w, p: round2(0.12 + 0.5 * (cum / total)), s: slot });
    }
    if (mine.length && n >= 2) items.push({ t: 'Hand in your part (with its sources) to the shared doc', k: 'milestone', w: 1, p: 0.68, s: slot });
    if (mine.length && hasPres) items.push({ t: n >= 2 ? 'Slides + speaker notes for your part' : 'Slides + speaker notes', k: 'section', w: 1, p: 0.82, s: slot });
  }
  editorTasks.forEach((t) => items.push({ ...t, s: editor }));

  // Shared moments belong to everyone.
  items.push({ t: 'Kickoff (everyone): agree what each part covers & who owns it', k: 'milestone', w: 1, p: 0.05, s: 0 });
  if (hasPres) items.push({ t: 'Full rehearsal (everyone)', k: 'milestone', w: 1, p: 0.94, s: 0 });
  items.push({ t: 'Final check & submit (everyone)', k: 'milestone', w: 1, p: 1, s: 0 });

  return items;
}

export function planFromTemplate(template, teamSize) {
  const tpl = TEMPLATE_SECTIONS[template] ?? TEMPLATE_SECTIONS['Standard Research & Presentation'];
  return planProject({
    sections: tpl.sections.map(([title, w]) => ({ title, w })),
    teamSize,
    presentation: tpl.presentation,
  });
}
