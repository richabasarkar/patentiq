import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import { Examiner, ArtUnitStats, SimilarExaminer } from '@/lib/types';

const USPTO_AVG_PENDENCY = 24.5;
const USPTO_AVG_GRANT_RATE = 67;
const USPTO_AVG_DAYS_TO_FIRST_OA = 365;

function rateColor(rate: number) {
  if (rate >= 70) return { hex: '#16a34a', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', label: 'Favorable' };
  if (rate >= 50) return { hex: '#d97706', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Moderate' };
  return { hex: '#dc2626', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', label: 'Selective' };
}

function PercentileBadge({ pct, label }: { pct?: number; label: string }) {
  if (pct == null) return null;
  const color = pct >= 75 ? 'text-green-700 bg-green-50 border-green-200'
    : pct >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {pct >= 75 ? '↑' : pct >= 50 ? '→' : '↓'} {pct.toFixed(0)}th pct.
    </span>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
      <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
        <span className="text-xs font-black text-white">{number}</span>
      </div>
      <div>
        <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 ${className}`}>
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{children}</p>;
}

// ─── Strategy Engine ──────────────────────────────────────────────────────────
function buildStrategy(examiner: Examiner) {
  const rate = examiner.grant_rate_3yr ?? 0;
  const ir = examiner.interview_allowance_rate ?? null;
  const totalApps = examiner.total_applications ?? 0;

  const confidence: 'High' | 'Medium' | 'Low' = totalApps >= 100 ? 'High' : totalApps >= 30 ? 'Medium' : 'Low';
  const confidenceNote = `${confidence} confidence — ${totalApps.toLocaleString()} applications`;

  let interviewImpact: string | null = null;
  let interviewImpactColor = 'text-slate-500';
  if (ir !== null) {
    const delta = ir - rate;
    if (Math.abs(delta) >= 3) {
      interviewImpact = delta > 0 ? `+${delta.toFixed(1)}pp` : `${delta.toFixed(1)}pp`;
      interviewImpactColor = delta > 0 ? 'text-green-600' : 'text-red-600';
    } else {
      interviewImpact = '~0pp';
    }
  }

  const personality = rate >= 75 ? 'Consistently favorable — receptive to broad, well-supported claims.'
    : rate >= 65 ? 'Generally reasonable — expects solid prior art work and clear claim language.'
    : rate >= 50 ? 'Moderately selective — plan for amendments and at least one rejection round.'
    : rate >= 35 ? 'Strict — requires precise language and strong technical arguments.'
    : 'Very selective — one of the harder USPTO examiners. Requires targeted strategy.';

  const interviewHighlyEffective = ir !== null && ir > rate + 10;
  const interviewIneffective = ir !== null && ir < 25;

  let primaryAction = '', primaryDetail = '', primaryColor = '';
  if (rate >= 70) { primaryAction = 'File with confidence'; primaryDetail = 'Strong grant rate — standard prosecution with broad claims is your best path.'; primaryColor = 'text-green-700 bg-green-50 border-green-300'; }
  else if (rate >= 55 && interviewHighlyEffective) { primaryAction = 'Request examiner interview early'; primaryDetail = `Interviews are highly effective (+${((ir ?? 0) - rate).toFixed(1)}pp). Schedule before or after first OA.`; primaryColor = 'text-blue-700 bg-blue-50 border-blue-300'; }
  else if (rate >= 55) { primaryAction = 'Prepare for amendment rounds'; primaryDetail = 'Anticipate 1-2 OAs. File broad claims with strong dependent fallbacks.'; primaryColor = 'text-amber-700 bg-amber-50 border-amber-300'; }
  else if (interviewHighlyEffective) { primaryAction = 'Request examiner interview immediately'; primaryDetail = `Low grant rate but interviews are highly effective (+${((ir ?? 0) - rate).toFixed(1)}pp). Your highest-leverage tool.`; primaryColor = 'text-blue-700 bg-blue-50 border-blue-300'; }
  else if (interviewIneffective) { primaryAction = 'File narrow — plan for continuation'; primaryDetail = 'Low grant rate and interviews ineffective. File targeted claims, invest in written arguments.'; primaryColor = 'text-red-700 bg-red-50 border-red-300'; }
  else { primaryAction = 'File narrow, targeted claims'; primaryDetail = 'Selective examiner. Use specific claim language and plan for multiple rejection rounds.'; primaryColor = 'text-amber-700 bg-amber-50 border-amber-300'; }

  const recs: { icon: string; text: string; why: string; impact: 'high' | 'medium' | 'low' }[] = [];
  if (examiner.pct_101 != null && examiner.pct_101 >= 30) recs.push({ icon: '⚖️', text: `High §101 rate (${examiner.pct_101.toFixed(0)}%) — prepare eligibility arguments`, why: 'Abstract idea rejections require specific claim amendments or eligibility arguments.', impact: 'high' });
  if (examiner.appeal_overturn_rate != null && examiner.appeal_overturn_rate >= 30) recs.push({ icon: '📋', text: `Appeal viable — ${examiner.appeal_overturn_rate.toFixed(0)}% PTAB overturn rate`, why: 'PTAB frequently overturns this examiner. Keep appeal as a serious option.', impact: 'high' });
  if (rate >= 70) {
    recs.push({ icon: '✅', text: 'Broad independent claims are viable', why: 'Grant rate above 70% — examiner allows high proportion as-filed.', impact: 'high' });
    recs.push({ icon: '🔄', text: 'Consider continuation after allowance', why: 'Favorable examiners make continuation strategies predictable.', impact: 'medium' });
  } else if (rate >= 50) {
    recs.push({ icon: '📝', text: 'File claims with specific, clear limitations', why: 'Moderate examiners respond better to precise language.', impact: 'high' });
    recs.push({ icon: '🛡️', text: 'Draft strong dependent claims as fallbacks', why: 'Narrow backup positions reduce amendment round costs.', impact: 'high' });
    if (interviewHighlyEffective) recs.push({ icon: '🤝', text: 'Schedule interview — significantly improves odds', why: `Interview rate is ${((ir ?? 0) - rate).toFixed(1)}pp above baseline.`, impact: 'high' });
  } else {
    recs.push({ icon: '🎯', text: 'Use narrow, highly specific claim language', why: 'Low grant rate — broad claims rejected at high rates.', impact: 'high' });
    if (interviewHighlyEffective) recs.push({ icon: '🤝', text: 'Use interviews early and often', why: `Interview rate is ${((ir ?? 0) - rate).toFixed(1)}pp above baseline.`, impact: 'high' });
    else if (interviewIneffective) recs.push({ icon: '⚠️', text: 'Avoid relying on interviews', why: 'Interview allowance rate below 25% — invest in written arguments.', impact: 'high' });
    recs.push({ icon: '🔄', text: 'Preserve continuation rights', why: 'Low grant rate examiners often force abandonment.', impact: 'high' });
    if (examiner.abandonment_rate && examiner.abandonment_rate >= 25) recs.push({ icon: '📊', text: `Warn client: ${examiner.abandonment_rate.toFixed(0)}% abandonment rate`, why: 'Set realistic expectations before committing to full prosecution.', impact: 'high' });
  }

  return { personality, primaryAction, primaryDetail, primaryColor, recs, confidence, confidenceNote, interviewImpact, interviewImpactColor };
}

// ─── Grant Gauge ──────────────────────────────────────────────────────────────
function GrantGauge({ rate, totalApps, percentile }: { rate: number; totalApps?: number; percentile?: number }) {
  const size = 148; const sw = 11;
  const r = (size - sw) / 2; const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, rate));
  const { hex, label } = rateColor(rate);
  const fill = (clamped / 100) * circ;
  const approxGranted = totalApps ? Math.round((rate / 100) * totalApps) : null;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={hex} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`} transform={`rotate(-90 ${cx} ${cx})`} />
        <text x={cx} y={cx - 8} textAnchor="middle" dominantBaseline="middle" fontSize="26" fontWeight="800" fill={hex}>{clamped.toFixed(0)}%</text>
        <text x={cx} y={cx + 13} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#94a3b8">{label}</text>
      </svg>
      <div className="text-center">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Grant Rate (3yr)</p>
        {approxGranted && <p className="text-xs text-slate-400 mt-0.5">~{approxGranted.toLocaleString()} of {totalApps?.toLocaleString()} granted</p>}
        {percentile != null && <div className="mt-1.5"><PercentileBadge pct={percentile} label="Grant" /></div>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
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

  const [{ data: artUnitStats }, { data: similarRaw }] = await Promise.all([
    examiner.art_unit_number
      ? supabase.from('art_unit_stats').select('*').eq('art_unit', examiner.art_unit_number).single<ArtUnitStats>()
      : { data: null },
    supabase.rpc('find_similar_examiners', { examiner_id: id, result_limit: 4 }),
  ]);

  const similar: SimilarExaminer[] = similarRaw ?? [];
  const rate = examiner.grant_rate_3yr ?? 0;
  const colors = rateColor(rate);
  const strategy = buildStrategy(examiner);

  const formattedDate = examiner.updated_at
    ? new Date(examiner.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const pendencyDiff = examiner.pendency_months != null ? examiner.pendency_months - USPTO_AVG_PENDENCY : null;
  const pendencyContext = pendencyDiff != null
    ? Math.abs(pendencyDiff) > 3 ? `${pendencyDiff > 0 ? '+' : ''}${pendencyDiff.toFixed(1)}mo vs USPTO avg` : 'Near USPTO avg'
    : null;

  const trendEntries = examiner.grant_rate_by_year
    ? Object.entries(examiner.grant_rate_by_year).map(([y, r]) => ({ y, r: r as number })).sort((a, b) => +a.y - +b.y)
    : [];
  const showTrend = trendEntries.length >= 3;
  let trendLabel = '', trendStyle = '', trendNote = '';
  if (showTrend) {
    const fa = (trendEntries[0].r + trendEntries[1].r) / 2;
    const la = (trendEntries[trendEntries.length - 2].r + trendEntries[trendEntries.length - 1].r) / 2;
    const delta = la - fa;
    trendLabel = delta > 2 ? `↑ +${delta.toFixed(1)}pp trend` : delta < -2 ? `↓ ${delta.toFixed(1)}pp trend` : '→ Stable';
    trendStyle = delta > 2 ? 'text-green-600 bg-green-50 border-green-200' : delta < -2 ? 'text-red-600 bg-red-50 border-red-200' : 'text-slate-500 bg-slate-50 border-slate-200';
    trendNote = delta > 2 ? 'Becoming more lenient — recent applications have better odds than historical rates suggest.'
      : delta < -2 ? 'Becoming stricter — recent grant rates lower than historical average. Plan accordingly.'
      : 'Consistent over time — historical rates are a reliable predictor of future behavior.';
  }

  // Cost estimator
  const avgOAs = examiner.avg_oas_to_allowance ?? (rate >= 70 ? 1.2 : rate >= 50 ? 2.0 : 2.8);
  const rceRate = examiner.rce_rate ?? (rate >= 70 ? 5 : rate >= 50 ? 15 : 30);
  const pendency = examiner.pendency_months ?? USPTO_AVG_PENDENCY;
  const lowCost = Math.round((2000 + avgOAs * 3500 * 0.8 + (rceRate / 100) * 2500 + 1000) / 500) * 500;
  const highCost = Math.round((2000 + avgOAs * 3500 * 1.4 + (rceRate / 100) * 2500 + 1000) / 500) * 500;
  const timelineLow = Math.round(pendency * 0.85);
  const timelineHigh = Math.round(pendency * 1.25);

  const impactBadge = (impact: 'high' | 'medium' | 'low') =>
    impact === 'high' ? 'bg-blue-50 text-blue-600 border border-blue-200'
    : impact === 'medium' ? 'bg-slate-50 text-slate-500 border border-slate-200'
    : 'bg-slate-50 text-slate-400 border border-slate-100';

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/"><Image src="/logo.png" alt="PatentIQ" width={110} height={30} className="object-contain h-7 w-auto" /></Link>
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />Data sourced from USPTO
            </span>
            <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">← Search</Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 pt-20 pb-20">

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-100 -mx-6 px-6 pt-8 pb-8 mb-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-2 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>{colors.label}</span>
                  {examiner.art_unit_number && <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">Art Unit {examiner.art_unit_number}</span>}
                  {artUnitStats && <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{artUnitStats.category}</span>}
                </div>
                <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">{examiner.name}</h1>
              </div>
              {formattedDate && <p className="text-xs text-slate-400 shrink-0">Updated {formattedDate}</p>}
            </div>

            {/* Hero metrics row */}
            <div className="flex flex-col sm:flex-row gap-8 items-start">
              {/* Gauge */}
              {examiner.grant_rate_3yr != null && (
                <div className="shrink-0">
                  <GrantGauge rate={examiner.grant_rate_3yr} totalApps={examiner.total_applications ?? undefined} percentile={examiner.grant_rate_percentile ?? undefined} />
                </div>
              )}

              {/* Metrics */}
              <div className="flex-1 space-y-4 pt-1 w-full">
                {/* USPTO bar */}
                {examiner.grant_rate_3yr != null && (() => {
                  const AVG = USPTO_AVG_GRANT_RATE;
                  const clamped = Math.min(100, Math.max(0, rate));
                  const diff = rate - AVG;
                  return (
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                        <span>0%</span><span className="font-semibold text-slate-500">vs. USPTO avg ({AVG}%)</span><span>100%</span>
                      </div>
                      <div className="relative h-2 bg-slate-100 rounded-full">
                        <div className="absolute top-0 h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: colors.hex, opacity: 0.85 }} />
                        <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-400 rounded-full z-10" style={{ left: `${AVG}%` }} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5 italic">
                        {diff >= 0 ? `${diff.toFixed(1)}pp above USPTO average — easier than most` : `${Math.abs(diff).toFixed(1)}pp below USPTO average — stricter than most`}
                      </p>
                    </div>
                  );
                })()}

                {/* 4 stat pills */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Applications', value: examiner.total_applications?.toLocaleString() ?? '—', sub: 'total analyzed' },
                    { label: 'Avg Pendency', value: examiner.pendency_months != null ? `${examiner.pendency_months.toFixed(1)} mo` : '—', sub: pendencyContext ?? 'months avg' },
                    { label: 'First OA', value: examiner.avg_days_to_first_oa != null ? `${(examiner.avg_days_to_first_oa / 30.4).toFixed(1)} mo` : '—', sub: 'avg wait time' },
                    { label: 'Avg OAs', value: examiner.avg_oas_to_allowance != null ? examiner.avg_oas_to_allowance.toFixed(1) : '—', sub: 'to allowance' },
                  ].map(s => (
                    <div key={s.label} className="flex flex-col gap-0.5">
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{s.label}</p>
                      <p className="text-xl font-extrabold text-slate-900">{s.value}</p>
                      <p className="text-xs text-slate-400">{s.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 1: STRATEGY & INTERVIEWS ─────────────────────────────── */}
        <div className="mb-10">
          <SectionHeader number="1" title="Strategy & Decision Guide" subtitle="AI-powered prosecution recommendations based on this examiner's history" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* LEFT: Strategy */}
            <div className="space-y-4">
              <Card>
                <CardLabel>Examiner Profile</CardLabel>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">🧠 {strategy.personality}</p>
              </Card>

              <div className={`rounded-2xl border-2 p-5 ${strategy.primaryColor}`}>
                <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Recommended Next Step</p>
                <h3 className="text-base font-extrabold mb-1.5">{strategy.primaryAction}</h3>
                <p className="text-sm leading-relaxed opacity-90">{strategy.primaryDetail}</p>
              </div>

              <div className="space-y-2">
                {strategy.recs.map((rec, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3 mb-1">
                      <span className="text-base shrink-0 mt-0.5">{rec.icon}</span>
                      <p className="text-sm font-semibold text-slate-800 flex-1 leading-snug">{rec.text}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${impactBadge(rec.impact)}`}>{rec.impact}</span>
                    </div>
                    <p className="text-xs text-slate-400 ml-8">{rec.why}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-400 flex items-center gap-1.5 px-1">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${strategy.confidence === 'High' ? 'bg-green-400' : strategy.confidence === 'Medium' ? 'bg-amber-400' : 'bg-red-400'}`} />
                {strategy.confidenceNote}
              </p>
            </div>

            {/* RIGHT: Interviews + PTAB */}
            <div className="space-y-4">
              {/* Interviews */}
              {examiner.interview_count != null && examiner.interview_allowance_rate != null && (() => {
                const count = examiner.interview_count!;
                const ir = examiner.interview_allowance_rate!;
                const circ = 2 * Math.PI * 28;
                const fillLen = (Math.min(100, ir) / 100) * circ;
                const color = ir >= 50 ? '#16a34a' : ir >= 25 ? '#d97706' : '#dc2626';
                const noteStyle = ir > 50 ? 'text-green-700 bg-green-50 border-green-200' : ir >= 25 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';
                const noteText = ir > 50 ? 'Highly effective — request one early' : ir >= 25 ? 'Sometimes helps — worth requesting' : 'Rarely effective — focus on written arguments';
                return (
                  <Card>
                    <CardLabel>Examiner Interviews</CardLabel>
                    <div className="flex items-center gap-5 mb-4">
                      <div>
                        <p className="text-4xl font-black text-slate-900">{count.toLocaleString()}</p>
                        <p className="text-xs text-slate-400 mt-0.5">total on record</p>
                        {examiner.interview_rate_percentile != null && <div className="mt-1.5"><PercentileBadge pct={examiner.interview_rate_percentile} label="Interview" /></div>}
                      </div>
                      <div className="w-px self-stretch bg-slate-100" />
                      <div className="flex flex-col items-center gap-1">
                        <svg width="64" height="64" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r="28" fill="none" stroke="#f1f5f9" strokeWidth="7" />
                          <circle cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
                            strokeDasharray={`${fillLen} ${circ}`} transform="rotate(-90 32 32)" />
                          <text x="32" y="29" textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="800" fill={color}>{ir.toFixed(0)}%</text>
                          <text x="32" y="41" textAnchor="middle" dominantBaseline="middle" fontSize="7" fill="#94a3b8">allow</text>
                        </svg>
                        <p className="text-xs text-slate-400 text-center leading-tight">Interview → Allowance</p>
                      </div>
                      {strategy.interviewImpact && (
                        <div className="flex flex-col items-center gap-1 flex-1 text-center">
                          <p className={`text-2xl font-extrabold ${strategy.interviewImpactColor}`}>{strategy.interviewImpact}</p>
                          <p className="text-xs text-slate-400">vs baseline grant rate</p>
                        </div>
                      )}
                    </div>
                    <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${noteStyle}`}>{noteText}</div>
                  </Card>
                );
              })()}

              {/* PTAB */}
              {examiner.appeal_count != null && (() => {
                const overturn = examiner.appeal_overturn_rate ?? 0;
                const affirm = examiner.appeal_affirm_rate ?? 0;
                const appealColor = overturn >= 35 ? '#16a34a' : overturn >= 20 ? '#d97706' : '#dc2626';
                const appealLabel = overturn >= 35 ? 'Appeal-Worthy' : overturn >= 20 ? 'Mixed Results' : 'Avoid Appeal';
                const appealStyle = overturn >= 35 ? 'text-green-700 bg-green-50 border-green-200' : overturn >= 20 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';
                return (
                  <Card>
                    <div className="flex items-center justify-between mb-3">
                      <CardLabel>PTAB Appeal Record</CardLabel>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${appealStyle}`}>{appealLabel}</span>
                    </div>
                    <div className="flex items-center gap-5 mb-4">
                      <div className="flex-1 space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">Affirmed</span><span className="font-bold text-slate-700">{affirm.toFixed(1)}%</span></div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-slate-300" style={{ width: `${affirm}%` }} /></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">Overturned</span><span className="font-bold" style={{ color: appealColor }}>{overturn.toFixed(1)}%</span></div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${overturn}%`, backgroundColor: appealColor }} /></div>
                        </div>
                      </div>
                      <div className="text-center shrink-0">
                        <p className="text-3xl font-black" style={{ color: appealColor }}>{overturn.toFixed(0)}%</p>
                        <p className="text-xs text-slate-400">overturn</p>
                        <p className="text-xs text-slate-400">{examiner.appeal_count} cases</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 italic leading-relaxed">
                      {overturn >= 30 ? `PTAB overturns this examiner ${overturn.toFixed(0)}% of the time — appeal is a strong strategic option after final rejection.`
                        : `PTAB affirms ${affirm.toFixed(0)}% of the time — focus on amendment or RCE over appeal.`}
                    </p>
                  </Card>
                );
              })()}

              {/* AI Summary teaser */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-2 mb-2"><span>✨</span><p className="text-xs font-bold uppercase tracking-widest opacity-75">AI Strategy Summary</p></div>
                <p className="text-sm opacity-85 leading-relaxed mb-3">Get a plain-language strategy brief for {examiner.name} generated by Claude AI from their full prosecution history.</p>
                <button className="w-full text-xs font-bold bg-white text-blue-600 hover:bg-blue-50 transition-all rounded-xl py-2.5">Unlock AI Summary (Pro)</button>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: PROSECUTION OUTCOMES ──────────────────────────────── */}
        {(examiner.allowance_after_1_oa != null || examiner.abandonment_rate != null || examiner.pct_101 != null) && (
          <div className="mb-10">
            <SectionHeader number="2" title="Prosecution Outcomes & Rejection Patterns" subtitle="What happens to applications with this examiner, and what types of rejections to expect" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* LEFT: Funnel + metrics */}
              <div className="space-y-4">
                {(examiner.allowance_after_1_oa != null || examiner.abandonment_rate != null) && (
                  <Card>
                    <CardLabel>Prosecution Funnel</CardLabel>
                    <div className="space-y-2.5 mb-5">
                      {[
                        { label: 'Application Filed', pct: 100, color: '#3b82f6', show: true },
                        { label: `After 1st OA (${(examiner.allowance_after_1_oa ?? 0).toFixed(0)}% allowed)`, pct: examiner.allowance_after_1_oa, color: '#16a34a', show: examiner.allowance_after_1_oa != null },
                        { label: `After 2nd OA (${(examiner.allowance_after_2_oa ?? 0).toFixed(0)}% cumulative)`, pct: examiner.allowance_after_2_oa, color: '#16a34a', show: examiner.allowance_after_2_oa != null },
                        { label: `Granted (${(100 - (examiner.abandonment_rate ?? 0)).toFixed(0)}%)`, pct: 100 - (examiner.abandonment_rate ?? 0), color: rateColor(rate).hex, show: examiner.abandonment_rate != null },
                      ].filter(s => s.show).map((stage, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-600 font-medium">{stage.label}</span>
                            <span className="font-bold text-slate-900">{(stage.pct ?? 0).toFixed(0)}%</span>
                          </div>
                          <div className="h-5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full flex items-center pl-2" style={{ width: `${stage.pct ?? 0}%`, backgroundColor: stage.color, minWidth: '8px' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Allow after 1 OA', value: examiner.allowance_after_1_oa, good: 50, ok: 25, suffix: '%' },
                        { label: 'Allow after 2 OAs', value: examiner.allowance_after_2_oa, good: 60, ok: 35, suffix: '%' },
                        { label: 'Abandonment rate', value: examiner.abandonment_rate, good: -15, ok: -30, suffix: '%', invert: true },
                        { label: 'RCE rate', value: examiner.rce_rate, good: -10, ok: -25, suffix: '%', invert: true },
                      ].filter(m => m.value != null).map(m => {
                        const v = m.value!;
                        const color = m.invert
                          ? v <= Math.abs(m.good) ? '#16a34a' : v <= Math.abs(m.ok) ? '#d97706' : '#dc2626'
                          : v >= m.good ? '#16a34a' : v >= m.ok ? '#d97706' : '#dc2626';
                        return (
                          <div key={m.label} className="bg-slate-50 rounded-xl p-3">
                            <p className="text-xs text-slate-400 mb-1">{m.label}</p>
                            <p className="text-xl font-extrabold" style={{ color }}>{v.toFixed(1)}{m.suffix}</p>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {examiner.avg_oas_to_allowance != null && (
                  <Card>
                    <CardLabel>Avg Office Actions to Allowance</CardLabel>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-4xl font-extrabold" style={{ color: examiner.avg_oas_to_allowance <= 1.5 ? '#16a34a' : examiner.avg_oas_to_allowance <= 2.5 ? '#d97706' : '#dc2626' }}>
                          {examiner.avg_oas_to_allowance.toFixed(1)}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">office actions before grant</p>
                      </div>
                      <div className="flex-1">
                        <div className="relative h-2 bg-slate-100 rounded-full mb-1.5">
                          <div className="absolute top-0 h-full rounded-full bg-gradient-to-r from-green-400 via-amber-400 to-red-400 w-full opacity-30" />
                          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                            style={{ left: `${Math.min(95, (examiner.avg_oas_to_allowance / 5) * 100)}%`, backgroundColor: examiner.avg_oas_to_allowance <= 1.5 ? '#16a34a' : examiner.avg_oas_to_allowance <= 2.5 ? '#d97706' : '#dc2626' }} />
                        </div>
                        <div className="flex justify-between text-xs text-slate-400"><span>1 (easy)</span><span>2-3 (avg)</span><span>4+ (hard)</span></div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              {/* RIGHT: Rejection types */}
              <div className="space-y-4">
                {(examiner.pct_101 != null || examiner.pct_103 != null) && (
                  <Card>
                    <div className="flex items-center justify-between mb-1">
                      <CardLabel>Rejection Type Breakdown</CardLabel>
                      {examiner.total_oas_analyzed && <span className="text-xs text-slate-400 -mt-3">{examiner.total_oas_analyzed.toLocaleString()} OAs</span>}
                    </div>
                    <p className="text-xs text-slate-400 mb-4 leading-relaxed">% of office actions containing each rejection type. Shapes your claim drafting strategy.</p>
                    <div className="space-y-4">
                      {[
                        { code: '§101', label: 'Subject Matter Eligibility', pct: examiner.pct_101, color: '#7c3aed', tip: 'Abstract idea rejections. Hard to overcome — requires eligibility arguments or claim restructuring.' },
                        { code: '§102', label: 'Anticipation', pct: examiner.pct_102, color: '#dc2626', tip: 'Single prior art reference anticipates claims. Distinguish by adding specific limitations.' },
                        { code: '§103', label: 'Obviousness', pct: examiner.pct_103, color: '#d97706', tip: 'Combination of references. Argue unexpected results, teaching away, or secondary considerations.' },
                        { code: '§112', label: 'Written Description', pct: examiner.pct_112, color: '#0891b2', tip: 'Spec doesn\'t support the claims. Tighten claim language or add specification support before filing.' },
                      ].filter(t => t.pct != null).map(t => {
                        const pct = t.pct!;
                        const maxPct = Math.max(examiner.pct_101 ?? 0, examiner.pct_102 ?? 0, examiner.pct_103 ?? 0, examiner.pct_112 ?? 0, 1);
                        return (
                          <div key={t.code}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black" style={{ color: t.color }}>{t.code}</span>
                                <span className="text-xs font-semibold text-slate-700">{t.label}</span>
                              </div>
                              <span className="text-sm font-extrabold text-slate-900">{pct.toFixed(1)}%</span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-1">
                              <div className="h-full rounded-full" style={{ width: `${(pct / maxPct) * 100}%`, backgroundColor: t.color }} />
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">{t.tip}</p>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {examiner.rejection_codes && (() => {
                  const codes = examiner.rejection_codes!;
                  const max = Math.max(codes.non_final, codes.final, 1);
                  const nfPct = codes.total > 0 ? ((codes.non_final / codes.total) * 100).toFixed(0) : '0';
                  const fPct = codes.total > 0 ? ((codes.final / codes.total) * 100).toFixed(0) : '0';
                  const finalRatio = codes.total > 0 ? (codes.final / codes.total) * 100 : 0;
                  return (
                    <Card>
                      <div className="flex items-center justify-between mb-4">
                        <CardLabel>Rejection Volume</CardLabel>
                        <span className="text-sm font-bold text-slate-700 -mt-3">{codes.total.toLocaleString()} total</span>
                      </div>
                      <div className="space-y-4">
                        {[
                          { label: 'Non-Final', count: codes.non_final, pct: nfPct, color: '#f59e0b', note: 'Allow amendment without losing the application.' },
                          { label: 'Final', count: codes.final, pct: fPct, color: '#ef4444', note: 'Limit response options — often require RCE or appeal.' },
                        ].map(bar => (
                          <div key={bar.label}>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="font-semibold text-slate-700">{bar.label} Rejections</span>
                              <span className="font-bold text-slate-900">{bar.count.toLocaleString()} ({bar.pct}%)</span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-1">
                              <div className="h-full rounded-full" style={{ width: `${(bar.count / max) * 100}%`, backgroundColor: bar.color }} />
                            </div>
                            <p className="text-xs text-slate-400">{bar.note}</p>
                          </div>
                        ))}
                        <p className="text-xs text-slate-500 italic pt-1 border-t border-slate-100">
                          {finalRatio > 40 ? 'High final rejection rate — prepare strong first responses.'
                            : finalRatio > 25 ? 'Moderate final rejection rate — some cases escalate.'
                            : 'Low final rejection rate — mostly non-final, giving more amendment opportunities.'}
                        </p>
                      </div>
                    </Card>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 3: COST & TIMING ──────────────────────────────────────── */}
        <div className="mb-10">
          <SectionHeader number="3" title="Cost & Timeline Estimate" subtitle="Estimated prosecution costs and timelines based on this examiner's patterns" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* LEFT: Cost estimator */}
            <Card>
              <CardLabel>Client Cost Estimate 💰</CardLabel>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">Based on this examiner's historical patterns. Use as a starting point for client conversations.</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Expected OA Responses', value: avgOAs.toFixed(1), sub: 'rounds of prosecution', color: rate >= 70 ? '#16a34a' : rate >= 50 ? '#d97706' : '#dc2626' },
                  { label: 'RCE Probability', value: `${rceRate.toFixed(0)}%`, sub: 'chance of needing RCE', color: rceRate >= 25 ? '#dc2626' : rceRate >= 10 ? '#d97706' : '#16a34a' },
                  { label: 'Estimated Cost', value: `$${(lowCost / 1000).toFixed(0)}k–$${(highCost / 1000).toFixed(0)}k`, sub: 'attorney fees excl. USPTO', color: '#1e293b' },
                  { label: 'Time to Patent', value: `${timelineLow}–${timelineHigh} mo`, sub: 'filing to grant estimate', color: '#1e293b' },
                ].map(m => (
                  <div key={m.label} className="bg-slate-50 rounded-xl p-3.5">
                    <p className="text-xs text-slate-400 mb-1">{m.label}</p>
                    <p className="text-xl font-extrabold" style={{ color: m.color }}>{m.value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{m.sub}</p>
                  </div>
                ))}
              </div>
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-slate-600">Probability of obtaining patent</p>
                  <p className="text-base font-extrabold" style={{ color: colors.hex }}>{Math.round(rate)}%</p>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${rate}%`, backgroundColor: colors.hex }} />
                </div>
              </div>
              {(examiner.abandonment_rate ?? 0) >= 20 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs text-amber-700 leading-relaxed">⚠️ {(examiner.abandonment_rate ?? 0).toFixed(0)}% abandonment rate — discuss realistic patent probability with your client before proceeding.</p>
                </div>
              )}
              <p className="text-xs text-slate-400 mt-3 italic">Estimates assume $2,000–$5,000 per OA response. Actual costs vary by firm and complexity.</p>
            </Card>

            {/* RIGHT: Timing breakdown */}
            <div className="space-y-4">
              <Card>
                <CardLabel>Speed to Allowance</CardLabel>
                <div className="flex items-end gap-2 mb-3">
                  <p className="text-4xl font-black text-slate-900">{examiner.pendency_months?.toFixed(1) ?? '—'}</p>
                  <p className="text-sm text-slate-400 mb-1">months avg</p>
                </div>
                <div className="relative h-1.5 bg-slate-100 rounded-full mb-2">
                  <div className="absolute top-0 h-full rounded-full bg-blue-400" style={{ width: `${Math.min(100, ((examiner.pendency_months ?? 0) / 60) * 100)}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-slate-400 rounded-full" style={{ left: `${(USPTO_AVG_PENDENCY / 60) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mb-2"><span>0 mo</span><span>{USPTO_AVG_PENDENCY}mo avg</span><span>60 mo</span></div>
                {pendencyContext && <p className="text-xs text-slate-500 italic">{pendencyContext} ({USPTO_AVG_PENDENCY}mo USPTO avg)</p>}
                {examiner.pendency_percentile != null && <div className="mt-2"><PercentileBadge pct={100 - examiner.pendency_percentile} label="Speed" /></div>}
              </Card>

              {examiner.avg_days_to_first_oa != null && (
                <Card>
                  <CardLabel>Time to First Office Action</CardLabel>
                  <div className="flex items-end gap-2 mb-3">
                    <p className="text-4xl font-black text-slate-900">{(examiner.avg_days_to_first_oa / 30.4).toFixed(1)}</p>
                    <p className="text-sm text-slate-400 mb-1">months avg</p>
                  </div>
                  {(() => {
                    const diff = examiner.avg_days_to_first_oa! - USPTO_AVG_DAYS_TO_FIRST_OA;
                    const isFaster = diff < -30; const isSlower = diff > 30;
                    const color = isFaster ? '#16a34a' : isSlower ? '#dc2626' : '#d97706';
                    const label = isFaster ? `${(Math.abs(diff) / 30.4).toFixed(1)}mo faster than average`
                      : isSlower ? `${(Math.abs(diff) / 30.4).toFixed(1)}mo slower than average`
                      : 'Near USPTO average';
                    return (
                      <>
                        <div className="relative h-1.5 bg-slate-100 rounded-full mb-2">
                          <div className="absolute top-0 h-full rounded-full" style={{ width: `${Math.min(100, (examiner.avg_days_to_first_oa! / 730) * 100)}%`, backgroundColor: color }} />
                          <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-slate-400 rounded-full" style={{ left: `${(USPTO_AVG_DAYS_TO_FIRST_OA / 730) * 100}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 mb-2"><span>0 mo</span><span>12mo avg</span><span>24 mo</span></div>
                        <p className="text-xs font-semibold" style={{ color }}>{label}</p>
                      </>
                    );
                  })()}
                </Card>
              )}

              <Card>
                <CardLabel>Data Quality</CardLabel>
                <div className="space-y-2">
                  {[
                    { dot: 'bg-green-400', text: 'USPTO PatEx dataset — 14M+ applications' },
                    { dot: 'bg-blue-400', text: '3-year rolling grant rate' },
                    ...(examiner.total_oas_analyzed ? [{ dot: 'bg-green-400', text: `${examiner.total_oas_analyzed.toLocaleString()} office actions analyzed` }] : []),
                    ...(examiner.appeal_count ? [{ dot: 'bg-green-400', text: `${examiner.appeal_count} PTAB appeal decisions` }] : []),
                    { dot: examiner.total_applications && examiner.total_applications > 100 ? 'bg-green-400' : examiner.total_applications && examiner.total_applications > 30 ? 'bg-amber-400' : 'bg-red-400', text: examiner.total_applications && examiner.total_applications > 100 ? `High confidence (${examiner.total_applications.toLocaleString()} apps)` : examiner.total_applications && examiner.total_applications > 30 ? `Moderate confidence (${examiner.total_applications?.toLocaleString()} apps)` : 'Low sample — interpret with caution' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-xs text-slate-600">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dot}`} />
                      {item.text}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* ── SECTION 4: BENCHMARKS ─────────────────────────────────────────── */}
        <div className="mb-10">
          <SectionHeader number="4" title="Benchmarks & Peer Comparison" subtitle="How this examiner compares to their art unit and similar examiners" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* LEFT: Art unit comparison */}
            {artUnitStats && (
              <Card>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <CardLabel>Art Unit {artUnitStats.art_unit}</CardLabel>
                    <p className="text-base font-bold text-slate-900 -mt-2">{artUnitStats.category}</p>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 shrink-0">{artUnitStats.examiner_count} examiners</span>
                </div>
                {(() => {
                  const diff = rate - artUnitStats.avg_grant_rate;
                  const diffColor = diff >= 3 ? 'text-green-600' : diff <= -3 ? 'text-red-600' : 'text-slate-500';
                  const bars = [
                    { label: 'This Examiner', value: rate, color: colors.hex, bold: true },
                    { label: `AU ${artUnitStats.art_unit} Avg`, value: artUnitStats.avg_grant_rate, color: '#94a3b8', bold: false },
                    { label: 'USPTO Avg', value: USPTO_AVG_GRANT_RATE, color: '#cbd5e1', bold: false },
                  ];
                  const maxVal = Math.max(...bars.map(b => b.value), 1);
                  return (
                    <>
                      <p className={`text-sm font-semibold mb-4 ${diffColor}`}>
                        {diff >= 0 ? `+${diff.toFixed(1)}pp above` : `${diff.toFixed(1)}pp below`} art unit average · AU avg: {artUnitStats.avg_grant_rate.toFixed(1)}%
                      </p>
                      <div className="space-y-3 mb-5">
                        {bars.map(bar => (
                          <div key={bar.label}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className={`font-semibold ${bar.bold ? 'text-slate-800' : 'text-slate-400'}`}>{bar.label}</span>
                              <span className={`font-bold ${bar.bold ? 'text-slate-900' : 'text-slate-400'}`}>{bar.value.toFixed(1)}%</span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${(bar.value / maxVal) * 100}%`, backgroundColor: bar.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {examiner.pendency_months != null && (
                        <div className="pt-4 border-t border-slate-100">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Pendency vs Art Unit</p>
                          <div className="flex items-center gap-4">
                            <div className="text-center flex-1"><p className="text-xl font-extrabold text-slate-900">{examiner.pendency_months.toFixed(1)} mo</p><p className="text-xs text-slate-400">This examiner</p></div>
                            <div className="text-center">{(() => { const d = examiner.pendency_months! - artUnitStats.avg_pendency_months; return <p className={`text-sm font-bold ${d > 2 ? 'text-red-500' : d < -2 ? 'text-green-500' : 'text-slate-400'}`}>{d > 0 ? `+${d.toFixed(1)}mo` : `${d.toFixed(1)}mo`}</p>; })()}<p className="text-xs text-slate-400">vs AU avg</p></div>
                            <div className="text-center flex-1"><p className="text-xl font-extrabold text-slate-400">{artUnitStats.avg_pendency_months.toFixed(1)} mo</p><p className="text-xs text-slate-400">AU average</p></div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </Card>
            )}

            {/* RIGHT: Similar examiners */}
            <div className="space-y-4">
              {similar.length > 0 && (
                <Card>
                  <CardLabel>Similar Examiners — Better Grant Rates</CardLabel>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">Examiners in the same art unit with higher grant rates. Useful if you have flexibility in continuation routing or filing strategy.</p>
                  <div className="space-y-2.5">
                    {similar.map((ex) => {
                      const ec = rateColor(ex.grant_rate_3yr);
                      return (
                        <Link key={ex.id} href={`/examiner/${ex.id}`}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{ex.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">AU {ex.art_unit_number} · {ex.pendency_months?.toFixed(1) ?? '—'} mo avg</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-extrabold" style={{ color: ec.hex }}>{ex.grant_rate_3yr.toFixed(1)}%</p>
                              <p className="text-xs text-green-600 font-semibold">+{(ex.grant_rate_3yr - rate).toFixed(1)}pp</p>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ec.bg} ${ec.text} ${ec.border}`}>{ec.label}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Examiner assignment depends on filing details — consult filing strategy before targeting specific examiners.</p>
                </Card>
              )}

              {/* Art unit Pro upsell */}
              <div className="rounded-2xl bg-slate-900 p-5 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full">Pro</span>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-75">Full Peer Benchmarking</p>
                </div>
                <p className="text-sm opacity-75 leading-relaxed mb-3">
                  Rank this examiner among all {artUnitStats?.examiner_count ?? ''} examiners in Art Unit {examiner.art_unit_number} across grant rate, pendency, interview success, and rejection patterns.
                </p>
                <button className="w-full text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition-all rounded-xl py-2.5">Upgrade to Pro</button>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 5: HISTORY & TRENDS ───────────────────────────────────── */}
        {showTrend && (
          <div className="mb-10">
            <SectionHeader number="5" title="Grant Rate History" subtitle="How this examiner's grant rate has changed over time" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card className="lg:col-span-2">
                <div className="flex items-center justify-between mb-5">
                  <CardLabel>Grant Rate Trend</CardLabel>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${trendStyle}`}>{trendLabel}</span>
                </div>
                {(() => {
                  const W = 700; const H = 160; const px = 40; const py = 16;
                  const cw = W - px * 2; const ch = H - py * 2;
                  const rates = trendEntries.map(e => e.r);
                  const min = Math.max(0, Math.min(...rates) - 8);
                  const max = Math.min(100, Math.max(...rates) + 8);
                  const xp = (i: number) => px + (i / (trendEntries.length - 1)) * cw;
                  const yp = (r: number) => py + ch - ((r - min) / (max - min)) * ch;
                  const pts = trendEntries.map((e, i) => `${xp(i)},${yp(e.r)}`).join(' ');
                  const area = `${xp(0)},${py + ch} ${pts} ${xp(trendEntries.length - 1)},${py + ch}`;
                  return (
                    <>
                      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
                        {[min, (min + max) / 2, max].map(tick => (
                          <g key={tick}>
                            <line x1={px} y1={yp(Math.round(tick))} x2={W - px} y2={yp(Math.round(tick))} stroke="#f1f5f9" strokeWidth="1" />
                            <text x={px - 8} y={yp(Math.round(tick))} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="#94a3b8">{Math.round(tick)}%</text>
                          </g>
                        ))}
                        <polygon points={area} fill={colors.hex} opacity="0.07" />
                        <polyline points={pts} fill="none" stroke={colors.hex} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                        {trendEntries.map((e, i) => (
                          <g key={e.y}>
                            <circle cx={xp(i)} cy={yp(e.r)} r="4" fill={colors.hex} />
                            <text x={xp(i)} y={H - 2} textAnchor="middle" fontSize="9" fill="#94a3b8">{e.y}</text>
                          </g>
                        ))}
                      </svg>
                      <p className="text-xs text-slate-500 leading-relaxed mt-3 italic">{trendNote}</p>
                    </>
                  );
                })()}
              </Card>
            </div>
          </div>
        )}

        {/* ── SECTION 6: AI CHAT (placeholder) ─────────────────────────────── */}
        <div className="mb-4">
          <SectionHeader number={showTrend ? '6' : '5'} title="Ask AI About This Examiner" subtitle="Chat with Claude AI about prosecution strategy, appeal options, and more" />
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Chat messages area */}
            <div className="h-64 flex flex-col items-center justify-center gap-3 bg-slate-50 border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white text-base">✨</span>
              </div>
              <div className="text-center px-8">
                <p className="text-sm font-semibold text-slate-700 mb-1">AI Examiner Assistant</p>
                <p className="text-xs text-slate-400 leading-relaxed">Ask me anything about {examiner.name}. I can help with prosecution strategy, appeal decisions, claim drafting tips, and cost planning.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                {[
                  'Should I appeal this examiner?',
                  'What claim language works best?',
                  'How do I respond to a §103 rejection?',
                  'What\'s the fastest path to allowance?',
                ].map(q => (
                  <button key={q} className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all">{q}</button>
                ))}
              </div>
            </div>
            {/* Input area */}
            <div className="p-4 flex gap-3 items-center">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-400">
                Ask anything about {examiner.name}...
              </div>
              <button className="bg-blue-600 text-white text-sm font-bold px-5 py-3 rounded-xl hover:bg-blue-700 transition-all shrink-0">
                Send
              </button>
            </div>
            <div className="px-4 pb-3">
              <p className="text-xs text-slate-400 text-center">AI chat coming soon — unlock with Pro access</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
