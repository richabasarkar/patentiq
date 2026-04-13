import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Examiner } from '@/lib/types';

function rateColor(rate: number) {
  if (rate >= 70) return { hex: '#16a34a', bg: 'bg-green-50', border: 'border-green-200', banner: 'bg-green-500', label: 'Favorable' };
  if (rate >= 50) return { hex: '#d97706', bg: 'bg-amber-50', border: 'border-amber-200', banner: 'bg-amber-500', label: 'Moderate' };
  return { hex: '#dc2626', bg: 'bg-red-50', border: 'border-red-200', banner: 'bg-red-500', label: 'Selective' };
}

function GrantGauge({ rate }: { rate: number }) {
  const size = 220;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedRate = Math.min(100, Math.max(0, rate));
  const fillLength = (clampedRate / 100) * circumference;
  const { hex, label } = rateColor(rate);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Grant rate: ${clampedRate.toFixed(1)}%`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke={hex} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={`${fillLength} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
        <text x={center} y={center - 10} textAnchor="middle" dominantBaseline="middle" fontSize="34" fontWeight="600" fill={hex}>
          {clampedRate.toFixed(1)}%
        </text>
        <text x={center} y={center + 20} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="#9ca3af">
          {label}
        </text>
      </svg>
      <p className="text-sm font-medium text-gray-400">Grant Rate (3yr)</p>
    </div>
  );
}

