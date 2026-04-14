import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import { Examiner } from '@/lib/types';

function rateColor(rate: number) {
  if (rate >= 70) return { hex: '#16a34a', light: '#dcfce7', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', banner: 'bg-green-500', label: 'Favorable' };
  if (rate >= 50) return { hex: '#d97706', light: '#fef3c7', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', banner: 'bg-amber-500', label: 'Moderate' };
  return { hex: '#dc2626', light: '#fee2e2', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', banner: 'bg-red-500', label: 'Selective' };
}

function GrantGauge({ rate }: { rate: number }) {
  const size = 180;
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
        <text x={cx} y={cx - 8} textAnchor="middle" dominantBaseline="middle" fontSize="32" fontWeight="800" fill={hex}>{clamped.toFixed(0)}%</text>
        <text x={cx} y={cx + 16} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#94a3b8">{label}</text>
      </svg>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Grant Rate (3yr)</p>
    </div>
  );
}

function USPTOBar({ rate }: { rate: number }) {
  const AVG = 67;
  const clamped = Math.min(100, Math.max(0, rate));
  const { hex } = rateColor(rate);
  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="flex justify-between text-xs text-slate-400 font-medium mb-1.5">
        <span>0%</span><span className="font-semibold text-slate-500">vs. USPTO avg</span><span>100%</span>
      </div>
      <div className="relative h-2 bg-slate-100 rounded-full overflow-visible">
        <div className="absolute top-0 h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: hex, opacity: 0.85 }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-400 rounded-full z-10" style={{ left: `${AVG}%` }} />
      </div>
      <div className="flex justify-between text-xs mt-1.5">
        <span style={{ color: hex }} className="font-bold">{clamped.toFixed(1)}%</span>
        <span className="text-slate-400">{AVG}% avg</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon, sub }: { label: string; value: string | undefined; icon: string; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-2xl p-5 flex flex-col gap-2 hover:bg-slate-100 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-2xl font-extrabold text-slate-900">{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function strategyPoints(rate: number) {
  if (rate >= 70) return [
    'Standard prosecution strategies are effective — this examiner has a favorable grant rate.',
    'Broad independent claims are viable; the examiner is receptive to well-supported applications.',
    'Focus on thorough prior art searches and clear specification support.',
    'Continuations and claim broadening after allowance are worth considering.',
  ];
  if (rate >= 50) return [
    'This examiner is moderately selective — anticipate at least one round of office actions.',
    'Schedule an examiner interview early in prosecution to align on claim scope.',
    'Be prepared to file amendments; dependent claims provide strong fallback positions.',
    'Thorough responses with robust technical arguments tend to perform well.',
  ];
  return [
    'This examiner has a low grant rate — targeted, specific claim language is essential.',
    'File narrow independent claims with well-defined limitations to reduce rejection risk.',
    'Examiner interviews are highly recommended — direct dialogue is the most effective tool.',
    'Consider continuation strategies to keep prosecution options open across applications.',
  ];
}

function RejectionCard({ codes, hex }: { codes: { non_final: number; final: number; total: number }; hex: string }) {
  const max = Math.max(codes.non_final, codes.final, 1);
  const nfPct = codes.total > 0 ? ((codes.non_final / codes.total) * 100).toFixed(0) : '0';
  const fPct = codes.total > 0 ? ((codes.final / codes.total) * 100).toFixed(0) : '0';
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rejection Activity</h3>
        <div className="text-right">
          <span className="text-2xl font-extrabold text-slate-900">{codes.total.toLocaleString()}</span>
          <span className="text-xs text-slate-400 ml-1">total</span>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-semibold text-amber-600">Non-Final</span>
            <span className="text-slate-500 font-medium">{codes.non_final.toLocaleString()} <span className="text-amber-500 text-xs">({nfPct}%)</span></span>
          </div>
          <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-amber-400 flex items-center justify-end pr-2" style={{ width: `${(codes.non_final / max) * 100}%` }}>
              {(codes.non_final / max) > 0.2 && <span className="text-xs font-bold text-white">{nfPct}%</span>}
            </div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-semibold text-red-600">Final</span>
            <span className="text-slate-500 font-medium">{codes.final.toLocaleString()} <span className="text-red-500 text-xs">({fPct}%)</span></span>
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
}

function InterviewCard({ count, rate, hex }: { count: number; rate: number; hex: string }) {
  const circ = 2 * Math.PI * 28;
  const fill = (Math.min(100, Math.max(0, rate)) / 100) * circ;
  const color = rate >= 50 ? '#16a34a' : rate >= 25 ? '#d97706' : '#dc2626';
  const note = rate > 50 ? 'Interviews highly effective' : rate >= 25 ? 'Interviews sometimes help' : 'Interviews rarely lead to allowance';
  const noteStyle = rate > 50 ? 'text-green-700 bg-green-50 border-green-200' : rate >= 25 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Examiner Interviews</h3>
      <div className="flex items-center gap-6 mb-5">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-5xl font-black text-slate-900">{count.toLocaleString()}</span>
          <span className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Total</span>
        </div>
        <div className="w-px self-stretch bg-slate-100" />
        <div className="flex flex-col items-center gap-2">
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="28" fill="none" stroke="#f1f5f9" strokeWidth="8" />
            <circle cx="36" cy="36" r="28" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${fill} ${circ}`} transform="rotate(-90 36 36)" />
            <text x="36" y="33" textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="800" fill={color}>{rate.toFixed(1)}%</text>
            <text x="36" y="46" textAnchor="middle" dominantBaseline="middle" fontSize="7" fill="#94a3b8">allowance</text>
          </svg>
          <p className="text-xs text-slate-400 text-center font-medium">Interview → Allow</p>
        </div>
      </div>
      <div className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${noteStyle}`}>{note}</div>
    </div>
  );
}

