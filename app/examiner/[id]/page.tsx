import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import { Examiner } from '@/lib/types';

function rateColor(rate: number) {
  if (rate >= 70) return { hex: '#16a34a', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', banner: 'bg-green-500', label: 'Favorable' };
  if (rate >= 50) return { hex: '#d97706', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', banner: 'bg-amber-500', label: 'Moderate' };
  return { hex: '#dc2626', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', banner: 'bg-red-500', label: 'Selective' };
}

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

function strategyPoints(rate: number) {
  if (rate >= 70) return [
    'Standard prosecution strategies are effective — this examiner has a favorable grant rate.',
    'Broad independent claims are viable; the examiner is receptive to well-supported applications.',
    'Focus on thorough prior art searches and clear specification support.',
    'Continuations and claim broadening after allowance are worth considering.',
  ];
  if (rate >= 50) return [
    'This examiner is moderately selective — anticipate at least one round of office actions.',
    'Schedule an examiner interview early to align on claim scope before formal rejections.',
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

  // Trend chart helpers
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

      {/* Nav */}
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

        {/* ── Fix 4: Open, airy hero — NO box, just clean layout ── */}
        <div className="pt-8 pb-10 mb-8 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>{colors.label}</span>
                {examiner.art_unit_number && <span className="text-sm text-slate-400 font-medium">Art Unit {examiner.art_unit_number}</span>}
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">{examiner.name}</h1>
            </div>
            {formattedDate && (
              <p className="text-xs text-slate-400 shrink-0">Updated {formattedDate}</p>
            )}
          </div>

          {/* Key metrics — open row, no card box */}
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

        {/* ── Main dashboard: 2 col grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT — 2 cols wide */}
          <div className="lg:col-span-2 space-y-8">

            {/* Strategy — clean section, no heavy box */}
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Prosecution Strategy</h2>
              <div className="space-y-4">
                {strategyPoints(rate).map((point, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-2" style={{ backgroundColor: colors.hex }} />
                    <p className="text-sm text-slate-600 leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rejection — single clean card */}
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

            {/* Trend chart */}
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

          {/* RIGHT sidebar — clean, spaced */}
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

            {/* Data quality — clean list, no heavy box */}
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

            {/* Art Unit — minimal */}
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
              <p className="text-sm opacity-85 leading-relaxed mb-4">Get a plain-language strategy brief for {examiner.name} powered by Claude AI.</p>
              <button className="w-full text-xs font-bold bg-white text-blue-600 hover:bg-blue-50 active:scale-95 transition-all rounded-xl py-2.5">Unlock AI Summary (Pro)</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
