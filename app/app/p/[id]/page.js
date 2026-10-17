'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { formatDate } from '@/lib/dates';

const KIND_LABEL = { section: 'Section', milestone: 'Milestone', admin: 'Admin' };

export default function ProjectPage({ params }) {
  const { id } = use(params);
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [me, setMe] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [briefUrl, setBriefUrl] = useState('');
  const [lastInvited, setLastInvited] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setMe(user);
    const [{ data: p }, { data: t }, { data: m }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).maybeSingle(),
      supabase.from('tasks').select('*').eq('project_id', id).order('due_date').order('created_at'),
      supabase.from('project_members').select('*').eq('project_id', id).order('slot'),
    ]);
    if (!p) { setNotFound(true); return; }
    setProject(p);
    setDocUrl(p.doc_url ?? '');
    setTasks(t ?? []);
    setMembers(m ?? []);
    if (p.brief_path) {
      const { data: signed } = await supabase.storage.from('briefs').createSignedUrl(p.brief_path, 3600);
      setBriefUrl(signed?.signedUrl ?? '');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (notFound) {
    return (
      <div className="card">
        <p>Project not found, or you have not been invited to it.</p>
        <Link href="/app">← Back to my projects</Link>
      </div>
    );
  }
  if (!project) return <p className="muted">Loading…</p>;

  const isOwner = me?.id === project.owner_id;
  const slots = Array.from({ length: project.team_size }, (_, i) => i + 1);

  function slotName(slot) {
    if (slot === 0) return 'Everyone';
    const m = members.find((x) => x.slot === slot);
    if (m) return m.email.toLowerCase() === me?.email?.toLowerCase() ? `${m.email} (you)` : m.email;
    if (slot === 1) return isOwner ? `${me?.email} (you)` : project.owner_email || 'Project creator';
    return `Teammate ${slot} (not invited yet)`;
  }

  async function toggle(task) {
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    const { error } = await createClient().from('tasks').update({ done: !task.done }).eq('id', task.id);
    if (error) { setError(error.message); load(); }
  }

  async function invite(e) {
    e.preventDefault();
    setError('');
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    const used = new Set(members.map((m) => m.slot));
    const free = slots.find((s) => s !== 1 && !used.has(s));
    if (!free) { setError('All teammate slots are filled.'); return; }
    const { error } = await createClient().from('project_members').insert({ project_id: id, email, slot: free });
    if (error) setError(error.message.includes('duplicate') ? 'Already invited.' : error.message);
    else { setInviteEmail(''); setLastInvited(email); setCopied(false); }
    load();
  }

  function inviteText(email) {
    return `Hi! I added you to our group project "${project.title}" on SplitWork, where the work is split fairly between us. `
      + `Sign up or log in at ${window.location.origin}/signup with this email (${email}) and you'll see your tasks and deadlines.`;
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteText(lastInvited));
      setCopied(true);
    } catch {
      setError('Could not copy automatically — select the message and copy it.');
    }
  }

  async function removeMember(m) {
    await createClient().from('project_members').delete().eq('id', m.id);
    load();
  }

  async function saveDoc(e) {
    e.preventDefault();
    const url = docUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) { setError('Link must start with http:// or https://'); return; }
    const { error } = await createClient().from('projects').update({ doc_url: url || null }).eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  const done = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const milestones = tasks.filter((t) => t.kind === 'milestone');

  return (
    <div className="stack">
      <Link href="/app" className="small">← My projects</Link>
      <section className="card">
        <h1 className="h2">{project.title}</h1>
        <p className="muted small">
          {project.team_size} people · due {formatDate(project.due_date)} · {project.template}
        </p>
        <div className="progress big" aria-label={`${pct}% done`}><span style={{ width: `${pct}%` }} /></div>
        <p className="small">{done} of {tasks.length} tasks done ({pct}%)</p>
        {project.brief_name && (
          <p className="small">📎 Teacher&apos;s brief: {briefUrl
            ? <a href={briefUrl} target="_blank" rel="noopener noreferrer">{project.brief_name}</a>
            : project.brief_name}</p>
        )}
        {project.doc_url && (
          <p className="small">📄 Shared doc: <a href={project.doc_url} target="_blank" rel="noopener noreferrer">{project.doc_url}</a></p>
        )}
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      <section className="card">
        <h2 className="h3">Milestones</h2>
        <ol className="timeline">
          {milestones.map((t) => (
            <li key={t.id} className={t.done ? 'is-done' : ''}>
              <span className="date">{formatDate(t.due_date)}</span> {t.title}
              <span className="muted small"> — {slotName(t.assignee_slot)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="h3">Who does what</h2>
        <p className="muted small">Each person owns a complete part (research, writing, their own slides), so nobody waits on anyone else. Parts meet at the hand-in date; the editor then writes the intro/conclusion and joins everything.</p>
        <div className="members">
          {tasks.some((t) => t.assignee_slot === 0) && (
            <div className="card member team-card">
              <h3 className="h4">Everyone</h3>
              <p className="muted small">Shared moments</p>
              <ul className="tasks">
                {tasks.filter((t) => t.assignee_slot === 0).map((t) => (
                  <li key={t.id}>
                    <label className={t.done ? 'is-done' : ''}>
                      <input type="checkbox" checked={t.done} onChange={() => toggle(t)} />
                      <span>{t.title}<span className="muted small"> · {formatDate(t.due_date)}</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {slots.map((slot) => {
            const mine = tasks.filter((t) => t.assignee_slot === slot);
            const effort = mine.reduce((s, t) => s + t.effort, 0);
            return (
              <div key={slot} className="card member">
                <h3 className="h4">{slotName(slot)}</h3>
                <p className="muted small">Workload: {effort} points · {mine.length} tasks</p>
                <ul className="tasks">
                  {mine.map((t) => (
                    <li key={t.id}>
                      <label className={t.done ? 'is-done' : ''}>
                        <input type="checkbox" checked={t.done} onChange={() => toggle(t)} />
                        <span>
                          {t.title}
                          <span className={`tag tag-${t.kind}`}>{KIND_LABEL[t.kind] ?? t.kind}</span>
                          <span className="muted small"> · {formatDate(t.due_date)}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="h3">Team</h2>
        {isOwner ? (
          <ol className="small how">
            <li>Type a teammate&apos;s email and click <strong>Invite</strong>. They take the next free slot (Teammate 2, 3…).</li>
            <li>Copy the message and send it to them (WhatsApp, email…).</li>
            <li>When they sign up or log in with that same email, this project and their tasks appear for them.</li>
          </ol>
        ) : (
          <p className="muted small">Only the project creator can invite teammates.</p>
        )}
        <ul className="plain">
          {members.map((m) => (
            <li key={m.id}>
              Teammate {m.slot}: {m.email}
              {isOwner && <button type="button" className="linkbtn" onClick={() => removeMember(m)}>remove</button>}
            </li>
          ))}
        </ul>
        {isOwner && (
          <form onSubmit={invite} className="row">
            <label htmlFor="invite" className="sr-only">Teammate email</label>
            <input id="invite" type="email" placeholder="teammate@student.edu" value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)} />
            <button type="submit" className="btn">Invite</button>
          </form>
        )}
        {isOwner && lastInvited && (
          <div className="brief-box">
            <p className="small ok">{lastInvited} was invited. Send them this message:</p>
            <p className="small invite-msg">{inviteText(lastInvited)}</p>
            <button type="button" className="btn btn-small" onClick={copyInvite}>{copied ? 'Copied ✓' : 'Copy message'}</button>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="h3">Shared document link</h2>
        <form onSubmit={saveDoc} className="row">
          <label htmlFor="doc" className="sr-only">Document URL</label>
          <input id="doc" type="url" placeholder="https://docs.google.com/…" value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)} />
          <button type="submit" className="btn">Save link</button>
        </form>
      </section>
    </div>
  );
}
