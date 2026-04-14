import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import { Examiner } from '@/lib/types';

function rateColor(rate: number) {
  if (rate >= 70) return { hex: '#16a34a', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', banner: 'bg-green-500', label: 'Favorable' };
  if (rate >= 50) return { hex: '#d97706', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', banner: 'bg-amber-500', label: 'Moderate' };
  return { hex: '#dc2626', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', banner: 'bg-red-500', label: 'Selective' };
}

// ─── Strategy Engine ──────────────────────────────────────────────────────────

type StrategyProfile = {
  primaryAction: string;
  primaryActionDetail: string;
  primaryActionColor: string;
  recommendations: { icon: string; text: string; impact: 'high' | 'medium' | 'low' }[];
  allowanceLikelihood: 'High' | 'Moderate' | 'Low';
  allowanceLikelihoodColor: string;
  confidence: 'High' | 'Medium' | 'Low';
  confidenceNote: string;
  interviewImpact: string | null;
  interviewImpactColor: string;
  examinerPersonality: string;
};

function buildStrategyProfile(examiner: Examiner): StrategyProfile {
  const rate = examiner.grant_rate_3yr ?? 0;
  const interviewRate = examiner.interview_allowance_rate ?? null;
  const totalApps = examiner.total_applications ?? 0;
  const pendency = examiner.pendency_months ?? null;

  const confidence: 'High' | 'Medium' | 'Low' =
    totalApps >= 100 ? 'High' : totalApps >= 30 ? 'Medium' : 'Low';
  const confidenceNote =
    confidence === 'High'
      ? `Based on ${totalApps.toLocaleString()} applications — statistically reliable`
      : confidence === 'Medium'
      ? `Based on ${totalApps.toLocaleString()} applications — moderate reliability`
      : `Only ${totalApps.toLocaleString()} applications — interpret with caution`;

  let interviewImpact: string | null = null;
  let interviewImpactColor = 'text-slate-600';
  if (interviewRate !== null && rate > 0) {
    const delta = interviewRate - rate;
    if (Math.abs(delta) >= 3) {
      interviewImpact = delta > 0
        ? `+${delta.toFixed(1)}pp above baseline grant rate`
        : `${delta.toFixed(1)}pp below baseline grant rate`;
      interviewImpactColor = delta > 0 ? 'text-green-600' : 'text-red-600';
    } else {
      interviewImpact = 'Minimal impact on grant rate (within ±3pp)';
      interviewImpactColor = 'text-slate-500';
    }
  }

  const examinerPersonality =
    rate >= 75 ? 'Consistently favorable — receptive to well-prepared applications with broad claims.'
    : rate >= 65 ? 'Generally reasonable — expects solid prior art work and clear claim language.'
    : rate >= 50 ? 'Moderately selective — plan for amendments and expect at least one round of rejections.'
    : rate >= 35 ? 'Strict examiner — requires precise claim language and strong technical arguments.'
    : 'Very selective — one of the harder examiners in the USPTO database. Requires targeted strategy.';

  const allowanceLikelihood: 'High' | 'Moderate' | 'Low' =
    rate >= 65 ? 'High' : rate >= 45 ? 'Moderate' : 'Low';
  const allowanceLikelihoodColor =
    allowanceLikelihood === 'High' ? 'text-green-600 bg-green-50 border-green-200'
    : allowanceLikelihood === 'Moderate' ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-red-600 bg-red-50 border-red-200';

  const interviewHighlyEffective = interviewRate !== null && interviewRate > rate + 10;
  const interviewIneffective = interviewRate !== null && interviewRate < 25;

  let primaryAction = '';
  let primaryActionDetail = '';
  let primaryActionColor = '';

  if (rate >= 70) {
    primaryAction = 'File with confidence';
    primaryActionDetail = 'This examiner has a strong grant rate. Standard prosecution with well-supported claims is your best path.';
    primaryActionColor = 'text-green-700 bg-green-50 border-green-300';
  } else if (rate >= 55 && interviewHighlyEffective) {
    primaryAction = 'Request examiner interview';
    primaryActionDetail = `Interviews move the needle significantly here (+${((interviewRate ?? 0) - rate).toFixed(1)}pp). Schedule one early — before the first office action if possible.`;
    primaryActionColor = 'text-blue-700 bg-blue-50 border-blue-300';
  } else if (rate >= 55) {
    primaryAction = 'Prepare for amendment rounds';
    primaryActionDetail = 'Anticipate 1-2 office actions. File broad independent claims and have dependent claims ready as fallback positions.';
    primaryActionColor = 'text-amber-700 bg-amber-50 border-amber-300';
  } else if (rate < 55 && interviewHighlyEffective) {
    primaryAction = 'Request examiner interview immediately';
    primaryActionDetail = `Low grant rate but interviews are highly effective (+${((interviewRate ?? 0) - rate).toFixed(1)}pp). This is your best tool with this examiner.`;
    primaryActionColor = 'text-blue-700 bg-blue-50 border-blue-300';
  } else if (rate < 55 && interviewIneffective) {
    primaryAction = 'File narrow — plan for continuation';
    primaryActionDetail = 'Low grant rate and interviews are not effective here. File targeted claims and preserve continuation rights for future prosecution.';
    primaryActionColor = 'text-red-700 bg-red-50 border-red-300';
  } else {
    primaryAction = 'File narrow, targeted claims';
    primaryActionDetail = 'This examiner is selective. Use specific, well-defined claim language and be ready for multiple rejection rounds.';
    primaryActionColor = 'text-amber-700 bg-amber-50 border-amber-300';
  }

  const recommendations: StrategyProfile['recommendations'] = [];
  if (rate >= 70) {
    recommendations.push({ icon: '✅', text: 'Broad independent claims are viable with this examiner', impact: 'high' });
    recommendations.push({ icon: '📋', text: 'Thorough prior art search will maintain allowance momentum', impact: 'medium' });
    recommendations.push({ icon: '🔄', text: 'Consider continuation after allowance to broaden coverage', impact: 'medium' });
    if (pendency && pendency < 20) recommendations.push({ icon: '⚡', text: `Fast pendency (${pendency.toFixed(1)} mo) — expect quicker prosecution cycle`, impact: 'high' });
  } else if (rate >= 50) {
    recommendations.push({ icon: '📝', text: 'File independent claims with clear, specific limitations', impact: 'high' });
    recommendations.push({ icon: '🛡️', text: 'Include strong dependent claims as fallback positions', impact: 'high' });
    if (interviewHighlyEffective) {
      recommendations.push({ icon: '🤝', text: 'Schedule an interview — highly effective with this examiner', impact: 'high' });
    } else {
      recommendations.push({ icon: '📞', text: 'Consider an interview after first office action to align on scope', impact: 'medium' });
    }
    recommendations.push({ icon: '⏱️', text: `Avg pendency ${pendency ? pendency.toFixed(1) + ' months' : 'unknown'} — budget prosecution timeline accordingly`, impact: 'low' });
  } else {
    recommendations.push({ icon: '🎯', text: 'Use narrow, highly specific claim language from the start', impact: 'high' });
    if (interviewHighlyEffective) {
      recommendations.push({ icon: '🤝', text: 'Examiner interviews are your most effective tool — use early', impact: 'high' });
    } else if (interviewIneffective) {
      recommendations.push({ icon: '⚠️', text: 'Interviews have low success rate here — invest in written arguments instead', impact: 'high' });
    }
    recommendations.push({ icon: '🔄', text: 'Preserve continuation rights — plan for multi-round prosecution', impact: 'high' });
    recommendations.push({ icon: '📑', text: 'Prepare robust technical arguments supported by specification', impact: 'medium' });
    if (pendency && pendency > 35) recommendations.push({ icon: '⏳', text: `Long pendency (${pendency.toFixed(1)} mo) — file early to preserve priority dates`, impact: 'medium' });
  }

  return { primaryAction, primaryActionDetail, primaryActionColor, recommendations, allowanceLikelihood, allowanceLikelihoodColor, confidence, confidenceNote, interviewImpact, interviewImpactColor, examinerPersonality };
}

function StrategyPanel({ examiner }: { examiner: Examiner }) {
  const profile = buildStrategyProfile(examiner);
  const impactBadge = (impact: 'high' | 'medium' | 'low') =>
    impact === 'high' ? 'bg-blue-50 text-blue-600 border border-blue-200'
    : impact === 'medium' ? 'bg-slate-50 text-slate-500 border border-slate-200'
    : 'bg-slate-50 text-slate-400 border border-slate-100';

  return (
    <div className="space-y-5">
      {/* Examiner personality */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🧠</span>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Examiner Profile</h3>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed font-medium">{profile.examinerPersonality}</p>
      </div>

      {/* Primary action */}
      <div className={`rounded-2xl border-2 p-5 ${profile.primaryActionColor}`}>
        <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">Recommended Next Step</p>
        <h3 className="text-base font-extrabold mb-1.5">{profile.primaryAction}</h3>
        <p className="text-sm leading-relaxed opacity-90">{profile.primaryActionDetail}</p>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-1 items-center text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Allowance</p>
          <span className={`text-sm font-extrabold px-2.5 py-1 rounded-full border mt-1 ${profile.allowanceLikelihoodColor}`}>{profile.allowanceLikelihood}</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-1 items-center text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Confidence</p>
          <span className={`text-sm font-extrabold px-2.5 py-1 rounded-full border mt-1 ${profile.confidence === 'High' ? 'text-green-600 bg-green-50 border-green-200' : profile.confidence === 'Medium' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200'}`}>{profile.confidence}</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-1 items-center text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Interview Δ</p>
          <span className={`text-sm font-extrabold mt-1 ${profile.interviewImpactColor}`}>
            {profile.interviewImpact ? (profile.interviewImpact.startsWith('+') || profile.interviewImpact.startsWith('-') ? profile.interviewImpact.split(' ')[0] : '~0pp') : 'No data'}
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full inline-block ${profile.confidence === 'High' ? 'bg-green-400' : profile.confidence === 'Medium' ? 'bg-amber-400' : 'bg-red-400'}`} />
        {profile.confidenceNote}
      </p>

      {/* Action checklist */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Action Checklist</h3>
        <div className="space-y-2">
          {profile.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3 bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 hover:shadow-md transition-shadow">
              <span className="text-base shrink-0 mt-0.5">{rec.icon}</span>
              <p className="text-sm text-slate-700 leading-relaxed flex-1">{rec.text}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 self-start mt-0.5 ${impactBadge(rec.impact)}`}>{rec.impact}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Interview impact detail */}
      {profile.interviewImpact && examiner.interview_allowance_rate != null && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">🤝</span>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Interview Impact Analysis</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-0.5 text-center flex-1">
              <p className="text-2xl font-extrabold text-slate-900">{(examiner.grant_rate_3yr ?? 0).toFixed(1)}%</p>
              <p className="text-xs text-slate-400">Baseline grant rate</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className={`text-lg font-black ${profile.interviewImpactColor}`}>→</span>
              <span className={`text-xs font-bold ${profile.interviewImpactColor}`}>{profile.interviewImpact.split(' ')[0]}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 text-center flex-1">
              <p className="text-2xl font-extrabold text-slate-900">{examiner.interview_allowance_rate.toFixed(1)}%</p>
              <p className="text-xs text-slate-400">After interview</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 text-center mt-3">Based on {examiner.interview_count?.toLocaleString() ?? '—'} recorded interviews</p>
        </div>
      )}
    </div>
  );
}

// ─── Page components ──────────────────────────────────────────────────────────

function GrantGauge({ rate }: { rate: number }) {
  const size = 160;
  const sw = 12;
  const r = (size - sw) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, rate));
  const fill = (clamped / 100) * circ;
  const { hex, label } = rateColor(rate);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={hex} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`} transform={`rotate(-90 ${cx} ${cx})`} />
        <text x={cx} y={cx - 8} textAnchor="middle" dominantBaseline="middle" fontSize="28" fontWeight="800" fill={hex}>{clamped.toFixed(0)}%</text>
        <text x={cx} y={cx + 14} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#94a3b8">{label}</text>
      </svg>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Grant Rate</p>
    </div>
  );
}

function USPTOBar({ rate }: { rate: number }) {
  const AVG = 67;
  const clamped = Math.min(100, Math.max(0, rate));
  const { hex } = rateColor(rate);
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-400 font-medium mb-1.5">
        <span>0%</span><span className="font-semibold text-slate-500">vs. USPTO avg ({AVG}%)</span><span>100%</span>
      </div>
      <div className="relative h-2 bg-slate-100 rounded-full">
        <div className="absolute top-0 h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: hex, opacity: 0.85 }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-400 rounded-full z-10" style={{ left: `${AVG}%` }} />
      </div>
      <div className="flex justify-between text-xs mt-1.5">
        <span style={{ color: hex }} className="font-bold">{clamped.toFixed(1)}% this examiner</span>
        <span className="text-slate-400">{AVG}% USPTO avg</span>
      </div>
    </div>
  );
}

export default async function ExaminerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: examiner } = await supabase.from('examiners').select('*').eq('id', id).single<Examiner>();

  if (!examiner) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-12 text-center max-w-md w-full">
          <div className="text-5xl mb-5">🔍</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Examiner not found</h1>
          <p className="text-slate-500 text-sm mb-8">We could not find an examiner with that ID.</p>
          <Link href="/" className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all">← Back to search</Link>
        </div>
      </main>
    );
  }

  const rate = examiner.grant_rate_3yr ?? 0;
  const colors = rateColor(rate);
  const formattedDate = examiner.updated_at
    ? new Date(examiner.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const trendEntries = examiner.grant_rate_by_year
    ? Object.entries(examiner.grant_rate_by_year).map(([y, r]) => ({ y, r: r as number })).sort((a, b) => +a.y - +b.y)
    : [];
  const showTrend = trendEntries.length >= 3;
  let trendLabel = '';
  let trendStyle = '';
  if (showTrend) {
    const fa = (trendEntries[0].r + trendEntries[1].r) / 2;
    const la = (trendEntries[trendEntries.length - 2].r + trendEntries[trendEntries.length - 1].r) / 2;
    const delta = la - fa;
    trendLabel = delta > 2 ? `↑ Trending up +${delta.toFixed(1)}pp` : delta < -2 ? `↓ Trending down ${delta.toFixed(1)}pp` : '→ Relatively stable';
    trendStyle = delta > 2 ? 'text-green-600 bg-green-50 border-green-200' : delta < -2 ? 'text-red-600 bg-red-50 border-red-200' : 'text-slate-500 bg-slate-50 border-slate-200';
  }

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'Inter, sans-serif' }}>

      <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="PatentIQ" width={110} height={30} className="object-contain h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Data sourced from USPTO
            </span>
            <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">← Search</Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pt-24 pb-16">

        {/* Hero — open layout */}
        <div className="pt-8 pb-10 mb-8 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>{colors.label}</span>
                {examiner.art_unit_number && <span className="text-sm text-slate-400 font-medium">Art Unit {examiner.art_unit_number}</span>}
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">{examiner.name}</h1>
            </div>
            {formattedDate && <p className="text-xs text-slate-400 shrink-0">Updated {formattedDate}</p>}
          </div>

          <div className="flex flex-col sm:flex-row items-start gap-10">
            {examiner.grant_rate_3yr != null && (
              <div className="shrink-0"><GrantGauge rate={examiner.grant_rate_3yr} /></div>
            )}
            <div className="flex-1 flex flex-col gap-5 pt-2 w-full">
              {examiner.grant_rate_3yr != null && <USPTOBar rate={examiner.grant_rate_3yr} />}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Applications', value: examiner.total_applications?.toLocaleString() },
                  { label: 'Avg Pendency', value: examiner.pendency_months != null ? `${examiner.pendency_months.toFixed(1)} mo` : undefined },
                  { label: 'Art Unit', value: examiner.art_unit_number },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col gap-0.5">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{s.label}</p>
                    <p className="text-xl font-extrabold text-slate-900">{s.value ?? '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT — 2 cols: Strategy Panel replaces old strategy section */}
          <div className="lg:col-span-2 space-y-8">

            {/* Strategy Panel — NEW */}
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Prosecution Strategy</h2>
              <StrategyPanel examiner={examiner} />
            </div>

            {/* Rejection Activity */}
            {examiner.rejection_codes && (() => {
              const codes = examiner.rejection_codes!;
              const max = Math.max(codes.non_final, codes.final, 1);
              const nfPct = codes.total > 0 ? ((codes.non_final / codes.total) * 100).toFixed(0) : '0';
              const fPct = codes.total > 0 ? ((codes.final / codes.total) * 100).toFixed(0) : '0';
              return (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rejection Activity</h2>
                    <span className="text-sm font-bold text-slate-900">{codes.total.toLocaleString()} <span className="text-slate-400 font-normal text-xs">total rejections</span></span>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-semibold text-amber-600">Non-Final Rejections</span>
                        <span className="text-slate-500">{codes.non_final.toLocaleString()} <span className="text-amber-500">({nfPct}%)</span></span>
                      </div>
                      <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400 flex items-center justify-end pr-2" style={{ width: `${(codes.non_final / max) * 100}%` }}>
                          {(codes.non_final / max) > 0.2 && <span className="text-xs font-bold text-white">{nfPct}%</span>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-semibold text-red-600">Final Rejections</span>
                        <span className="text-slate-500">{codes.final.toLocaleString()} <span className="text-red-500">({fPct}%)</span></span>
                      </div>
                      <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-red-400 flex items-center justify-end pr-2" style={{ width: `${(codes.final / max) * 100}%` }}>
                          {(codes.final / max) > 0.2 && <span className="text-xs font-bold text-white">{fPct}%</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Grant Rate Trend */}
            {showTrend && (() => {
              const W = 500; const H = 150; const px = 36; const py = 16;
              const cw = W - px * 2; const ch = H - py * 2;
              const rates = trendEntries.map(e => e.r);
              const min = Math.max(0, Math.min(...rates) - 8);
              const max = Math.min(100, Math.max(...rates) + 8);
              const xp = (i: number) => px + (i / (trendEntries.length - 1)) * cw;
              const yp = (r: number) => py + ch - ((r - min) / (max - min)) * ch;
              const pts = trendEntries.map((e, i) => `${xp(i)},${yp(e.r)}`).join(' ');
              const area = `${xp(0)},${py + ch} ${pts} ${xp(trendEntries.length - 1)},${py + ch}`;
              return (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Grant Rate Trend</h2>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${trendStyle}`}>{trendLabel}</span>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
                      {[min, (min + max) / 2, max].map(tick => (
                        <g key={tick}>
                          <line x1={px} y1={yp(Math.round(tick))} x2={W - px} y2={yp(Math.round(tick))} stroke="#f1f5f9" strokeWidth="1" />
                          <text x={px - 6} y={yp(Math.round(tick))} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="#94a3b8">{Math.round(tick)}%</text>
                        </g>
                      ))}
                      <polygon points={area} fill={colors.hex} opacity="0.07" />
                      <polyline points={pts} fill="none" stroke={colors.hex} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                      {trendEntries.map((e, i) => (
                        <g key={e.y}>
                          <circle cx={xp(i)} cy={yp(e.r)} r="3.5" fill={colors.hex} />
                          <text x={xp(i)} y={H - 2} textAnchor="middle" fontSize="9" fill="#94a3b8">{e.y}</text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* RIGHT sidebar */}
          <div className="space-y-6">

            {/* Interviews */}
            {examiner.interview_count != null && examiner.interview_allowance_rate != null && (() => {
              const count = examiner.interview_count!;
              const rate2 = examiner.interview_allowance_rate!;
              const circ = 2 * Math.PI * 28;
              const fillLen = (Math.min(100, Math.max(0, rate2)) / 100) * circ;
              const color = rate2 >= 50 ? '#16a34a' : rate2 >= 25 ? '#d97706' : '#dc2626';
              const note = rate2 > 50 ? 'Interviews are highly effective' : rate2 >= 25 ? 'Interviews sometimes help' : 'Interviews rarely lead to allowance';
              const noteStyle = rate2 > 50 ? 'text-green-700 bg-green-50 border-green-200' : rate2 >= 25 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';
              return (
                <div>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Examiner Interviews</h2>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <div className="flex items-center gap-5 mb-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-4xl font-black text-slate-900">{count.toLocaleString()}</span>
                        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Total Interviews</span>
                      </div>
                      <div className="w-px self-stretch bg-slate-100" />
                      <div className="flex flex-col items-center gap-1">
                        <svg width="64" height="64" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r="28" fill="none" stroke="#f1f5f9" strokeWidth="7" />
                          <circle cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
                            strokeDasharray={`${fillLen} ${circ}`} transform="rotate(-90 32 32)" />
                          <text x="32" y="29" textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="800" fill={color}>{rate2.toFixed(0)}%</text>
                          <text x="32" y="41" textAnchor="middle" dominantBaseline="middle" fontSize="7" fill="#94a3b8">allow</text>
                        </svg>
                        <p className="text-xs text-slate-400 text-center leading-tight">Interview<br />→ Allowance</p>
                      </div>
                    </div>
                    <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${noteStyle}`}>{note}</div>
                  </div>
                </div>
              );
            })()}

            {/* Data quality */}
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Data Quality</h2>
              <div className="space-y-2.5">
                {[
                  { dot: 'bg-green-400', text: 'USPTO PatEx dataset' },
                  { dot: 'bg-green-400', text: '14M+ applications analyzed' },
                  { dot: 'bg-blue-400', text: '3-year rolling grant rate' },
                  ...(examiner.total_applications && examiner.total_applications > 100
                    ? [{ dot: 'bg-green-400', text: `High confidence (${examiner.total_applications.toLocaleString()} apps)` }]
                    : []),
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-slate-600">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dot}`} />
                    {item.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Art Unit */}
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Art Unit Context</h2>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                {examiner.art_unit_number && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-400 mb-0.5">Art Unit</p>
                    <p className="text-3xl font-black text-slate-900">{examiner.art_unit_number}</p>
                  </div>
                )}
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-600 bg-blue-100 rounded-full px-2 py-0.5">Pro</span>
                    <p className="text-xs font-semibold text-slate-700">Peer benchmarking</p>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">Compare this examiner to others in Art Unit {examiner.art_unit_number ?? 'their group'}.</p>
                  <button className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all rounded-xl py-2">Upgrade to Pro</button>
                </div>
              </div>
            </div>

            {/* AI teaser */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">✨</span>
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-75">AI Summary</h3>
              </div>
              <p className="text-sm opacity-85 leading-relaxed mb-3">Get a plain-language strategy brief for {examiner.name} powered by Claude AI.</p>
              <button className="w-full text-xs font-bold bg-white text-blue-600 hover:bg-blue-50 active:scale-95 transition-all rounded-xl py-2.5">Unlock AI Summary (Pro)</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
