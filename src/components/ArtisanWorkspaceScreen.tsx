import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Wrench, 
  CheckCircle2, 
  AlertCircle, 
  Edit3, 
  Phone, 
  MapPin, 
  Sparkles, 
  LogOut, 
  Tag, 
  DollarSign, 
  X, 
  Briefcase,
  Check,
  FileText,
  Camera,
  Loader2,
  User,
  ShieldAlert,
  Eye,
  MessageSquare,
  Clock,
  PhoneCall
} from 'lucide-react';
import { Artisan, UserSession, ServiceContactRequest, ContactRequestStatus } from '../types';
import { SERVICE_CATEGORIES, getAllWilayas, getCommunesByWilaya } from '../data';
import { 
  isValidAlgerianPhone, 
  normalizePhoneNumber, 
  formatPhoneNumber, 
  formatStartingPrice, 
  parseStartingPrice,
  compressImageFile,
  validateExperienceYears,
  clampExperienceYears
} from '../utils';
import { isOwnArtisanProfile, resolveCurrentArtisan, canHandleContactRequest, canEditArtisanProfile, sanitizeArtisanProfileUpdate } from '../domain';
import { contactRequestRepository } from '../repositories';

interface ArtisanWorkspaceScreenProps {
  currentUser: UserSession;
  artisans: Artisan[];
  onLogout: () => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  onSaveArtisanProfile: (newArtisan: Artisan) => void;
  onUpdateArtisanProfile: (updatedArtisan: Artisan) => void;
  onPreviewPublicProfile: (artisan: Artisan) => void;
  onGoToSearch: () => void;
}

