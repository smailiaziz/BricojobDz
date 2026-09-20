import React from 'react';
import { Heart, Search, ChevronRight } from 'lucide-react';
import { Artisan } from '../types';
import { ArtisanCard } from './ArtisanCard';

interface FavoritesScreenProps {
  favoriteArtisans: Artisan[];
  onToggleFavorite: (id: string) => void;
  onSelectArtisan: (artisan: Artisan) => void;
  onGoSearch: () => void;
}

export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({
  favoriteArtisans,
  onToggleFavorite,
  onSelectArtisan,
  onGoSearch,
}) => {
  return (
    <div className="w-full min-h-[100dvh] bg-[#FAF8F5] px-4 py-6 font-['Cairo',sans-serif]" dir="rtl">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button 
            onClick={onGoSearch}
            className="p-2 bg-white rounded-xl shadow-xs border border-stone-200/80 text-stone-600 hover:text-emerald-700 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black text-stone-900">المفضلة</h1>
        </div>
        <div className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black border border-rose-100 uppercase tracking-wider">
          {favoriteArtisans.length} حرفي
        </div>
      </div>

      {favoriteArtisans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-5 animate-fade-in">
          <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center text-stone-300 shadow-xs border-2 border-stone-100">
            <Heart className="w-12 h-12" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-black text-stone-900">قائمتك المفضلة فارغة</h3>
            <p className="text-xs font-bold text-stone-400 leading-relaxed max-w-[240px] mx-auto">
              ابدأ في استكشاف الحرفيين وأضفهم إلى مفضلتك للوصول السريع والمنظم.
            </p>
          </div>
          <button
            onClick={onGoSearch}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black px-8 py-3.5 rounded-2xl text-xs shadow-lg shadow-emerald-700/20 active:scale-95 transition-all cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>استكشف الحرفيين الآن</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5 animate-fade-in">
          {favoriteArtisans.map((artisan) => (
            <ArtisanCard
              key={artisan.id}
              artisan={artisan}
              isFavorite={true}
              onToggleFavorite={onToggleFavorite}
              onClick={onSelectArtisan}
            />
          ))}
        </div>
      )}
    </div>
  );
};
