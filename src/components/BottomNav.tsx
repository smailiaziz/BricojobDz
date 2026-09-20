import React from 'react';
import { Home, Search, Heart, User, Wrench, ClipboardList } from 'lucide-react';
import { UserSession } from '../types';

export type NavView = 'home' | 'orders' | 'search' | 'favorites' | 'login' | 'register' | 'artisan' | 'account';

interface BottomNavProps {
  currentView: NavView;
  currentUser?: UserSession | null;
  favoritesCount: number;
  onNavigate: (view: NavView) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  currentUser,
  favoritesCount,
  onNavigate,
}) => {
  const isOrdersActive = currentView === 'orders';
  const isHomeActive = currentView === 'home';
  const isSearchActive = currentView === 'search';
  const isFavoritesActive = currentView === 'favorites';
  const isArtisanActive = currentView === 'artisan';
  const isAccountActive = currentView === 'account';
  const isLoginActive = (currentView === 'login' || currentView === 'register') && !isArtisanActive;

  // First Tab active state: if logged in, active when on orders; if guest, active when on home
  const isFirstTabActive = currentUser ? isOrdersActive : isHomeActive;

  const handleFirstTabClick = () => {
    if (currentUser) {
      onNavigate('orders');
    } else {
      onNavigate('home');
    }
  };

  const handleAccountClick = () => {
    if (currentUser?.role === 'artisan') {
      onNavigate('artisan');
    } else if (currentUser?.role === 'user') {
      onNavigate('account');
    } else {
      onNavigate('login');
    }
  };

  const isFourthTabActive = currentUser?.role === 'artisan' ? isArtisanActive : (currentUser ? isAccountActive : isLoginActive);

  return (
    <nav 
      aria-label="التنقل السفلي"
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none font-['Cairo',sans-serif]" 
      dir="rtl"
    >
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl border-t border-stone-200/80 pt-2.5 px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.06)] pointer-events-auto rounded-t-[1.75rem]">
        {/* 1. Primary Hub: 'طلباتي' for User / 'الطلبات' for Artisan / 'الرئيسية' for Guest */}
        <button
          type="button"
          onClick={handleFirstTabClick}
          className={`flex-1 flex flex-col items-center justify-center transition-all cursor-pointer min-h-[48px] py-1 ${
            isFirstTabActive
              ? 'text-emerald-700'
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <div className={`transition-all duration-300 ${isFirstTabActive ? 'scale-110' : ''}`}>
            {currentUser ? (
              <ClipboardList className={`w-6 h-6 stroke-[2.5] ${isFirstTabActive ? 'fill-emerald-50/50' : ''}`} />
            ) : (
              <Home className={`w-6 h-6 stroke-[2.5] ${isFirstTabActive ? 'fill-emerald-50' : ''}`} />
            )}
          </div>
          <span className={`text-[10px] mt-1 font-black transition-all ${isFirstTabActive ? 'opacity-100' : 'opacity-70'}`}>
            {currentUser?.role === 'artisan' 
              ? 'الطلبات' 
              : currentUser 
                ? 'طلباتي' 
                : 'الرئيسية'}
          </span>
        </button>

        {/* 2. Directory / Artisans: 'الحرفيون' */}
        <button
          type="button"
          onClick={() => onNavigate('search')}
          className={`flex-1 flex flex-col items-center justify-center transition-all cursor-pointer min-h-[48px] py-1 ${
            isSearchActive
              ? 'text-emerald-700'
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <div className={`transition-all duration-300 ${isSearchActive ? 'scale-110' : ''}`}>
            <Search className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className={`text-[10px] mt-1 font-black transition-all ${isSearchActive ? 'opacity-100' : 'opacity-70'}`}>
            الحرفيون
          </span>
        </button>

        {/* 3. Favorites */}
        <button
          type="button"
          onClick={() => onNavigate('favorites')}
          className={`flex-1 flex flex-col items-center justify-center transition-all cursor-pointer min-h-[48px] py-1 relative ${
            isFavoritesActive
              ? 'text-emerald-700'
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <div className={`transition-all duration-300 relative ${isFavoritesActive ? 'scale-110' : ''}`}>
            <Heart className={`w-6 h-6 stroke-[2.5] ${isFavoritesActive ? 'fill-emerald-700/10' : ''}`} />
            {favoritesCount > 0 && (
              <span className="absolute -top-1 -right-1.5 bg-rose-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {favoritesCount > 9 ? '9+' : favoritesCount}
              </span>
            )}
          </div>
          <span className={`text-[10px] mt-1 font-black transition-all ${isFavoritesActive ? 'opacity-100' : 'opacity-70'}`}>المفضلة</span>
        </button>

        {/* 4. Account / Artisan Workspace / Login */}
        <button
          type="button"
          onClick={handleAccountClick}
          className={`flex-1 flex flex-col items-center justify-center transition-all cursor-pointer min-h-[48px] py-1 ${
            isFourthTabActive
              ? 'text-emerald-700'
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <div className={`transition-all duration-300 ${isFourthTabActive ? 'scale-110' : ''}`}>
            {currentUser?.role === 'artisan' ? (
              <div className={`w-6 h-6 rounded-full bg-emerald-700 text-white text-[10px] font-black flex items-center justify-center border-2 ${isFourthTabActive ? 'border-emerald-200 shadow-sm' : 'border-transparent opacity-80'}`}>
                <Wrench className="w-3.5 h-3.5" />
              </div>
            ) : currentUser ? (
              <div className={`w-6 h-6 rounded-full bg-stone-800 text-white text-[10px] font-black flex items-center justify-center border-2 ${isFourthTabActive ? 'border-stone-300 shadow-sm' : 'border-transparent opacity-80'}`}>
                {currentUser.name.charAt(0)}
              </div>
            ) : (
              <User className="w-6 h-6 stroke-[2.5]" />
            )}
          </div>
          <span className={`text-[10px] mt-1 font-black transition-all truncate max-w-[64px] ${isFourthTabActive ? 'opacity-100' : 'opacity-70'}`}>
            {currentUser?.role === 'artisan' 
              ? 'ملفي المهني' 
              : currentUser 
                ? (currentUser.name.split(' ')[0] || 'حسابي')
                : 'دخول'}
          </span>
        </button>
      </div>
    </nav>
  );
};
