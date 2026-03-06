'use client';

import { useState, useRef, useEffect } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { searchAddress, type ThaiAddress } from '@/lib/thailand-address';

interface AddressAutocompleteProps {
  onSelect: (address: ThaiAddress) => void;
  initialSubDistrict?: string;
  initialDistrict?: string;
  initialProvince?: string;
  initialPostalCode?: string;
}

export default function AddressAutocomplete({
  onSelect,
  initialSubDistrict = '',
  initialDistrict = '',
  initialProvince = '',
  initialPostalCode = '',
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ThaiAddress[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<ThaiAddress | null>(
    initialSubDistrict ? { subDistrict: initialSubDistrict, district: initialDistrict, province: initialProvince, postalCode: initialPostalCode } : null
  );
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.length >= 2) {
      const found = searchAddress(value, 15);
      setResults(found);
      setIsOpen(found.length > 0);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  };

  const handleSelect = (addr: ThaiAddress) => {
    setSelected(addr);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    onSelect(addr);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    onSelect({ subDistrict: '', district: '', province: '', postalCode: '' });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
        <span className="flex items-center gap-1.5">
          <MapPin size={14} /> ค้นหาที่อยู่ไทย
        </span>
        <span className="text-xs font-normal text-surface-400 ml-5">พิมพ์ชื่อแขวง/เขต/จังหวัด/รหัสไปรษณีย์</span>
      </label>

      {selected ? (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-primary-200 dark:border-primary-800
                        bg-primary-50 dark:bg-primary-900/20 text-sm">
          <MapPin size={16} className="text-primary-500 shrink-0" />
          <span className="flex-1 text-surface-800 dark:text-white">
            {selected.subDistrict}, {selected.district}, {selected.province} {selected.postalCode}
          </span>
          <button onClick={handleClear} type="button"
            className="p-1 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-800 cursor-pointer">
            <X size={14} className="text-surface-400" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => { if (results.length > 0) setIsOpen(true); }}
            placeholder="เช่น สีลม, จตุจักร, 10900..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                       bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm placeholder:text-surface-400
                       focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
          />
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-surface-200 dark:border-surface-700
                        bg-white dark:bg-surface-800 shadow-xl animate-fade-in">
          {results.map((addr, i) => (
            <button key={`${addr.subDistrict}-${addr.district}-${i}`}
              type="button"
              onClick={() => handleSelect(addr)}
              className="w-full px-4 py-3 text-left hover:bg-primary-50 dark:hover:bg-primary-900/20
                         border-b border-surface-100 dark:border-surface-700 last:border-0
                         transition-colors cursor-pointer">
              <p className="text-sm text-surface-800 dark:text-white">
                <span className="font-medium">{addr.subDistrict}</span>
                {' '}<span className="text-surface-400">›</span>{' '}
                {addr.district}
                {' '}<span className="text-surface-400">›</span>{' '}
                {addr.province}
              </p>
              <p className="text-xs text-surface-500 mt-0.5">📮 {addr.postalCode}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
