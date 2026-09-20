import React from 'react';
import { Smartphone, QrCode, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

interface DesktopRestrictionScreenProps {
  onBypass?: () => void;
}

export const DesktopRestrictionScreen: React.FC<DesktopRestrictionScreenProps> = ({
  onBypass,
}) => {
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-4 sm:p-6 font-['Cairo',sans-serif] text-slate-900 selection:bg-emerald-100" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 text-center space-y-6 animate-fade-in">
        
        {/* Mobile Icon Badge */}
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto border border-emerald-100 shadow-2xs">
          <Smartphone className="w-8 h-8 stroke-[1.75]" />
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-bold border border-emerald-200/60">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>تطبيق مخصص للهواتف المحمولة</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight pt-1">
            تجربة مخصصة للجوال
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
            تم تصميم وبرمجة منصة <strong className="font-bold text-slate-700">BricojobDz</strong> لتعمل بشكل مثالي وسلس حصرياً عبر شاشات الهواتف الذكية والأجهزة المحمولة.
          </p>
        </div>

        {/* Instruction Card */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-right space-y-2.5">
          <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>كيفية الاستخدام:</span>
          </p>
          <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside leading-relaxed pr-1">
            <li>افتح هذا الرابط مباشرة من متصفح هاتفك المحمول.</li>
            <li>أو قم بتفعيل وضع معاينة الجوال (Device Mode / F12) في متصفحك.</li>
          </ul>
        </div>

        {/* Bottom Actions / Bypass */}
        <div className="pt-2 flex flex-col gap-2.5">
          {onBypass && (
            <button
              type="button"
              onClick={onBypass}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-2xl text-xs font-bold transition border border-slate-200/80 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>متابعة العرض للتجربة على سطح المكتب</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
