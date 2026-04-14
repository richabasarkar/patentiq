import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import { Examiner } from '@/lib/types';

const USPTO_AVG_PENDENCY = 24.5;
const USPTO_AVG_GRANT_RATE = 67;

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
  recommendations: { icon: string; text: string; why: string; impact: 'high' | 'medium' | 'low' }[];
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
      ? `Statistically reliable — based on ${totalApps.toLocaleString()} applications`
      : confidence === 'Medium'
      ? `Moderate reliability — based on ${totalApps.toLocaleString()} applications`
      : `Low sample size — only ${totalApps.toLocaleString()} applications, interpret with caution`;

  let interviewImpact: string | null = null;
  let interviewImpactColor = 'text-slate-600';
  if (interviewRate !== null && rate > 0) {
    const delta = interviewRate - rate;
    if (Math.abs(delta) >= 3) {
      interviewImpact = delta > 0
        ? `+${delta.toFixed(1)}pp above baseline`
        : `${delta.toFixed(1)}pp below baseline`;
      interviewImpactColor = delta > 0 ? 'text-green-600' : 'text-red-600';
    } else {
      interviewImpact = '~0pp impact';
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
    primaryActionDetail = 'This examiner has a strong grant rate — well above the USPTO average. Standard prosecution with well-supported, broad claims is your best path. Expect a smoother-than-average prosecution cycle.';
    primaryActionColor = 'text-green-700 bg-green-50 border-green-300';
  } else if (rate >= 55 && interviewHighlyEffective) {
    primaryAction = 'Request examiner interview early';
    primaryActionDetail = `Interviews move the needle significantly here (+${((interviewRate ?? 0) - rate).toFixed(1)}pp above baseline). Schedule one before or immediately after the first office action to align on claim scope directly with the examiner.`;
    primaryActionColor = 'text-blue-700 bg-blue-50 border-blue-300';
  } else if (rate >= 55) {
    primaryAction = 'Prepare for amendment rounds';
    primaryActionDetail = 'This examiner is moderately selective. Anticipate 1-2 rounds of office actions before allowance. File broad independent claims now, and have dependent claims ready as fallback positions for amendment rounds.';
    primaryActionColor = 'text-amber-700 bg-amber-50 border-amber-300';
  } else if (rate < 55 && interviewHighlyEffective) {
    primaryAction = 'Request examiner interview immediately';
    primaryActionDetail = `Low grant rate, but interviews are highly effective here (+${((interviewRate ?? 0) - rate).toFixed(1)}pp above baseline). This is your highest-leverage tool with this examiner — use it early in prosecution.`;
    primaryActionColor = 'text-blue-700 bg-blue-50 border-blue-300';
  } else if (rate < 55 && interviewIneffective) {
    primaryAction = 'File narrow — plan for continuation';
    primaryActionDetail = 'Low grant rate and interviews are not effective here. File targeted, specific claims, invest in written arguments over interviews, and preserve continuation rights to keep future prosecution options open.';
    primaryActionColor = 'text-red-700 bg-red-50 border-red-300';
  } else {
    primaryAction = 'File narrow, targeted claims';
    primaryActionDetail = 'This examiner is selective. Use specific, well-defined claim language from the start and be ready for multiple rejection rounds. Broad claims are unlikely to survive initial examination.';
    primaryActionColor = 'text-amber-700 bg-amber-50 border-amber-300';
  }

  const recommendations: StrategyProfile['recommendations'] = [];
  if (rate >= 70) {
    recommendations.push({ icon: '✅', text: 'Broad independent claims are viable', why: 'Grant rate above 70% means this examiner allows a high proportion of claims as-filed.', impact: 'high' });
    recommendations.push({ icon: '📋', text: 'Run a thorough prior art search', why: 'Strong prior art work builds examiner confidence and reduces back-and-forth.', impact: 'medium' });
    recommendations.push({ icon: '🔄', text: 'Consider a continuation after allowance', why: 'Favorable examiners make continuation strategies more predictable and cost-effective.', impact: 'medium' });
    if (pendency && pendency < 20) recommendations.push({ icon: '⚡', text: `Expect fast prosecution (~${pendency.toFixed(0)} months avg)`, why: 'Shorter pendency means lower prosecution cost and faster time-to-patent.', impact: 'high' });
  } else if (rate >= 50) {
    recommendations.push({ icon: '📝', text: 'File claims with specific, clear limitations', why: 'Moderate examiners respond better to precise claim language than broad assertions.', impact: 'high' });
    recommendations.push({ icon: '🛡️', text: 'Draft strong dependent claims as fallbacks', why: 'Having narrow backup positions reduces the cost of amendment rounds.', impact: 'high' });
    if (interviewHighlyEffective) {
      recommendations.push({ icon: '🤝', text: 'Schedule an interview — it significantly helps', why: `Interview allowance rate is ${((interviewRate ?? 0) - rate).toFixed(1)}pp above baseline with this examiner.`, impact: 'high' });
    } else {
      recommendations.push({ icon: '📞', text: 'Consider an interview after first OA', why: 'Direct dialogue can narrow disputes before they require formal responses.', impact: 'medium' });
    }
    recommendations.push({ icon: '⏱️', text: `Budget for ~${pendency ? pendency.toFixed(0) : '?'} months of prosecution`, why: `${pendency && pendency > USPTO_AVG_PENDENCY ? `Longer than the ${USPTO_AVG_PENDENCY}mo USPTO average — plan timelines accordingly.` : `On par with the ${USPTO_AVG_PENDENCY}mo USPTO average.`}`, impact: 'low' });
  } else {
    recommendations.push({ icon: '🎯', text: 'Use narrow, highly specific claim language', why: 'Low grant rate examiners reject broad claims at a high rate — specificity is your best defense.', impact: 'high' });
    if (interviewHighlyEffective) {
      recommendations.push({ icon: '🤝', text: 'Use examiner interviews early and often', why: `Interview allowance rate is ${((interviewRate ?? 0) - rate).toFixed(1)}pp above baseline — your most effective lever.`, impact: 'high' });
    } else if (interviewIneffective) {
      recommendations.push({ icon: '⚠️', text: 'Avoid relying on interviews alone', why: 'Interview allowance rate is below 25% — invest in strong written arguments instead.', impact: 'high' });
    }
    recommendations.push({ icon: '🔄', text: 'File a continuation to preserve options', why: 'Low grant rate examiners often force abandonment — a continuation keeps prosecution alive.', impact: 'high' });
    recommendations.push({ icon: '📑', text: 'Build robust technical arguments from specification', why: 'Detailed spec support gives you ammunition to distinguish prior art in written responses.', impact: 'medium' });
    if (pendency && pendency > 35) recommendations.push({ icon: '⏳', text: `File early — expect ~${pendency.toFixed(0)} months to resolution`, why: `Well above the ${USPTO_AVG_PENDENCY}mo USPTO average. Late filing means late protection.`, impact: 'medium' });
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
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🧠</span>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Examiner Profile</h3>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed font-medium">{profile.examinerPersonality}</p>
      </div>

      <div className={`rounded-2xl border-2 p-5 ${profile.primaryActionColor}`}>
        <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Recommended Next Step</p>
        <h3 className="text-base font-extrabold mb-2">{profile.primaryAction}</h3>
        <p className="text-sm leading-relaxed opacity-90">{profile.primaryActionDetail}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-1 items-center text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Allowance</p>
          <span className={`text-sm font-extrabold px-2.5 py-1 rounded-full border mt-1 ${profile.allowanceLikelihoodColor}`}>{profile.allowanceLikelihood}</span>
          <p className="text-xs text-slate-400 mt-1">likelihood</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-1 items-center text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Data</p>
          <span className={`text-sm font-extrabold px-2.5 py-1 rounded-full border mt-1 ${profile.confidence === 'High' ? 'text-green-600 bg-green-50 border-green-200' : profile.confidence === 'Medium' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200'}`}>{profile.confidence}</span>
          <p className="text-xs text-slate-400 mt-1">confidence</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-1 items-center text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Interview Δ</p>
          <span className={`text-sm font-extrabold mt-1 ${profile.interviewImpactColor}`}>
            {profile.interviewImpact ?? 'No data'}
          </span>
          <p className="text-xs text-slate-400 mt-1">vs baseline</p>
        </div>
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1.5 -mt-1">
        <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${profile.confidence === 'High' ? 'bg-green-400' : profile.confidence === 'Medium' ? 'bg-amber-400' : 'bg-red-400'}`} />
        {profile.confidenceNote}
      </p>

      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Action Checklist</h3>
        <div className="space-y-2">
          {profile.recommendations.map((rec, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3.5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-1.5">
                <span className="text-base shrink-0 mt-0.5">{rec.icon}</span>
                <p className="text-sm font-semibold text-slate-800 flex-1 leading-snug">{rec.text}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 self-start ${impactBadge(rec.impact)}`}>{rec.impact}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed ml-8">{rec.why}</p>
            </div>
          ))}
        </div>
      </div>

      {profile.interviewImpact && examiner.interview_allowance_rate != null && Math.abs((examiner.interview_allowance_rate) - (examiner.grant_rate_3yr ?? 0)) >= 3 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">🤝</span>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Interview Impact Analysis</h3>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex flex-col items-center gap-0.5 text-center flex-1 bg-slate-50 rounded-xl p-3">
              <p className="text-2xl font-extrabold text-slate-900">{(examiner.grant_rate_3yr ?? 0).toFixed(1)}%</p>
              <p className="text-xs text-slate-400">Baseline grant rate</p>
              <p className="text-xs text-slate-500 mt-0.5">Without interview</p>
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <span className={`text-xl font-black ${profile.interviewImpactColor}`}>→</span>
              <span className={`text-xs font-bold ${profile.interviewImpactColor}`}>{profile.interviewImpact}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 text-center flex-1 bg-slate-50 rounded-xl p-3">
              <p className="text-2xl font-extrabold text-slate-900">{examiner.interview_allowance_rate.toFixed(1)}%</p>
              <p className="text-xs text-slate-400">Interview allowance</p>
              <p className="text-xs text-slate-500 mt-0.5">Cases with interview</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 text-center">Based on {examiner.interview_count?.toLocaleString() ?? '—'} recorded interviews with this examiner</p>
        </div>
      )}
    </div>
  );
}

