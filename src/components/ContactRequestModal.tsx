import React, { useState, useEffect } from 'react';
import { X, Send, User, Phone, MessageSquare, Tag, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Artisan, UserSession } from '../types';
import { contactRequestRepository } from '../repositories';
import { isValidAlgerianPhone, normalizePhoneNumber, formatStartingPrice } from '../utils';
import { canCreateContactRequest } from '../domain';

interface ContactRequestModalProps {
  artisan: Artisan;
  currentUser?: UserSession | null;
  onClose: () => void;
  onShowToast?: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const ContactRequestModal: React.FC<ContactRequestModalProps> = ({
  artisan,
  currentUser,
  onClose,
  onShowToast,
}) => {
  const [customerName, setCustomerName] = useState(currentUser?.name || '');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || '');
  const [avatarError, setAvatarError] = useState(false);
  const [service, setService] = useState<string>(
    artisan.services && artisan.services.length > 0 ? artisan.services[0] : ''
  );
  const [customService, setCustomService] = useState('');
  const [isCustomService, setIsCustomService] = useState(
    !artisan.services || artisan.services.length === 0
  );
  const [description, setDescription] = useState('');
  const [preferredContact, setPreferredContact] = useState<'phone' | 'whatsapp'>('phone');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!canCreateContactRequest(currentUser, artisan)) {
      if (onShowToast) onShowToast('لا يمكنك إرسال طلب تواصل لملفك المهني الشخصي.', 'warning');
      return;
    }

    const newErrors: Record<string, string> = {};

    if (!customerName.trim()) {
      newErrors.customerName = 'يرجى إدخال اسمك الكامل.';
    }

    if (!customerPhone.trim() || !isValidAlgerianPhone(customerPhone)) {
      newErrors.customerPhone = 'يرجى إدخال رقم هاتف جزائري صحيح (مثال: 0550123456).';
    }

    const selectedService = isCustomService ? customService.trim() : service.trim();
    if (!selectedService) {
      newErrors.service = 'يرجى تحديد أو كتابة الخدمة المطلوبة.';
    }

    if (!description.trim() || description.trim().length < 5) {
      newErrors.description = 'يرجى كتابة وصف مختصر لا يقل عن 5 أحرف لما تحتاجه.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (onShowToast) onShowToast('يرجى تصحيح الأخطاء الموضحة في النموذج.', 'error');
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const normalizedPhone = normalizePhoneNumber(customerPhone);
      contactRequestRepository.save({
        artisanId: artisan.id,
        artisanName: artisan.name,
        customerId: currentUser?.id,
        customerName: customerName.trim(),
        customerPhone: normalizedPhone,
        service: selectedService,
        description: description.trim(),
        preferredContact,
      });

      if (onShowToast) {
        onShowToast('تم إرسال طلب التواصل بنجاح! سيتواصل معك الحرفي قريباً.', 'success');
      }
      onClose();
    } catch {
      if (onShowToast) {
        onShowToast('حدث خطأ أثناء إرسال الطلب. يرجى المحاولة لاحقاً.', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-['Cairo',sans-serif] animate-fade-in" 
      dir="rtl"
    >
      <div 
        className="bg-white w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-3xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden border border-stone-200/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white border-b border-stone-200/80 flex items-center justify-between px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-stone-900">طلب تواصل مع الحرفي</h2>
              <p className="text-[10px] text-stone-500 font-bold">أرسل تفاصيل ما تحتاجه وسيتواصل معك مباشرة</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-2 text-stone-400 hover:text-stone-700 active:bg-stone-100 rounded-full transition cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto bg-[#FAF8F5] p-5 space-y-4">
          
          {/* Artisan Summary Badge */}
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs border border-stone-200/60 overflow-hidden">
              {artisan.avatar?.trim() && !avatarError ? (
                <img 
                  src={artisan.avatar} 
                  alt={artisan.name} 
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-full h-full object-cover" 
                />
              ) : (
                <User className="w-5 h-5 text-emerald-700 stroke-[1.5]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-stone-900 truncate">{artisan.name}</h3>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  {formatStartingPrice(artisan.startingPrice)}
                </span>
              </div>
              <p className="text-[11px] font-bold text-emerald-700 truncate">{artisan.profession}</p>
              <p className="text-[10px] text-stone-400 font-medium truncate">{artisan.city}، {artisan.wilaya}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Customer Name */}
            <div>
              <label className="block text-xs font-black text-stone-800 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-stone-500" />
                <span>الاسم الكامل <span className="text-rose-600">*</span></span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="أدخل اسمك"
                className={`w-full bg-white border ${errors.customerName ? 'border-rose-500 bg-rose-50/20' : 'border-stone-200'} rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition`}
              />
              {errors.customerName && (
                <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.customerName}</span>
                </p>
              )}
            </div>

            {/* Customer Phone */}
            <div>
              <label className="block text-xs font-black text-stone-800 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-stone-500" />
                <span>رقم الهاتف للتواصل <span className="text-rose-600">*</span></span>
              </label>
              <div className="relative" dir="ltr">
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0550123456"
                  className={`w-full bg-white border ${errors.customerPhone ? 'border-rose-500 bg-rose-50/20' : 'border-stone-200'} rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition text-left`}
                />
              </div>
              {errors.customerPhone && (
                <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.customerPhone}</span>
                </p>
              )}
            </div>

            {/* Preferred Contact Mode */}
            <div>
              <label className="block text-xs font-black text-stone-800 mb-1.5">
                وسيلة التواصل المفضلة
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPreferredContact('phone')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    preferredContact === 'phone'
                      ? 'bg-emerald-50 border-emerald-700 text-emerald-800 font-black shadow-2xs'
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-700" />
                  <span>اتصال هاتفي</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredContact('whatsapp')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    preferredContact === 'whatsapp'
                      ? 'bg-emerald-50 border-emerald-700 text-emerald-800 font-black shadow-2xs'
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>عبر واتساب</span>
                </button>
              </div>
            </div>

            {/* Service Selection */}
            <div>
              <label className="block text-xs font-black text-stone-800 mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-stone-500" />
                <span>الخدمة المطلوبة <span className="text-rose-600">*</span></span>
              </label>

              {artisan.services && artisan.services.length > 0 && !isCustomService ? (
                <div className="space-y-2">
                  <select
                    value={service}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomService(true);
                        setCustomService('');
                      } else {
                        setService(e.target.value);
                      }
                    }}
                    className={`w-full bg-white border ${errors.service ? 'border-rose-500 bg-rose-50/20' : 'border-stone-200'} rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition`}
                  >
                    {artisan.services.map((svc, idx) => (
                      <option key={idx} value={svc}>
                        {svc}
                      </option>
                    ))}
                    <option value="__custom__">+ خدمة أخرى غير موجودة في القائمة</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={customService}
                    onChange={(e) => setCustomService(e.target.value)}
                    placeholder="مثال: تصليح تسريب ماء في الحمام"
                    className={`w-full bg-white border ${errors.service ? 'border-rose-500 bg-rose-50/20' : 'border-stone-200'} rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition`}
                  />
                  {artisan.services && artisan.services.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomService(false);
                        setService(artisan.services[0]);
                      }}
                      className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                    >
                      ← العودة للاختيار من قائمة خدمات الحرفي
                    </button>
                  )}
                </div>
              )}
              {errors.service && (
                <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.service}</span>
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-black text-stone-800 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-stone-500" />
                <span>وصف مختصر للحاجة أو العطل <span className="text-rose-600">*</span></span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اشرح المشكلة باختصار وموقعك التقريبي لتسهيل استجابة الحرفي..."
                className={`w-full bg-white border ${errors.description ? 'border-rose-500 bg-rose-50/20' : 'border-stone-200'} rounded-xl p-3 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition leading-relaxed`}
              />
              {errors.description && (
                <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.description}</span>
                </p>
              )}
            </div>

            {/* Price Clarification Notice */}
            <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200/80 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold text-amber-900 leading-relaxed">
                طلب التواصل مجاني ولا يلزمك بشيء. السعر النهائي يحدده الحرفي بعد التواصل والمعاينة.
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center gap-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 px-4 rounded-xl text-xs shadow-md shadow-emerald-700/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>إرسال طلب التواصل</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-3 px-4 rounded-xl text-xs transition cursor-pointer min-h-[44px]"
              >
                إلغاء
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};
