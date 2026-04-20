'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function SaveButton({ examinerId }: { examinerId: string }) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: existing } = await supabase
          .from('saved_examiners')
          .select('id')
          .eq('user_id', uid)
          .eq('examiner_id', examinerId)
          .single();
        setSaved(!!existing);
      }
      setLoading(false);
    });
  }, [examinerId]);

  const toggle = async () => {
    if (!userId) { window.location.href = '/sign-in'; return; }
    setLoading(true);
    if (saved) {
      await supabase.from('saved_examiners')
        .delete().eq('user_id', userId).eq('examiner_id', examinerId);
      setSaved(false);
    } else {
      await supabase.from('saved_examiners')
        .insert({ user_id: userId, examiner_id: examinerId });
      setSaved(true);
    }
    setLoading(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={saved ? 'Remove from saved' : 'Save examiner'}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
        saved
          ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
          : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
      } disabled:opacity-50`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}