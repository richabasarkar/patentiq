'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function Navbar() {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  const initials = user?.email ? user.email[0].toUpperCase() : '';

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center relative">
        {/* Logo */}
        <Link href="/">
          <Image src="/logo.png" alt="PatentIQ" width={180} height={47} className="object-contain h-9 w-auto shrink-0" priority />
        </Link>

        {/* Nav centered */}
        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          <a href="/#how" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">How it works</a>
          <a href="/#features" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Features</a>
          <a href="/#pricing" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Pricing</a>
        </nav>

        {/* Auth right */}
        <div className="flex items-center gap-3 ml-auto">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {initials}
                </div>
                <span className="text-sm font-medium text-slate-700 hidden sm:block max-w-32 truncate">{user.email}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 shrink-0">
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl border border-slate-100 shadow-xl z-20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-xs text-slate-400">Signed in as</p>
                      <p className="text-sm font-semibold text-slate-900 truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <Link href="/account" onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                        Account settings
                      </Link>
                      <Link href="/pricing" onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                        Upgrade to Pro
                        <span className="ml-auto text-xs font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Pro</span>
                      </Link>
                    </div>
                    <div className="py-1 border-t border-slate-100">
                      <button onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <Link href="/sign-in" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-4 py-2">
                Sign in
              </Link>
              <Link href="/sign-up" className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all px-5 py-2 rounded-xl shadow-sm">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
