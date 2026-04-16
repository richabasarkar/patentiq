'use client';

import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
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

function CardLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{children}</p>;
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-4 bg-slate-50 rounded-xl">
      <p className="text-xs text-slate-400 mb-2 font-medium">{label}</p>
      <p className="text-2xl font-extrabold" style={{ color: color ?? '#0f172a' }}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

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
    } else { interviewImpact = '~0pp'; }
  }

  const personality = rate >= 75 ? 'Consistently favorable — receptive to broad, well-supported claims.'
    : rate >= 65 ? 'Generally reasonable — expects solid prior art work and clear claim language.'
    : rate >= 50 ? 'Moderately selective — plan for amendments and at least one rejection round.'
    : rate >= 35 ? 'Strict — requires precise language and strong technical arguments.'
    : 'Very selective — one of the harder USPTO examiners. Requires targeted strategy.';

  const interviewHighlyEffective = ir !== null && ir > rate + 10;
  const interviewIneffective = ir !== null && ir < 25;

  let primaryAction = '', primaryDetail = '', primaryColor = '';
  if (rate >= 70) { primaryAction = 'File with confidence'; primaryDetail = 'Strong allowance rate — standard prosecution with broad claims is your best path.'; primaryColor = 'border-green-300 bg-green-50'; }
  else if (rate >= 55 && interviewHighlyEffective) { primaryAction = 'Request examiner interview early'; primaryDetail = `Interviews are highly effective (+${((ir ?? 0) - rate).toFixed(1)}pp). Schedule before or after first OA.`; primaryColor = 'border-blue-300 bg-blue-50'; }
  else if (rate >= 55) { primaryAction = 'Prepare for amendment rounds'; primaryDetail = 'Anticipate 1-2 OAs. File broad claims with strong dependent fallbacks.'; primaryColor = 'border-amber-300 bg-amber-50'; }
  else if (interviewHighlyEffective) { primaryAction = 'Request examiner interview immediately'; primaryDetail = `Low allowance rate but interviews are highly effective (+${((ir ?? 0) - rate).toFixed(1)}pp). Your highest-leverage tool.`; primaryColor = 'border-blue-300 bg-blue-50'; }
  else if (interviewIneffective) { primaryAction = 'File narrow — plan for continuation'; primaryDetail = 'Low allowance rate and interviews ineffective. File targeted claims, invest in written arguments.'; primaryColor = 'border-red-300 bg-red-50'; }
  else { primaryAction = 'File narrow, targeted claims'; primaryDetail = 'Selective examiner. Use specific claim language and plan for multiple rejection rounds.'; primaryColor = 'border-amber-300 bg-amber-50'; }

  const prefs: { title: string; detail: string; impact: 'high' | 'medium' | 'low' }[] = [];
  if (examiner.pct_101 != null && examiner.pct_101 >= 30) prefs.push({ title: `Frequently uses §101 Subject Matter Eligibility rejections (${examiner.pct_101.toFixed(0)}% of OAs)`, detail: 'Abstract idea rejections are this examiner\'s primary tool. Draft claims to avoid broad software/method language. Include concrete technical implementations in the specification and ensure claims tie to a specific technological improvement. Consider filing eligibility declarations early.', impact: 'high' });
  if (examiner.pct_103 != null && examiner.pct_103 >= 60) prefs.push({ title: `Heavy use of §103 Obviousness rejections (${examiner.pct_103.toFixed(0)}% of OAs)`, detail: 'This examiner frequently combines prior art references to reject claims. Run a thorough prior art search before filing. Prepare secondary consideration declarations (commercial success, long-felt need) proactively. Draft claims with specific combinations of elements unlikely to be found together in the prior art.', impact: 'high' });
  if (examiner.pct_102 != null && examiner.pct_102 >= 50) prefs.push({ title: `High §102 Anticipation rejection rate (${examiner.pct_102.toFixed(0)}% of OAs)`, detail: 'This examiner frequently finds single prior art references that anticipate claims. Include multiple distinguishing limitations in independent claims. Ensure your specification clearly describes the novel aspects of the invention with specific technical detail that would not be found in prior art.', impact: 'high' });
  if (examiner.pct_112 != null && examiner.pct_112 >= 20) prefs.push({ title: `Notable §112 Written Description issues (${examiner.pct_112.toFixed(0)}% of OAs)`, detail: 'This examiner frequently finds that specifications do not adequately support the claims. Before filing, review every claim element and confirm it is explicitly described in the specification. Avoid claiming broader than what is exemplified. Add multiple working examples to the specification.', impact: 'medium' });
  if (examiner.appeal_overturn_rate != null && examiner.appeal_overturn_rate >= 30) prefs.push({ title: `PTAB frequently overturns this examiner (${examiner.appeal_overturn_rate.toFixed(0)}% overturn rate)`, detail: 'PTAB reverses this examiner at an above-average rate, suggesting their rejections do not always hold up on appeal. If you receive a final rejection that you believe is legally flawed, appeal is a stronger-than-average strategic option here. Document your appeal arguments from the first office action response.', impact: 'high' });
  if (interviewHighlyEffective) prefs.push({ title: `Interviews significantly improve outcomes (+${((ir ?? 0) - rate).toFixed(1)}pp allowance rate)`, detail: 'Direct examiner interviews are highly effective with this examiner. Request an interview after receiving the first OA — before filing a formal response. Use the interview to narrow the scope of disagreement, understand the examiner\'s specific concerns, and propose claim amendments collaboratively. This saves multiple OA rounds.', impact: 'high' });
  else if (interviewIneffective) prefs.push({ title: 'Interviews rarely lead to allowance with this examiner', detail: 'Despite the option, examiner interviews have a below-average success rate here. Invest your time in thorough written responses with strong technical and legal arguments rather than relying on interviews. Consider engaging a technical expert to provide a declaration supporting patentability.', impact: 'high' });
  if ((examiner.rce_rate ?? 0) >= 20) prefs.push({ title: `High RCE rate — ${(examiner.rce_rate ?? 0).toFixed(0)}% of applications require continued examination`, detail: 'A Request for Continued Examination (RCE) is filed when prosecution reaches a dead end after a Final Rejection and the applicant wants to continue without abandoning. This examiner\'s high RCE rate means additional prosecution fees are likely. Budget $1,200-$2,000 for USPTO RCE fees plus attorney time. Discuss this with your client upfront.', impact: 'medium' });

  if (prefs.length === 0) {
    prefs.push({ title: 'Standard prosecution approach is effective', detail: 'This examiner does not show strong skews toward particular rejection types. Use standard prosecution strategy: clear claim language, solid specification support, and thorough prior art search.', impact: 'low' });
  }

  return { personality, primaryAction, primaryDetail, primaryColor, prefs, confidence, confidenceNote, interviewImpact, interviewImpactColor };
}

