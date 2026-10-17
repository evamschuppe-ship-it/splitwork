'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { TEMPLATES, formatDate, isoInDays } from '@/lib/dates';

export default function AppPage() {
  const [title, setTitle] = useState('');
  const [teamSize, setTeamSize] = useState(4);
  const [dueDate, setDueDate] = useState(isoInDays(14));
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from('projects')
      .select('id, title, team_size, due_date, template, created_at, tasks(done)')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setProjects(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onSubmit(e) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    setSaving(true);
    setError('');
    const size = Number(teamSize) >= 1 && Number(teamSize) <= 12 ? Number(teamSize) : 4;
    const { error } = await createClient().from('projects').insert({
      title: clean,
      team_size: size,
      due_date: dueDate || isoInDays(14),
      template: template || TEMPLATES[0],
    });
    if (error) setError(error.message);
    else setTitle('');
    await load();
    setSaving(false);
  }

  return (
    <div className="stack">
      <section className="card">
        <h1 className="h2">New project workspace</h1>
        <p className="muted small">Only the title is required — we split the work for you.</p>
        <form onSubmit={onSubmit} className="form">
          <label htmlFor="title">Project title</label>
          <input id="title" type="text" required maxLength={200} placeholder="e.g. Marketing 201 final presentation"
            value={title} onChange={(e) => setTitle(e.target.value)} data-testid="core-input" />
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
              <label htmlFor="tpl">Template</label>
              <select id="tpl" value={template} onChange={(e) => setTemplate(e.target.value)}>
                {TEMPLATES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn" disabled={saving} data-testid="core-submit">
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
                  </span>
                  <span className="progress" aria-label={`${pct}% done`}>
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <span className="muted small">{done}/{total} tasks done</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
