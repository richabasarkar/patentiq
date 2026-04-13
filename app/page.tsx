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
          aria-label="Search patent examiners"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          className="w-full pl-11 pr-4 py-4 rounded-xl border border-white/10 text-white placeholder-gray-500 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/5 backdrop-blur-sm shadow-lg"
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
        <ul role="listbox" className="absolute z-20 mt-2 w-full bg-[#0f1e35] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          {results.map((examiner, i) => (
            <li
              key={examiner.id}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => handleSelect(examiner)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex items-center justify-between px-4 py-3 cursor-pointer text-sm transition-colors ${
                i === activeIndex ? 'bg-white/10' : 'hover:bg-white/5'
              } ${i !== 0 ? 'border-t border-white/5' : ''}`}
            >
              <span className="font-medium text-white">{examiner.name}</span>
              {examiner.art_unit_number && (
                <span className="text-xs text-gray-400 ml-3 shrink-0">Art Unit {examiner.art_unit_number}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const steps = [
  { n: '1', title: 'Search any examiner', desc: 'Look up any of the 18,110 active USPTO patent examiners by name in seconds.' },
  { n: '2', title: 'See their data', desc: 'Instantly view grant rate, pendency, rejection patterns, and interview success rates.' },
  { n: '3', title: 'File smarter', desc: 'Build a tailored prosecution strategy before you respond to an office action.' },
];

const features = [
  { stat: '18,110', label: 'Examiners', desc: 'Complete USPTO examiner database — every active examiner, fully searchable.' },
  { stat: 'Free', label: 'To Search', desc: 'No account, no paywall. Basic examiner stats are open to everyone.' },
  { stat: 'AI', label: 'Summaries', desc: 'Plain-language prosecution strategy summaries powered by Claude AI.' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0a1628' }}>

      {/* Nav */}
      <header className="w-full border-b border-white/5 px-4 sm:px-6" style={{ backgroundColor: '#0a1628' }}>
        <div className="max-w-6xl mx-auto h-16 flex items-center justify-between">
          <Image src="/logo.png" alt="PatentIQ" width={140} height={40} className="object-contain" />
          <button className="text-sm font-medium text-gray-300 border border-white/10 rounded-lg px-4 py-1.5 hover:bg-white/5 transition-colors">
            Sign In
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="w-full px-4 sm:px-6 pt-24 pb-20 sm:pt-32 sm:pb-28 flex flex-col items-center text-center"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.12) 0%, transparent 70%)' }}>
        <span className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-5 px-3 py-1 rounded-full border border-blue-400/20 bg-blue-400/5">
          USPTO Examiner Intelligence
        </span>
        <h1 className="text-4xl sm:text-6xl font-bold text-white tracking-tight leading-tight max-w-3xl">
          Make smarter patent<br className="hidden sm:block" />
          <span className="text-blue-400"> prosecution decisions</span>
        </h1>
        <p className="mt-5 text-gray-400 text-base sm:text-lg max-w-lg leading-relaxed">
          Search 18,110 USPTO patent examiners — see grant rates, rejection patterns, interview stats, and AI-powered strategy in seconds.
        </p>

        <div className="w-full max-w-xl mt-10">
          <ExaminerSearch />
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {['18,110 Examiners', '14M+ Applications Analyzed', 'Free to Search'].map((label) => (
            <span key={label} className="px-4 py-1.5 rounded-full border border-white/10 text-sm text-gray-400 font-medium bg-white/5">
              {label}
            </span>
          ))}
        </div>

        {/* Example search hint */}
        <p className="mt-4 text-xs text-gray-600">
          Try searching: <span className="text-gray-400 cursor-pointer hover:text-blue-400 transition-colors">"John Smith"</span> or <span className="text-gray-400 cursor-pointer hover:text-blue-400 transition-colors">"Sarah Johnson"</span>
        </p>
      </section>

      {/* How it works */}
      <section className="w-full px-4 sm:px-6 py-20 border-t border-white/5" style={{ backgroundColor: '#0d1f38' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl sm:text-3xl font-bold text-white mb-2">How it works</h2>
          <p className="text-center text-gray-500 text-sm sm:text-base mb-14">Three steps from search to strategy.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            {steps.map((step) => (
              <div key={step.n} className="flex flex-col items-center text-center gap-4">
                <div className="w-11 h-11 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-bold flex items-center justify-center shrink-0">
                  {step.n}
                </div>
                <h3 className="text-base font-semibold text-white">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why PatentIQ */}
      <section className="w-full px-4 sm:px-6 py-20 border-t border-white/5" style={{ backgroundColor: '#0a1628' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl sm:text-3xl font-bold text-white mb-2">Why PatentIQ</h2>
          <p className="text-center text-gray-500 text-sm sm:text-base mb-14">Built for practitioners who want an edge.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.label} className="rounded-2xl border border-white/8 px-7 py-7 flex flex-col gap-4 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all" style={{ backgroundColor: '#0d1f38' }}>
                <div>
                  <span className="text-3xl font-bold text-white">{f.stat}</span>
                  {' '}
                  <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{f.label}</span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="w-full px-4 sm:px-6 py-16 border-t border-white/5" style={{ backgroundColor: '#0d1f38' }}>
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-5">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Ready to prosecute smarter?</h2>
          <p className="text-gray-500 text-sm sm:text-base">Search any USPTO examiner free — no account required.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href="#" className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-lg">
              Search Examiners →
            </a>
            <a href="#" className="px-6 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-gray-300 text-sm font-semibold transition-colors">
              View Pricing
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 px-4 sm:px-6 py-8 mt-auto" style={{ backgroundColor: '#0a1628' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Image src="/logo.png" alt="PatentIQ" width={100} height={28} className="object-contain opacity-60" />
          <p className="text-xs text-gray-600 text-center">
            Data sourced from USPTO PatEx dataset · Not legal advice · © {new Date().getFullYear()} PatentIQ
          </p>
        </div>
      </footer>

    </div>
  );
}