export const ArtisanWorkspaceScreen: React.FC<ArtisanWorkspaceScreenProps> = ({
  currentUser,
  artisans,
  onLogout,
  onShowToast,
  onSaveArtisanProfile,
  onUpdateArtisanProfile,
  onPreviewPublicProfile,
  onGoToSearch,
}) => {
  // Resolve active artisan record for current logged-in user using canonical identifier
  const currentArtisan = useMemo(() => {
    return resolveCurrentArtisan(currentUser, artisans);
  }, [currentUser, artisans]);

  // Ownership verification
  const isOwner = useMemo(() => {
    if (!currentArtisan) return true; // Can create new profile
    return isOwnArtisanProfile(currentArtisan, currentUser);
  }, [currentArtisan, currentUser]);

  // Contact Requests Inbox state & handlers
  const [contactRequests, setContactRequests] = useState<ServiceContactRequest[]>([]);

  const refreshContactRequests = () => {
    if (currentArtisan?.id) {
      const requests = contactRequestRepository.getByArtisan(currentArtisan.id);
      setContactRequests(requests);
    } else {
      setContactRequests([]);
    }
  };

  useEffect(() => {
    refreshContactRequests();
  }, [currentArtisan?.id]);

  const handleToggleRequestStatus = (requestId: string, currentStatus: ContactRequestStatus) => {
    const targetRequest = contactRequests.find(r => r.id === requestId);
    if (!canHandleContactRequest(currentUser, targetRequest, currentArtisan)) {
      if (onShowToast) {
        onShowToast('غير مصرح لك بتعديل حالة هذا الطلب.', 'error');
      }
      return;
    }

    const nextStatus: ContactRequestStatus = currentStatus === 'pending' ? 'handled' : 'pending';
    const success = contactRequestRepository.updateStatus(requestId, nextStatus);
    if (success) {
      refreshContactRequests();
      if (onShowToast) {
        onShowToast(
          nextStatus === 'handled' ? 'تم تحديد الطلب كمعالج بنجاح.' : 'تمت إعادة تعيين الطلب كجديد.',
          'success'
        );
      }
    }
  };

  // Determine completeness of professional profile
  const isProfileComplete = Boolean(
    currentArtisan &&
    currentArtisan.profession?.trim() &&
    currentArtisan.category?.trim() &&
    currentArtisan.wilaya?.trim() &&
    currentArtisan.city?.trim() &&
    currentArtisan.phone?.trim() &&
    currentArtisan.services &&
    currentArtisan.services.length > 0
  );

  // Toggle edit state: default to edit mode if profile is missing/incomplete
  const [isEditing, setIsEditing] = useState<boolean>(!isProfileComplete);

  // Form Field States
  const [profession, setProfession] = useState<string>(currentArtisan?.profession || currentUser.profession || '');
  const [category, setCategory] = useState<string>(currentArtisan?.category || 'tech');
  const [wilaya, setWilaya] = useState<string>(currentArtisan?.wilaya || currentUser.wilaya || 'الجزائر');
  const [city, setCity] = useState<string>(currentArtisan?.city || currentUser.city || 'باب الزوار');
  const [phone, setPhone] = useState<string>(currentArtisan?.phone || currentUser.phone || '');
  const [startingPrice, setStartingPrice] = useState<string>(
    currentArtisan?.startingPrice !== null && currentArtisan?.startingPrice !== undefined
      ? String(currentArtisan.startingPrice)
      : ''
  );
  const [availableNow, setAvailableNow] = useState<boolean>(currentArtisan?.availableNow ?? true);
  const [bio, setBio] = useState<string>(currentArtisan?.bio || '');
  const [servicesInput, setServicesInput] = useState<string>(
    currentArtisan?.services ? currentArtisan.services.join('، ') : ''
  );
  const [experienceYears, setExperienceYears] = useState<string>(
    currentArtisan?.experienceYears !== undefined ? String(currentArtisan.experienceYears) : '0'
  );
  const [availableTimes, setAvailableTimes] = useState<string>(
    currentArtisan?.availableTimes || 'طوال الأسبوع (08:00 - 18:00)'
  );

  // Professional Image (Avatar) States
  const [avatar, setAvatar] = useState<string>(currentArtisan?.avatar || '');
  const [avatarPreview, setAvatarPreview] = useState<string>(currentArtisan?.avatar || '');
  const [avatarError, setAvatarError] = useState<boolean>(false);
  const [viewAvatarError, setViewAvatarError] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Form Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync state if currentArtisan updates
  useEffect(() => {
    if (currentArtisan) {
      setProfession(currentArtisan.profession || '');
      setCategory(currentArtisan.category || 'tech');
      setWilaya(currentArtisan.wilaya || 'الجزائر');
      setCity(currentArtisan.city || 'باب الزوار');
      setPhone(currentArtisan.phone || '');
      setStartingPrice(
        currentArtisan.startingPrice !== null && currentArtisan.startingPrice !== undefined
          ? String(currentArtisan.startingPrice)
          : ''
      );
      setAvailableNow(currentArtisan.availableNow ?? true);
      setBio(currentArtisan.bio || '');
      setServicesInput(currentArtisan.services ? currentArtisan.services.join('، ') : '');
      setAvatar(currentArtisan.avatar || '');
      setAvatarPreview(currentArtisan.avatar || '');
      setAvatarError(false);
      setViewAvatarError(false);
      setExperienceYears(currentArtisan.experienceYears !== undefined ? String(currentArtisan.experienceYears) : '0');
      setAvailableTimes(currentArtisan.availableTimes || 'طوال الأسبوع (08:00 - 18:00)');
    }
  }, [currentArtisan]);

  // Initial saved values for dirty state calculation
  const initialFormValues = useMemo(() => {
    return {
      profession: currentArtisan?.profession || '',
      category: currentArtisan?.category || 'tech',
      wilaya: currentArtisan?.wilaya || 'الجزائر',
      city: currentArtisan?.city || 'باب الزوار',
      phone: currentArtisan?.phone || '',
      startingPrice:
        currentArtisan?.startingPrice !== null && currentArtisan?.startingPrice !== undefined
          ? String(currentArtisan.startingPrice)
          : '',
      availableNow: currentArtisan?.availableNow ?? true,
      bio: currentArtisan?.bio || '',
      servicesInput: currentArtisan?.services ? currentArtisan.services.join('، ') : '',
      avatar: currentArtisan?.avatar || '',
      experienceYears: currentArtisan?.experienceYears !== undefined ? String(currentArtisan.experienceYears) : '0',
      availableTimes: currentArtisan?.availableTimes || 'طوال الأسبوع (08:00 - 18:00)',
    };
  }, [currentArtisan]);

  // Derived dirty state
  const isDirty = useMemo(() => {
    if (!currentArtisan) return Boolean(profession.trim() || servicesInput.trim() || avatar.trim());
    return (
      profession !== initialFormValues.profession ||
      category !== initialFormValues.category ||
      wilaya !== initialFormValues.wilaya ||
      city !== initialFormValues.city ||
      phone !== initialFormValues.phone ||
      startingPrice !== initialFormValues.startingPrice ||
      availableNow !== initialFormValues.availableNow ||
      bio !== initialFormValues.bio ||
      servicesInput !== initialFormValues.servicesInput ||
      avatar !== initialFormValues.avatar ||
      experienceYears !== initialFormValues.experienceYears ||
      availableTimes !== initialFormValues.availableTimes
    );
  }, [profession, category, wilaya, city, phone, startingPrice, availableNow, bio, servicesInput, avatar, experienceYears, availableTimes, initialFormValues, currentArtisan]);

  // Derived Profile Completeness / Quality Score
  const profileQuality = useMemo(() => {
    const target = isEditing
      ? {
          name: currentUser.name,
          profession,
          category,
          wilaya,
          city,
          phone,
          services: servicesInput.split(/[،,]/).map(s => s.trim()).filter(Boolean),
          startingPrice: startingPrice.trim() !== '' ? parseStartingPrice(startingPrice) : null,
          bio,
          avatar: avatar.trim() || currentArtisan?.avatar || '',
        }
      : {
          name: currentArtisan?.name || currentUser.name,
          profession: currentArtisan?.profession || '',
          category: currentArtisan?.category || '',
          wilaya: currentArtisan?.wilaya || '',
          city: currentArtisan?.city || '',
          phone: currentArtisan?.phone || '',
          services: currentArtisan?.services || [],
          startingPrice: currentArtisan?.startingPrice,
          bio: currentArtisan?.bio || '',
          avatar: currentArtisan?.avatar || '',
        };

    const items = [
      { id: 'name', label: 'الاسم الكامل', isDone: Boolean(target.name?.trim()), required: true },
      { id: 'profession', label: 'المسمى المهني', isDone: Boolean(target.profession?.trim() && target.profession.trim().length >= 3), required: true },
      { id: 'category', label: 'التخصص المهني', isDone: Boolean(target.category?.trim()), required: true },
      { id: 'location', label: 'الولاية والبلدية', isDone: Boolean(target.wilaya?.trim() && target.city?.trim()), required: true },
      { id: 'phone', label: 'رقم الهاتف الصالح', isDone: Boolean(target.phone?.trim() && isValidAlgerianPhone(target.phone)), required: true },
      { id: 'services', label: 'قائمة الخدمات', isDone: Boolean(target.services && target.services.length > 0), required: true },
      { id: 'startingPrice', label: 'السعر الابتدائي', isDone: Boolean(target.startingPrice !== null && target.startingPrice !== undefined), required: false },
      { id: 'bio', label: 'النبذة التعريفية', isDone: Boolean(target.bio?.trim()), required: false },
      { id: 'avatar', label: 'الصورة المهنية', isDone: Boolean(target.avatar?.trim()), required: false },
    ];

    const completedCount = items.filter(i => i.isDone).length;
    const totalCount = items.length;
    const percentage = Math.round((completedCount / totalCount) * 100);
    const requiredCompleted = items.filter(i => i.required).every(i => i.isDone);
    const missingImportant = items.filter(i => i.required && !i.isDone);

    return {
      percentage,
      completedCount,
      totalCount,
      items,
      requiredCompleted,
      missingImportant,
      isReady: requiredCompleted,
    };
  }, [isEditing, currentArtisan, currentUser, profession, category, wilaya, city, phone, servicesInput, startingPrice, bio, avatar]);

  // Handle Wilaya change & auto-select first commune
  const handleWilayaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setWilaya(selected);
    const availableCommunes = getCommunesByWilaya(selected);
    if (availableCommunes.length > 0) {
      setCity(availableCommunes[0]);
    } else {
      setCity('');
    }
  };

  // Professional Image File Upload & Compression
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast('يرجى اختيار ملف صورة صالح (JPEG, PNG, WebP).', 'warning');
      e.target.value = '';
      return;
    }

    try {
      setIsProcessingImage(true);
      const compressedBase64 = await compressImageFile(file, 400, 0.75);
      setAvatar(compressedBase64);
      setAvatarPreview(compressedBase64);
      setAvatarError(false);
    } catch {
      onShowToast('حدث خطأ أثناء معالجة الصورة. يرجى اختيار صورة أخرى.', 'error');
    } finally {
      setIsProcessingImage(false);
      e.target.value = '';
    }
  };

  // Cancel edit handler: restores initial values and discards unsaved changes
  const handleCancelEdit = () => {
    if (currentArtisan) {
      setProfession(currentArtisan.profession || '');
      setCategory(currentArtisan.category || 'tech');
      setWilaya(currentArtisan.wilaya || 'الجزائر');
      setCity(currentArtisan.city || 'باب الزوار');
      setPhone(currentArtisan.phone || '');
      setStartingPrice(
        currentArtisan.startingPrice !== null && currentArtisan.startingPrice !== undefined
          ? String(currentArtisan.startingPrice)
          : ''
      );
      setAvailableNow(currentArtisan.availableNow ?? true);
      setBio(currentArtisan.bio || '');
      setServicesInput(currentArtisan.services ? currentArtisan.services.join('، ') : '');
      setAvatar(currentArtisan.avatar || '');
      setAvatarPreview(currentArtisan.avatar || '');
      setAvatarError(false);
      setExperienceYears(currentArtisan.experienceYears !== undefined ? String(currentArtisan.experienceYears) : '0');
      setAvailableTimes(currentArtisan.availableTimes || 'طوال الأسبوع (08:00 - 18:00)');
    }
    setErrors({});
    setIsEditing(false);
  };

  // Form Validation & Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (currentArtisan && !isOwner) {
      onShowToast('غير مصرح لك بتعديل هذا الملف المهني.', 'error');
      return;
    }

    const newErrors: Record<string, string> = {};

    if (!profession.trim() || profession.trim().length < 3) {
      newErrors.profession = 'يرجى إدخال مسمى مهني دقيق (مثل: إصلاح أجهزة الكمبيوتر والهواتف).';
    }

    if (!category) {
      newErrors.category = 'يرجى اختيار التخصص المهني.';
    }

    if (!wilaya) {
      newErrors.wilaya = 'يرجى اختيار الولاية.';
    }

    if (!city) {
      newErrors.city = 'يرجى اختيار البلدية.';
    }

    if (!phone.trim() || !isValidAlgerianPhone(phone)) {
      newErrors.phone = 'يرجى إدخال رقم هاتف جزائري صحيح (مثل: 0550123456).';
    }

    const expError = validateExperienceYears(experienceYears);
    if (expError) {
      newErrors.experienceYears = expError;
    }

    const servicesList = servicesInput
      .split(/[،,]/)
      .map(s => s.trim())
      .filter(Boolean);

    if (servicesList.length === 0) {
      newErrors.services = 'يرجى إدخال خدمة واحدة على الأقل تتقنها.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      onShowToast('يرجى تصحيح الأخطاء الموضحة في النموذج.', 'error');
      return;
    }

    setErrors({});
    const normalizedPhoneNum = normalizePhoneNumber(phone);
    const parsedPrice = parseStartingPrice(startingPrice);
    const finalAvatar = avatar.trim() || (currentArtisan?.avatar ?? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80');
    const finalExpYears = clampExperienceYears(experienceYears);
    const finalAvailableTimes = availableTimes.trim() || 'طوال الأسبوع (08:00 - 18:00)';

    if (currentArtisan) {
      if (!canEditArtisanProfile(currentUser, currentArtisan)) {
        onShowToast('غير مصرح لك بتعديل هذا الملف المهني.', 'error');
        return;
      }
      // Update existing Artisan Profile (preserves artisan ID, review history, and verified status)
      const updatedArtisan: Artisan = sanitizeArtisanProfileUpdate(currentArtisan, {
        name: currentUser.name,
        profession: profession.trim(),
        category,
        wilaya,
        city,
        phone: normalizedPhoneNum,
        startingPrice: parsedPrice,
        availableNow,
        bio: bio.trim() || 'حرفي متخصص ومستعد لتلبية طلبات الصيانة والخدمات في المنطقة.',
        services: servicesList,
        avatar: finalAvatar,
        experienceYears: finalExpYears,
        availableTimes: finalAvailableTimes,
      });

      onUpdateArtisanProfile(updatedArtisan);
      setIsEditing(false);
      onShowToast('تم حفظ ونشر تعديلات ملفك المهني بنجاح!', 'success');
    } else {
      // Create new Artisan Profile
      const newArtisan: Artisan = {
        id: `artisan-${Date.now()}`,
        name: currentUser.name,
        profession: profession.trim(),
        category,
        wilaya,
        city,
        phone: normalizedPhoneNum,
        startingPrice: parsedPrice,
        rating: 0,
        reviewCount: 0,
        avatar: finalAvatar,
        verified: false,
        experienceYears: finalExpYears,
        bio: bio.trim() || 'حرفي متخصص ومستعد لتلبية طلبات الصيانة والخدمات في المنطقة.',
        services: servicesList,
        portfolio: [],
        reviews: [],
        availableTimes: finalAvailableTimes,
        availableNow,
      };

      onSaveArtisanProfile(newArtisan);
      setIsEditing(false);
      onShowToast('تم إنشاء ونشر ملفك المهني بنجاح!', 'success');
    }
  };

  const currentCategoryObj = SERVICE_CATEGORIES.find(c => c.id === (currentArtisan?.category || category));
  const availableWilayas = getAllWilayas();
  const availableCommunes = getCommunesByWilaya(wilaya);

  return (
    <div className="flex-1 w-full bg-[#FAF8F5] font-['Cairo',sans-serif]" dir="rtl">
      
      {/* 1. Header with User Identity & Professional Photo */}
      <div className="bg-white border-b border-stone-200/80 pt-5 pb-5 px-5 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 font-black text-lg flex items-center justify-center border border-stone-200/80 overflow-hidden shrink-0">
              {currentArtisan?.avatar?.trim() && !viewAvatarError ? (
                <img
                  src={currentArtisan.avatar}
                  alt={currentArtisan.name}
                  referrerPolicy="no-referrer"
                  onError={() => setViewAvatarError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-emerald-700 text-white font-black text-lg flex items-center justify-center">
                  {currentUser.name.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-stone-900 leading-tight">{currentUser.name}</h1>
                <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-200/80 flex items-center gap-1">
                  <Wrench className="w-2.5 h-2.5 text-emerald-700" />
                  حرفي
                </span>
              </div>
              <p className="text-xs text-stone-500 font-medium mt-0.5">{currentUser.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="p-2 text-stone-400 hover:text-rose-600 hover:bg-stone-100 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
            <span>خروج</span>
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-3.5">

        {/* Ownership Warning (if somehow non-owner visits) */}
        {!isOwner && currentArtisan && (
          <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl flex items-center gap-2 text-rose-800 text-xs font-bold">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span>أنت تتصفح هذا الملف بصفة قراءة فقط، لا تملك صلاحية تعديل بيانات هذا الحرفي.</span>
          </div>
        )}

        {/* أولاً — حالة الملف المهني (Compact Status) */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
          {profileQuality.isReady && profileQuality.percentage === 100 ? (
            /* Concise 100% Ready State */
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <div className="text-xs font-black text-stone-900">الملف جاهز للنشر</div>
                  <span className="text-[11px] font-bold text-emerald-700">100% مكتمل ومنشور للعملاء</span>
                </div>
              </div>

              {!isEditing && isOwner && (
                <div className="flex items-center gap-2">
                  {currentArtisan && (
                    <button
                      type="button"
                      onClick={() => onPreviewPublicProfile(currentArtisan)}
                      className="bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-800 text-xs font-bold py-2 px-3 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-stone-200/80 shadow-2xs"
                      title="معاينة الملف كما يراه العميل"
                    >
                      <Eye className="w-3.5 h-3.5 text-stone-600" />
                      <span>معاينة كعميل</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black py-2 px-3.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل الملف</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Incomplete / In-Progress State */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${profileQuality.isReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black text-stone-900">حالة اكتمال الملف</h2>
                    <span className={`text-[11px] font-bold ${profileQuality.isReady ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {profileQuality.isReady ? 'جاهز للنشر' : 'يحتاج معلومات أساسية'}
                    </span>
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-xs font-black text-stone-900">{profileQuality.percentage}%</span>
                </div>
              </div>

              <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${profileQuality.isReady ? 'bg-emerald-600' : 'bg-amber-500'}`}
                  style={{ width: `${profileQuality.percentage}%` }}
                />
              </div>

              {profileQuality.missingImportant.length > 0 && (
                <div className="pt-0.5">
                  <span className="text-[10px] font-bold text-amber-900 block mb-1">بيانات مطلوبة:</span>
                  <div className="flex flex-wrap gap-1">
                    {profileQuality.missingImportant.map(item => (
                      <span key={item.id} className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <AlertCircle className="w-2.5 h-2.5" />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!isEditing && isOwner && (
                <div className="pt-1 border-t border-stone-100 flex items-center gap-2">
                  {currentArtisan && (
                    <button
                      type="button"
                      onClick={() => onPreviewPublicProfile(currentArtisan)}
                      className="flex-1 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-800 text-xs font-bold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-stone-200/80 shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-stone-600" />
                      <span>معاينة كعميل</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className={`${currentArtisan ? 'flex-1' : 'w-full'} bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black py-2.5 px-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{currentArtisan ? 'تعديل الملف' : 'إكمال البيانات'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content Area: Either Edit Form OR View Mode Sections */}
        {isEditing && isOwner ? (
          /* خامساً — التعديل (Scrollable Form in Clear Groups) */
          <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-stone-900">
                    {currentArtisan ? 'تعديل الملف المهني' : 'إنشاء الملف المهني'}
                  </h3>
                  {isDirty && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      توجد تعديلات غير محفوظة
                    </span>
                  )}
                </div>
              </div>

              {isProfileComplete && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
                  title="إلغاء التعديل"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* الصورة المهنية (Professional Image) */}
              <div className="space-y-2.5 border-b border-stone-100 pb-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-stone-900">
                    الصورة المهنية
                  </label>
                  <span className="text-[10px] font-bold text-stone-400">تظهر للعملاء في الدليل</span>
                </div>
                
                <div className="flex items-center gap-3.5 bg-stone-50/80 p-3 rounded-2xl border border-stone-200/70">
                  <div className="relative w-16 h-16 rounded-2xl bg-emerald-50 border border-stone-200/80 overflow-hidden flex items-center justify-center shrink-0">
                    {avatarPreview?.trim() && !avatarError ? (
                      <img
                        src={avatarPreview}
                        alt="معاينة الصورة المهنية"
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <User className="w-8 h-8 text-emerald-700 stroke-[1.5]" />
                      </div>
                    )}
                    {isProcessingImage && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <input
                      type="file"
                      ref={avatarInputRef}
                      onChange={handleAvatarFileChange}
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isProcessingImage}
                      className="bg-white hover:bg-emerald-50 text-stone-800 hover:text-emerald-800 border border-stone-200 hover:border-emerald-300 text-xs font-bold py-2 px-3 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{avatarPreview ? 'تغيير الصورة' : 'اختيار صورة'}</span>
                    </button>
                    <p className="text-[10px] text-stone-400 font-medium leading-tight">
                      اختر صورة واضحة لملفك (JPG, PNG, WebP).
                    </p>
                  </div>
                </div>
              </div>

              {/* 1. المعلومات الأساسية */}
              <div className="space-y-3">
                <div className="text-xs font-black text-stone-900 border-b border-stone-100 pb-1">
                  1. المعلومات الأساسية
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    المسمى المهني <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={profession}
                    onChange={e => setProfession(e.target.value)}
                    placeholder="مثال: كهربائي منازل وصيانة الشبكات"
                    className={`w-full bg-stone-50 border ${errors.profession ? 'border-rose-500 bg-rose-50/30' : 'border-stone-200'} rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all`}
                  />
                  {errors.profession && (
                    <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{errors.profession}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    التخصص <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className={`w-full bg-stone-50 border ${errors.category ? 'border-rose-500 bg-rose-50/30' : 'border-stone-200'} rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all`}
                  >
                    {SERVICE_CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{errors.category}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* 2. الموقع والتواصل */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-black text-stone-900 border-b border-stone-100 pb-1">
                  2. الموقع والتواصل
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      الولاية <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={wilaya}
                      onChange={handleWilayaChange}
                      className={`w-full bg-stone-50 border ${errors.wilaya ? 'border-rose-500 bg-rose-50/30' : 'border-stone-200'} rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all`}
                    >
                      {availableWilayas.map(w => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      البلدية <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      className={`w-full bg-stone-50 border ${errors.city ? 'border-rose-500 bg-rose-50/30' : 'border-stone-200'} rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all`}
                    >
                      {availableCommunes.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    رقم الهاتف / WhatsApp <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative" dir="ltr">
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="0550123456"
                      className={`w-full bg-stone-50 border ${errors.phone ? 'border-rose-500 bg-rose-50/30' : 'border-stone-200'} rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all text-left`}
                    />
                    <div className="absolute right-3 top-2.5 text-stone-400">
                      <Phone className="w-4 h-4" />
                    </div>
                  </div>
                  {errors.phone && (
                    <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{errors.phone}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* 3. الخدمات والسعر */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-black text-stone-900 border-b border-stone-100 pb-1">
                  3. الخدمات والسعر
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    الخدمات المقدمة (افصل بينها بفاصلة) <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={servicesInput}
                    onChange={e => setServicesInput(e.target.value)}
                    placeholder="مثال: صيانة لوحات الكهرباء، تمديد الأسلاك، تركيب الإنارة"
                    className={`w-full bg-stone-50 border ${errors.services ? 'border-rose-500 bg-rose-50/30' : 'border-stone-200'} rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all leading-relaxed`}
                  />
                  {errors.services && (
                    <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{errors.services}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    السعر الابتدائي التقديري (اختياري)
                  </label>
                  <div className="relative" dir="ltr">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={startingPrice}
                      onChange={e => setStartingPrice(e.target.value)}
                      placeholder="مثال: 1500"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all text-left"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-stone-500 font-bold">د.ج</span>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-0.5">اتركه فارغاً لظهور عبارة "حسب المعاينة".</p>
                </div>
              </div>

              {/* 4. التوفر والخبرة المهنية */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-black text-stone-900 border-b border-stone-100 pb-1">
                  4. التوفر والخبرة الميدانية
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      سنوات الخبرة الميدانية <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={experienceYears}
                      onChange={e => setExperienceYears(e.target.value)}
                      placeholder="مثال: 5"
                      className={`w-full bg-stone-50 border ${errors.experienceYears ? 'border-rose-500 bg-rose-50/30' : 'border-stone-200'} rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all`}
                    />
                    {errors.experienceYears && (
                      <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>{errors.experienceYears}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      أوقات العمل والتوفر <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={availableTimes}
                      onChange={e => setAvailableTimes(e.target.value)}
                      placeholder="طوال الأسبوع (08:00 - 18:00)"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all"
                    />
                  </div>
                </div>

                <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-bold text-stone-800">متاح الآن لاستقبال الطلبات والمكالمات</span>
                    <p className="text-[10px] text-stone-500 font-medium">إظهار شارة التوفر للعملاء في البحث</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={availableNow}
                      onChange={e => setAvailableNow(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-700"></div>
                  </label>
                </div>
              </div>

              {/* 5. النبذة */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-black text-stone-900 border-b border-stone-100 pb-1">
                  5. النبذة التعريفية
                </div>
                <div>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="اكتب نبذة مختصرة عن خبرتك والخدمات التي تقدمها للعملاء..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all leading-relaxed"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-stone-100">
                <button
                  type="submit"
                  disabled={isProcessingImage}
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{currentArtisan ? 'حفظ التغييرات' : 'نشر ملفي المهني'}</span>
                </button>

                {isProfileComplete && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </form>
          </div>
        ) : (
          /* READ-ONLY VIEW: Clean, Calm Sections Matching Account/Search/Favorites */
          currentArtisan && (
            <div className="space-y-3.5">
              {/* ثانياً — المعلومات المهنية وحالة التوفر */}
              <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                      <Briefcase className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs font-black text-stone-900">المعلومات المهنية</h3>
                  </div>
                  <span className="text-[11px] font-bold text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Tag className="w-3 h-3 text-stone-400" />
                    {currentCategoryObj?.name || currentArtisan.category}
                  </span>
                </div>

                {/* Professional Photo in View Mode */}
                <div className="flex items-center gap-3.5 py-1 border-b border-stone-50">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-stone-200/80 overflow-hidden flex items-center justify-center shrink-0">
                    {currentArtisan.avatar?.trim() && !viewAvatarError ? (
                      <img
                        src={currentArtisan.avatar}
                        alt={currentArtisan.name}
                        referrerPolicy="no-referrer"
                        onError={() => setViewAvatarError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <User className="w-7 h-7 text-emerald-700 stroke-[1.5]" />
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-black text-stone-900 block">الصورة المهنية</span>
                    <span className="text-[11px] font-medium text-stone-500">تظهر للعملاء في دليل البحث والملف المهني</span>
                  </div>
                </div>

                {/* Structured Info Rows */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between py-1 border-b border-stone-50">
                    <span className="text-xs font-bold text-stone-500">الاسم</span>
                    <span className="text-xs font-black text-stone-900">{currentArtisan.name}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-stone-50">
                    <span className="text-xs font-bold text-stone-500">المهنة</span>
                    <span className="text-xs font-black text-stone-900">{currentArtisan.profession}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-stone-50">
                    <span className="text-xs font-bold text-stone-500">الموقع</span>
                    <span className="text-xs font-bold text-stone-800 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-700" />
                      <span>{currentArtisan.wilaya} · {currentArtisan.city}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-stone-50">
                    <span className="text-xs font-bold text-stone-500">رقم الهاتف</span>
                    <span className="text-xs font-mono font-bold text-stone-900 flex items-center gap-1" dir="ltr">
                      <Phone className="w-3 h-3 text-emerald-700" />
                      <span>{formatPhoneNumber(currentArtisan.phone)}</span>
                    </span>
                  </div>

                  {/* Inline Available Now Switch */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${currentArtisan.availableNow ? 'bg-emerald-600 animate-pulse' : 'bg-stone-300'}`} />
                      <span className="text-xs font-bold text-stone-800">
                        {currentArtisan.availableNow ? 'متاح لاستقبال الطلبات' : 'غير متاح حالياً'}
                      </span>
                    </div>
                    {isOwner && canEditArtisanProfile(currentUser, currentArtisan) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!canEditArtisanProfile(currentUser, currentArtisan)) return;
                          const updated = { ...currentArtisan, availableNow: !currentArtisan.availableNow };
                          onUpdateArtisanProfile(updated);
                          onShowToast(updated.availableNow ? 'تم تفعيل حالتك: متاح الآن' : 'تم تغيير حالتك إلى: غير متاح حالياً', 'info');
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          currentArtisan.availableNow 
                            ? 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-xs' 
                            : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                        }`}
                      >
                        {currentArtisan.availableNow ? 'متاح' : 'تفعيل'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ثالثاً — الخدمات والأسعار */}
              <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                      <DollarSign className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs font-black text-stone-900">الخدمات والأسعار</h3>
                  </div>

                  <div className="text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-md">
                    {formatStartingPrice(currentArtisan.startingPrice)}
                  </div>
                </div>

                {/* الخدمات */}
                {currentArtisan.services && currentArtisan.services.length > 0 ? (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-stone-400 block">الخدمات المتاحة</span>
                    <div className="flex flex-wrap gap-1.5">
                      {currentArtisan.services.map((svc, idx) => (
                        <span 
                          key={idx}
                          className="bg-stone-50 text-stone-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-stone-200/70 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3 text-emerald-700" />
                          {svc}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* رابعاً — النبذة */}
              {currentArtisan.bio && (
                <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
                    <div className="p-1.5 bg-stone-100 text-stone-700 rounded-lg">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs font-black text-stone-900">النبذة التعريفية</h3>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed font-medium">
                    {currentArtisan.bio}
                  </p>
                </div>
              )}

              {/* خامساً — طلبات التواصل الموجهة للحرفي (Contact Requests Inbox) */}
              {isOwner && currentArtisan && (
                <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                      </div>
                      <h3 className="text-xs font-black text-stone-900">طلبات التواصل</h3>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {contactRequests.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">
                          {contactRequests.length} إجمالي
                        </span>
                      )}
                      {contactRequests.filter(r => r.status === 'pending').length > 0 && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {contactRequests.filter(r => r.status === 'pending').length} جديد
                        </span>
                      )}
                    </div>
                  </div>

                  {contactRequests.length === 0 ? (
                    <div className="py-6 px-4 text-center space-y-1.5 bg-stone-50/70 rounded-xl border border-dashed border-stone-200">
                      <MessageSquare className="w-6 h-6 text-stone-300 mx-auto" />
                      <p className="text-xs font-bold text-stone-700">لا توجد طلبات تواصل حالياً</p>
                      <p className="text-[11px] text-stone-500 font-medium">
                        ستظهر هنا طلبات العملاء المباشرة المرسلة إلى ملفك المهني.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contactRequests.map(req => {
                        const isPending = req.status === 'pending';
                        const formattedDate = new Date(req.createdAt).toLocaleDateString('ar-DZ', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        });

                        return (
                          <div
                            key={req.id}
                            className={`p-3.5 rounded-xl border transition-all ${
                              isPending
                                ? 'bg-emerald-50/30 border-emerald-200/80 shadow-2xs'
                                : 'bg-stone-50/60 border-stone-200/70 opacity-85'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-stone-200/80 flex items-center justify-center text-xs font-black text-stone-700 shrink-0">
                                  {req.customerName.charAt(0)}
                                </div>
                                <div>
                                  <div className="text-xs font-black text-stone-900 leading-tight">
                                    {req.customerName}
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] text-stone-500 font-medium mt-0.5">
                                    <Clock className="w-3 h-3" />
                                    <span>{formattedDate}</span>
                                  </div>
                                </div>
                              </div>

                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                  isPending
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : 'bg-stone-200 text-stone-700 border-stone-300'
                                }`}
                              >
                                {isPending ? 'جديد' : 'تمت المعالجة'}
                              </span>
                            </div>

                            <div className="space-y-1.5 text-xs text-stone-700 mb-3">
                              <div className="flex items-center gap-1.5 font-bold text-stone-900 bg-white/70 p-2 rounded-lg border border-stone-200/60">
                                <Briefcase className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                <span>الخدمة المطلوبة: {req.service}</span>
                              </div>

                              {req.description && (
                                <p className="text-[11.5px] text-stone-600 font-medium bg-white/50 p-2 rounded-lg border border-stone-100 leading-relaxed">
                                  {req.description}
                                </p>
                              )}
                            </div>

                            <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between gap-2">
                              {req.customerPhone ? (
                                <a
                                  href={`tel:${req.customerPhone}`}
                                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-100/60 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                  <span dir="ltr">{formatPhoneNumber(req.customerPhone)}</span>
                                </a>
                              ) : (
                                <span className="text-[11px] text-stone-400 font-medium">الهاتف غير محدد</span>
                              )}

                              <button
                                type="button"
                                onClick={() => handleToggleRequestStatus(req.id, req.status)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                  isPending
                                    ? 'bg-white hover:bg-stone-100 text-stone-700 border-stone-300 shadow-2xs'
                                    : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300'
                                }`}
                              >
                                {isPending ? 'تحديد كمعالج' : 'إعادة تعيين كجديد'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          )
        )}

      </div>
    </div>
  );
};