// ─── Tab component ────────────────────────────────────────────────────────────

function TabNav({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 overflow-x-auto">
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap transition-all ${active === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main component (client) ──────────────────────────────────────────────────

function ExaminerDashboard({ examiner, artUnitStats, similar }: { examiner: Examiner; artUnitStats: ArtUnitStats | null; similar: SimilarExaminer[] }) {
  const [activeTab, setActiveTab] = useState('strategy');

  const rate = examiner.grant_rate_3yr ?? 0;
  const colors = rateColor(rate);
  const strategy = buildStrategy(examiner);

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
    trendLabel = delta > 2 ? `Trending up +${delta.toFixed(1)}pp` : delta < -2 ? `Trending down ${delta.toFixed(1)}pp` : 'Stable';
    trendStyle = delta > 2 ? 'text-green-600 bg-green-50 border-green-200' : delta < -2 ? 'text-red-600 bg-red-50 border-red-200' : 'text-slate-500 bg-slate-50 border-slate-200';
    trendNote = delta > 2 ? 'Becoming more lenient — recent applications have better odds than historical rates suggest.'
      : delta < -2 ? 'Becoming stricter — recent allowance rates are lower than the historical average.'
      : 'Consistent over time — historical rates are a reliable predictor of future behavior.';
  }

  const avgOAs = examiner.avg_oas_to_allowance ?? (rate >= 70 ? 1.2 : rate >= 50 ? 2.0 : 2.8);
  const rceRate = examiner.rce_rate ?? (rate >= 70 ? 5 : rate >= 50 ? 15 : 30);
  const pendency = examiner.pendency_months ?? USPTO_AVG_PENDENCY;
  const lowCost = Math.round((2000 + avgOAs * 3500 * 0.8 + (rceRate / 100) * 2500 + 1000) / 500) * 500;
  const highCost = Math.round((2000 + avgOAs * 3500 * 1.4 + (rceRate / 100) * 2500 + 1000) / 500) * 500;
  const timelineLow = Math.round(pendency * 0.85);
  const timelineHigh = Math.round(pendency * 1.25);

  const tabs = [
    { id: 'strategy', label: 'Strategy' },
    { id: 'outcomes', label: 'Prosecution Outcomes' },
    { id: 'cost', label: 'Cost & Timeline' },
    { id: 'benchmarks', label: 'Benchmarks' },
    { id: 'history', label: 'History' },
    { id: 'chat', label: 'Ask AI' },
  ];

  return (
    <div>
      <TabNav tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* ── TAB 1: STRATEGY ───────────────────────────────────────────────── */}
      {activeTab === 'strategy' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT: Interviews + Profile + Recommended Step */}
          <div className="space-y-4">
            {/* Examiner Interviews */}
            {examiner.interview_count != null && examiner.interview_allowance_rate != null && (() => {
              const count = examiner.interview_count!;
              const ir = examiner.interview_allowance_rate!;
              const circ = 2 * Math.PI * 28;
              const fillLen = (Math.min(100, ir) / 100) * circ;
              const color = ir >= 50 ? '#16a34a' : ir >= 25 ? '#d97706' : '#dc2626';
              const noteStyle = ir > 50 ? 'text-green-700 bg-green-50 border-green-200' : ir >= 25 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';
              const noteText = ir > 50 ? 'Highly effective — request one early in prosecution'
                : ir >= 25 ? 'Sometimes helps — worth requesting after first OA'
                : 'Rarely effective — focus resources on written arguments';
              return (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
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
                      <p className="text-xs text-slate-400 text-center leading-tight">Interview<br />→ Allowance</p>
                    </div>
                    {strategy.interviewImpact && (
                      <div className="flex-1 text-center">
                        <p className={`text-2xl font-extrabold ${strategy.interviewImpactColor}`}>{strategy.interviewImpact}</p>
                        <p className="text-xs text-slate-400 mt-0.5">vs baseline allowance rate</p>
                      </div>
                    )}
                  </div>
                  <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${noteStyle}`}>{noteText}</div>
                </div>
              );
            })()}

            {/* Examiner Profile */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <CardLabel>Examiner Profile</CardLabel>
              <p className="text-sm text-slate-700 leading-relaxed">{strategy.personality}</p>
            </div>

            {/* Recommended Next Step */}
            <div className={`rounded-2xl border-2 p-5 ${strategy.primaryColor}`}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Recommended Next Step</p>
              <h3 className="text-base font-extrabold text-slate-900 mb-2">{strategy.primaryAction}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{strategy.primaryDetail}</p>
            </div>

            <p className="text-xs text-slate-400 flex items-center gap-1.5 px-1">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${strategy.confidence === 'High' ? 'bg-green-400' : strategy.confidence === 'Medium' ? 'bg-amber-400' : 'bg-red-400'}`} />
              {strategy.confidenceNote}
            </p>
          </div>

          {/* RIGHT: Examiner Preferences */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <CardLabel>Examiner Tendencies & Preferences</CardLabel>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Known patterns from {examiner.total_oas_analyzed?.toLocaleString() ?? examiner.total_applications?.toLocaleString() ?? '—'} office actions. Use these to tailor your claim drafting and response strategy before you file.
            </p>
            <div className="space-y-4">
              {strategy.prefs.map((pref, i) => (
                <div key={i} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start gap-3 mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 border ${pref.impact === 'high' ? 'bg-red-50 text-red-600 border-red-200' : pref.impact === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{pref.impact}</span>
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{pref.title}</p>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed ml-12">{pref.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PROSECUTION OUTCOMES ───────────────────────────────────── */}
      {activeTab === 'outcomes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT: Funnel + metrics */}
          <div className="space-y-4">
            {(examiner.allowance_after_1_oa != null || examiner.abandonment_rate != null) && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <CardLabel>Prosecution Funnel</CardLabel>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">What happens to a typical application with this examiner, from filing through final outcome.</p>
                <div className="space-y-3 mb-5">
                  {[
                    { label: 'Application Filed', pct: 100, color: '#3b82f6' },
                    ...(examiner.allowance_after_1_oa != null ? [{ label: `Allowed after 1st OA response — ${examiner.allowance_after_1_oa.toFixed(0)}%`, pct: examiner.allowance_after_1_oa, color: '#16a34a' }] : []),
                    ...(examiner.allowance_after_2_oa != null ? [{ label: `Allowed after 2nd OA response — ${examiner.allowance_after_2_oa.toFixed(0)}% cumulative`, pct: examiner.allowance_after_2_oa, color: '#16a34a' }] : []),
                    ...(examiner.abandonment_rate != null ? [{ label: `Allowed (all rounds) — ${(100 - examiner.abandonment_rate).toFixed(0)}%`, pct: 100 - examiner.abandonment_rate, color: rateColor(rate).hex }] : []),
                  ].map((stage, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-600 font-medium">{stage.label}</span>
                        <span className="font-bold text-slate-900">{stage.pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${stage.pct}%`, backgroundColor: stage.color, minWidth: '4px' }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Allowance after 1st OA", value: examiner.allowance_after_1_oa, suffix: '%', good: 50, ok: 25 },
                    { label: "Allowance after 2nd OA", value: examiner.allowance_after_2_oa, suffix: '%', good: 60, ok: 35 },
                    { label: "Abandonment Rate", value: examiner.abandonment_rate, suffix: '%', good: -15, ok: -30, invert: true },
                    { label: "RCE Rate", value: examiner.rce_rate, suffix: '%', good: -10, ok: -25, invert: true },
                  ].filter(m => m.value != null).map(m => {
                    const v = m.value!;
                    const c = m.invert
                      ? v <= Math.abs(m.good) ? '#16a34a' : v <= Math.abs(m.ok) ? '#d97706' : '#dc2626'
                      : v >= m.good ? '#16a34a' : v >= m.ok ? '#d97706' : '#dc2626';
                    return <Stat key={m.label} label={m.label} value={`${v.toFixed(1)}${m.suffix}`} color={c} />;
                  })}
                </div>
              </div>
            )}

            {/* Avg OAs to allowance */}
            {examiner.avg_oas_to_allowance != null && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <CardLabel>Avg OA's to Allowance</CardLabel>
                <p className="text-xs text-slate-400 mb-4">How many rounds of office actions before allowance, on average.</p>
                <div className="flex items-center gap-5">
                  <div className="text-center">
                    <p className="text-5xl font-extrabold" style={{ color: examiner.avg_oas_to_allowance <= 1.5 ? '#16a34a' : examiner.avg_oas_to_allowance <= 2.5 ? '#d97706' : '#dc2626' }}>
                      {examiner.avg_oas_to_allowance.toFixed(1)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">office actions</p>
                  </div>
                  <div className="flex-1">
                    <div className="relative h-2.5 bg-slate-100 rounded-full mb-2">
                      <div className="absolute top-0 h-full rounded-full bg-gradient-to-r from-green-400 via-amber-400 to-red-400 w-full opacity-25" />
                      <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow"
                        style={{ left: `${Math.min(93, (examiner.avg_oas_to_allowance / 5) * 100)}%`, backgroundColor: examiner.avg_oas_to_allowance <= 1.5 ? '#16a34a' : examiner.avg_oas_to_allowance <= 2.5 ? '#d97706' : '#dc2626' }} />
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 mb-3">
                      <span>1 (easy)</span><span>2–3 (typical)</span><span>4+ (difficult)</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {examiner.avg_oas_to_allowance <= 1.5 ? 'Most applications resolve in a single round. Budget for efficient prosecution.'
                        : examiner.avg_oas_to_allowance <= 2.5 ? 'Typical prosecution length. Plan for 2 rounds of office actions in your client timeline.'
                        : 'Extended prosecution expected. Budget for 3+ rounds and discuss continuation strategy upfront.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Rejection types + appeal */}
          <div className="space-y-4">
            {/* Rejection type breakdown */}
            {(examiner.pct_101 != null || examiner.pct_103 != null) && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-1">
                  <CardLabel>Rejection Type Breakdown</CardLabel>
                  {examiner.total_oas_analyzed && <span className="text-xs text-slate-400 -mt-3">{examiner.total_oas_analyzed.toLocaleString()} OA's analyzed</span>}
                </div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">% of OA's containing each rejection type. Shapes your claim drafting strategy before you file.</p>
                <div className="space-y-4">
                  {[
                    { code: '§101', label: 'Subject Matter Eligibility', pct: examiner.pct_101, color: '#7c3aed', tip: 'Abstract idea rejections. Hard to overcome — requires eligibility arguments or claim restructuring to tie claims to a specific technical improvement.' },
                    { code: '§102', label: 'Anticipation', pct: examiner.pct_102, color: '#dc2626', tip: 'Single prior art reference anticipates claims. Distinguish by adding specific limitations not present in the reference.' },
                    { code: '§103', label: 'Obviousness', pct: examiner.pct_103, color: '#d97706', tip: 'Combination of references. Argue unexpected results, teaching away, or secondary considerations such as commercial success.' },
                    { code: '§112', label: 'Written Description', pct: examiner.pct_112, color: '#0891b2', tip: 'Specification does not adequately support the claims. Tighten claim language and ensure every claim element is described with specificity in the spec before filing.' },
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
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                          <div className="h-full rounded-full" style={{ width: `${(pct / maxPct) * 100}%`, backgroundColor: t.color }} />
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{t.tip}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PTAB Appeal */}
            {examiner.appeal_count != null && (() => {
              const overturn = examiner.appeal_overturn_rate ?? 0;
              const affirm = examiner.appeal_affirm_rate ?? 0;
              const appealColor = overturn >= 35 ? '#16a34a' : overturn >= 20 ? '#d97706' : '#dc2626';
              const appealLabel = overturn >= 35 ? 'Appeal-Worthy' : overturn >= 20 ? 'Mixed Results' : 'Avoid Appeal';
              const appealStyle = overturn >= 35 ? 'text-green-700 bg-green-50 border-green-200' : overturn >= 20 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';
              return (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-1">
                    <CardLabel>PTAB Appeal Record</CardLabel>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border -mt-3 ${appealStyle}`}>{appealLabel}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                    Of {examiner.appeal_count} cases that went to appeal, {affirm.toFixed(0)}% were affirmed (USPTO won) and {overturn.toFixed(0)}% were reversed or remanded (applicant won).
                  </p>
                  <div className="flex items-center gap-5 mb-4">
                    <div className="flex-1 space-y-2.5">
                      <div>
                        <div className="flex justify-between text-xs mb-1.5"><span className="text-slate-500 font-medium">Affirmed — USPTO wins</span><span className="font-bold text-slate-700">{affirm.toFixed(1)}%</span></div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-slate-300" style={{ width: `${affirm}%` }} /></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1.5"><span className="text-slate-500 font-medium">Reversed — applicant wins</span><span className="font-bold" style={{ color: appealColor }}>{overturn.toFixed(1)}%</span></div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${overturn}%`, backgroundColor: appealColor }} /></div>
                      </div>
                    </div>
                    <div className="text-center shrink-0 w-20">
                      <p className="text-4xl font-black" style={{ color: appealColor }}>{overturn.toFixed(0)}%</p>
                      <p className="text-xs text-slate-400">applicant<br />win rate</p>
                      <p className="text-xs text-slate-400 mt-1">{examiner.appeal_count} cases</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 italic leading-relaxed">
                    {overturn >= 30 ? `PTAB overturns this examiner ${overturn.toFixed(0)}% of the time — significantly above average. Appeal is a strong option after a final rejection.`
                      : `PTAB affirms this examiner ${affirm.toFixed(0)}% of the time. Focus on amendment or RCE strategies rather than appeal.`}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── TAB 3: COST & TIMELINE ─────────────────────────────────────────── */}
      {activeTab === 'cost' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT: Cost estimator */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <CardLabel>Client Cost Estimate</CardLabel>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Estimated prosecution costs based on this examiner's historical patterns. Use as a starting point for client conversations — actual costs vary by firm and technology area.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <Stat label="Expected OA Responses" value={avgOAs.toFixed(1)}
                sub="rounds of prosecution"
                color={rate >= 70 ? '#16a34a' : rate >= 50 ? '#d97706' : '#dc2626'} />
              <Stat label="RCE Probability" value={`${rceRate.toFixed(0)}%`}
                sub="chance of needing continued exam"
                color={rceRate >= 25 ? '#dc2626' : rceRate >= 10 ? '#d97706' : '#16a34a'} />
              <Stat label="Estimated Cost Range" value={`$${(lowCost / 1000).toFixed(0)}k – $${(highCost / 1000).toFixed(0)}k`}
                sub="attorney fees, excl. USPTO fees" />
              <Stat label="Time to Patent" value={`${timelineLow}–${timelineHigh} mo`}
                sub="filing to allowance estimate" />
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-600">Probability of obtaining patent</p>
                <p className="text-base font-extrabold" style={{ color: colors.hex }}>{Math.round(rate)}%</p>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${rate}%`, backgroundColor: colors.hex }} />
              </div>
            </div>
            {(examiner.abandonment_rate ?? 0) >= 20 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                <p className="text-xs text-amber-700 leading-relaxed font-medium">
                  {(examiner.abandonment_rate ?? 0).toFixed(0)}% abandonment rate — discuss the realistic probability of not obtaining a patent with your client before committing to full prosecution.
                </p>
              </div>
            )}
            <p className="text-xs text-slate-400 italic leading-relaxed">
              Estimates assume $2,000–$5,000 per OA response at industry-average rates. Actual costs vary by firm size and technology complexity.
            </p>
          </div>

          {/* RIGHT: Timing */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <CardLabel>Speed to Allowance</CardLabel>
              <div className="flex items-end gap-2 mb-4">
                <p className="text-5xl font-black text-slate-900">{examiner.pendency_months?.toFixed(1) ?? '—'}</p>
                <p className="text-sm text-slate-400 mb-1.5">months avg</p>
              </div>
              <div className="relative h-2 bg-slate-100 rounded-full mb-2">
                <div className="absolute top-0 h-full rounded-full bg-blue-400" style={{ width: `${Math.min(100, ((examiner.pendency_months ?? 0) / 60) * 100)}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-400 rounded-full" style={{ left: `${(USPTO_AVG_PENDENCY / 60) * 100}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-400 mb-3"><span>0 mo</span><span>{USPTO_AVG_PENDENCY}mo USPTO avg</span><span>60 mo</span></div>
              {pendencyContext && <p className="text-xs text-slate-500 italic">{pendencyContext}</p>}
              {examiner.pendency_percentile != null && <div className="mt-2"><PercentileBadge pct={100 - examiner.pendency_percentile} label="Speed" /></div>}
            </div>

            {examiner.avg_days_to_first_oa != null && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <CardLabel>Time to First OA</CardLabel>
                <div className="flex items-end gap-2 mb-4">
                  <p className="text-5xl font-black text-slate-900">{(examiner.avg_days_to_first_oa / 30.4).toFixed(1)}</p>
                  <p className="text-sm text-slate-400 mb-1.5">months avg</p>
                </div>
                {(() => {
                  const diff = examiner.avg_days_to_first_oa! - USPTO_AVG_DAYS_TO_FIRST_OA;
                  const isFaster = diff < -30; const isSlower = diff > 30;
                  const color = isFaster ? '#16a34a' : isSlower ? '#dc2626' : '#d97706';
                  const label = isFaster ? `${(Math.abs(diff) / 30.4).toFixed(1)} months faster than USPTO average`
                    : isSlower ? `${(Math.abs(diff) / 30.4).toFixed(1)} months slower than USPTO average`
                    : 'Near USPTO average wait time';
                  return (
                    <>
                      <div className="relative h-2 bg-slate-100 rounded-full mb-2">
                        <div className="absolute top-0 h-full rounded-full" style={{ width: `${Math.min(100, (examiner.avg_days_to_first_oa! / 730) * 100)}%`, backgroundColor: color }} />
                        <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-400 rounded-full" style={{ left: `${(USPTO_AVG_DAYS_TO_FIRST_OA / 730) * 100}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 mb-3"><span>0 mo</span><span>12mo avg</span><span>24 mo</span></div>
                      <p className="text-xs font-semibold mb-1" style={{ color }}>{label}</p>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {isFaster ? 'Set client expectations for faster-than-average prosecution.'
                          : isSlower ? 'File early. Clients should expect a long wait before hearing anything.'
                          : 'Budget 10–14 months before the first office action.'}
                      </p>
                    </>
                  );
                })()}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <CardLabel>Data Quality & Coverage</CardLabel>
              <div className="space-y-2.5">
                {[
                  { dot: 'bg-green-400', text: 'USPTO PatEx dataset — 14M+ applications analyzed' },
                  { dot: 'bg-blue-400', text: 'Allowance rates based on 3-year rolling window' },
                  { dot: 'bg-green-400', text: 'OA rejection data through March 2025' },
                  { dot: 'bg-green-400', text: 'PTAB appeal decisions through April 2026 (live API)' },
                  ...(examiner.total_oas_analyzed ? [{ dot: 'bg-green-400', text: `${examiner.total_oas_analyzed.toLocaleString()} office actions analyzed for this examiner` }] : []),
                  { dot: examiner.total_applications && examiner.total_applications > 100 ? 'bg-green-400' : 'bg-amber-400', text: examiner.total_applications && examiner.total_applications > 100 ? `High confidence — ${examiner.total_applications.toLocaleString()} applications` : `Moderate sample — ${examiner.total_applications?.toLocaleString() ?? '—'} applications` },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${item.dot}`} />
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: BENCHMARKS ─────────────────────────────────────────────── */}
      {activeTab === 'benchmarks' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {artUnitStats && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
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
                    <p className={`text-sm font-semibold mb-5 ${diffColor}`}>
                      {diff >= 0 ? `+${diff.toFixed(1)}pp above` : `${diff.toFixed(1)}pp below`} art unit average · AU avg: {artUnitStats.avg_grant_rate.toFixed(1)}%
                    </p>
                    <div className="space-y-3 mb-5">
                      {bars.map(bar => (
                        <div key={bar.label}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className={bar.bold ? 'font-semibold text-slate-800' : 'text-slate-400'}>{bar.label}</span>
                            <span className={bar.bold ? 'font-bold text-slate-900' : 'text-slate-400'}>{bar.value.toFixed(1)}%</span>
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
                          <div className="text-center flex-1"><p className="text-2xl font-extrabold text-slate-900">{examiner.pendency_months.toFixed(1)} mo</p><p className="text-xs text-slate-400">This examiner</p></div>
                          <div className="text-center">{(() => { const d = examiner.pendency_months! - artUnitStats.avg_pendency_months; return <p className={`text-sm font-bold ${d > 2 ? 'text-red-500' : d < -2 ? 'text-green-500' : 'text-slate-400'}`}>{d > 0 ? `+${d.toFixed(1)}mo` : `${d.toFixed(1)}mo`}</p>; })()}<p className="text-xs text-slate-400">vs AU avg</p></div>
                          <div className="text-center flex-1"><p className="text-2xl font-extrabold text-slate-400">{artUnitStats.avg_pendency_months.toFixed(1)} mo</p><p className="text-xs text-slate-400">AU average</p></div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          <div className="space-y-4">
            {similar.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <CardLabel>Similar Examiners — Higher Allowance Rates</CardLabel>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Examiners in the same art unit with higher allowance rates. If you have flexibility in continuation routing or divisional filing strategy, these examiners may produce better outcomes.
                </p>
                <div className="space-y-2.5">
                  {similar.map((ex) => {
                    const ec = rateColor(ex.grant_rate_3yr);
                    return (
                      <Link key={ex.id} href={`/examiner/${ex.id}`}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{ex.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">AU {ex.art_unit_number} · {ex.pendency_months?.toFixed(1) ?? '—'} mo avg pendency</p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
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
                <p className="text-xs text-slate-400 mt-3 italic">Examiner assignment depends on filing details — consult your filing strategy before targeting specific examiners.</p>
              </div>
            )}

            <div className="rounded-2xl bg-slate-900 p-5 text-white">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full">Pro</span>
                <p className="text-xs font-bold uppercase tracking-widest opacity-75">Full Peer Benchmarking</p>
              </div>
              <p className="text-sm opacity-75 leading-relaxed mb-3">
                Rank this examiner among all {artUnitStats?.examiner_count ?? ''} examiners in Art Unit {examiner.art_unit_number} across allowance rate, pendency, interview success, and rejection patterns.
              </p>
              <button className="w-full text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition-all rounded-xl py-2.5">Upgrade to Pro</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: HISTORY ────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {showTrend && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <CardLabel>Allowance Rate Trend</CardLabel>
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
                    <p className="text-xs text-slate-500 leading-relaxed mt-4 italic">{trendNote}</p>
                  </>
                );
              })()}
            </div>
          )}

          {examiner.rejection_codes && (() => {
            const codes = examiner.rejection_codes!;
            const max = Math.max(codes.non_final, codes.final, 1);
            const nfPct = codes.total > 0 ? ((codes.non_final / codes.total) * 100).toFixed(0) : '0';
            const fPct = codes.total > 0 ? ((codes.final / codes.total) * 100).toFixed(0) : '0';
            const finalRatio = codes.total > 0 ? (codes.final / codes.total) * 100 : 0;
            return (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <CardLabel>Rejection Volume on Record</CardLabel>
                  <span className="text-sm font-bold text-slate-700 -mt-3">{codes.total.toLocaleString()} total</span>
                </div>
                <div className="space-y-4">
                  {[
                    { label: 'Non-Final Rejections', count: codes.non_final, pct: nfPct, color: '#f59e0b', note: 'Non-final rejections allow the applicant to amend claims and continue prosecution without additional fees.' },
                    { label: 'Final Rejections', count: codes.final, pct: fPct, color: '#ef4444', note: 'Final rejections close prosecution — applicants must file an RCE, appeal, or abandon. These are the costlier rejections.' },
                  ].map(bar => (
                    <div key={bar.label}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-semibold text-slate-700">{bar.label}</span>
                        <span className="font-bold text-slate-900">{bar.count.toLocaleString()} ({bar.pct}%)</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                        <div className="h-full rounded-full" style={{ width: `${(bar.count / max) * 100}%`, backgroundColor: bar.color }} />
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{bar.note}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 italic">
                    {finalRatio > 40 ? 'Above-average final rejection rate — prepare strong first responses to avoid prosecution escalating to finals.'
                      : finalRatio > 25 ? 'Moderate final rejection rate — some applications escalate, but most resolve through non-final amendment.'
                      : 'Below-average final rejection rate — most rejections are non-final, giving applicants more opportunity to amend.'}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── TAB 6: AI CHAT ─────────────────────────────────────────────────── */}
      {activeTab === 'chat' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="h-72 flex flex-col items-center justify-center gap-4 bg-slate-50 border-b border-slate-100">
            <div className="text-center px-8">
              <p className="text-base font-bold text-slate-700 mb-2">AI Examiner Assistant</p>
              <p className="text-sm text-slate-400 leading-relaxed max-w-md">
                Ask anything about {examiner.name}. Get prosecution strategy recommendations, appeal analysis, claim drafting tips, and cost planning — all based on this examiner's actual data.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-1 px-6">
              {[
                'Should I appeal this examiner?',
                'What claim language works best?',
                'How do I respond to a §103 rejection?',
                'What is the fastest path to allowance?',
                'How should I set client cost expectations?',
              ].map(q => (
                <button key={q} className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-all">{q}</button>
              ))}
            </div>
          </div>
          <div className="p-4 flex gap-3 items-center">
            <input
              type="text"
              placeholder={`Ask anything about ${examiner.name}...`}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
            />
            <button className="bg-blue-600 text-white text-sm font-bold px-5 py-3 rounded-xl hover:bg-blue-700 transition-all shrink-0">Send</button>
          </div>
          <div className="px-4 pb-3">
            <p className="text-xs text-slate-400 text-center">AI chat powered by Claude — available with Pro access</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Server component wrapper ─────────────────────────────────────────────────

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
  const formattedDate = examiner.updated_at
    ? new Date(examiner.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const pendencyDiff = examiner.pendency_months != null ? examiner.pendency_months - USPTO_AVG_PENDENCY : null;
  const pendencyContext = pendencyDiff != null
    ? Math.abs(pendencyDiff) > 3 ? `${pendencyDiff > 0 ? '+' : ''}${pendencyDiff.toFixed(1)}mo vs USPTO avg` : 'Near USPTO avg'
    : null;

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'Inter, sans-serif' }}>
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

        {/* Hero */}
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
              {formattedDate && <p className="text-xs text-slate-400 shrink-0">Data updated {formattedDate}</p>}
            </div>

            <div className="flex flex-col sm:flex-row gap-8 items-start">
              {examiner.grant_rate_3yr != null && (() => {
                const size = 148; const sw = 11;
                const r = (size - sw) / 2; const cx = size / 2;
                const circ = 2 * Math.PI * r;
                const clamped = Math.min(100, Math.max(0, rate));
                const fill = (clamped / 100) * circ;
                const approxGranted = examiner.total_applications ? Math.round((rate / 100) * examiner.total_applications) : null;
                return (
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
                      {examiner.grant_rate_percentile != null && <div className="mt-1"><PercentileBadge pct={examiner.grant_rate_percentile} label="Allowance rate" /></div>}
                    </div>
                  </div>
                );
              })()}

              <div className="flex-1 space-y-4 pt-1 w-full">
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
                        {diff >= 0 ? `${diff.toFixed(1)}pp above USPTO average` : `${Math.abs(diff).toFixed(1)}pp below USPTO average`}
                      </p>
                    </div>
                  );
                })()}

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
        </div>

        {/* Tabbed dashboard */}
        <ExaminerDashboard examiner={examiner} artUnitStats={artUnitStats} similar={similar} />
      </div>
    </div>
  );
}
