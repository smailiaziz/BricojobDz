import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronRight,
  MapPin, 
  ShieldCheck, 
  Check, 
  Clock, 
  Star, 
  Award, 
  ArrowDownNarrowWide, 
  ArrowUpNarrowWide,
  SlidersHorizontal,
  Zap
} from 'lucide-react';
import { Artisan, ServiceCategory } from '../types';
import { getWilayaFilterOptions, getCommunesByWilaya, getAllWilayas } from '../data';
import { normalizeArabicText, isArtisan247 } from '../utils';

export interface FilterDraftValues {
  wilaya: string;
  commune: string;
  category: string;
  sortBy: 'default' | 'rating' | 'experience' | 'price-asc' | 'price-desc';
  availableNowOnly: boolean;
  emergency247Only: boolean;
  verifiedOnly: boolean;
}

interface AdvancedFilterModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onApply: (draft: FilterDraftValues) => void;
  artisans: Artisan[];
  categories: ServiceCategory[];
  searchText?: string;
  initialWilaya: string;
  initialCommune: string;
  initialCategory: string;
  initialSortBy: 'default' | 'rating' | 'experience' | 'price-asc' | 'price-desc';
  initialAvailableNowOnly: boolean;
  initialEmergency247Only: boolean;
  initialVerifiedOnly: boolean;
}

