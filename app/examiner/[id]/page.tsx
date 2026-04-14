import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import { Examiner } from '@/lib/types';

function rateColor(rate: number) {
  if (rate >= 70) return { hex: '#16a34a', lightBg: 'bg-green-50', border: 'border-green-200', banner: 'bg-green-500', label: 'Favorable', badgeBg: 'bg-green-50', badgeText: 'text-green-700', badgeBorder: 'border-green-200' };
  if (rate >= 50) return { hex: '#d97706', lightBg: 'bg-amber-50', border: 'border-amber-200', banner: 'bg-amber-500', label: 'Moderate', badgeBg: 'bg-amber-50', badgeText: 'text-amber-700', badgeBorder: 'border-amber-200' };
  return { hex: '#dc2626', lightBg: 'bg-red-50', border: 'border-red-200', banner: 'bg-red-500', label: 'Selective', badgeBg: 'bg-red-50', badgeText: 'text-red-700', badgeBorder: 'border-red-200' };
}

function GrantGauge({ rate }: { rate: number }) {
  const size = 200;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedRate = Math.min(100, Math.max(0, rate));
  const fillLength = (clampedRate / 100) * circumference;
  const { hex, label } = rateColor(rate);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        <circle cx={center} cy={center} r={radius} fill="none" stroke={hex} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={`${fillLength} ${circumference}`} transform={`rotate(-90 ${center} ${center})`} />
        <text x={center} y={center - 10} textAnchor="middle" dominantBaseline="middle" fontSize="36" fontWeight="800" fill={hex}>{clampedRate.toFixed(1)}%</text>
        <text x={center} y={center + 18} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="#94a3b8">{label}</text>
      </svg>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Grant Rate (3yr)</p>
    </div>
  );
}

function USPTOBar({ rate }: { rate: number }) {
  const USPTO_AVG = 67;
  const clampedRate = Math.min(100, Math.max(0, rate));
  const { hex } = rateColor(rate);
  return (
    <div className="w-full max-w-xs mx-auto flex flex-col gap-2">
      <div className="flex justify-between text-xs text-gray-400 font-medium">
        <span>0%</span><span className="font-semibold text-gray-500">vs. USPTO avg</span><span>100%</span>
      </div>
      <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="absolute top-0 h-full w-0.5 bg-gray-300 z-10" style={{ left: `${USPTO_AVG}%` }} />
        <div className="absolute top-0 left-0 h-full rounded-full" style={{ width: `${clampedRate}%`, backgroundColor: hex, opacity: 0.85 }} />
      </div>
      <div className="flex justify-between text-xs">
        <span style={{ color: hex }} className="font-bold">{clampedRate.toFixed(1)}%</span>
        <span className="text-gray-400">{USPTO_AVG}% avg</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number | undefined; icon: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-center h-28 px-3 gap-1.5 hover:bg-slate-100 transition-colors">
      <span className="text-xl">{icon}</span>
      <p className="text-xl font-bold text-slate-900 leading-none">
        {value ?? <span className="text-gray-300 text-base font-normal">—</span>}
      </p>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide leading-tight">{label}</p>
    </div>
  );
}

function strategyPoints(rate: number): string[] {
  if (rate >= 70) return [
    'This examiner has a favorable grant rate — standard prosecution strategies are effective.',
    'Broad independent claims are viable; the examiner is receptive to well-supported applications.',
    'Focus on thorough prior art searches and clear specification support to maintain allowance momentum.',
    'Continuations and claim broadening after allowance are worth considering.',
  ];
  if (rate >= 50) return [
    'This examiner is moderately selective — anticipate at least one round of office actions.',
    'Schedule an examiner interview early in prosecution to align on claim scope before formal rejections.',
    'Be prepared to file amendments; dependent claims can provide fallback positions.',
    'Thorough responses with robust technical arguments tend to perform well with this examiner.',
  ];
  return [
    'This examiner has a low grant rate — targeted, specific claim language is strongly recommended.',
    'File narrow independent claims with well-defined limitations to reduce rejection risk.',
    'Examiner interviews are highly recommended — direct dialogue is the most effective tool here.',
    'Consider continuation strategies to keep prosecution options open across multiple applications.',
  ];
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">{children}</h2>;
}

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      {accent && <div className="h-1 w-full" style={{ backgroundColor: accent }} />}
      <div className="p-7">{children}</div>
    </div>
  );
}

