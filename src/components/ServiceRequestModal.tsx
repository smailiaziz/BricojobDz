import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, User, Phone, Send, CheckCircle2, Tag } from 'lucide-react';
import { Artisan, UserSession, OrderItem } from '../types';
import { orderRepository } from '../repositories';
import { 
  getTodayLocalDateString, 
  validateServiceRequestDate, 
  isValidAlgerianPhone,
  normalizePhoneNumber,
  getCleanStartingPrice 
} from '../utils';

interface ServiceRequestModalProps {
  artisan: Artisan;
  currentUser?: UserSession | null;
  onClose: () => void;
  onShowToast?: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const ServiceRequestModal: React.FC<ServiceRequestModalProps> = ({
  artisan,
  currentUser,
  onClose,
  onShowToast,
}) => {
  const todayStr = getTodayLocalDateString();
  const cleanPrice = getCleanStartingPrice(artisan.startingPrice);

  const [clientName, setClientName] = useState(currentUser?.name || '');
  const [clientPhone, setClientPhone] = useState(currentUser?.phone || '');
  const [preferredDate, setPreferredDate] = useState(todayStr);
  const [serviceDetails, setServiceDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Legacy direct-order flow is intentionally disabled.
    // The current marketplace lifecycle creates Orders only through:
    // ServiceRequest → ServiceOffer → accepted offer → Order.
    if (onShowToast) {
      onShowToast('يرجى إنشاء طلب خدمة من خلال المسار الحالي.', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col font-['Cairo',sans-serif] animate-fade-in" dir="rtl">
      
      {/* Header */}
      <div className="bg-white border-b border-stone-200/80 flex items-center justify-between px-4 py-3 shrink-0">
        <button onClick={onClose} className="p-2 text-stone-500 active:bg-stone-100 rounded-full cursor-pointer">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-sm font-black text-stone-900">طلب خدمة جديدة</h2>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-[#FAF8F5]">
        <div className="p-4 space-y-6 pb-24">
          
          {/* Artisan Summary */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-3">
             <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-lg shrink-0">
                {artisan.name.charAt(0)}
             </div>
             <div>
                <h3 className="text-sm font-black text-stone-900">{artisan.name}</h3>
                <p className="text-xs font-bold text-emerald-700">{artisan.profession}</p>
             </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Form Fields */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-stone-600 mr-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>اسمك الكامل</span>
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="أدخل اسمك"
                  className="w-full bg-white border border-stone-200/80 rounded-2xl p-4 text-sm font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-stone-600 mr-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  <span>رقم الهاتف</span>
                </label>
                <input
                  type="tel"
                  required
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="05 / 06 / 07..."
                  className="w-full bg-white border border-stone-200/80 rounded-2xl p-4 text-sm font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-stone-600 mr-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>الموعد المفضل</span>
                </label>
                <input
                  type="date"
                  required
                  min={todayStr}
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full bg-white border border-stone-200/80 rounded-2xl p-4 text-sm font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-stone-600 mr-1 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>تفاصيل المشكلة / الخدمة</span>
                </label>
                <textarea
                  required
                  value={serviceDetails}
                  onChange={(e) => setServiceDetails(e.target.value)}
                  placeholder="اشرح ما تحتاجه بوضوح (نوع العطل، العنوان...)"
                  className="w-full bg-white border border-stone-200/80 rounded-2xl p-4 text-sm font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 min-h-[120px]"
                />
              </div>
            </div>

            {/* Price Note */}
            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 flex gap-3">
               <div className="shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-700" />
               </div>
               <p className="text-[11px] font-bold text-amber-900 leading-relaxed">
                  ملاحظة: السعر النهائي يحدده الحرفي بعد المعاينة الميدانية. 
                  {cleanPrice ? ` السعر المبدئي لهذا الحرفي هو ${cleanPrice}.` : ''}
               </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-4 rounded-2xl text-base shadow-lg shadow-emerald-700/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                 <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>تأكيد إرسال الطلب</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
