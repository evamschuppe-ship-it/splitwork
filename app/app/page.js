'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { TEMPLATES, formatDate, isoInDays } from '@/lib/dates';
import { buildItems, readBrief } from '@/lib/brief';

export default function AppPage() {
  const [title, setTitle] = useState('');
  const [teamSize, setTeamSize] = useState(4);
  const [dueDate, setDueDate] = useState(isoInDays(14));
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [briefFile, setBriefFile] = useState(null);
  const [brief, setBrief] = useState(null);
  const [briefMsg, setBriefMsg] = useState('');
  const [reading, setReading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from('projects')
      .select('id, title, team_size, due_date, template, brief_name, created_at, tasks(done)')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setProjects(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onBrief(e) {
    const file = e.target.files?.[0];
    setBrief(null);
    setBriefFile(null);
    setBriefMsg('');
    if (!file) return;
    setReading(true);
    try {
      const result = await readBrief(file);
      setBriefFile(file);
      setBrief(result);
      const notes = [];
      if (!title.trim() && result.title) { setTitle(result.title); notes.push('title'); }
      if (result.dueDate) { setDueDate(result.dueDate); notes.push(`due date (${formatDate(result.dueDate)})`); }
      if (result.teamSize) { setTeamSize(result.teamSize); notes.push(`team size (${result.teamSize})`); }
      setBriefMsg(
        (result.sections.length >= 2
          ? `Found ${result.sections.length} sections in the brief.`
          : 'Could not find clear sections in this file — the template below will be used, and the brief is still shared with your team.')
        + (notes.length ? ` Also filled in: ${notes.join(', ')}.` : '')
      );
    } catch (err) {
      setBriefMsg(err.message);
      e.target.value = '';
    }
    setReading(false);
  }

  function removeSection(i) {
    setBrief((b) => ({ ...b, sections: b.sections.filter((_, j) => j !== i) }));
  }

  const useBrief = brief && brief.sections.length >= 2;

  async function onSubmit(e) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    setSaving(true);
    setError('');
    const supabase = createClient();
    const size = Number(teamSize) >= 1 && Number(teamSize) <= 12 ? Number(teamSize) : 4;
    const { data: created, error } = await supabase.from('projects').insert({
      title: clean,
      team_size: size,
      due_date: dueDate || isoInDays(14),
      template: useBrief ? 'From teacher brief' : template || TEMPLATES[0],
      custom_sections: useBrief ? buildItems(brief.sections, brief.hasPresentation) : null,
      brief_name: briefFile ? briefFile.name : null,
    }).select('id').single();

    if (error) {
      setError(error.message);
    } else {
      if (briefFile) {
        const safe = briefFile.name.replace(/[^\w.\-]+/g, '_').slice(-100);
        const path = `${created.id}/${safe}`;
        const { error: upErr } = await supabase.storage.from('briefs').upload(path, briefFile);
        if (upErr) setError(`Project created, but the brief could not be uploaded: ${upErr.message}`);
        else await supabase.from('projects').update({ brief_path: path }).eq('id', created.id);
      }
      setTitle('');
      setBrief(null);
      setBriefFile(null);
      setBriefMsg('');
      e.target.reset();
      setTeamSize(4);
      setDueDate(isoInDays(14));
    }
    await load();
    setSaving(false);
  }

  return (
    <div className="stack">
      <section className="card">
        <h1 className="h2">New project workspace</h1>
        <p className="muted small">Only the title is required. Add your teacher&apos;s brief and the split follows its sections.</p>
        <form onSubmit={onSubmit} className="form">
          <label htmlFor="title">Project title</label>
          <input id="title" type="text" required maxLength={200} placeholder="e.g. Marketing 201 final presentation"
            value={title} onChange={(e) => setTitle(e.target.value)} data-testid="core-input" />

          <label htmlFor="brief">Teacher&apos;s brief (optional) — Word or PowerPoint</label>
          <input id="brief" type="file" accept=".docx,.pptx,.doc,.ppt" onChange={onBrief} className="file" />
          {reading && <p className="muted small">Reading the brief…</p>}
          {briefMsg && <p className={useBrief ? 'ok small' : 'muted small'} role="status">{briefMsg}</p>}
          {useBrief && (
            <div className="brief-box">
              <p className="small"><strong>Sections to split</strong> (bigger grade weight = more work points). Remove any that are not real work:</p>
              <ul className="chips">
                {brief.sections.map((s, i) => (
                  <li key={s.title}>
                    <span>{s.title}</span>
                    <span className="muted small"> · {s.w} pts</span>
                    <button type="button" className="chip-x" onClick={() => removeSection(i)} aria-label={`Remove ${s.title}`}>×</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid3">
            <div>
              <label htmlFor="size">Team size</label>
              <input id="size" type="number" min={1} max={12} value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)} />
            </div>
            <div>
              <label htmlFor="due">Final due date</label>
              <input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="tpl">Template {useBrief && <span className="muted small">(not needed — using brief)</span>}</label>
              <select id="tpl" value={template} onChange={(e) => setTemplate(e.target.value)} disabled={useBrief}>
                {TEMPLATES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn" disabled={saving || reading} data-testid="core-submit">
            {saving ? 'Splitting the work…' : 'Create & split the work'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="h2">Your project workspaces</h2>
        {loading && <p className="muted">Loading…</p>}
        {!loading && projects.length === 0 && (
          <p className="muted">No projects yet. Create your first one above.</p>
        )}
        <ul className="list">
          {projects.map((p) => {
            const total = p.tasks?.length ?? 0;
            const done = p.tasks?.filter((t) => t.done).length ?? 0;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <li key={p.id} data-testid="core-item" className="card item">
                <Link href={`/app/p/${p.id}`} className="item-link">
                  <span className="item-title">{p.title}</span>
                  <span className="muted small">
                    {p.team_size} people · due {formatDate(p.due_date)} · {p.template}
                    {p.brief_name ? ' · 📎 brief' : ''}
                  </span>
                  <span className="progress" aria-label={`${pct}% done`}>
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <span className="muted small">{done}/{total} tasks done · open to invite teammates</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