export const AdvancedFilterModal: React.FC<AdvancedFilterModalProps> = ({
  isOpen,
  onCancel,
  onApply,
  artisans,
  categories,
  searchText = '',
  initialWilaya,
  initialCommune,
  initialCategory,
  initialSortBy,
  initialAvailableNowOnly,
  initialEmergency247Only,
  initialVerifiedOnly,
}) => {
  // 1. Local Draft State (does not affect search results until applied)
  const [draftWilaya, setDraftWilaya] = useState(initialWilaya);
  const [draftCommune, setDraftCommune] = useState(initialCommune);
  const [draftCategory, setDraftCategory] = useState(initialCategory);
  const [draftSortBy, setDraftSortBy] = useState(initialSortBy);
  const [draftAvailableNowOnly, setDraftAvailableNowOnly] = useState(initialAvailableNowOnly);
  const [draftEmergency247Only, setDraftEmergency247Only] = useState(initialEmergency247Only);
  const [draftVerifiedOnly, setDraftVerifiedOnly] = useState(initialVerifiedOnly);

  // Synchronize draft state with incoming active filters whenever opened
  useEffect(() => {
    if (isOpen) {
      setDraftWilaya(initialWilaya);
      setDraftCommune(initialCommune);
      setDraftCategory(initialCategory);
      setDraftSortBy(initialSortBy);
      setDraftAvailableNowOnly(initialAvailableNowOnly);
      setDraftEmergency247Only(initialEmergency247Only);
      setDraftVerifiedOnly(initialVerifiedOnly);
    }
  }, [
    isOpen,
    initialWilaya,
    initialCommune,
    initialCategory,
    initialSortBy,
    initialAvailableNowOnly,
    initialEmergency247Only,
    initialVerifiedOnly,
  ]);

  // Handle Wilaya change & auto-reset commune
  const handleWilayaChange = (wilaya: string) => {
    setDraftWilaya(wilaya);
    setDraftCommune('الكل');
  };

  const availableCommunes = useMemo(() => {
    return getCommunesByWilaya(draftWilaya);
  }, [draftWilaya]);

  const wilayaOptions = useMemo(() => {
    return getWilayaFilterOptions();
  }, []);

  const wilayaCount = useMemo(() => {
    return getAllWilayas().length;
  }, []);

  // Compute live matching artisan count for the draft state
  const draftResultsCount = useMemo(() => {
    let result = [...artisans];

    if (draftCategory !== 'all') {
      result = result.filter(a => a.category === draftCategory);
    }

    if (draftWilaya !== 'الكل') {
      result = result.filter(a => a.wilaya === draftWilaya);
    }

    if (draftCommune !== 'الكل') {
      result = result.filter(a => a.city === draftCommune);
    }

    if (draftVerifiedOnly) result = result.filter(a => a.verified);
    if (draftAvailableNowOnly) result = result.filter(a => a.availableNow);
    if (draftEmergency247Only) result = result.filter(a => isArtisan247(a));

    if (searchText.trim()) {
      const query = normalizeArabicText(searchText.trim());
      result = result.filter(a => 
        normalizeArabicText(a.name).includes(query) || 
        normalizeArabicText(a.profession).includes(query) ||
        normalizeArabicText(a.city).includes(query) ||
        normalizeArabicText(a.wilaya).includes(query) ||
        (a.services && a.services.some(s => normalizeArabicText(s).includes(query)))
      );
    }

    return result.length;
  }, [artisans, searchText, draftCategory, draftWilaya, draftCommune, draftVerifiedOnly, draftAvailableNowOnly, draftEmergency247Only]);

  // Count active filters within the draft
  const draftActiveFiltersCount = useMemo(() => {
    let count = 0;
    if (draftWilaya !== 'الكل') count++;
    if (draftCommune !== 'الكل') count++;
    if (draftCategory !== 'all') count++;
    if (draftAvailableNowOnly) count++;
    if (draftEmergency247Only) count++;
    if (draftVerifiedOnly) count++;
    if (draftSortBy !== 'default') count++;
    return count;
  }, [draftWilaya, draftCommune, draftCategory, draftAvailableNowOnly, draftEmergency247Only, draftVerifiedOnly, draftSortBy]);

  const handleToggleSort = (type: 'rating' | 'experience' | 'price-asc' | 'price-desc') => {
    if (draftSortBy === type) {
      setDraftSortBy('default');
    } else {
      setDraftSortBy(type);
    }
  };

  const handleDraftReset = () => {
    setDraftWilaya('الكل');
    setDraftCommune('الكل');
    setDraftCategory('all');
    setDraftSortBy('default');
    setDraftVerifiedOnly(false);
    setDraftAvailableNowOnly(false);
    setDraftEmergency247Only(false);
  };

  const handleApply = () => {
    onApply({
      wilaya: draftWilaya,
      commune: draftCommune,
      category: draftCategory,
      sortBy: draftSortBy,
      availableNowOnly: draftAvailableNowOnly,
      emergency247Only: draftEmergency247Only,
      verifiedOnly: draftVerifiedOnly,
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      className="w-full min-h-[calc(100dvh-5rem)] bg-[#FAF8F5] flex flex-col font-['Cairo',sans-serif] pb-36 animate-fade-in"
      dir="rtl"
    >
      {/* 1. Header: Back/Cancel, Title, & Reset */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-4 py-3.5 flex items-center justify-between shadow-2xs">
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 -mr-1.5 text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 transition flex items-center gap-1 cursor-pointer min-h-[44px]"
          aria-label="إلغاء والعودة"
        >
          <ChevronRight className="w-5 h-5 text-stone-700" />
          <span className="text-xs font-bold text-stone-700">إلغاء</span>
        </button>

        <div className="flex items-center gap-2">
          <h1 className="text-base font-black text-stone-900">تصفية النتائج</h1>
          {draftActiveFiltersCount > 0 && (
            <span className="bg-emerald-700 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full">
              {draftActiveFiltersCount}
            </span>
          )}
        </div>

        {draftActiveFiltersCount > 0 ? (
          <button
            type="button"
            onClick={handleDraftReset}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer whitespace-nowrap"
          >
            إعادة ضبط الفلاتر
          </button>
        ) : (
          <div className="w-12" />
        )}
      </header>

      {/* 2. Scrollable Body: Location, Specialty, Criteria, Sorting */}
      <div className="p-4 sm:p-5 space-y-4 flex-1">
        
        {/* Section 1: Geographic Location (Wilaya & Commune) */}
        <div className="space-y-3 bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-black text-stone-900">
            <MapPin className="w-4 h-4 text-emerald-700" />
            <span>الموقع الجغرافي</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Wilaya Selector */}
            <div>
              <label className="block text-[11px] font-bold text-stone-600 mb-1.5">
                الولاية ({wilayaCount} ولاية)
              </label>
              <select
                value={draftWilaya}
                onChange={(e) => handleWilayaChange(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold text-stone-800 focus:outline-none focus:border-emerald-700 focus:bg-white transition cursor-pointer"
              >
                {wilayaOptions.map(w => (
                  <option key={w} value={w}>
                    {w === 'الكل' ? `جميع الولايات (${wilayaCount})` : w}
                  </option>
                ))}
              </select>
            </div>

            {/* Commune Selector */}
            <div>
              <label className="block text-[11px] font-bold text-stone-600 mb-1.5">
                البلدية أو الدائرة
              </label>
              <select
                disabled={draftWilaya === 'الكل'}
                value={draftCommune}
                onChange={(e) => setDraftCommune(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold text-stone-800 focus:outline-none focus:border-emerald-700 focus:bg-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="الكل">
                  {draftWilaya === 'الكل' ? 'اختر الولاية أولاً' : `جميع بلديات ${draftWilaya}`}
                </option>
                {availableCommunes.map(comm => (
                  <option key={comm} value={comm}>
                    {comm}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Specialty / Category */}
        <div className="space-y-3 bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-black text-stone-900">
            <SlidersHorizontal className="w-4 h-4 text-emerald-700" />
            <span>التخصص أو نوع الخدمة</span>
          </div>

          <select
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold text-stone-800 focus:outline-none focus:border-emerald-700 focus:bg-white transition cursor-pointer"
          >
            <option value="all">جميع التخصصات</option>
            {categories
              .filter(c => c.id !== 'all')
              .map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>

        {/* Section 3: Criteria & Verification */}
        <div className="space-y-2.5">
          <span className="block text-xs font-black text-stone-900 px-1">
            المعايير والموثوقية
          </span>

          {/* Available Now */}
          <label className={`flex items-center justify-between p-3.5 rounded-2xl border transition cursor-pointer ${
            draftAvailableNowOnly 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-600/40' 
              : 'bg-white border-stone-200/80 hover:bg-stone-50'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-stone-900">متاحون الآن</span>
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              </div>
            </div>
            <input
              type="checkbox"
              checked={draftAvailableNowOnly}
              onChange={(e) => setDraftAvailableNowOnly(e.target.checked)}
              className="w-5 h-5 text-emerald-700 rounded-lg focus:ring-emerald-700 cursor-pointer accent-emerald-700"
            />
          </label>

          {/* 24/7 Emergency */}
          <label className={`flex items-center justify-between p-3.5 rounded-2xl border transition cursor-pointer ${
            draftEmergency247Only 
              ? 'bg-amber-50 text-amber-900 border-amber-500/40' 
              : 'bg-white border-stone-200/80 hover:bg-stone-50'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-stone-900">طوارئ 24/7</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={draftEmergency247Only}
              onChange={(e) => setDraftEmergency247Only(e.target.checked)}
              className="w-5 h-5 text-amber-600 rounded-lg focus:ring-amber-600 cursor-pointer accent-amber-600"
            />
          </label>

          {/* Verified Only */}
          <label className={`flex items-center justify-between p-3.5 rounded-2xl border transition cursor-pointer ${
            draftVerifiedOnly 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-600/40' 
              : 'bg-white border-stone-200/80 hover:bg-stone-50'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-stone-900 block">
                  موثوقون فقط
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={draftVerifiedOnly}
              onChange={(e) => setDraftVerifiedOnly(e.target.checked)}
              className="w-5 h-5 text-emerald-700 rounded-lg focus:ring-emerald-700 cursor-pointer accent-emerald-700"
            />
          </label>
        </div>

        {/* Section 4: Results Sorting */}
        <div className="space-y-2.5">
          <span className="block text-xs font-black text-stone-900 px-1">
            ترتيب النتائج
          </span>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleToggleSort('rating')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border cursor-pointer ${
                draftSortBy === 'rating'
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                  : 'bg-white text-stone-700 border-stone-200/80 hover:bg-stone-50'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>الأعلى تقييماً</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleSort('experience')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border cursor-pointer ${
                draftSortBy === 'experience'
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                  : 'bg-white text-stone-700 border-stone-200/80 hover:bg-stone-50'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>الأكثر خبرة</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleSort('price-asc')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border cursor-pointer ${
                draftSortBy === 'price-asc'
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                  : 'bg-white text-stone-700 border-stone-200/80 hover:bg-stone-50'
              }`}
            >
              <ArrowDownNarrowWide className="w-3.5 h-3.5" />
              <span>الأقل سعراً</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleSort('price-desc')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border cursor-pointer ${
                draftSortBy === 'price-desc'
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                  : 'bg-white text-stone-700 border-stone-200/80 hover:bg-stone-50'
              }`}
            >
              <ArrowUpNarrowWide className="w-3.5 h-3.5" />
              <span>الأعلى سعراً</span>
            </button>
          </div>
        </div>

      </div>

      {/* 3. Fixed Bottom Apply Button (stands comfortably above BottomNav) */}
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-30 flex justify-center pointer-events-none font-['Cairo',sans-serif]">
        <div className="w-full max-w-md px-4 pb-2 pointer-events-auto">
          <button
            type="button"
            onClick={handleApply}
            className="w-full bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-black py-3.5 px-6 rounded-2xl text-sm sm:text-base shadow-lg shadow-emerald-900/15 flex items-center justify-center gap-2 transition cursor-pointer min-h-[50px]"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>عرض {draftResultsCount} حرفيًا</span>
          </button>
        </div>
      </div>
    </div>
  );
};

