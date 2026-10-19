'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { strongPassword } from '@/lib/password';

export default function ResetPasswordPage() {
  const [status, setStatus] = useState('checking'); // checking | ready | invalid
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const code = params.get('code');

    async function verify() {
      // Link from the email template (works on any device) or the default PKCE link.
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
        setStatus(error ? 'invalid' : 'ready');
      } else if (code) {
        // The client may already have exchanged the code while starting up.
        const { data } = await supabase.auth.getSession();
        if (data.session) setStatus('ready');
        else {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          setStatus(error ? 'invalid' : 'ready');
        }
      } else {
        const { data } = await supabase.auth.getSession();
        setStatus(data.session ? 'ready' : 'invalid');
      }
      window.history.replaceState(null, '', '/reset-password');
    }
    verify();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const { error } = await createClient().auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.assign('/app');
  }

  return (
    <div className="auth">
      <h1>Choose a new password</h1>
      {status === 'checking' && <p className="muted">Checking your reset link…</p>}
      {status === 'invalid' && (
        <div className="card">
          <p><strong>This reset link is invalid or has expired.</strong></p>
          <p className="muted small">Links work once and expire after an hour. <Link href="/forgot-password">Send a new link</Link>.</p>
        </div>
      )}
      {status === 'ready' && (
        <form onSubmit={onSubmit} className="card form" method="post" action="/reset-password">
          <label htmlFor="password">New password (min. 6 characters)</label>
          <div className="pw-row">
            <input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="btn btn-ghost pw-toggle" onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
          </div>
          <button type="button" className="linkish" onClick={() => { setPassword(strongPassword()); setShow(true); }}>
            🔐 Suggest a strong password
          </button>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save new password'}</button>
        </form>
      )}
    </div>
  );
}
