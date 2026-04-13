'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface ExaminerResult {
  id: string;
  name: string;
  art_unit_number?: string;
  grant_rate_3yr?: number;
}

// ─── Search autocomplete — logic untouched ────────────────────────────────────

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
          className="w-full pl-11 pr-4 py-4 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
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
        <ul role="listbox" className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {results.map((examiner, i) => (
            <li
              key={examiner.id}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => handleSelect(examiner)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex items-center justify-between px-4 py-3 cursor-pointer text-sm transition-colors ${
                i === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
              } ${i !== 0 ? 'border-t border-gray-100' : ''}`}
            >
              <span className="font-medium text-gray-900">{examiner.name}</span>
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

// ─── Static sections ──────────────────────────────────────────────────────────

const steps = [
  {
    n: '1',
    title: 'Search any examiner',
    desc: 'Look up any of the 18,110 active USPTO patent examiners by name in seconds.',
  },
  {
    n: '2',
    title: 'See their data',
    desc: 'Instantly view grant rate, average pendency, total applications, and prosecution patterns.',
  },
  {
    n: '3',
    title: 'File smarter',
    desc: 'Build a tailored prosecution strategy before you respond to an office action.',
  },
];

const features = [
  {
    stat: '18,110',
    label: 'Examiners',
    desc: 'Complete USPTO examiner database — every active examiner, fully searchable.',
  },
  {
    stat: 'Free',
    label: 'To Search',
    desc: 'No account, no paywall. Basic examiner stats are open to everyone.',
  },
  {
    stat: 'Big-firm',
    label: 'Intel',
    desc: 'The same prosecution data large firms pay thousands for, available to all.',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Nav */}
      <header className="w-full bg-white border-b border-gray-200 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900 tracking-tight">PatentIQ</span>
          <button className="text-sm font-medium text-gray-600 border border-gray-200 rounded-lg px-4 py-1.5 hover:bg-gray-50 transition-colors">
            Sign In
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="w-full px-4 sm:px-6 pt-20 pb-16 sm:pt-28 sm:pb-20 flex flex-col items-center text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-4">
          USPTO Examiner Intelligence
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-tight max-w-2xl">
          Make smarter patent<br className="hidden sm:block" /> prosecution decisions
        </h1>
        <p className="mt-4 text-gray-500 text-base sm:text-lg max-w-md">
          Search 18,110 USPTO patent examiners by name — see grant rates, pendency data, and prosecution patterns instantly.
        </p>

        {/* Search */}
        <div className="w-full max-w-xl mt-10">
          <ExaminerSearch />
        </div>

        {/* Stat pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {[
            '18,110 Examiners',
            '14M+ Applications Analyzed',
            'Free to Search',
          ].map((label) => (
            <span
              key={label}
              className="px-4 py-1.5 rounded-full bg-white border border-gray-200 text-sm text-gray-500 font-medium shadow-sm"
            >
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="w-full px-4 sm:px-6 py-16 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl sm:text-3xl font-bold text-gray-900 mb-2">How it works</h2>
          <p className="text-center text-gray-500 text-sm sm:text-base mb-12">Three steps from search to strategy.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.n} className="flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {step.n}
                </div>
                <h3 className="text-base font-semibold text-gray-900">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why PatentIQ */}
      <p className="text-center text-gray-500 text-sm sm:text-base mb-12">Built for practitioners who want an edge.</p>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Why PatentIQ</h2>
          <p className="text-center text-gray-500 text-sm sm:text-base mb-12">Built for practitioners who want an edge.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.label}
                className="bg-white rounded-2xl border border-gray-200 px-8 py-8 flex flex-col gap-4 hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <span className="text-blue-600 text-lg font-bold">{f.stat.charAt(0)}</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-gray-900">{f.stat}</span>
                  {' '}
                  <span className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{f.label}</span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-gray-200 bg-white px-4 sm:px-6 py-6 mt-auto">
        <p className="text-center text-xs text-gray-400">
          PatentIQ · Data sourced from USPTO PatEx dataset · Not legal advice
        </p>
      </footer>

    </div>
  );
}