function RejectionActivity({ codes, accentHex }: { codes: { non_final: number; final: number; total: number }; accentHex: string }) {
  const max = Math.max(codes.non_final, codes.final, 1);
  const nfPct = codes.total > 0 ? ((codes.non_final / codes.total) * 100).toFixed(0) : '0';
  const fPct = codes.total > 0 ? ((codes.final / codes.total) * 100).toFixed(0) : '0';
  return (
    <Card accent={accentHex}>
      <div className="flex items-start justify-between mb-6">
        <SectionTitle>Rejection Activity</SectionTitle>
        <div className="text-right -mt-1">
          <p className="text-2xl font-black text-slate-900">{codes.total.toLocaleString()}</p>
          <p className="text-xs text-gray-400">total</p>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-amber-600">Non-Final</span>
            <span className="text-gray-500">{codes.non_final.toLocaleString()} <span className="text-amber-500">({nfPct}%)</span></span>
          </div>
          <div className="h-5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-amber-400 flex items-center justify-end pr-2" style={{ width: `${(codes.non_final / max) * 100}%` }}>
              {(codes.non_final / max) > 0.15 && <span className="text-xs font-bold text-white">{nfPct}%</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-red-600">Final</span>
            <span className="text-gray-500">{codes.final.toLocaleString()} <span className="text-red-500">({fPct}%)</span></span>
          </div>
          <div className="h-5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-red-400 flex items-center justify-end pr-2" style={{ width: `${(codes.final / max) * 100}%` }}>
              {(codes.final / max) > 0.15 && <span className="text-xs font-bold text-white">{fPct}%</span>}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function InterviewGauge({ rate }: { rate: number }) {
  const size = 110; const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2; const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedRate = Math.min(100, Math.max(0, rate));
  const fillLength = (clampedRate / 100) * circumference;
  const color = rate >= 50 ? '#16a34a' : rate >= 25 ? '#d97706' : '#dc2626';
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        <circle cx={center} cy={center} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={`${fillLength} ${circumference}`} transform={`rotate(-90 ${center} ${center})`} />
        <text x={center} y={center - 4} textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="700" fill={color}>{clampedRate.toFixed(1)}%</text>
        <text x={center} y={center + 12} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#94a3b8">allowance</text>
      </svg>
      <p className="text-xs text-gray-400 text-center">Interview → Allowance</p>
    </div>
  );
}

function ExaminerInterviews({ count, allowanceRate, accentHex }: { count: number; allowanceRate: number; accentHex: string }) {
  const note = allowanceRate > 50 ? 'Interviews are highly effective with this examiner.'
    : allowanceRate >= 25 ? 'Interviews sometimes lead to allowance.'
    : 'Interviews rarely lead to allowance here.';
  const noteColor = allowanceRate > 50 ? 'text-green-700 bg-green-50 border-green-200'
    : allowanceRate >= 25 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200';
  return (
    <Card accent={accentHex}>
      <SectionTitle>Examiner Interviews</SectionTitle>
      <div className="flex items-center justify-around gap-4 mb-6">
        <div className="flex flex-col items-center gap-1">
          <p className="text-6xl font-black text-slate-900">{count.toLocaleString()}</p>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total</p>
        </div>
        <div className="w-px self-stretch bg-gray-100" />
        <InterviewGauge rate={allowanceRate} />
      </div>
      <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${noteColor}`}>{note}</div>
    </Card>
  );
}

function GrantRateTrend({ grantRateByYear, overallRate, accentHex }: { grantRateByYear: Record<string, number>; overallRate: number; accentHex: string }) {
  const entries = Object.entries(grantRateByYear).map(([year, rate]) => ({ year, rate })).sort((a, b) => Number(a.year) - Number(b.year));
  if (entries.length < 3) return null;
  const W = 480; const H = 180; const padX = 40; const padY = 20;
  const chartW = W - padX * 2; const chartH = H - padY * 2;
  const rates = entries.map((e) => e.rate);
  const minRate = Math.max(0, Math.min(...rates) - 10);
  const maxRate = Math.min(100, Math.max(...rates) + 10);
  const xPos = (i: number) => padX + (i / (entries.length - 1)) * chartW;
  const yPos = (r: number) => padY + chartH - ((r - minRate) / (maxRate - minRate)) * chartH;
  const polylinePoints = entries.map((e, i) => `${xPos(i)},${yPos(e.rate)}`).join(' ');
  const areaPoints = `${xPos(0)},${padY + chartH} ${polylinePoints} ${xPos(entries.length - 1)},${padY + chartH}`;
  const firstAvg = (entries[0].rate + entries[1].rate) / 2;
  const lastAvg = (entries[entries.length - 2].rate + entries[entries.length - 1].rate) / 2;
  const delta = lastAvg - firstAvg;
  const trendLabel = delta > 2 ? `Trending up +${delta.toFixed(1)}pp` : delta < -2 ? `Trending down ${delta.toFixed(1)}pp` : 'Relatively stable';
  const trendColor = delta > 2 ? 'text-green-700 bg-green-50 border-green-200' : delta < -2 ? 'text-red-700 bg-red-50 border-red-200' : 'text-gray-600 bg-gray-50 border-gray-200';
  const yTicks = [minRate, (minRate + maxRate) / 2, maxRate].map((v) => Math.round(v));
  return (
    <Card accent={accentHex}>
      <SectionTitle>Grant Rate Trend</SectionTitle>
      <div className="w-full overflow-x-auto mb-4">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={padX} y1={yPos(tick)} x2={W - padX} y2={yPos(tick)} stroke="#f1f5f9" strokeWidth="1" />
              <text x={padX - 6} y={yPos(tick)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#94a3b8">{tick}%</text>
            </g>
          ))}
          <polygon points={areaPoints} fill={accentHex} opacity="0.08" />
          <polyline points={polylinePoints} fill="none" stroke={accentHex} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {entries.map((e, i) => (
            <g key={e.year}>
              <circle cx={xPos(i)} cy={yPos(e.rate)} r="4" fill={accentHex} />
              <text x={xPos(i)} y={H - 4} textAnchor="middle" fontSize="10" fill="#94a3b8">{e.year}</text>
              <text x={xPos(i)} y={yPos(e.rate) - 10} textAnchor="middle" fontSize="10" fontWeight="600" fill={accentHex}>{e.rate.toFixed(1)}%</text>
            </g>
          ))}
        </svg>
      </div>
      <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${trendColor}`}>{trendLabel} over this period.</div>
    </Card>
  );
}

function ArtUnitContext({ artUnit }: { artUnit?: string | number }) {
  return (
    <Card accent="#2563eb">
      <div className="flex items-start justify-between mb-5">
        <SectionTitle>Art Unit Context</SectionTitle>
        <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600 rounded-full px-3 py-1 bg-blue-50 border border-blue-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Pro
        </span>
      </div>
      {artUnit && (
        <div className="mb-5">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Art Unit</p>
          <p className="text-4xl font-black text-slate-900">{artUnit}</p>
        </div>
      )}
      <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 px-5 py-7 flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-700">Art unit comparison coming soon</p>
          <p className="text-xs text-gray-500 mt-1 max-w-xs">Upgrade to Pro for peer benchmarking — see how this examiner compares to others in Art Unit {artUnit ?? 'their group'}.</p>
        </div>
        <button className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors rounded-xl px-5 py-2 shadow-sm">
          Upgrade to Pro
        </button>
      </div>
    </Card>
  );
}

export default async function ExaminerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: examiner } = await supabase.from('examiners').select('*').eq('id', id).single<Examiner>();

  if (!examiner) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 text-center max-w-md w-full">
          <p className="text-4xl mb-4">🔍</p>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Examiner not found</h1>
          <p className="text-gray-500 text-sm mb-6">We could not find an examiner with that ID.</p>
          <Link href="/" className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">Back to search</Link>
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
    <main className="min-h-screen bg-slate-50">

      {/* Nav */}
      <header className="w-full bg-white border-b border-gray-100 px-6 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="PatentIQ" width={120} height={34} className="object-contain" />
          </Link>
          <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1">
            ← Back to search
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14 flex flex-col gap-8">

        {/* Hero card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className={`h-1.5 w-full ${colors.banner}`} />
          <div className="px-8 pt-10 pb-8 flex flex-col items-center gap-6"
            style={{ background: `radial-gradient(ellipse at 50% 0%, ${colors.hex}08 0%, transparent 65%)` }}>
            <div className="text-center flex flex-col items-center gap-2">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">{examiner.name}</h1>
              <div className="flex items-center gap-2.5">
                {examiner.art_unit_number && <p className="text-gray-400 text-base">Art Unit {examiner.art_unit_number}</p>}
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${colors.badgeBg} ${colors.badgeText} ${colors.badgeBorder}`}>
                  {colors.label}
                </span>
              </div>
            </div>
            {examiner.grant_rate_3yr != null && <GrantGauge rate={examiner.grant_rate_3yr} />}
            {examiner.grant_rate_3yr != null && <USPTOBar rate={examiner.grant_rate_3yr} />}
            <div className="grid grid-cols-3 gap-4 w-full max-w-md mx-auto">
              <StatCard label="Applications" value={examiner.total_applications?.toLocaleString()} icon="📄" />
              <StatCard label="Avg Pendency (mo)" value={examiner.pendency_months != null ? examiner.pendency_months.toFixed(1) : undefined} icon="⏱️" />
              <StatCard label="Art Unit" value={examiner.art_unit_number} icon="🏛️" />
            </div>
          </div>
        </div>

        {/* 2-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <div className="flex flex-col gap-6">
            <Card accent={colors.hex}>
              <SectionTitle>Prosecution Strategy Notes</SectionTitle>
              <ul className="flex flex-col gap-4">
                {strategyPoints(rate).map((point, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-600 leading-relaxed">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full self-start relative top-[6px]" style={{ backgroundColor: colors.hex }} />
                    {point}
                  </li>
                ))}
              </ul>
            </Card>
            {examiner.rejection_codes && <RejectionActivity codes={examiner.rejection_codes} accentHex={colors.hex} />}
          </div>
          <div className="flex flex-col gap-6">
            {examiner.interview_count != null && examiner.interview_allowance_rate != null && (
              <ExaminerInterviews count={examiner.interview_count} allowanceRate={examiner.interview_allowance_rate} accentHex={colors.hex} />
            )}
            {examiner.grant_rate_by_year && (
              <GrantRateTrend grantRateByYear={examiner.grant_rate_by_year} overallRate={rate} accentHex={colors.hex} />
            )}
            <ArtUnitContext artUnit={examiner.art_unit_number} />
          </div>
        </div>

        {formattedDate && <p className="text-xs text-gray-400 text-center">Data last updated: {formattedDate}</p>}
      </div>
    </main>
  );
}
