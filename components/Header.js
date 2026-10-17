'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function Header() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    await createClient().auth.signOut();
    window.location.assign('/');
  }

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="logo" aria-hidden="true">◧</span> SplitWork
      </Link>
      <nav className="topnav">
        {ready && user && (
          <>
            <Link href="/app" className="navlink">My projects</Link>
            <button type="button" data-testid="logout" className="btn btn-ghost" onClick={logout}>
              Log out
            </button>
          </>
        )}
        {ready && !user && (
          <>
            <Link href="/login" className="navlink">Log in</Link>
            <Link href="/signup" className="btn btn-small">Sign up</Link>
          </>
        )}
      </nav>
    </header>
  );
}
