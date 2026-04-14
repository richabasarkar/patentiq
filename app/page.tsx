'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface ExaminerResult {
  id: string;
  name: string;
  art_unit_number?: string;
  grant_rate_3yr?: number;
}

function ExaminerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExaminerResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setIsOpen(false); return; }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data: ExaminerResult[] = await res.json();
      setResults(data);
      setIsOpen(data.length > 0);
    } catch {
      setResults([]); setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (examiner: ExaminerResult) => {
    setIsOpen(false);
    setQuery('');
    router.push(`/examiner/${examiner.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); handleSelect(results[activeIndex]); }
    else if (e.key === 'Escape') { setIsOpen(false); setActiveIndex(-1); }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { return () => { if (debounceRef.current) clearTimeout(debounceRef.current); }; }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search by examiner name…"
          autoComplete="off"
          className="w-full pl-11 pr-4 py-4 rounded-2xl border border-gray-200 text-gray-900 placeholder-gray-400 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
        />
        {isLoading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2">
            <svg className="animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </span>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <ul role="listbox" className="absolute z-20 mt-2 w-full bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden">
          {results.map((examiner, i) => (
            <li key={examiner.id} role="option" aria-selected={i === activeIndex}
              onMouseDown={() => handleSelect(examiner)} onMouseEnter={() => setActiveIndex(i)}
              className={`flex items-center justify-between px-4 py-3 cursor-pointer text-sm transition-colors ${i === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'} ${i !== 0 ? 'border-t border-gray-100' : ''}`}>
              <span className="font-medium text-gray-900">{examiner.name}</span>
              {examiner.art_unit_number && <span className="text-xs text-gray-400 ml-3 shrink-0">Art Unit {examiner.art_unit_number}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const steps = [
  { n: '01', title: 'Search any examiner', desc: 'Look up any of the 18,110 active USPTO patent examiners by name in seconds.' },
  { n: '02', title: 'See their data', desc: 'Instantly view grant rate, pendency, rejection patterns, and interview success rates.' },
  { n: '03', title: 'File smarter', desc: 'Build a tailored prosecution strategy before you respond to an office action.' },
];

const features = [
  { stat: '18,110', label: 'Examiners', desc: 'Complete USPTO examiner database — every active examiner, fully searchable.', icon: '🗂️' },
  { stat: 'Free', label: 'To Search', desc: 'No account, no paywall. Basic examiner stats are open to everyone.', icon: '🔓' },
  { stat: 'AI', label: 'Summaries', desc: 'Plain-language prosecution strategy summaries powered by Claude AI.', icon: '✨' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Nav — white, clean */}
      <header className="w-full bg-white border-b border-gray-100 px-6 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto h-16 flex items-center justify-between">
          <Image src="/logo.png" alt="PatentIQ" width={130} height={36} className="object-contain" />
          <nav className="hidden sm:flex items-center gap-8 text-sm font-medium text-gray-500">
            <a href="#how" className="hover:text-gray-900 transition-colors">How it works</a>
            <a href="#why" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
          </nav>
          <button className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors rounded-xl px-5 py-2 shadow-sm">
            Sign In
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="w-full px-6 pt-28 pb-24 flex flex-col items-center text-center bg-white">
        <span className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-6 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100">
          USPTO Examiner Intelligence
        </span>
        <h1 className="text-5xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1] max-w-3xl">
          Make smarter patent<br />
          <span className="text-blue-600">prosecution decisions</span>
        </h1>
        <p className="mt-6 text-gray-500 text-lg max-w-lg leading-relaxed">
          Search 18,110 USPTO patent examiners — see grant rates, rejection patterns, interview stats, and AI-powered strategy in seconds.
        </p>

        <div className="w-full max-w-lg mt-10">
          <ExaminerSearch />
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-6">
          {['18,110 Examiners', '14M+ Applications Analyzed', 'Free to Search'].map((label) => (
            <span key={label} className="px-4 py-1.5 rounded-full bg-slate-50 border border-gray-200 text-sm text-gray-500 font-medium">
              {label}
            </span>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-400">
          Try: <span className="text-blue-500 cursor-pointer">"John Smith"</span> or <span className="text-blue-500 cursor-pointer">"Sarah Johnson"</span>
        </p>
      </section>

      {/* How it works */}
      <section id="how" className="w-full px-6 py-24 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">How it works</h2>
            <p className="text-gray-500 text-base max-w-md mx-auto">Three steps from search to strategy.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.n} className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col gap-4 hover:shadow-md transition-shadow">
                <span className="text-4xl font-black text-blue-100 leading-none">{step.n}</span>
                <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why PatentIQ */}
      <section id="why" className="w-full px-6 py-24 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">Why PatentIQ</h2>
            <p className="text-gray-500 text-base max-w-md mx-auto">Built for practitioners who want an edge.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.label} className="rounded-3xl p-8 flex flex-col gap-4 bg-slate-50 border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                <span className="text-3xl">{f.icon}</span>
                <div>
                  <span className="text-3xl font-black text-slate-900">{f.stat}</span>
                  {' '}
                  <span className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{f.label}</span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="w-full px-6 py-24 bg-slate-900">
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Ready to prosecute smarter?</h2>
          <p className="text-gray-400 text-base">Search any USPTO examiner free — no account required.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href="#" className="px-7 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors shadow-lg">
              Search Examiners →
            </a>
            <a href="#" className="px-7 py-3 rounded-2xl border border-white/10 hover:bg-white/5 text-gray-300 text-sm font-semibold transition-colors">
              View Pricing
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-gray-100 px-6 py-8 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Image src="/logo.png" alt="PatentIQ" width={100} height={28} className="object-contain opacity-60" />
          <p className="text-xs text-gray-400 text-center">
            Data sourced from USPTO PatEx dataset · Not legal advice · © {new Date().getFullYear()} PatentIQ
          </p>
        </div>
      </footer>

    </div>
  );
}
