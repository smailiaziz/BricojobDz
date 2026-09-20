import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, ShieldCheck, Clock, Zap, ChevronRight, SlidersHorizontal,
  Layers, Wrench, Snowflake, Palette, Hammer, Building, Sparkles, Car, Smartphone, Flower2
} from 'lucide-react';
import { Artisan, ServiceCategory as Category, UserSession } from '../types';
import { normalizeArabicText, isArtisan247 } from '../utils';
import { getCommunesByWilaya } from '../data';
import { isOwnArtisanProfile } from '../domain';
import { ArtisanCard } from './ArtisanCard';
import { AdvancedFilterModal, FilterDraftValues } from './AdvancedFilterModal';

interface SearchScreenProps {
  artisans: Artisan[];
  categories: Category[];
  favoriteIds: string[];
  currentUser?: UserSession | null;
  onToggleFavorite: (id: string) => void;
  onSelectArtisan: (artisan: Artisan) => void;
  onBack: () => void;
}

// Icon resolver for category horizontal scroll
const getCategoryIconComponent = (id: string) => {
  switch (id) {
    case 'plumbing': return Wrench;
    case 'electrical': return Zap;
    case 'ac': return Snowflake;
    case 'painting': return Palette;
    case 'carpentry': return Hammer;
    case 'construction': return Building;
    case 'cleaning': return Sparkles;
    case 'mechanic': return Car;
    case 'appliances': return Smartphone;
    case 'gardening': return Flower2;
    case 'all':
    default:
      return Layers;
  }
};

