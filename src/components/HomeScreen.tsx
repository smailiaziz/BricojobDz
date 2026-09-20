import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, LogIn, UserPlus } from 'lucide-react';
import { Artisan, ServiceCategory, UserSession } from '../types';
import heroImg from '../assets/images/algerian_home_artisan_1789422914737.jpg';

interface HomeScreenProps {
  categories?: ServiceCategory[];
  artisans?: Artisan[];
  favoriteIds?: string[];
  currentUser?: UserSession | null;
  onToggleFavorite?: (artisanId: string) => void;
  onSelectArtisan?: (artisan: Artisan) => void;
  onOpenLogin?: () => void;
  onOpenRegister?: () => void;
  onLogout?: () => void;
  onSearchClick?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentUser,
  onOpenLogin,
  onOpenRegister,
  onSearchClick,
}) => {
  const navigate = useNavigate();

  // 1. Authenticated User Auto-Redirect:
  // If a valid user is already logged in, do not display the Landing Page.
  // Redirect immediately to their profile/account page with replace: true.
  useEffect(() => {
    if (currentUser) {
      navigate('/orders', { replace: true });
    }
  }, [currentUser, navigate]);

  // Prevent flash of landing page while redirecting
  if (currentUser) {
    return null;
  }

  const handleBrowseServices = () => {
    if (onSearchClick) {
      onSearchClick();
    } else {
      navigate('/search');
    }
  };

  const handleLogin = () => {
    if (onOpenLogin) {
      onOpenLogin();
    } else {
      navigate('/login');
    }
  };

  const handleRegister = () => {
    if (onOpenRegister) {
      onOpenRegister();
    } else {
      navigate('/register');
    }
  };

  return (
    <div 
      className="relative w-full min-h-[100dvh] flex flex-col justify-between bg-[#FAF8F5] text-stone-900 font-['Cairo',sans-serif] selection:bg-emerald-100 selection:text-emerald-900 overflow-hidden animate-fade-in" 
      dir="rtl"
    >
      {/* 
        Hero Visual Layer (Full-width, smoothly integrated under header,
        fading seamlessly and naturally into the warm ivory/sand background)
      */}
      <div className="absolute top-0 inset-x-0 h-[64%] sm:h-[68%] z-0 pointer-events-none select-none overflow-hidden">
        <img
          src={heroImg}
          alt="حرفيون وخدمات صيانة منزلية موثوقة في الجزائر"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-[center_top] scale-[1.01]"
        />
        {/* Soft top wash to keep header crisp and readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#FAF8F5]/85 via-[#FAF8F5]/30 to-transparent h-20" />
        
        {/* Smooth, long, natural ivory/sand fade at the lower portion only */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_top,#FAF8F5_0%,rgba(250,248,245,0.95)_12%,rgba(250,248,245,0.6)_28%,rgba(250,248,245,0.15)_45%,rgba(250,248,245,0)_65%)]" />
      </div>

      {/* 1. Header (Logo & Refined Local Indicator) */}
      <header className="relative z-10 w-full px-5 pt-4 sm:pt-5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-emerald-700 text-white rounded-lg flex items-center justify-center font-black text-base shadow-xs">
            B
          </div>
          <div className="flex flex-col">
            <span className="text-base font-black tracking-tight text-stone-900 leading-none">
              Bricojob<span className="text-emerald-700">Dz</span>
            </span>
            <span className="text-[10px] text-stone-600 font-semibold tracking-wider mt-0.5">
              منصة الحرفيين والخدمات
            </span>
          </div>
        </div>

        {/* Refined Local Badge (No generic emoji flag) */}
        <div className="flex items-center gap-1.5 bg-[#FAF8F5]/90 backdrop-blur-md border border-stone-200/90 px-2.5 py-1 rounded-full text-xs font-medium text-stone-700 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
          <span className="text-[11px] font-semibold text-stone-800">خدمات محلية موثوقة</span>
        </div>
      </header>

      {/* Spacer to let the visual atmosphere breathe in the center */}
      <div className="flex-1 relative z-10" />

      {/* 2, 3, 4. Content Flow: Trust Badge, Headline, Description, & CTAs */}
      <main className="relative z-10 w-full px-5 pb-6 pt-2 flex flex-col gap-4">
        
        {/* Headline, Sub-badge, and Description */}
        <div className="space-y-2">
          {/* Modification 1: Replaced unsupported claim with "حرفيون موثوقون لخدمات منزلك" */}
          <div className="inline-flex items-center gap-1.5 bg-emerald-700/10 border border-emerald-700/20 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="text-[11.5px]">حرفيون موثوقون لخدمات منزلك</span>
          </div>

          <h1 className="text-2xl sm:text-[27px] font-black text-stone-900 leading-snug tracking-tight">
            كل خدمة تحتاج حرفيًا مناسبًا.
          </h1>

          <p className="text-sm text-stone-600 font-medium leading-relaxed max-w-sm">
            اكتشف الخدمات والحرفيين في الجزائر، واختر الشخص المناسب لمهمتك بسهولة.
          </p>
        </div>

        {/* Actions Area: Primary CTA & Soft Warm Secondary Buttons */}
        <div className="space-y-2.5 pt-1">
          {/* Primary CTA: "تصفح الخدمات" */}
          <button
            type="button"
            onClick={handleBrowseServices}
            className="w-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-bold py-3 px-5 rounded-xl text-base shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
          >
            <span>تصفح الخدمات</span>
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* Secondary Actions: Soft Warm Controls */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleLogin}
              className="flex items-center justify-center gap-1.5 bg-stone-100/90 hover:bg-stone-200/80 active:scale-[0.99] text-stone-700 font-semibold py-2.5 px-3 rounded-xl text-xs sm:text-sm border border-stone-200/90 transition-colors cursor-pointer min-h-[44px]"
            >
              <LogIn className="w-3.5 h-3.5 text-stone-600" />
              <span>تسجيل الدخول</span>
            </button>

            <button
              type="button"
              onClick={handleRegister}
              className="flex items-center justify-center gap-1.5 bg-stone-100/90 hover:bg-stone-200/80 active:scale-[0.99] text-stone-700 font-semibold py-2.5 px-3 rounded-xl text-xs sm:text-sm border border-stone-200/90 transition-colors cursor-pointer min-h-[44px]"
            >
              <UserPlus className="w-3.5 h-3.5 text-stone-600" />
              <span>إنشاء حساب</span>
            </button>
          </div>
        </div>

        {/* Discreet Local Signature without emoji */}
        <div className="pt-0.5 flex items-center justify-center">
          <span className="text-[11px] text-stone-500 font-normal">
            صُنع بعناية لتلبية احتياجات المنازل في الجزائر
          </span>
        </div>
      </main>
    </div>
  );
};
