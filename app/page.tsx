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
      <div className="relative flex items-center">
        <span className="absolute left-5 text-slate-400 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder='Try: "John Smith" or "Sarah Johnson"'
          autoComplete="off"
          className="w-full pl-14 pr-36 py-5 rounded-2xl text-slate-900 placeholder-slate-400 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-lg border border-slate-200"
          style={{ fontFamily: 'Inter, sans-serif' }}
        />
        {isLoading ? (
          <span className="absolute right-4">
            <svg className="animate-spin text-slate-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </span>
        ) : (
          <button className="absolute right-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm">
            Search
          </button>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <ul role="listbox" className="absolute z-20 mt-2 w-full bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden">
          {results.map((examiner, i) => (
            <li key={examiner.id} role="option" aria-selected={i === activeIndex}
              onMouseDown={() => handleSelect(examiner)} onMouseEnter={() => setActiveIndex(i)}
              className={`flex items-center justify-between px-5 py-3.5 cursor-pointer text-sm transition-colors ${i === activeIndex ? 'bg-blue-50' : 'hover:bg-slate-50'} ${i !== 0 ? 'border-t border-slate-100' : ''}`}>
              <span className="font-medium text-slate-900">{examiner.name}</span>
              <div className="flex items-center gap-3 shrink-0">
                {examiner.grant_rate_3yr != null && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${examiner.grant_rate_3yr >= 70 ? 'bg-green-100 text-green-700' : examiner.grant_rate_3yr >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {examiner.grant_rate_3yr.toFixed(0)}% grant
                  </span>
                )}
                {examiner.art_unit_number && <span className="text-xs text-slate-400">AU {examiner.art_unit_number}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const stats = [
  { value: '18,110', label: 'Active Examiners', icon: '👤' },
  { value: '14M+', label: 'Applications Analyzed', icon: '📊' },
  { value: '100%', label: 'USPTO Coverage', icon: '🏛️' },
  { value: 'Free', label: 'Basic Access', icon: '🔓' },
];

const features = [
  {
    icon: '📈',
    title: 'Grant Rate Analytics',
    desc: 'See 3-year grant rates, USPTO benchmarks, and trend lines — instantly, for any examiner.',
  },
  {
    icon: '⚖️',
    title: 'Rejection Patterns',
    desc: 'Understand the ratio of non-final to final rejections. Know what you\'re walking into.',
  },
  {
    icon: '🤝',
    title: 'Interview Intelligence',
    desc: 'Track interview allowance rates. Know if requesting an interview will actually move the needle.',
  },
  {
    icon: '✨',
    title: 'AI Strategy Summaries',
    desc: 'Plain-language prosecution recommendations powered by Claude AI. No more guessing.',
  },
  {
    icon: '📉',
    title: 'Trend Analysis',
    desc: 'Is your examiner getting stricter over time? The grant rate trend tells the full story.',
  },
  {
    icon: '🏆',
    title: 'Art Unit Benchmarking',
    desc: 'Compare your examiner to peers in the same art unit. Coming soon for Pro users.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Sticky nav */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Image src="/logo.png" alt="PatentIQ" width={130} height={36} className="object-contain" priority />
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Features</a>
            <a href="#how" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">How it works</a>
            <a href="#pricing" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <button className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-4 py-2">
              Sign in
            </button>
            <button className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all px-5 py-2 rounded-xl shadow-sm">
              Get started free
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 flex flex-col items-center text-center bg-white">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          USPTO Examiner Intelligence Platform
        </div>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.05] max-w-4xl mb-6" style={{ fontFamily: 'DM Sans, Inter, sans-serif' }}>
          Know your examiner<br />
          <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">before you file.</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-500 max-w-xl leading-relaxed mb-10">
          Search 18,110 USPTO examiners. See grant rates, rejection patterns, interview stats, and AI-powered prosecution strategy — in seconds.
        </p>

        <div className="w-full max-w-2xl mb-6">
          <ExaminerSearch />
        </div>

        <p className="text-xs text-slate-400 mb-10">
          No account required · Free for basic stats · Trusted by patent practitioners
        </p>

        {/* Stats row */}
        <div className="flex flex-wrap justify-center gap-8 mt-4 pt-10 border-t border-slate-100 w-full max-w-2xl">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl font-extrabold text-slate-900">{s.value}</span>
              <span className="text-xs text-slate-400 font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="py-24 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">What you get</p>
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, Inter, sans-serif' }}>
              Everything you need to prosecute smarter
            </h2>
            <p className="text-slate-500 text-lg max-w-lg mx-auto">Built for solo practitioners, boutique firms, and anyone who wants a data edge.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-7 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Simple process</p>
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, Inter, sans-serif' }}>
              From search to strategy in 30 seconds
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { n: '01', title: 'Search any examiner', desc: 'Type a name — find any of the 18,110 active USPTO patent examiners instantly.' },
              { n: '02', title: 'Analyze their data', desc: 'View grant rates, rejection ratios, interview success rates, and multi-year trends.' },
              { n: '03', title: 'Get your strategy', desc: 'Receive AI-generated prosecution recommendations tailored to this exact examiner.' },
            ].map((step) => (
              <div key={step.n} className="relative">
                <div className="text-7xl font-black text-slate-100 leading-none mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>{step.n}</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="py-24 px-6 bg-slate-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-extrabold text-white mb-4" style={{ fontFamily: 'DM Sans, Inter, sans-serif' }}>
            Start for free. Upgrade when you&apos;re ready.
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-lg mx-auto">
            Basic examiner search is free forever. Pro unlocks AI summaries, art unit benchmarking, and saved searches.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-base font-bold transition-all shadow-lg">
              Search Examiners Free →
            </button>
            <button className="px-8 py-4 rounded-2xl border border-white/10 hover:bg-white/5 text-slate-300 text-base font-semibold transition-all">
              View Pro pricing
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Image src="/logo.png" alt="PatentIQ" width={100} height={28} className="object-contain opacity-50" />
          <p className="text-xs text-slate-400 text-center">
            Data sourced from USPTO PatEx dataset · Not legal advice · © {new Date().getFullYear()} PatentIQ
          </p>
          <div className="flex gap-6 text-xs text-slate-400">
            <a href="#" className="hover:text-slate-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