function USPTOBar({ rate }: { rate: number }) {
  const USPTO_AVG = 67;
  const clampedRate = Math.min(100, Math.max(0, rate));
  const { hex } = rateColor(rate);

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-2">
      <div className="flex justify-between text-xs text-gray-400 font-medium">
        <span>0%</span>
        <span>vs. USPTO average</span>
        <span>100%</span>
      </div>
      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className="absolute top-0 h-full w-0.5 bg-gray-400 z-10" style={{ left: `${USPTO_AVG}%` }} />
        <div className="absolute top-0 left-0 h-full rounded-full transition-all" style={{ width: `${clampedRate}%`, backgroundColor: hex, opacity: 0.85 }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span style={{ color: hex }} className="font-semibold">{clampedRate.toFixed(1)}% this examiner</span>
        <span>{USPTO_AVG}% USPTO avg</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number | undefined; accent?: { bg: string; border: string } }) {
  return (
    <div className={`rounded-xl border px-5 py-4 flex flex-col gap-1 flex-1 min-w-0 text-center ${accent ? `${accent.bg} ${accent.border}` : 'bg-gray-50 border-gray-200'}`}>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">
        {value ?? <span className="text-gray-400 text-base font-normal">—</span>}
      </p>
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

function RejectionActivity({ codes }: { codes: { non_final: number; final: number; total: number } }) {
  const max = Math.max(codes.non_final, codes.final, 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Rejection Activity</h2>
        <div className="text-right">
          <p className="text-3xl font-bold text-gray-900">{codes.total.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Rejections</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium text-amber-700">Non-Final</span>
            <span className="text-gray-500 tabular-nums font-medium">{codes.non_final.toLocaleString()}</span>
          </div>
          <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: `${(codes.non_final / max) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium text-red-700">Final</span>
            <span className="text-gray-500 tabular-nums font-medium">{codes.final.toLocaleString()}</span>
          </div>
          <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-red-400 transition-all"
              style={{ width: `${(codes.final / max) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 flex gap-6 text-xs text-gray-400">
        <span>
          Non-final ratio:{' '}
          <span className="font-semibold text-amber-600">
            {codes.total > 0 ? ((codes.non_final / codes.total) * 100).toFixed(0) : 0}%
          </span>
        </span>
        <span>
          Final ratio:{' '}
          <span className="font-semibold text-red-600">
            {codes.total > 0 ? ((codes.final / codes.total) * 100).toFixed(0) : 0}%
          </span>
        </span>
      </div>
    </div>
  );
}

function InterviewGauge({ rate }: { rate: number }) {
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedRate = Math.min(100, Math.max(0, rate));
  const fillLength = (clampedRate / 100) * circumference;
  const color = rate >= 50 ? '#16a34a' : rate >= 25 ? '#d97706' : '#dc2626';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Interview allowance rate: ${clampedRate.toFixed(1)}%`}>
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={`${fillLength} ${circumference}`}
        transform={`rotate(-90 ${center} ${center})`}
      />
      <text x={center} y={center - 6} textAnchor="middle" dominantBaseline="middle" fontSize="17" fontWeight="600" fill={color}>
        {clampedRate.toFixed(1)}%
      </text>
      <text x={center} y={center + 12} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#9ca3af">
        allowance
      </text>
    </svg>
  );
}

function ExaminerInterviews({ count, allowanceRate }: { count: number; allowanceRate: number }) {
  const note =
    allowanceRate > 50
      ? 'Interviews are highly effective with this examiner.'
      : allowanceRate >= 25
      ? 'Interviews sometimes lead to allowance.'
      : 'Interviews rarely lead to allowance here.';

  const noteColor =
    allowanceRate > 50
      ? 'text-green-700 bg-green-50 border-green-200'
      : allowanceRate >= 25
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-red-700 bg-red-50 border-red-200';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-gray-900">Examiner Interviews</h2>

      <div className="flex items-center justify-center gap-10">
        <div className="flex flex-col items-center gap-1">
          <p className="text-5xl font-bold text-gray-900">{count.toLocaleString()}</p>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total Interviews</p>
        </div>

        <div className="w-px self-stretch bg-gray-100" />

        <div className="flex flex-col items-center gap-2">
          <InterviewGauge rate={allowanceRate} />
          <p className="text-xs text-gray-400 font-medium text-center">Interview → Allowance Rate</p>
        </div>
      </div>

      <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${noteColor}`}>
        {note}
      </div>
    </div>
  );
}

function GrantRateTrend({ grantRateByYear, overallRate }: { grantRateByYear: Record<string, number>; overallRate: number }) {
  const entries = Object.entries(grantRateByYear)
    .map(([year, rate]) => ({ year, rate }))
    .sort((a, b) => Number(a.year) - Number(b.year));

  if (entries.length < 3) return null;

  const { hex } = rateColor(overallRate);

  const W = 480;
  const H = 180;
  const padX = 40;
  const padY = 20;
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const rates = entries.map((e) => e.rate);
  const minRate = Math.max(0, Math.min(...rates) - 10);
  const maxRate = Math.min(100, Math.max(...rates) + 10);

  function xPos(i: number) {
    return padX + (i / (entries.length - 1)) * chartW;
  }
  function yPos(rate: number) {
    return padY + chartH - ((rate - minRate) / (maxRate - minRate)) * chartH;
  }

  const polylinePoints = entries.map((e, i) => `${xPos(i)},${yPos(e.rate)}`).join(' ');

  const firstAvg = (entries[0].rate + entries[1].rate) / 2;
  const lastAvg = (entries[entries.length - 2].rate + entries[entries.length - 1].rate) / 2;
  const delta = lastAvg - firstAvg;
  const trendLabel =
    delta > 2
      ? `Grant rate is trending up +${delta.toFixed(1)}pp over this period.`
      : delta < -2
      ? `Grant rate is trending down ${delta.toFixed(1)}pp over this period.`
      : 'Grant rate has been relatively stable over this period.';

  const trendColor =
    delta > 2
      ? 'text-green-700 bg-green-50 border-green-200'
      : delta < -2
      ? 'text-red-700 bg-red-50 border-red-200'
      : 'text-gray-600 bg-gray-50 border-gray-200';

  const yTicks = [minRate, (minRate + maxRate) / 2, maxRate].map((v) => Math.round(v));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-gray-900">Grant Rate Trend</h2>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" aria-label="Grant rate by year line chart">
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={padX} y1={yPos(tick)} x2={W - padX} y2={yPos(tick)} stroke="#f3f4f6" strokeWidth="1" />
              <text x={padX - 6} y={yPos(tick)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#9ca3af">
                {tick}%
              </text>
            </g>
          ))}

          <polyline
            points={polylinePoints}
            fill="none"
            stroke={hex}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {entries.map((e, i) => (
            <g key={e.year}>
              <circle cx={xPos(i)} cy={yPos(e.rate)} r="4" fill={hex} />
              <text x={xPos(i)} y={H - 4} textAnchor="middle" fontSize="10" fill="#9ca3af">
                {e.year}
              </text>
              <text x={xPos(i)} y={yPos(e.rate) - 10} textAnchor="middle" fontSize="10" fontWeight="500" fill={hex}>
                {e.rate.toFixed(1)}%
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${trendColor}`}>
        {trendLabel}
      </div>
    </div>
  );
}

function ArtUnitContext({ artUnit }: { artUnit?: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Art Unit Context</h2>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Pro
        </span>
      </div>

      {artUnit && (
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Art Unit</p>
          <p className="text-4xl font-bold text-gray-900">{artUnit}</p>
        </div>
      )}

      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-6 flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">Art unit comparison coming soon</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            Upgrade to Pro for peer benchmarking — see how this examiner compares to others in Art Unit {artUnit ?? 'their group'}.
          </p>
        </div>
        <button className="mt-1 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-700 transition-colors rounded-lg px-4 py-2">
          Upgrade to Pro
        </button>
      </div>
    </div>
  );
}

export default async function ExaminerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: examiner } = await supabase
    .from('examiners')
    .select('*')
    .eq('id', id)
    .single<Examiner>();

  if (!examiner) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center max-w-md w-full">
          <p className="text-4xl mb-4">🔍</p>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Examiner not found</h1>
          <p className="text-gray-500 text-sm mb-6">We could not find an examiner with that ID.</p>
          <Link href="/" className="inline-block bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-700 transition-colors">
            Back to search
          </Link>
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
    <main className="min-h-screen bg-gray-100 px-4 py-10 sm:py-14">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">

        {/* Back link */}
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 w-fit">
          ← PatentIQ
        </Link>

        {/* Main card — full width */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className={`h-2 w-full ${colors.banner}`} />
          <div className="p-6 sm:p-10 flex flex-col items-center gap-8">

            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900">{examiner.name}</h1>
              {examiner.art_unit_number && (
                <p className="text-gray-400 mt-1 text-base">Art Unit {examiner.art_unit_number}</p>
              )}
            </div>

            {examiner.grant_rate_3yr != null && <GrantGauge rate={examiner.grant_rate_3yr} />}
            {examiner.grant_rate_3yr != null && <USPTOBar rate={examiner.grant_rate_3yr} />}

            <div className="flex flex-row gap-3 w-full max-w-lg mx-auto">
              <StatCard label="Total Applications" value={examiner.total_applications?.toLocaleString()} />
              <StatCard label="Avg Pendency (mo)" value={examiner.pendency_months != null ? examiner.pendency_months.toFixed(1) : undefined} />
              <StatCard label="Art Unit" value={examiner.art_unit_number} accent={examiner.grant_rate_3yr != null ? { bg: colors.bg, border: `border ${colors.border}` } : undefined} />
            </div>

          </div>
        </div>

        {/* 2-column grid on desktop, single column on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">

          {/* LEFT column */}
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-5">Prosecution Strategy Notes</h2>
              <ul className="flex flex-col gap-4">
                {strategyPoints(rate).map((point, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-600 leading-relaxed">
                    <span className="shrink-0 w-2 h-2 rounded-full self-start relative top-[5px]" style={{ backgroundColor: colors.hex }} />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {examiner.rejection_codes && (
              <RejectionActivity codes={examiner.rejection_codes} />
            )}
          </div>

          {/* RIGHT column */}
          <div className="flex flex-col gap-6">
            {examiner.interview_count != null && examiner.interview_allowance_rate != null && (
              <ExaminerInterviews
                count={examiner.interview_count}
                allowanceRate={examiner.interview_allowance_rate}
              />
            )}

            {examiner.grant_rate_by_year && (
              <GrantRateTrend
                grantRateByYear={examiner.grant_rate_by_year}
                overallRate={rate}
              />
            )}

            <ArtUnitContext artUnit={examiner.art_unit_number} />
          </div>

        </div>

        {/* Footer — full width */}
        {formattedDate && (
          <p className="text-xs text-gray-400 text-center">Data last updated: {formattedDate}</p>
        )}

      </div>
    </main>
  );
}