// ─── Page components ──────────────────────────────────────────────────────────

function GrantGauge({ rate, totalApps }: { rate: number; totalApps?: number }) {
  const size = 160;
  const sw = 12;
  const r = (size - sw) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, rate));
  const fill = (clamped / 100) * circ;
  const { hex, label } = rateColor(rate);
  const approxGranted = totalApps ? Math.round((rate / 100) * totalApps) : null;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={hex} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`} transform={`rotate(-90 ${cx} ${cx})`} />
        <text x={cx} y={cx - 8} textAnchor="middle" dominantBaseline="middle" fontSize="28" fontWeight="800" fill={hex}>{clamped.toFixed(0)}%</text>
        <text x={cx} y={cx + 14} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#94a3b8">{label}</text>
      </svg>
      <div className="text-center">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Grant Rate (3yr)</p>
        {approxGranted && (
          <p className="text-xs text-slate-400 mt-0.5">~{approxGranted.toLocaleString()} of {totalApps?.toLocaleString()} granted</p>
        )}
      </div>
    </div>
  );
}

function USPTOBar({ rate }: { rate: number }) {
  const AVG = USPTO_AVG_GRANT_RATE;
  const clamped = Math.min(100, Math.max(0, rate));
  const { hex } = rateColor(rate);
  const diff = (rate - AVG).toFixed(1);
  const diffText = rate >= AVG
    ? `${diff}pp above USPTO average — easier than most examiners`
    : `${Math.abs(parseFloat(diff))}pp below USPTO average — stricter than most`;
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-400 font-medium mb-1.5">
        <span>0%</span>
        <span className="font-semibold text-slate-500">vs. USPTO avg ({AVG}%)</span>
        <span>100%</span>
      </div>
      <div className="relative h-2 bg-slate-100 rounded-full">
        <div className="absolute top-0 h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: hex, opacity: 0.85 }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-400 rounded-full z-10" style={{ left: `${AVG}%` }} />
      </div>
      <div className="flex justify-between text-xs mt-1.5">
        <span style={{ color: hex }} className="font-bold">{clamped.toFixed(1)}% this examiner</span>
        <span className="text-slate-400">{AVG}% avg</span>
      </div>
      <p className="text-xs text-slate-400 mt-1.5 italic">{diffText}</p>
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

  const pendencyDiff = examiner.pendency_months != null
    ? (examiner.pendency_months - USPTO_AVG_PENDENCY).toFixed(1)
    : null;
  const pendencyContext = pendencyDiff != null
    ? parseFloat(pendencyDiff) > 3
      ? `${pendencyDiff}mo longer than USPTO avg`
      : parseFloat(pendencyDiff) < -3
      ? `${Math.abs(parseFloat(pendencyDiff))}mo faster than USPTO avg`
      : 'Near USPTO average'
    : null;

  const trendEntries = examiner.grant_rate_by_year
    ? Object.entries(examiner.grant_rate_by_year).map(([y, r]) => ({ y, r: r as number })).sort((a, b) => +a.y - +b.y)
    : [];
  const showTrend = trendEntries.length >= 3;
  let trendLabel = '';
  let trendStyle = '';
  let trendExplainer = '';
  if (showTrend) {
    const fa = (trendEntries[0].r + trendEntries[1].r) / 2;
    const la = (trendEntries[trendEntries.length - 2].r + trendEntries[trendEntries.length - 1].r) / 2;
    const delta = la - fa;
    trendLabel = delta > 2 ? `↑ Trending up +${delta.toFixed(1)}pp` : delta < -2 ? `↓ Trending down ${delta.toFixed(1)}pp` : '→ Relatively stable';
    trendStyle = delta > 2 ? 'text-green-600 bg-green-50 border-green-200' : delta < -2 ? 'text-red-600 bg-red-50 border-red-200' : 'text-slate-500 bg-slate-50 border-slate-200';
    trendExplainer = delta > 2
      ? `This examiner has become more lenient over time — recent applications have a higher chance of allowance than historical averages suggest.`
      : delta < -2
      ? `This examiner has become stricter over time — recent grant rates are lower than their historical average. Plan accordingly.`
      : `Grant rate has been consistent over the analysis period — historical rates are a reliable predictor of future behavior.`;
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

        {/* Hero */}
        <div className="pt-8 pb-10 mb-8 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>{colors.label}</span>
                {examiner.art_unit_number && <span className="text-sm text-slate-400 font-medium">Art Unit {examiner.art_unit_number}</span>}
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">{examiner.name}</h1>
            </div>
            {formattedDate && <p className="text-xs text-slate-400 shrink-0">Data updated {formattedDate}</p>}
          </div>

          <div className="flex flex-col sm:flex-row items-start gap-10">
            {examiner.grant_rate_3yr != null && (
              <div className="shrink-0">
                <GrantGauge rate={examiner.grant_rate_3yr} totalApps={examiner.total_applications ?? undefined} />
              </div>
            )}
            <div className="flex-1 flex flex-col gap-5 pt-2 w-full">
              {examiner.grant_rate_3yr != null && <USPTOBar rate={examiner.grant_rate_3yr} />}
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Applications</p>
                  <p className="text-xl font-extrabold text-slate-900">{examiner.total_applications?.toLocaleString() ?? '—'}</p>
                  <p className="text-xs text-slate-400">total analyzed</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Avg Pendency</p>
                  <p className="text-xl font-extrabold text-slate-900">{examiner.pendency_months != null ? `${examiner.pendency_months.toFixed(1)} mo` : '—'}</p>
                  {pendencyContext && <p className="text-xs text-slate-400">{pendencyContext}</p>}
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Art Unit</p>
                  <p className="text-xl font-extrabold text-slate-900">{examiner.art_unit_number ?? '—'}</p>
                  <p className="text-xs text-slate-400">technology group</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT */}
          <div className="lg:col-span-2 space-y-8">

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
              const finalRatio = codes.total > 0 ? (codes.final / codes.total) * 100 : 0;
              const rejectionContext = finalRatio > 40
                ? 'High final rejection rate — this examiner frequently escalates to finals. Expect a tight prosecution window and prepare strong first responses.'
                : finalRatio > 25
                ? 'Moderate final rejection rate — some applications escalate to finals, but most can be resolved through amendment.'
                : 'Low final rejection rate — most rejections are non-final, giving you more opportunities to amend and respond.';
              return (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rejection Activity</h2>
                    <span className="text-sm font-bold text-slate-900">{codes.total.toLocaleString()} <span className="text-slate-400 font-normal text-xs">total rejections on record</span></span>
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
                      <p className="text-xs text-slate-400 mt-1">Non-final rejections allow you to amend claims and respond without losing the application.</p>
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
                      <p className="text-xs text-slate-400 mt-1">Final rejections limit your response options and often require an RCE or appeal to continue prosecution.</p>
                    </div>
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-600 leading-relaxed italic">{rejectionContext}</p>
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
                    <p className="text-xs text-slate-500 leading-relaxed mt-3 italic">{trendExplainer}</p>
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
              const interviewExplainer = rate2 > 50
                ? 'More than half of interviews with this examiner result in allowance — a strong signal to request one early.'
                : rate2 >= 25
                ? 'Interviews have a moderate success rate here. Worth requesting, but not a guaranteed path to allowance.'
                : 'Interviews rarely lead to allowance with this examiner. Focus resources on written arguments instead.';
              return (
                <div>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Examiner Interviews</h2>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <div className="flex items-center gap-5 mb-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-4xl font-black text-slate-900">{count.toLocaleString()}</span>
                        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Total Interviews</span>
                        <span className="text-xs text-slate-400">on record</span>
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
                    <div className={`rounded-xl border px-3 py-2 text-xs font-semibold mb-2 ${noteStyle}`}>{note}</div>
                    <p className="text-xs text-slate-400 leading-relaxed">{interviewExplainer}</p>
                  </div>
                </div>
              );
            })()}

            {/* Speed to Allowance */}
            {examiner.pendency_months != null && (
              <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Speed to Allowance</h2>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-end gap-2 mb-1">
                    <p className="text-3xl font-black text-slate-900">{examiner.pendency_months.toFixed(1)}</p>
                    <p className="text-sm text-slate-400 mb-1">months avg</p>
                  </div>
                  <div className="relative h-1.5 bg-slate-100 rounded-full mb-2 mt-3">
                    <div className="absolute top-0 h-full rounded-full bg-blue-400" style={{ width: `${Math.min(100, (examiner.pendency_months / 60) * 100)}%` }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-slate-400 rounded-full" style={{ left: `${(USPTO_AVG_PENDENCY / 60) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mb-3">
                    <span>0 mo</span>
                    <span>{USPTO_AVG_PENDENCY}mo avg</span>
                    <span>60 mo</span>
                  </div>
                  {pendencyContext && <p className="text-xs text-slate-500 leading-relaxed italic">{pendencyContext} ({USPTO_AVG_PENDENCY}mo USPTO average)</p>}
                </div>
              </div>
            )}

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
                    : examiner.total_applications && examiner.total_applications > 30
                    ? [{ dot: 'bg-amber-400', text: `Moderate confidence (${examiner.total_applications.toLocaleString()} apps)` }]
                    : [{ dot: 'bg-red-400', text: `Low sample size — use with caution` }]),
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
                    <p className="text-xs text-slate-400 mt-0.5">Technology group identifier</p>
                  </div>
                )}
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-600 bg-blue-100 rounded-full px-2 py-0.5">Pro</span>
                    <p className="text-xs font-semibold text-slate-700">Peer benchmarking</p>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">See how this examiner ranks among peers in Art Unit {examiner.art_unit_number ?? 'their group'} — grant rate percentile, pendency ranking, and more.</p>
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
              <p className="text-sm opacity-85 leading-relaxed mb-3">Get a plain-language strategy brief for {examiner.name} — generated by Claude AI based on their full prosecution history.</p>
              <button className="w-full text-xs font-bold bg-white text-blue-600 hover:bg-blue-50 active:scale-95 transition-all rounded-xl py-2.5">Unlock AI Summary (Pro)</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
