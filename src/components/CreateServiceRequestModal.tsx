import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  Tag, 
  FileText, 
  MapPin, 
  Clock, 
  Coins, 
  Image as ImageIcon, 
  Trash2, 
  AlertCircle, 
  CheckCircle2,
  Plus
} from 'lucide-react';
import { ServiceRequest, RequestUrgency, UserSession } from '../types';
import { SERVICE_CATEGORIES, getAllWilayas, getCommunesByWilaya } from '../data';
import { serviceRequestRepository } from '../repositories';
import { compressImageFile, getTodayLocalDateString } from '../utils';
import { URGENCY_OPTIONS, validateServiceRequestBudget } from '../domain/serviceRequests';

interface CreateServiceRequestModalProps {
  currentUser: UserSession;
  onClose: () => void;
  onSuccess: (newRequest: ServiceRequest) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const CreateServiceRequestModal: React.FC<CreateServiceRequestModalProps> = ({
  currentUser,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const availableCategories = SERVICE_CATEGORIES.filter(c => c.id !== 'all');
  const allWilayas = getAllWilayas();

  const [category, setCategory] = useState(availableCategories[0]?.id || 'plumbing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [wilaya, setWilaya] = useState(currentUser.wilaya && allWilayas.includes(currentUser.wilaya) ? currentUser.wilaya : allWilayas[0] || 'الجزائر');
  
  const initialCommunes = getCommunesByWilaya(wilaya);
  const [city, setCity] = useState(currentUser.city && initialCommunes.includes(currentUser.city) ? currentUser.city : initialCommunes[0] || '');
  
  const [urgency, setUrgency] = useState<RequestUrgency>('today');
  const [preferredDate, setPreferredDate] = useState(getTodayLocalDateString());
  const [budgetMax, setBudgetMax] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handleWilayaChange = (newWilaya: string) => {
    setWilaya(newWilaya);
    const communes = getCommunesByWilaya(newWilaya);
    setCity(communes[0] || '');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length >= 3) {
      onShowToast('الحد الأقصى للصور هو 3 صور لكل طلب.', 'warning');
      return;
    }

    const file = files[0];
    // Check file size limit before compression (e.g. max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      onShowToast('حجم الصورة كبير جداً، يرجى اختيار صورة أصغر من 10 ميغابايت.', 'error');
      return;
    }

    setIsCompressingPhoto(true);
    try {
      // Compress to 600px width/height and 0.7 quality to keep localStorage ultra-lean
      const compressed = await compressImageFile(file, 600, 0.7);
      setPhotos(prev => [...prev.slice(0, 2), compressed]);
      onShowToast('تمت إضافة الصورة بنجاح.', 'success');
    } catch {
      onShowToast('فشل في معالجة الصورة. يرجى المحاولة بصورة أخرى.', 'error');
    } finally {
      setIsCompressingPhoto(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!title.trim() || title.trim().length < 4) {
      newErrors.title = 'يرجى إدخال عنوان واضح للطلب لا يقل عن 4 أحرف.';
    }

    if (!description.trim() || description.trim().length < 10) {
      newErrors.description = 'يرجى كتابة وصف تفصيلي للمشكلة أو الخدمة لا يقل عن 10 أحرف.';
    }

    if (!wilaya) {
      newErrors.wilaya = 'يرجى اختيار الولاية.';
    }

    if (!city) {
      newErrors.city = 'يرجى اختيار البلدية.';
    }

    let parsedBudget: number | undefined = undefined;
    const budgetValidation = validateServiceRequestBudget(budgetMax);
    if (!budgetValidation.isValid) {
      newErrors.budgetMax = budgetValidation.error || 'يرجى إدخال ميزانية صحيحة (0 أو أكثر) أو ترك الحقل فارغاً.';
    } else {
      parsedBudget = budgetValidation.parsedBudget;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      onShowToast('يرجى تصحيح الأخطاء الموضحة في النموذج.', 'error');
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const newRequest: ServiceRequest = {
        id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        clientId: currentUser.id,
        clientName: currentUser.name,
        clientPhone: currentUser.phone,
        category,
        title: title.trim(),
        description: description.trim(),
        wilaya,
        city,
        photos: photos.length > 0 ? photos : undefined,
        budgetMax: parsedBudget,
        urgency,
        preferredDate: urgency === 'scheduled' ? preferredDate : undefined,
        status: 'open',
        createdAt: new Date().toISOString(),
      };

      const saved = serviceRequestRepository.create(newRequest);
      if (!saved) {
        throw new Error('FAILED_TO_SAVE');
      }

      onShowToast('تم نشر طلب الخدمة بنجاح! ستبدأ باستقبال عروض الحرفيين قريباً.', 'success');
      onSuccess(newRequest);
      onClose();
    } catch {
      onShowToast('حدث خطأ أثناء نشر الطلب. يرجى المحاولة مرة أخرى.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const communes = getCommunesByWilaya(wilaya);

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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-stone-900">طلب خدمة جديدة</h2>
              <p className="text-[10px] text-stone-500 font-bold">انشر حاجتك واستقبل عروض الأسعار من الحرفيين</p>
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
          <form onSubmit={handleSubmit} className="space-y-4 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
            
            {/* 1. Category */}
            <div>
              <label className="block text-xs font-black text-stone-800 mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-stone-500" />
                <span>الخدمة / المهنة المطلوبة <span className="text-rose-600">*</span></span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition"
              >
                {availableCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Request Title */}
            <div>
              <label className="block text-xs font-black text-stone-800 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-stone-500" />
                <span>عنوان الطلب <span className="text-rose-600">*</span></span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: إصلاح تسرب مياه تحت حوض المطبخ"
                className={`w-full bg-white border ${errors.title ? 'border-rose-500 bg-rose-50/20' : 'border-stone-200'} rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition`}
              />
              {errors.title && (
                <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.title}</span>
                </p>
              )}
            </div>

            {/* 3. Description */}
            <div>
              <label className="block text-xs font-black text-stone-800 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-stone-500" />
                <span>وصف المشكلة بالتفصيل <span className="text-rose-600">*</span></span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اشرح المشكلة باختصار، ما الذي يحتاج للإصلاح أو التركيب، وأي تفاصيل تساعد الحرفي في تقدير التكلفة..."
                className={`w-full bg-white border ${errors.description ? 'border-rose-500 bg-rose-50/20' : 'border-stone-200'} rounded-xl p-3 text-xs text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition leading-relaxed`}
              />
              {errors.description && (
                <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.description}</span>
                </p>
              )}
            </div>

            {/* 4. Location: Wilaya & Commune */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-black text-stone-800 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-500" />
                  <span>الولاية <span className="text-rose-600">*</span></span>
                </label>
                <select
                  value={wilaya}
                  onChange={(e) => handleWilayaChange(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition"
                >
                  {allWilayas.map(w => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-stone-800 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-500" />
                  <span>البلدية <span className="text-rose-600">*</span></span>
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition"
                >
                  {communes.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 5. Urgency / Time */}
            <div>
              <label className="block text-xs font-black text-stone-800 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>متى تحتاج الخدمة؟</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {URGENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setUrgency(opt.value)}
                    className={`py-2 px-2.5 rounded-xl border text-right transition flex flex-col justify-center cursor-pointer ${
                      urgency === opt.value
                        ? 'bg-emerald-50/80 border-emerald-700 text-emerald-900 font-black shadow-2xs ring-1 ring-emerald-700/30'
                        : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <span className="text-xs font-bold">{opt.label}</span>
                    <span className="text-[10px] text-stone-500 font-normal">{opt.sublabel}</span>
                  </button>
                ))}
              </div>

              {urgency === 'scheduled' && (
                <div className="mt-2.5">
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">حدد التاريخ المفضل:</label>
                  <input
                    type="date"
                    min={getTodayLocalDateString()}
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                  />
                </div>
              )}
            </div>

            {/* 6. Budget (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-black text-stone-800 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-stone-500" />
                  <span>الميزانية التقريبية المقترحة</span>
                </label>
                <span className="text-[10px] text-stone-400 font-bold">(اختياري)</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  placeholder="مثال: 3000"
                  className={`w-full bg-white border ${errors.budgetMax ? 'border-rose-500 bg-rose-50/20' : 'border-stone-200'} rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition`}
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-stone-400">
                  دج
                </span>
              </div>
              {errors.budgetMax && (
                <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.budgetMax}</span>
                </p>
              )}
            </div>

            {/* 7. Photos (Optional with compression) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-black text-stone-800 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-stone-500" />
                  <span>صور توضيحية للمشكلة</span>
                </label>
                <span className="text-[10px] text-stone-400 font-bold">(اختياري - حتى 3 صور)</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-stone-200 bg-stone-100 group">
                    <img 
                      src={photo} 
                      alt={`صورة ${idx + 1}`} 
                      className="w-full h-full object-cover" 
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 left-1 bg-rose-600/90 text-white p-1 rounded-md hover:bg-rose-700 transition cursor-pointer shadow-xs"
                      aria-label="حذف الصورة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {photos.length < 3 && (
                  <label className="aspect-square border-2 border-dashed border-stone-300 hover:border-emerald-700/60 bg-white hover:bg-emerald-50/20 rounded-xl flex flex-col items-center justify-center p-2 text-center cursor-pointer transition">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={isCompressingPhoto}
                      className="hidden"
                    />
                    {isCompressingPhoto ? (
                      <div className="w-4 h-4 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4 text-stone-400 mb-1" />
                        <span className="text-[10px] font-bold text-stone-600">+ إضافة صورة</span>
                      </>
                    )}
                  </label>
                )}
              </div>
            </div>

            {/* Clarification Note */}
            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold text-emerald-900 leading-relaxed">
                نشر الطلب مجاني. ستتمكن من مقارنة عروض الحرفيين واختيار الأنسب لك بكل حرية.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isCompressingPhoto}
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 px-4 rounded-xl text-xs shadow-md shadow-emerald-700/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>نشر الطلب الآن</span>
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
