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

interface SavedExaminer {
  id: string;
  examiner_id: string;
  saved_at: string;
  examiner: {
    name: string;
    art_unit_number: string;
    grant_rate_3yr: number;
    pendency_months: number;
    total_applications: number;
  };
}

function rateColor(rate: number) {
  if (rate >= 70) return { text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', hex: '#16a34a', label: 'Favorable' };
  if (rate >= 50) return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', hex: '#d97706', label: 'Moderate' };
  return { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', hex: '#dc2626', label: 'Selective' };
}

export default function SavedPage() {
  const [saved, setSaved] = useState<SavedExaminer[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/sign-in'); return; }
      const u = data.session.user;
      setUser({ id: u.id, email: u.email });

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', u.id).single();
      if (profile?.full_name) setFullName(profile.full_name);

      const { data: savedData } = await supabase
        .from('saved_examiners')
        .select('*, examiner:examiners(name, art_unit_number, grant_rate_3yr, pendency_months, total_applications)')
        .eq('user_id', u.id)
        .order('saved_at', { ascending: false });

      setSaved(savedData ?? []);
      setLoading(false);
    });
  }, [router]);

  const handleRemove = async (id: string) => {
    await supabase.from('saved_examiners').delete().eq('id', id);
    setSaved(prev => prev.filter(s => s.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" style={{ fontFamily: 'Inter, sans-serif' }}>
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'Inter, sans-serif' }}>
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="PatentIQ" width={140} height={36} className="object-contain h-9 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/account" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Account</Link>
            <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">← Search</Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 pt-28 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-1">Saved Examiners</h1>
          <p className="text-slate-400 text-sm">
            {fullName ? `${fullName}'s` : 'Your'} saved examiner list — {saved.length} examiner{saved.length !== 1 ? 's' : ''} saved
          </p>
        </div>

        {saved.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
            <p className="text-2xl mb-3">🔍</p>
            <h2 className="text-lg font-bold text-slate-700 mb-2">No saved examiners yet</h2>
            <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
              When you find an examiner you want to track, click the bookmark button on their profile to save them here.
            </p>
            <Link href="/" className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all">
              Search Examiners
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {saved.map(s => {
              const ex = s.examiner;
              const colors = rateColor(ex.grant_rate_3yr);
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between gap-4 hover:border-blue-200 transition-all group">
                  <Link href={`/examiner/${s.examiner_id}`} className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">{ex.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Art Unit {ex.art_unit_number} · {ex.total_applications?.toLocaleString()} applications</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-extrabold" style={{ color: colors.hex }}>{ex.grant_rate_3yr?.toFixed(1)}%</p>
                        <p className="text-xs text-slate-400">allowance rate</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>{colors.label}</span>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-700">{ex.pendency_months?.toFixed(1)} mo</p>
                        <p className="text-xs text-slate-400">pendency</p>
                      </div>
                    </div>
                  </Link>
                  <button onClick={() => handleRemove(s.id)}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Search</p>
          <p className="text-sm text-slate-500 mb-4">Look up another examiner to add to your saved list.</p>
          <Link href="/" className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all">
            Search Examiners
          </Link>
        </div>
      </div>
    </div>
  );
}