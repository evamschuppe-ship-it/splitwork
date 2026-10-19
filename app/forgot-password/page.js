'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const fromLogin = sessionStorage.getItem('splitwork-reset-email');
      if (fromLogin) setEmail(fromLogin);
      sessionStorage.removeItem('splitwork-reset-email');
    } catch {}
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(/rate limit/i.test(error.message)
        ? 'Too many reset emails were sent recently. Please wait a few minutes and try again.'
        : error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="auth">
      <h1>Reset your password</h1>
      {sent ? (
        <div className="card">
          <p><strong>Check your inbox.</strong> If an account exists for {email}, we&apos;ve sent a link to choose a new password.</p>
          <p className="muted small">Didn&apos;t get it after a few minutes? Check spam, or <button type="button" className="linkish" onClick={() => setSent(false)}>try again</button>.</p>
        </div>
      ) : (
        <>
          <p className="muted">Enter the email you signed up with and we&apos;ll email you a link to set a new password.</p>
          <form onSubmit={onSubmit} className="card form">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required value={email}
              onChange={(e) => setEmail(e.target.value)} />
            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Sending…' : 'Email me a reset link'}
            </button>
          </form>
        </>
      )}
      <p className="muted small">Remembered it? <Link href="/login">Back to log in</Link></p>
    </div>
  );
}
