import React from 'react';
import { Download, X, Share, PlusSquare, Smartphone } from 'lucide-react';
import { UsePwaInstallPromptResult } from '../hooks/usePwaInstallPrompt';

interface PWAInstallBannerProps {
  pwaState: UsePwaInstallPromptResult;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ pwaState }) => {
  const { 
    showBanner, 
    promptInstall, 
    dismissBanner, 
    isIOS, 
    showIOSGuide, 
    setShowIOSGuide 
  } = pwaState;

  // Don't render anything if banner is not active and iOS guide is closed
  if (!showBanner && !showIOSGuide) {
    return null;
  }

  return (
    <>
      {/* 1. Main Polite PWA Install Banner */}
      {showBanner && (
        <div 
          id="pwa-install-banner"
          dir="rtl"
          className="fixed bottom-20 left-4 right-4 sm:left-6 sm:right-auto sm:bottom-6 sm:w-96 z-40 bg-[#FAF8F5] border border-stone-200/80 rounded-2xl p-4 shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-0"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-stone-900 leading-tight">
                  ثبّت BricojobDz على جهازك
                </h4>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  احتفظ بـ BricojobDz على جهازك للوصول إليه بسرعة مثل التطبيق.
                </p>
              </div>
            </div>
            <button
              id="pwa-dismiss-icon-btn"
              onClick={dismissBanner}
              className="text-stone-400 hover:text-stone-600 p-1 rounded-lg transition-colors shrink-0"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3.5 flex items-center justify-end gap-2.5">
            <button
              id="pwa-dismiss-btn"
              onClick={dismissBanner}
              className="px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-100/80 hover:bg-stone-200/80 rounded-xl transition-colors"
            >
              ليس الآن
            </button>
            <button
              id="pwa-install-btn"
              onClick={() => promptInstall()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 rounded-xl shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تثبيت التطبيق</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. iOS Instruction Modal */}
      {showIOSGuide && (
        <div 
          id="pwa-ios-guide-modal"
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#FAF8F5] p-5 shadow-2xl border border-stone-200 text-stone-900">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-stone-900">
                  التثبيت على iPhone / iPad
                </h3>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-600 mb-4 leading-relaxed">
              لإضافة BricojobDz إلى الشاشة الرئيسية، افتح قائمة المشاركة ثم اختر &quot;إضافة إلى الشاشة الرئيسية&quot;.
            </p>

            <div className="space-y-2 bg-white rounded-xl p-3 border border-stone-200/80 text-xs text-stone-700 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">1</span>
                <span className="flex items-center gap-1">
                  اضغط على زر المشاركة <Share className="w-3.5 h-3.5 text-emerald-700 inline" /> في متصفح Safari.
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">2</span>
                <span className="flex items-center gap-1">
                  اختر <PlusSquare className="w-3.5 h-3.5 text-emerald-700 inline" /> &quot;إضافة إلى الشاشة الرئيسية&quot;.
                </span>
              </div>
            </div>

            <button
              id="pwa-ios-close-btn"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
};
