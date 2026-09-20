import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserSession } from '../types';
import { 
  LogOut, 
  User, 
  Camera, 
  Mail, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Heart, 
  Search, 
  FileText, 
  Shield, 
  Sparkles, 
  ChevronLeft,
  Briefcase
} from 'lucide-react';
import { appLocalStorage } from '../repositories/storage';
import { authService } from '../services';
import { compressImageFile, formatPhoneNumber } from '../utils';
import { orderRepository, serviceRequestRepository, favoritesRepository } from '../repositories';

interface AccountScreenProps {
  currentUser: UserSession;
  onLogout: () => void;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({ currentUser, onLogout }) => {
  const navigate = useNavigate();
  
  const [coverImage, setCoverImage] = useState<string | null>(() => {
    return appLocalStorage.getItem<string>(`user_cover_${currentUser.id}`, null);
  });
  
  const [avatarImage, setAvatarImage] = useState<string | undefined>(currentUser.avatar);
  const [avatarError, setAvatarError] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    setAvatarImage(currentUser.avatar);
    setAvatarError(false);
  }, [currentUser.avatar]);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStatusMessage(null);
      const compressedBase64 = await compressImageFile(file, 800, 0.75);
      const isSaved = appLocalStorage.setItem(`user_cover_${currentUser.id}`, compressedBase64);
      if (isSaved) {
        setCoverImage(compressedBase64);
        setStatusMessage({ text: 'تم تحديث صورة الغلاف بنجاح', type: 'success' });
      } else {
        setStatusMessage({ text: 'تعذر حفظ الصورة بسبب امتلاء مساحة التخزين المحلية. يرجى اختيار صورة أخرى.', type: 'error' });
      }
    } catch {
      setStatusMessage({ text: 'حدث خطأ أثناء معالجة الصورة. يرجى اختيار صورة أخرى.', type: 'error' });
    } finally {
      e.target.value = '';
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStatusMessage(null);
      const compressedBase64 = await compressImageFile(file, 400, 0.75);
      const updatedUser = { ...currentUser, avatar: compressedBase64 };
      authService.updateUserSession(updatedUser);
      setAvatarImage(compressedBase64);
      setStatusMessage({ text: 'تم تحديث الصورة الشخصية بنجاح', type: 'success' });
    } catch {
      setStatusMessage({ text: 'حدث خطأ أثناء معالجة الصورة. يرجى اختيار صورة أخرى.', type: 'error' });
    } finally {
      e.target.value = '';
    }
  };

  // Activity Summary based solely on existing repository data
  const clientOrders = useMemo(() => {
    return orderRepository.getByClient(currentUser.id);
  }, [currentUser.id]);

  const completedOrdersCount = useMemo(() => {
    return clientOrders.filter(o => o.status === 'completed').length;
  }, [clientOrders]);

  const serviceRequestsCount = useMemo(() => {
    return serviceRequestRepository.getByClientId(currentUser.id).length;
  }, [currentUser.id]);

  const favoritesCount = useMemo(() => {
    return favoritesRepository.getFavoriteIds(currentUser.id).length;
  }, [currentUser.id]);

  // Account Completion calculation based strictly on existing UserSession fields
  const hasPhone = Boolean(currentUser.phone && currentUser.phone.trim().length > 0);
  const hasLocation = Boolean(currentUser.wilaya && currentUser.wilaya.trim().length > 0);
  const hasAvatar = Boolean(avatarImage && avatarImage.trim().length > 0);

  const missingFields: string[] = [];
  if (!hasPhone) missingFields.push('رقم الهاتف للتواصل المباشر');
  if (!hasLocation) missingFields.push('الولاية والبلدية لتلقي الخدمات القريبة');
  if (!hasAvatar) missingFields.push('الصورة الشخصية');

  // Total canonical points: 1 (Name & Email) + 1 (Phone) + 1 (Location) + 1 (Avatar) = 4
  const totalPoints = 4;
  const completedPoints = 1 + (hasPhone ? 1 : 0) + (hasLocation ? 1 : 0) + (hasAvatar ? 1 : 0);
  const completionPercentage = Math.round((completedPoints / totalPoints) * 100);

  return (
    <div className="flex-1 flex flex-col relative w-full h-full bg-[#FAF8F5] font-['Cairo',sans-serif]" dir="rtl">
      
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-stone-200/80 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
        <div>
          <h1 className="text-base font-black text-stone-900">حسابي</h1>
          <p className="text-[11px] text-stone-500 font-medium">إدارة بياناتك الشخصية ونشاطك</p>
        </div>
        
        <button
          type="button"
          onClick={onLogout}
          className="text-stone-500 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-stone-200/80 shadow-2xs"
          title="تسجيل الخروج"
          aria-label="تسجيل الخروج"
        >
          <LogOut className="w-3.5 h-3.5 text-stone-500" />
          <span>خروج</span>
        </button>
      </div>

      {/* Background Cover / Header Visual */}
      <div className="h-36 sm:h-44 w-full relative bg-stone-200 overflow-hidden shadow-2xs">
        {coverImage ? (
          <img
            src={coverImage}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-stone-300 via-stone-200 to-emerald-50/60 flex items-center justify-center">
            <div className="text-stone-400 text-xs font-bold opacity-60">غلاف الحساب الشخصي</div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-900/25 via-transparent to-stone-900/40" />

        {/* Change Cover Button */}
        <button
          onClick={() => coverInputRef.current?.click()}
          className="absolute top-3 left-3 p-2 bg-white/85 hover:bg-white backdrop-blur-md rounded-xl text-stone-800 transition-all shadow-xs z-10 cursor-pointer flex items-center gap-1.5 text-[11px] font-bold"
          title="تغيير صورة الغلاف"
          aria-label="تغيير صورة الغلاف"
        >
          <Camera className="w-3.5 h-3.5 text-stone-700" />
          <span>تغيير الغلاف</span>
        </button>
        <input 
          type="file" 
          accept="image/*" 
          ref={coverInputRef} 
          onChange={handleCoverChange} 
          className="hidden" 
        />
      </div>

      {/* Profile Identity Card */}
      <div className="px-4 -mt-12 relative z-10">
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm flex flex-col items-center text-center">
          
          {/* Avatar with edit button */}
          <div className="relative -mt-12 mb-2">
            <div className="w-24 h-24 rounded-full border-4 border-white bg-emerald-50 flex items-center justify-center overflow-hidden shadow-sm">
              {avatarImage?.trim() && !avatarError ? (
                <img
                  src={avatarImage}
                  alt={currentUser.name}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-emerald-700 stroke-[1.5]" />
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 rounded-full text-white shadow-md border-2 border-white transition-all cursor-pointer"
              title="تغيير الصورة الشخصية"
              aria-label="تغيير الصورة الشخصية"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input 
              type="file" 
              accept="image/*" 
              ref={avatarInputRef} 
              onChange={handleAvatarChange} 
              className="hidden" 
            />
          </div>

          {/* User Name & Role Badge */}
          <h2 className="text-lg font-black text-stone-900 leading-tight">
            {currentUser.name}
          </h2>

          <div className="mt-1.5 flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2.5 py-0.5 rounded-full text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>حساب عميل</span>
            </span>
          </div>

          <p className="text-[11px] text-stone-400 font-medium mt-1">
            حساب شخصي خاص — لا يظهر في أدلة البحث العامة
          </p>
        </div>
      </div>

      {/* Inline Feedback Notification */}
      {statusMessage && (
        <div className="mt-3 px-4 w-full animate-fade-in">
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Body Content */}
      <div className="px-4 mt-4 space-y-3.5">
        
        {/* 1. حالة اكتمال الحساب (Account Completion) */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${completionPercentage === 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-stone-900">اكتمال الحساب</h3>
                <span className={`text-[11px] font-bold ${completionPercentage === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {completionPercentage === 100 ? 'الحساب مكتمل 100%' : 'توجد بيانات موصى بإضافتها'}
                </span>
              </div>
            </div>
            <span className="text-xs font-black text-stone-900">{completionPercentage}%</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${completionPercentage === 100 ? 'bg-emerald-600' : 'bg-amber-500'}`}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>

          {missingFields.length > 0 ? (
            <div className="pt-1">
              <span className="text-[10px] font-bold text-stone-500 block mb-1">بيانات يمكن إضافتها:</span>
              <div className="flex flex-wrap gap-1">
                {missingFields.map((field, idx) => (
                  <span key={idx} className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <AlertCircle className="w-2.5 h-2.5" />
                    {field}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="pt-0.5 flex items-center gap-1 text-[11px] font-bold text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>جميع المعلومات الأساسية لحسابك متوفرة.</span>
            </div>
          )}
        </div>

        {/* 2. ملخص النشاط (Activity Summary) */}
        <div className="space-y-2">
          <h3 className="text-xs font-black text-stone-700 px-1">ملخص النشاط</h3>
          <div className="grid grid-cols-3 gap-2">
            
            {/* طلبات الخدمة */}
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs hover:border-emerald-300 transition-all text-right flex flex-col justify-between cursor-pointer"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[10px] text-stone-500 font-bold">طلبات الخدمة</span>
                <FileText className="w-3.5 h-3.5 text-emerald-700" />
              </div>
              <span className="text-sm font-black text-stone-900">{serviceRequestsCount}</span>
            </button>

            {/* الطلبات المكتملة */}
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs hover:border-emerald-300 transition-all text-right flex flex-col justify-between cursor-pointer"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[10px] text-stone-500 font-bold">المكتملة</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              </div>
              <span className="text-sm font-black text-emerald-800">{completedOrdersCount}</span>
            </button>

            {/* المفضلة */}
            <button
              type="button"
              onClick={() => navigate('/favorites')}
              className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs hover:border-emerald-300 transition-all text-right flex flex-col justify-between cursor-pointer"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[10px] text-stone-500 font-bold">المفضلة</span>
                <Heart className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <span className="text-sm font-black text-stone-900">{favoritesCount}</span>
            </button>
          </div>
        </div>

        {/* 3. الإجراءات السريعة (Quick Actions) */}
        <div className="space-y-2">
          <h3 className="text-xs font-black text-stone-700 px-1">إجراءات سريعة</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="bg-white hover:bg-emerald-50/40 p-3 rounded-2xl border border-stone-200/80 flex items-center justify-between transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-stone-900 block">طلب خدمة جديد</span>
                  <span className="text-[10px] text-stone-500">نشر طلب لتلقي عروض الحرفيين</span>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-stone-400" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/search')}
              className="bg-white hover:bg-emerald-50/40 p-3 rounded-2xl border border-stone-200/80 flex items-center justify-between transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Search className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-stone-900 block">تصفح الحرفيين</span>
                  <span className="text-[10px] text-stone-500">البحث حسب المهنة والولاية</span>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-stone-400" />
            </button>
          </div>
        </div>

        {/* 4. المعلومات الشخصية (Personal Information) */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs space-y-3">
          <div className="text-xs font-black text-stone-700 border-b border-stone-100 pb-2 flex items-center justify-between">
            <span>المعلومات الشخصية</span>
            <span className="text-[10px] text-stone-400 font-bold">بيانات الحساب المسجلة</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2 text-stone-500 font-bold">
                <User className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>الاسم</span>
              </div>
              <span className="font-extrabold text-stone-900">
                {currentUser.name}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-stone-100">
              <div className="flex items-center gap-2 text-stone-500 font-bold">
                <Mail className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>البريد الإلكتروني</span>
              </div>
              <span className="font-extrabold text-stone-900 dir-ltr text-right">
                {currentUser.email}
              </span>
            </div>

            {currentUser.phone ? (
              <div className="flex items-center justify-between py-1 border-t border-stone-100">
                <div className="flex items-center gap-2 text-stone-500 font-bold">
                  <Phone className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>رقم الهاتف</span>
                </div>
                <span className="font-extrabold text-stone-900 dir-ltr text-right font-mono">
                  {formatPhoneNumber(currentUser.phone)}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between py-1 border-t border-stone-100">
                <div className="flex items-center gap-2 text-stone-500 font-bold">
                  <Phone className="w-4 h-4 text-stone-400 shrink-0" />
                  <span>رقم الهاتف</span>
                </div>
                <span className="text-[11px] font-bold text-stone-400">
                  غير مسجل
                </span>
              </div>
            )}

            {currentUser.wilaya ? (
              <div className="flex items-center justify-between py-1 border-t border-stone-100">
                <div className="flex items-center gap-2 text-stone-500 font-bold">
                  <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>المنطقة</span>
                </div>
                <span className="font-extrabold text-stone-900">
                  {currentUser.city ? `${currentUser.city}، ` : ''}{currentUser.wilaya}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between py-1 border-t border-stone-100">
                <div className="flex items-center gap-2 text-stone-500 font-bold">
                  <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
                  <span>المنطقة</span>
                </div>
                <span className="text-[11px] font-bold text-stone-400">
                  غير مسجلة
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 5. الخصوصية والأمان (Privacy) */}
        <div className="bg-emerald-50/50 border border-emerald-200/60 p-3.5 rounded-2xl flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-emerald-950">الخصوصية والأمان</h4>
            <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
              حسابك محمي وخاص بك. لا يتم إظهار معلوماتك الشخصية إلا عند إرسالك طلب تواصل أو طلب خدمة لحرفي محدد.
            </p>
          </div>
        </div>

        {/* 6. زر تسجيل الخروج (Logout Action) */}
        <button
          type="button"
          onClick={onLogout}
          className="w-full bg-stone-100 hover:bg-stone-200/80 active:scale-[0.99] text-stone-700 font-bold py-3 px-4 rounded-xl text-xs sm:text-sm border border-stone-200/90 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
        >
          <LogOut className="w-4 h-4 text-stone-600" />
          <span>تسجيل الخروج من الحساب</span>
        </button>
      </div>
    </div>
  );
};
