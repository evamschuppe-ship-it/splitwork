'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError('Wrong email or password.');
      setLoading(false);
      return;
    }
    window.location.assign('/app');
  }

  return (
    <div className="auth">
      <h1>Log in</h1>
      <p className="muted">Welcome back to your team workspaces.</p>
      <form onSubmit={onSubmit} className="card form" method="post" action="/login">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required value={email}
          onChange={(e) => setEmail(e.target.value)} data-testid="login-email" />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password" />
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn" disabled={loading} data-testid="login-submit">
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="muted small">New here? <Link href="/signup">Create an account</Link></p>
    </div>
  );
}
