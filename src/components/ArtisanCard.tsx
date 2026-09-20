import React, { useState, useEffect } from 'react';
import { Star, MapPin, Heart, Phone, MessageCircle, CheckCircle2, Award, User } from 'lucide-react';
import { Artisan } from '../types';
import { isArtisan247, cleanPhoneForWhatsApp, formatStartingPrice, formatExperienceYears } from '../utils';

interface ArtisanCardProps {
  artisan: Artisan;
  isFavorite: boolean;
  isOwnProfile?: boolean;
  onToggleFavorite: (id: string) => void;
  onClick: (artisan: Artisan) => void;
}

// OPTIMIZATION: Memoize ArtisanCard to prevent redundant re-renders in large lists
export const ArtisanCard: React.FC<ArtisanCardProps> = React.memo(({
  artisan,
  isFavorite,
  isOwnProfile = false,
  onToggleFavorite,
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [artisan.avatar]);

  const whatsappNumber = cleanPhoneForWhatsApp(artisan.phone);
  return (
    <div
      onClick={() => onClick(artisan)}
      className="bg-white rounded-3xl p-3.5 border border-stone-200/80 shadow-xs hover:border-emerald-700/40 hover:shadow-sm transition-all duration-300 flex items-start gap-3.5 group cursor-pointer relative overflow-hidden"
    >
      {/* Compact Side Photo */}
      <div className="relative shrink-0 w-20 h-24 rounded-2xl bg-emerald-50 overflow-hidden border border-stone-200/70 flex items-center justify-center">
        {artisan.avatar?.trim() && !imageError ? (
          <img
            src={artisan.avatar}
            alt={artisan.name}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <User className="w-8 h-8 text-emerald-700 stroke-[1.5]" />
          </div>
        )}
        
        {/* Status Badge Over Image */}
        {(isArtisan247(artisan) || artisan.availableNow) && (
          <div className={`absolute bottom-0 inset-x-0 py-0.5 text-center text-[8px] font-black text-white ${
            isArtisan247(artisan) ? 'bg-rose-600' : 'bg-emerald-700'
          }`}>
            {isArtisan247(artisan) ? '24/7' : 'متاح الآن'}
          </div>
        )}
      </div>

      {/* Main Content Info */}
      <div className="flex-1 min-w-0 py-0.5 min-h-24 flex flex-col justify-between text-right">
        <div>
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 truncate">
              <h3 className="font-black text-stone-900 text-[14px] truncate group-hover:text-emerald-700 transition-colors">
                {artisan.name}
              </h3>
              {artisan.verified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              )}
            </div>
            {!isOwnProfile && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(artisan.id);
                }}
                className={`shrink-0 p-1.5 -m-1 rounded-xl transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center ${
                  isFavorite ? 'text-rose-500' : 'text-stone-300 hover:text-rose-400'
                }`}
                aria-label="إضافة للمفضلة"
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>
          <p className="text-[11px] font-bold text-emerald-700 leading-tight mt-0.5 truncate">
            {artisan.profession}
          </p>
        </div>

        {/* Middle row: Rating & Reviews + Location */}
        <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500 my-1">
          <div className="flex items-center gap-0.5 font-black text-amber-500 shrink-0">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span>{artisan.rating}</span>
            <span className="text-stone-400 font-medium text-[9px]">({artisan.reviewCount})</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-stone-300 shrink-0" />
          <div className="flex items-center gap-0.5 text-stone-500 truncate text-[10px]">
            <MapPin className="w-3 h-3 shrink-0 text-stone-400" />
            <span className="truncate">{artisan.city}، {artisan.wilaya}</span>
          </div>
        </div>

        {/* Bottom row: Experience + Starting Price */}
        <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-bold">
          <span className="bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0">
            <Award className="w-2.5 h-2.5 text-stone-400" />
            {formatExperienceYears(artisan.experienceYears)}
          </span>
          {artisan.completedJobs !== undefined && artisan.completedJobs > 0 && (
            <span className="bg-emerald-100/70 text-emerald-900 px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" />
              <span>{artisan.completedJobs} خدمة مكتملة</span>
            </span>
          )}
          <span className="text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100/80 font-black truncate whitespace-nowrap">
            {formatStartingPrice(artisan.startingPrice)}
          </span>
        </div>
      </div>

      {/* Quick Action Sidebar (Vertical) */}
      <div className="flex flex-col gap-2 shrink-0 self-center">
        <a
          href={`tel:${artisan.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100/90 hover:bg-emerald-700 hover:text-white transition-all shadow-xs active:scale-95"
          title="اتصال هاتفي"
          aria-label="اتصال هاتفي"
        >
          <Phone className="w-4 h-4" />
        </a>
        <a
          href={`https://wa.me/${whatsappNumber}`}
          onClick={(e) => e.stopPropagation()}
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl bg-emerald-50/70 text-emerald-800 flex items-center justify-center border border-emerald-100/90 hover:bg-emerald-700 hover:text-white transition-all shadow-xs active:scale-95"
          title="واتساب"
          aria-label="واتساب"
        >
          <MessageCircle className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
});