function TrendCard({ data, hex }: { data: Record<string, number>; hex: string }) {
  const entries = Object.entries(data).map(([y, r]) => ({ y, r })).sort((a, b) => +a.y - +b.y);
  if (entries.length < 3) return null;
  const W = 400; const H = 140; const px = 32; const py = 16;
  const cw = W - px * 2; const ch = H - py * 2;
  const rates = entries.map(e => e.r);
  const min = Math.max(0, Math.min(...rates) - 8);
  const max = Math.min(100, Math.max(...rates) + 8);
  const xp = (i: number) => px + (i / (entries.length - 1)) * cw;
  const yp = (r: number) => py + ch - ((r - min) / (max - min)) * ch;
  const pts = entries.map((e, i) => `${xp(i)},${yp(e.r)}`).join(' ');
  const area = `${xp(0)},${py + ch} ${pts} ${xp(entries.length - 1)},${py + ch}`;
  const fa = (entries[0].r + entries[1].r) / 2;
  const la = (entries[entries.length - 2].r + entries[entries.length - 1].r) / 2;
  const delta = la - fa;
  const trend = delta > 2 ? `↑ +${delta.toFixed(1)}pp` : delta < -2 ? `↓ ${delta.toFixed(1)}pp` : '→ Stable';
  const trendStyle = delta > 2 ? 'text-green-600 bg-green-50 border-green-200' : delta < -2 ? 'text-red-600 bg-red-50 border-red-200' : 'text-slate-500 bg-slate-50 border-slate-200';
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Grant Rate Trend</h3>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${trendStyle}`}>{trend}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
        <polygon points={area} fill={hex} opacity="0.07" />
        <polyline points={pts} fill="none" stroke={hex} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {entries.map((e, i) => (
          <g key={e.y}>
            <circle cx={xp(i)} cy={yp(e.r)} r="3.5" fill={hex} />
            <text x={xp(i)} y={H - 2} textAnchor="middle" fontSize="9" fill="#94a3b8">{e.y}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function ProCard({ artUnit }: { artUnit?: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Art Unit Context</h3>
        <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5">Pro</span>
      </div>
      {artUnit && (
        <div className="mb-4">
          <p className="text-xs text-slate-400 font-medium mb-0.5">Art Unit</p>
          <p className="text-3xl font-black text-slate-900">{artUnit}</p>
        </div>
      )}
      <div className="rounded-xl bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-100 p-5 flex flex-col items-center text-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">Art unit benchmarking</p>
          <p className="text-xs text-slate-500 mt-0.5">Compare this examiner to peers in AU {artUnit ?? 'their group'}. Upgrade to Pro.</p>
        </div>
        <button className="w-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all rounded-xl py-2.5 shadow-sm">
          Upgrade to Pro
        </button>
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
          <Link href="/" className="inline-block bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all shadow-sm">← Back to search</Link>
        </div>
      </main>
    );
  }

  const rate = examiner.grant_rate_3yr ?? 0;
  const colors = rateColor(rate);
  const formattedDate = examiner.updated_at
    ? new Date(examiner.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Top nav */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="PatentIQ" width={120} height={34} className="object-contain" />
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Data sourced from USPTO
            </span>
            <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
              ← Search
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 pt-24 pb-16">

        {/* Hero panel */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-6">
          <div className={`h-1.5 w-full ${colors.banner}`} />
          <div className="p-8 sm:p-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900" style={{ fontFamily: 'DM Sans, Inter, sans-serif' }}>
                    {examiner.name}
                  </h1>
                  <span className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                    {colors.label}
                  </span>
                </div>
                {examiner.art_unit_number && (
                  <p className="text-slate-400 text-base font-medium">Art Unit {examiner.art_unit_number}</p>
                )}
              </div>
              {formattedDate && (
                <div className="text-xs text-slate-400 sm:text-right">
                  <p className="font-semibold text-slate-500">Last updated</p>
                  <p>{formattedDate}</p>
                </div>
              )}
            </div>

            {/* Key metrics row */}
            <div className="flex flex-col sm:flex-row items-center gap-8 sm:gap-12">
              {examiner.grant_rate_3yr != null && (
                <div className="shrink-0">
                  <GrantGauge rate={examiner.grant_rate_3yr} />
                </div>
              )}
              <div className="flex-1 w-full flex flex-col gap-6">
                {examiner.grant_rate_3yr != null && <USPTOBar rate={examiner.grant_rate_3yr} />}
                <div className="grid grid-cols-3 gap-3 w-full">
                  <MiniStat label="Applications" value={examiner.total_applications?.toLocaleString()} icon="📄" />
                  <MiniStat label="Avg Pendency" value={examiner.pendency_months != null ? `${examiner.pendency_months.toFixed(1)}mo` : undefined} icon="⏱️" />
                  <MiniStat label="Art Unit" value={examiner.art_unit_number} icon="🏛️" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: Strategy + Rejections (2 cols wide) */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Strategy notes */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Prosecution Strategy Notes</h3>
              <ul className="space-y-3">
                {strategyPoints(rate).map((point, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-600 leading-relaxed">
                    <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.hex }} />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Rejection + Interview side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {examiner.rejection_codes && <RejectionCard codes={examiner.rejection_codes} hex={colors.hex} />}
              {examiner.interview_count != null && examiner.interview_allowance_rate != null && (
                <InterviewCard count={examiner.interview_count} rate={examiner.interview_allowance_rate} hex={colors.hex} />
              )}
            </div>

            {/* Trend chart */}
            {examiner.grant_rate_by_year && (
              <TrendCard data={examiner.grant_rate_by_year} hex={colors.hex} />
            )}
          </div>

          {/* RIGHT sidebar */}
          <div className="flex flex-col gap-5">

            {/* Trust signals */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Data Quality</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                  <span className="text-sm text-slate-600">USPTO PatEx dataset</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                  <span className="text-sm text-slate-600">14M+ applications analyzed</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-sm text-slate-600">3-year rolling grant rate</span>
                </div>
                {examiner.total_applications && examiner.total_applications > 100 && (
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                    <span className="text-sm text-slate-600">High confidence ({examiner.total_applications.toLocaleString()} apps)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick stats */}
            {examiner.avg_office_actions_actual != null && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Office Action Stats</h3>
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Avg Office Actions / App</p>
                    <p className="text-2xl font-extrabold text-slate-900">{examiner.avg_office_actions_actual.toFixed(1)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Pro upsell */}
            <ProCard artUnit={examiner.art_unit_number} />

            {/* AI Summary teaser */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">✨</span>
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-80">AI Prosecution Summary</h3>
              </div>
              <p className="text-sm opacity-90 leading-relaxed mb-4">
                Get a plain-language strategy brief for {examiner.name} — powered by Claude AI.
              </p>
              <button className="w-full text-xs font-bold bg-white text-blue-600 hover:bg-blue-50 active:scale-95 transition-all rounded-xl py-2.5">
                Unlock AI Summary (Pro)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