export const SearchScreen: React.FC<SearchScreenProps> = ({
  artisans,
  categories,
  favoriteIds,
  currentUser,
  onToggleFavorite,
  onSelectArtisan,
  onBack,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as { 
    category?: string; 
    emergency247Only?: boolean; 
    searchText?: string;
    searchState?: {
      searchText?: string;
      selectedCategory?: string;
      selectedWilaya?: string;
      selectedCommune?: string;
      sortBy?: 'default' | 'rating' | 'experience' | 'price-asc' | 'price-desc';
      verifiedOnly?: boolean;
      availableNowOnly?: boolean;
      emergency247Only?: boolean;
    };
  } | null;

  const savedSearch = locationState?.searchState;

  const [searchText, setSearchText] = useState(() => savedSearch?.searchText ?? (locationState?.searchText || ''));
  const [selectedCategory, setSelectedCategory] = useState<string>(() => savedSearch?.selectedCategory ?? (locationState?.category || 'all'));
  const [selectedWilaya, setSelectedWilaya] = useState(() => savedSearch?.selectedWilaya ?? 'الكل');
  const [selectedCommune, setSelectedCommune] = useState(() => savedSearch?.selectedCommune ?? 'الكل');
  const [sortBy, setSortBy] = useState<'default' | 'rating' | 'experience' | 'price-asc' | 'price-desc'>(() => savedSearch?.sortBy ?? 'default');
  const [verifiedOnly, setVerifiedOnly] = useState(() => savedSearch?.verifiedOnly ?? false);
  const [availableNowOnly, setAvailableNowOnly] = useState(() => savedSearch?.availableNowOnly ?? false);
  const [emergency247Only, setEmergency247Only] = useState<boolean>(() => savedSearch?.emergency247Only ?? Boolean(locationState?.emergency247Only));
  const [isFilterViewOpen, setIsFilterViewOpen] = useState(() => location.hash === '#filter');

  // Synchronize active filters with location.state to preserve search context across Artisan Modal navigation
  useEffect(() => {
    const currentSearchState = {
      searchText,
      selectedCategory,
      selectedWilaya,
      selectedCommune,
      sortBy,
      verifiedOnly,
      availableNowOnly,
      emergency247Only,
    };

    const existingState = location.state?.searchState;
    if (JSON.stringify(existingState) !== JSON.stringify(currentSearchState)) {
      navigate('/search' + location.hash, {
        replace: true,
        state: {
          ...location.state,
          searchState: currentSearchState,
        },
      });
    }
  }, [
    searchText,
    selectedCategory,
    selectedWilaya,
    selectedCommune,
    sortBy,
    verifiedOnly,
    availableNowOnly,
    emergency247Only,
    location.hash,
    location.state,
    navigate,
  ]);

  // Synchronize filter view state with URL hash (#filter) for native device back button support
  useEffect(() => {
    setIsFilterViewOpen(location.hash === '#filter');
  }, [location.hash]);

  const handleOpenFilterView = () => {
    navigate('/search#filter');
  };

  const handleCloseFilterView = () => {
    if (location.hash === '#filter') {
      navigate(-1);
    } else {
      setIsFilterViewOpen(false);
    }
  };

  const handleApplyDraftFilters = (draft: FilterDraftValues) => {
    setSelectedWilaya(draft.wilaya);
    setSelectedCommune(draft.commune);
    setSelectedCategory(draft.category);
    setSortBy(draft.sortBy);
    setVerifiedOnly(draft.verifiedOnly);
    setAvailableNowOnly(draft.availableNowOnly);
    setEmergency247Only(draft.emergency247Only);
    handleCloseFilterView();
  };

  // Auto-reset commune when wilaya changes or if selectedCommune is invalid for selectedWilaya
  useEffect(() => {
    if (selectedWilaya === 'الكل') {
      if (selectedCommune !== 'الكل') setSelectedCommune('الكل');
    } else {
      const validCommunes = getCommunesByWilaya(selectedWilaya);
      if (selectedCommune !== 'الكل' && !validCommunes.includes(selectedCommune)) {
        setSelectedCommune('الكل');
      }
    }
  }, [selectedWilaya, selectedCommune]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedWilaya !== 'الكل') count++;
    if (selectedCommune !== 'الكل') count++;
    if (sortBy !== 'default') count++;
    if (verifiedOnly) count++;
    if (availableNowOnly) count++;
    if (emergency247Only) count++;
    if (selectedCategory !== 'all') count++;
    return count;
  }, [selectedWilaya, selectedCommune, sortBy, verifiedOnly, availableNowOnly, emergency247Only, selectedCategory]);

  const handleResetFilters = () => {
    setSelectedWilaya('الكل');
    setSelectedCommune('الكل');
    setSelectedCategory('all');
    setSortBy('default');
    setVerifiedOnly(false);
    setAvailableNowOnly(false);
    setEmergency247Only(false);
    setSearchText('');
  };

  const filteredArtisans = useMemo(() => {
    let result = [...artisans];

    if (selectedCategory !== 'all') {
      result = result.filter(a => a.category === selectedCategory);
    }

    if (selectedWilaya !== 'الكل') {
      result = result.filter(a => a.wilaya === selectedWilaya);
    }

    if (selectedCommune !== 'الكل') {
      result = result.filter(a => a.city === selectedCommune);
    }

    if (verifiedOnly) result = result.filter(a => a.verified);
    if (availableNowOnly) result = result.filter(a => a.availableNow);
    if (emergency247Only) result = result.filter(a => isArtisan247(a));

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

    // Apply Sorting
    if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'experience') {
      result.sort((a, b) => b.experienceYears - a.experienceYears);
    } else if (sortBy === 'price-asc') {
      result.sort((a, b) => {
        const hasA = a.startingPrice !== null && a.startingPrice !== undefined;
        const hasB = b.startingPrice !== null && b.startingPrice !== undefined;
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return a.startingPrice! - b.startingPrice!;
      });
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => {
        const hasA = a.startingPrice !== null && a.startingPrice !== undefined;
        const hasB = b.startingPrice !== null && b.startingPrice !== undefined;
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return b.startingPrice! - a.startingPrice!;
      });
    }

    return result;
  }, [artisans, searchText, selectedCategory, selectedWilaya, selectedCommune, sortBy, verifiedOnly, availableNowOnly, emergency247Only]);

  // If the Full-Screen Filter View is open, render it directly
  if (isFilterViewOpen) {
    return (
      <AdvancedFilterModal
        isOpen={true}
        onCancel={handleCloseFilterView}
        onApply={handleApplyDraftFilters}
        artisans={artisans}
        categories={categories}
        searchText={searchText}
        initialWilaya={selectedWilaya}
        initialCommune={selectedCommune}
        initialCategory={selectedCategory}
        initialSortBy={sortBy}
        initialAvailableNowOnly={availableNowOnly}
        initialEmergency247Only={emergency247Only}
        initialVerifiedOnly={verifiedOnly}
      />
    );
  }

  return (
    <div className="w-full space-y-5 animate-fade-in font-['Cairo',sans-serif] px-4 py-5 bg-[#FAF8F5]" dir="rtl">
      
      {/* Search Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 bg-white rounded-xl shadow-xs border border-stone-200/80 text-stone-600 hover:text-emerald-700 transition-colors cursor-pointer"
            aria-label="الرجوع"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black text-stone-900">استكشاف الخدمات</h1>
        </div>

        {/* Search Input and Filter View Button */}
        <div className="flex items-center gap-2">
          <div className="relative group flex-1">
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-700 group-focus-within:scale-110 transition-transform">
              <Search className="w-5 h-5 stroke-[2.5]" />
            </div>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="ابحث عن سباك، نجار، كهربائي، مدينة..."
              className="w-full bg-white border border-stone-200/90 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold text-stone-900 focus:outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10 shadow-xs transition-all placeholder:text-stone-400"
            />
          </div>
          <button
            type="button"
            onClick={handleOpenFilterView}
            className={`p-3.5 rounded-2xl border transition-all flex items-center justify-center relative cursor-pointer shadow-xs ${
              activeFiltersCount > 0
                ? 'bg-emerald-700 text-white border-emerald-800 shadow-emerald-700/20'
                : 'bg-white text-stone-700 border-stone-200/90 hover:border-emerald-700/40'
            }`}
            title="تصفية النتائج"
            aria-label="تصفية النتائج"
          >
            <SlidersHorizontal className="w-5 h-5 stroke-[2.5]" />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-scale-in">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 1. Categories Section: Icon + Label Horizontal Scroll */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black text-stone-700">التخصصات</h2>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none -mx-4 px-4 touch-pan-x" dir="rtl">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const IconComponent = getCategoryIconComponent(cat.id);
            const displayName = cat.id === 'all' ? 'جميع التخصصات' : cat.name;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex flex-col items-center justify-center gap-1.5 px-3 py-2 rounded-2xl min-w-[76px] h-[78px] transition-all border shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50 border-emerald-700 text-emerald-700 shadow-xs'
                    : 'bg-white border-stone-200/80 text-stone-500 hover:border-emerald-700/30 hover:text-stone-700'
                }`}
              >
                <div className={`transition-colors ${isSelected ? 'text-emerald-700' : 'text-stone-400'}`}>
                  <IconComponent className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span className={`text-[11px] whitespace-nowrap transition-colors ${
                  isSelected ? 'font-black text-emerald-800' : 'font-bold text-stone-600'
                }`}>
                  {displayName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Quick Filters: Verified, Available Now, Emergency 24/7 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 touch-pan-x" dir="rtl">
        <button
          type="button"
          onClick={() => setVerifiedOnly(!verifiedOnly)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-all border whitespace-nowrap cursor-pointer ${
            verifiedOnly 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-700' 
              : 'bg-white text-stone-600 border-stone-200/80 hover:border-stone-300'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span>موثوقون فقط</span>
        </button>
        <button
          type="button"
          onClick={() => setAvailableNowOnly(!availableNowOnly)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-all border whitespace-nowrap cursor-pointer ${
            availableNowOnly 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-700' 
              : 'bg-white text-stone-600 border-stone-200/80 hover:border-stone-300'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span>متاحون الآن</span>
        </button>
        <button
          type="button"
          onClick={() => setEmergency247Only(!emergency247Only)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-all border whitespace-nowrap cursor-pointer ${
            emergency247Only 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-700' 
              : 'bg-white text-stone-600 border-stone-200/80 hover:border-stone-300'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span>طوارئ 24/7</span>
        </button>
      </div>

      {/* Results Section */}
      <div className="space-y-4 pt-1">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-stone-500 tracking-wider">نتائج البحث ({filteredArtisans.length})</h2>
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 transition cursor-pointer"
            >
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>

        {filteredArtisans.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-12 text-center border border-stone-200/80 space-y-5 shadow-xs">
            <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
              <Search className="w-10 h-10 text-stone-400" />
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-black text-stone-900">لم نجد نتائج لطلبك</p>
              <p className="text-xs font-medium text-stone-500 leading-relaxed">
                جرب البحث بكلمات أخرى أو اختر ولاية وتخصصاً مختلفاً.
              </p>
            </div>
            <button
              onClick={handleResetFilters}
              className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-2xl transition shadow-xs cursor-pointer"
            >
              إعادة ضبط الفلاتر
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredArtisans.map((artisan) => (
              <ArtisanCard
                key={artisan.id}
                artisan={artisan}
                isFavorite={favoriteIds.includes(artisan.id)}
                isOwnProfile={isOwnArtisanProfile(artisan, currentUser)}
                onToggleFavorite={onToggleFavorite}
                onClick={onSelectArtisan}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

