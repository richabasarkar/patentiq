import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import { Examiner, ArtUnitStats, SimilarExaminer } from '@/lib/types';
import { ExaminerDashboard } from './dashboard';

const USPTO_AVG_PENDENCY = 24.5;
const USPTO_AVG_GRANT_RATE = 67;

function rateColor(rate: number) {
  if (rate >= 70) return { hex: '#16a34a', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', label: 'Favorable' };
  if (rate >= 50) return { hex: '#d97706', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Moderate' };
  return { hex: '#dc2626', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', label: 'Selective' };
}

function PercentileBadge({ pct }: { pct?: number }) {
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

export default async function ExaminerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: examiner } = await supabase
    .from('examiners').select('*').eq('id', id).single<Examiner>();

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
  const formattedDate = examiner.updated_at
    ? new Date(examiner.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const pendencyDiff = examiner.pendency_months != null ? examiner.pendency_months - USPTO_AVG_PENDENCY : null;
  const pendencyContext = pendencyDiff != null
    ? Math.abs(pendencyDiff) > 3 ? `${pendencyDiff > 0 ? '+' : ''}${pendencyDiff.toFixed(1)}mo vs USPTO avg` : 'Near USPTO avg'
    : null;

  const size = 148; const sw = 11;
  const r = (size - sw) / 2; const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, rate));
  const fill = (clamped / 100) * circ;
  const approxGranted = examiner.total_applications ? Math.round((rate / 100) * examiner.total_applications) : null;
  const AVG = USPTO_AVG_GRANT_RATE;
  const diff = rate - AVG;

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'Inter, sans-serif' }}>
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="PatentIQ" width={140} height={36} className="object-contain h-9 w-auto" />
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

      <div className="max-w-6xl mx-auto px-6 pt-20 pb-20">
        {/* Hero */}
        <div className="bg-white border-b border-slate-100 -mx-6 px-6 pt-8 pb-8 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-2 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>{colors.label}</span>
                {examiner.art_unit_number && <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">Art Unit {examiner.art_unit_number}</span>}
                {artUnitStats && <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{artUnitStats.category}</span>}
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">{examiner.name}</h1>
            </div>
            {formattedDate && <p className="text-xs text-slate-400 shrink-0">Data updated {formattedDate}</p>}
          </div>

          <div className="flex flex-col sm:flex-row gap-8 items-start">
            <div className="shrink-0 flex flex-col items-center gap-2">
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
                <circle cx={cx} cy={cx} r={r} fill="none" stroke={colors.hex} strokeWidth={sw} strokeLinecap="round"
                  strokeDasharray={`${fill} ${circ}`} transform={`rotate(-90 ${cx} ${cx})`} />
                <text x={cx} y={cx - 8} textAnchor="middle" dominantBaseline="middle" fontSize="26" fontWeight="800" fill={colors.hex}>{clamped.toFixed(0)}%</text>
                <text x={cx} y={cx + 13} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#94a3b8">Allowance Rate</text>
              </svg>
              <div className="text-center">
                {approxGranted && <p className="text-xs text-slate-400">~{approxGranted.toLocaleString()} of {examiner.total_applications?.toLocaleString()} allowed</p>}
                {examiner.grant_rate_percentile != null && <div className="mt-1"><PercentileBadge pct={examiner.grant_rate_percentile} /></div>}
              </div>
            </div>

            <div className="flex-1 space-y-4 pt-1 w-full">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>0%</span><span className="font-semibold text-slate-500">vs. USPTO avg ({AVG}%)</span><span>100%</span>
                </div>
                <div className="relative h-2 bg-slate-100 rounded-full">
                  <div className="absolute top-0 h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: colors.hex, opacity: 0.85 }} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-400 rounded-full z-10" style={{ left: `${AVG}%` }} />
                </div>
                <p className="text-xs text-slate-400 mt-1.5 italic">
                  {diff >= 0 ? `${diff.toFixed(1)}pp above USPTO average` : `${Math.abs(diff).toFixed(1)}pp below USPTO average`}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Applications', value: examiner.total_applications?.toLocaleString() ?? '—', sub: 'total analyzed' },
                  { label: 'Avg Pendency', value: examiner.pendency_months != null ? `${examiner.pendency_months.toFixed(1)} mo` : '—', sub: pendencyContext ?? 'months avg' },
                  { label: 'First OA', value: examiner.avg_days_to_first_oa != null ? `${(examiner.avg_days_to_first_oa / 30.4).toFixed(1)} mo` : '—', sub: 'avg wait time' },
                  { label: "Avg OA's", value: examiner.avg_oas_to_allowance != null ? examiner.avg_oas_to_allowance.toFixed(1) : '—', sub: 'to allowance' },
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

        <ExaminerDashboard examiner={examiner} artUnitStats={artUnitStats} similar={similar} />
      </div>
    </div>
  );
}
