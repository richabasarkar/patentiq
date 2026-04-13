import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Examiner } from '@/lib/types';

function GrantGauge({ rate }: { rate: number }) {
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const startAngle = -210;
  const totalArc = 240;
  const clampedRate = Math.min(100, Math.max(0, rate));
  const fillArc = (clampedRate / 100) * totalArc;

  function polarToCartesian(angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  }

  function arcPath(startDeg: number, endDeg: number) {
    const s = polarToCartesian(startDeg);
    const e = polarToCartesian(endDeg);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  }

  const trackPath = arcPath(startAngle, startAngle + totalArc);
  const fillPath = fillArc > 0 ? arcPath(startAngle, startAngle + fillArc) : null;
  const color = rate >= 70 ? '#16a34a' : rate >= 50 ? '#d97706' : '#dc2626';
  const label = rate >= 70 ? 'Favorable' : rate >= 50 ? 'Moderate' : 'Selective';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={trackPath} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} strokeLinecap="round" />
        {fillPath && (
          <path d={fillPath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        )}
        <text x={center} y={center - 6} textAnchor="middle" dominantBaseline="middle" fontSize="28" fontWeight="600" fill={color}>
          {clampedRate.toFixed(1)}%
        </text>
        <text x={center} y={center + 20} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="#6b7280">
          {label}
        </text>
      </svg>
      <p className="text-sm font-medium text-gray-500 -mt-2">Grant Rate</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-4 flex flex-col gap-1 flex-1 min-w-0">
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
  const formattedDate = examiner.updated_at
    ? new Date(examiner.updated_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">

        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 w-fit">
          PatentIQ
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col items-center gap-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">{examiner.name}</h1>
            {examiner.art_unit_number && (
              <p className="text-gray-400 mt-1 text-base">Art Unit {examiner.art_unit_number}</p>
            )}
          </div>

          {examiner.grant_rate_3yr != null && (
            <GrantGauge rate={examiner.grant_rate_3yr} />
          )}

          <div className="flex gap-3 w-full flex-wrap justify-center">
            <StatCard label="Total Applications" value={examiner.total_applications?.toLocaleString()} />
            <StatCard
              label="Avg Pendency (months)"
              value={examiner.pendency_months != null ? examiner.pendency_months.toFixed(1) : undefined}
            />
            <StatCard label="Art Unit" value={examiner.art_unit_number} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Prosecution Strategy Notes</h2>
          <ul className="flex flex-col gap-3">
            {strategyPoints(rate).map((point, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-600 leading-relaxed">
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 self-start relative top-[5px]" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {formattedDate && (
          <p className="text-xs text-gray-400 text-center">Data last updated: {formattedDate}</p>
        )}

      </div>
    </main>
  );
}
