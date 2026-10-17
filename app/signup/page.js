'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [suggested, setSuggested] = useState(false);

  function suggestPassword() {
    // 16 random characters from an unambiguous set, generated in the browser.
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?';
    const bytes = new Uint32Array(16);
    crypto.getRandomValues(bytes);
    const pwd = Array.from(bytes, (b) => chars[b % chars.length]).join('');
    setPassword(pwd);
    setShow(true);
    setSuggested(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error } = await createClient().auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (!data.session) {
      setError('Account created but no session was returned. Please log in.');
      setLoading(false);
      return;
    }
    window.location.assign('/app');
  }

  return (
    <div className="auth">
      <h1>Create your account</h1>
      <p className="muted">Start splitting your group project in seconds.</p>
      <form onSubmit={onSubmit} className="card form" method="post" action="/signup">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required value={email}
          onChange={(e) => setEmail(e.target.value)} data-testid="signup-email" />
        <label htmlFor="password">Password (min. 6 characters)</label>
        <div className="pw-row">
          <input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={6}
            passwordrules="minlength: 12; required: lower; required: upper; required: digit;"
            value={password} onChange={(e) => { setPassword(e.target.value); setSuggested(false); }} data-testid="signup-password" />
          <button type="button" className="btn btn-ghost pw-toggle" onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
        </div>
        <button type="button" className="linkish" onClick={suggestPassword}>🔐 Suggest a strong password</button>
        {suggested && (
          <p className="muted small" role="status">
            Strong password filled in. When you sign up, your browser (Chrome, Safari/iCloud Keychain…) will offer to save it — click <strong>Save</strong>.
          </p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn" disabled={loading} data-testid="signup-submit">
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="muted small">Already have an account? <Link href="/login">Log in</Link></p>
    </div>
  );
}
