'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface ExaminerResult {
  id: string;
  name: string;
  art_unit_number?: string;
  grant_rate_3yr?: number;
}

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExaminerResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data: ExaminerResult[] = await res.json();
      setResults(data);
      setIsOpen(data.length > 0);
    } catch {
      setResults([]);
      setIsOpen(false);
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
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const pills = [
    { label: '18,110 Examiners' },
    { label: '14M+ Applications Analyzed' },
    { label: 'Free to Search' },
  ];

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-xl flex flex-col items-center gap-6">

        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 tracking-tight">PatentIQ</h1>
          <p className="mt-2 text-gray-500 text-lg">
            Search 18,110 USPTO patent examiners by name
          </p>
        </div>

        <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="relative" ref={containerRef}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
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
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {isLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </span>
              )}
            </div>

            {isOpen && results.length > 0 && (
              <ul
                role="listbox"
                className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
              >
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
                      <span className="text-xs text-gray-400 ml-3 shrink-0">
                        Art Unit {examiner.art_unit_number}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {pills.map((pill) => (
            <span
              key={pill.label}
              className="px-4 py-1.5 rounded-full bg-white border border-gray-200 text-sm text-gray-500 font-medium shadow-sm"
            >
              {pill.label}
            </span>
          ))}
        </div>

      </div>
    </main>
  );
}
