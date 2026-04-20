'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AccountPage() {
  const [user, setUser] = useState<{ email?: string; id?: string } | null>(null);
  const [plan, setPlan] = useState<string>('free');
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/sign-in'); return; }
      const u = data.session.user;
      setUser({ email: u.email, id: u.id });
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', u.id).single();
      if (profile) setPlan(profile.plan);
      setLoading(false);
    });
  }, [router]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(''); setPasswordError('');
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters.'); return; }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setPasswordError(error.message); }
    else { setPasswordMsg('Password updated successfully.'); setNewPassword(''); setConfirmPassword(''); }
    setSavingPassword(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="text-sm text-slate-400">Loading...</div>
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
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">← Back to search</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 pt-28 pb-20">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-1">Account Settings</h1>
        <p className="text-slate-400 text-sm mb-10">{user?.email}</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Plan */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Current Plan</p>
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${plan === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                {plan === 'pro' ? 'Pro' : 'Free'}
              </span>
              {plan === 'pro' && <span className="text-xs text-slate-400">$7/month</span>}
            </div>
            {plan === 'free' ? (
              <>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">Upgrade to Pro to unlock AI strategy summaries, full peer benchmarking, and more.</p>
                <ul className="space-y-2 mb-5">
                  {['AI strategy summaries (Claude)', 'Full art unit peer benchmarking', 'Examiner ranking within art unit', 'Cost & timeline estimator', 'Priority support'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/pricing" className="block w-full text-center py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all">
                  Upgrade to Pro — $7/mo
                </Link>
                <p className="text-xs text-slate-400 text-center mt-2">14-day free trial · Cancel anytime</p>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">You have full access to all Pro features.</p>
                <button className="w-full py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">
                  Manage Subscription
                </button>
              </>
            )}
          </div>

          {/* Change password */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Change Password</p>
            {passwordMsg && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4"><p className="text-xs text-green-700 font-medium">{passwordMsg}</p></div>}
            {passwordError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4"><p className="text-xs text-red-600 font-medium">{passwordError}</p></div>}
            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required
                  placeholder="Min. 8 characters"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="submit" disabled={savingPassword}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-all disabled:opacity-60">
                {savingPassword ? 'Saving...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* Account info */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Account Info</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <p className="text-xs text-slate-500">Email</p>
                <p className="text-sm font-semibold text-slate-900">{user?.email}</p>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <p className="text-xs text-slate-500">Plan</p>
                <p className="text-sm font-semibold text-slate-900 capitalize">{plan}</p>
              </div>
              <div className="flex items-center justify-between py-2">
                <p className="text-xs text-slate-500">Member since</p>
                <p className="text-sm font-semibold text-slate-900">2026</p>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Session</p>
            <p className="text-sm text-slate-500 mb-4">You are currently signed in as <span className="font-semibold text-slate-700">{user?.email}</span>.</p>
            <button onClick={handleSignOut}
              className="w-full py-3 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 transition-all">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
