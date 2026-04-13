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
  const startAngle = -190;
  const totalArc = 200;
  const clampedRate = Math.min(100, Math.max(0, rate));
  const fillArc = (clampedRate / 100) * totalArc;
  const { hex, label } = rateColor(rate);

  function polarToCartesian(angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: center + radius * Math.cos(rad), y: center + radius * Math.sin(rad) };
  }

  function arcPath(startDeg: number, endDeg: number) {
    const s = polarToCartesian(startDeg);
    const e = polarToCartesian(endDeg);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  }

  const trackPath = arcPath(startAngle, startAngle + totalArc);
  const fillPath = fillArc > 0 ? arcPath(startAngle, startAngle + fillArc) : null;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Grant rate gauge: ${clampedRate.toFixed(1)}%`}>
        <path d={trackPath} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} strokeLinecap="round" />
        {fillPath && (
          <path d={fillPath} fill="none" stroke={hex} strokeWidth={strokeWidth} strokeLinecap="round" />
        )}
        {/* Rate number — positioned higher in center */}
        <text x={center} y={center - 14} textAnchor="middle" dominantBaseline="middle" fontSize="34" fontWeight="600" fill={hex}>
          {clampedRate.toFixed(1)}%
        </text>
        {/* Label below the number */}
        <text x={center} y={center + 18} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="#9ca3af">
          {label}
        </text>
      </svg>
      {/* "Grant Rate" sits outside the SVG — no overlap possible */}
      <p className="text-sm font-medium text-gray-400 -mt-2">Grant Rate (3yr)</p>
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
        {/* USPTO average marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-gray-400 z-10"
          style={{ left: `${USPTO_AVG}%` }}
        />
        {/* Examiner fill */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all"
          style={{ width: `${clampedRate}%`, backgroundColor: hex, opacity: 0.85 }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span style={{ color: hex }} className="font-semibold">{clampedRate.toFixed(1)}% this examiner</span>
        <span className="text-gray-400">{USPTO_AVG}% USPTO avg</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number | undefined;
  accent?: { bg: string; border: string };
}) {
  return (
    <div
      className={`rounded-xl border px-5 py-4 flex flex-col gap-1 flex-1 min-w-0 text-center ${
        accent ? `${accent.bg} ${accent.border}` : 'bg-gray-50 border-gray-200'
      }`}
    >
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">
        {value ?? <span className="text-gray-400 text-base font-normal">—</span>}
      </p>
    </div>
  );
}

function strategyPoints(rate: number): string[] {
  if (rate >= 70) {
    return [
      'This examiner has a favorable grant rate — standard prosecution strategies are effective.',
      'Broad independent claims are viable; the examiner is receptive to well-supported applications.',
      'Focus on thorough prior art searches and clear specification support to maintain allowance momentum.',
      'Continuations and claim broadening after allowance are worth considering.',
    ];
  }
  if (rate >= 50) {
    return [
      'This examiner is moderately selective — anticipate at least one round of office actions.',
      'Schedule an examiner interview early in prosecution to align on claim scope before formal rejections.',
      'Be prepared to file amendments; dependent claims can provide fallback positions.',
      'Thorough responses with robust technical arguments tend to perform well with this examiner.',
    ];
  }
  return [
    'This examiner has a low grant rate — targeted, specific claim language is strongly recommended.',
    'File narrow independent claims with well-defined limitations to reduce rejection risk.',
    'Examiner interviews are highly recommended — direct dialogue is the most effective tool here.',
    'Consider continuation strategies to keep prosecution options open across multiple applications.',
  ];
}

export default async function ExaminerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
          <p className="text-gray-500 text-sm mb-6">
            We could not find an examiner with that ID.
          </p>
          <Link
            href="/"
            className="inline-block bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to search
          </Link>
        </div>
      </main>
    );
  }

  const rate = examiner.grant_rate_3yr ?? 0;
  const colors = rateColor(rate);

  const formattedDate = examiner.updated_at
    ? new Date(examiner.updated_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-10 sm:py-14">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">

        {/* Back link */}
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 w-fit"
        >
          ← PatentIQ
        </Link>

        {/* Main card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Colored top banner */}
          <div className={`h-2 w-full ${colors.banner}`} />

          <div className="p-8 sm:p-10 flex flex-col items-center gap-8">
            {/* Name + art unit */}
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900">{examiner.name}</h1>
              {examiner.art_unit_number && (
                <p className="text-gray-400 mt-1 text-base">Art Unit {examiner.art_unit_number}</p>
              )}
            </div>

            {/* Gauge */}
            {examiner.grant_rate_3yr != null && (
              <GrantGauge rate={examiner.grant_rate_3yr} />
            )}

            {/* USPTO comparison bar */}
            {examiner.grant_rate_3yr != null && (
              <USPTOBar rate={examiner.grant_rate_3yr} />
            )}

            {/* Stat cards — stacked on mobile, row on sm+ */}
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <StatCard
                label="Total Applications"
                value={examiner.total_applications?.toLocaleString()}
              />
              <StatCard
                label="Avg Pendency (mo)"
                value={examiner.pendency_months != null ? examiner.pendency_months.toFixed(1) : undefined}
              />
              <StatCard
                label="Art Unit"
                value={examiner.art_unit_number}
                accent={examiner.grant_rate_3yr != null ? { bg: colors.bg, border: `border ${colors.border}` } : undefined}
              />
            </div>
          </div>
        </div>

        {/* Strategy card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Prosecution Strategy Notes</h2>
          <ul className="flex flex-col gap-4">
            {strategyPoints(rate).map((point, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-600 leading-relaxed">
                <span
                  className="shrink-0 w-2 h-2 rounded-full self-start relative top-[5px]"
                  style={{ backgroundColor: colors.hex }}
                />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        {formattedDate && (
          <p className="text-xs text-gray-400 text-center">Data last updated: {formattedDate}</p>
        )}

      </div>
    </main>
  );
}