'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      <form onSubmit={onSubmit} className="card form">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} data-testid="signup-email" />
        <label htmlFor="password">Password (min. 6 characters)</label>
        <input id="password" type="password" autoComplete="new-password" required minLength={6}
          value={password} onChange={(e) => setPassword(e.target.value)} data-testid="signup-password" />
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn" disabled={loading} data-testid="signup-submit">
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="muted small">Already have an account? <Link href="/login">Log in</Link></p>
    </div>
  );
}
