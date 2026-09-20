import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Star, MapPin, Clock, Award, 
  Phone, MessageSquare, Heart, Copy, Check, Send, Sparkles, Loader2, Tag, Image as ImageIcon, CheckCircle2, Share2, ShieldCheck, User,
  Briefcase, FileText, Eye
} from 'lucide-react';
import { Artisan, UserSession, OrderItem } from '../types';
import { cleanPhoneForWhatsApp, isArtisan247, formatStartingPrice, formatExperienceYears } from '../utils';
import { orderRepository } from '../repositories';
import { 
  isOwnArtisanProfile, 
  canReviewArtisan, 
  canReviewCompletedOrder,
  canEditReview, 
  canDeleteReview, 
  canCreateContactRequest, 
  canFavoriteArtisan,
  getReviewForOrder,
  isValidRating
} from '../domain';
import { ContactRequestModal } from './ContactRequestModal';

interface ArtisanDetailModalProps {
  artisan: Artisan;
  isFavorite: boolean;
  currentUser?: UserSession | null;
  initialTab?: 'services' | 'portfolio' | 'reviews';
  initialSelectedOrderId?: string;
  onToggleFavorite: (artisanId: string) => void;
  onClose: () => void;
  onAddReview: (artisanId: string, orderId: string, rating: number, comment: string, authorName: string, userId: string) => void;
  onUpdateReview?: (artisanId: string, reviewId: string, rating: number, comment: string, userId: string) => void;
  onDeleteReview?: (artisanId: string, reviewId: string, userId: string) => void;
  onOpenLogin?: () => void;
  onShowToast?: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const ArtisanDetailModal: React.FC<ArtisanDetailModalProps> = ({
  artisan,
  isFavorite,
  currentUser,
  initialTab,
  initialSelectedOrderId,
  onToggleFavorite,
  onClose,
  onAddReview,
  onUpdateReview,
  onDeleteReview,
  onOpenLogin,
  onShowToast,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'services' | 'portfolio' | 'reviews'>(initialTab || 'services');
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [isContactRequestOpen, setIsContactRequestOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAvatarError(false);
  }, [artisan.avatar]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Check if viewing own artisan profile
  const isOwnProfile = isOwnArtisanProfile(artisan, currentUser);

  // Completed Orders by Current User with this Artisan
  const userCompletedOrdersWithArtisan = useMemo(() => {
    if (!currentUser || currentUser.role !== 'user' || !currentUser.id) return [];
    const allUserOrders = orderRepository.getByClient(currentUser.id);
    return allUserOrders.filter(
      o => o.artisanId === artisan.id && o.status === 'completed'
    );
  }, [currentUser, artisan.id]);

  // Eligible Completed Orders for Review (not yet reviewed)
  const eligibleOrdersForReview = useMemo(() => {
    return userCompletedOrdersWithArtisan.filter(
      o => canReviewCompletedOrder(currentUser, o, artisan, artisan.reviews)
    );
  }, [userCompletedOrdersWithArtisan, currentUser, artisan]);

  // Review Form State
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Sync selectedOrderId when eligible orders change or initialSelectedOrderId is passed
  useEffect(() => {
    if (initialSelectedOrderId && eligibleOrdersForReview.some(o => o.id === initialSelectedOrderId)) {
      setSelectedOrderId(initialSelectedOrderId);
    } else if (eligibleOrdersForReview.length > 0) {
      setSelectedOrderId(eligibleOrdersForReview[0].id);
    } else {
      setSelectedOrderId('');
    }
  }, [eligibleOrdersForReview, initialSelectedOrderId]);

  // Find existing review by current user (if any)
  const existingReview = useMemo(() => {
    if (!currentUser) return null;
    return artisan.reviews.find(
      rev => rev.userId === currentUser.id
    ) || null;
  }, [artisan.reviews, currentUser]);

  const hasAlreadyReviewed = !!existingReview;

  const handleCopyPhone = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(artisan.phone);
    }
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
    if (onShowToast) onShowToast('تم نسخ رقم الهاتف بنجاح!', 'info');
  };

  const handleShareProfile = async () => {
    const profileUrl = `${window.location.origin}/artisan/${artisan.id}`;
    const shareData = {
      title: `${artisan.name} - ${artisan.profession}`,
      text: `اكتشف خدمات الحرفي ${artisan.name} (${artisan.profession}) في ${artisan.city}، ${artisan.wilaya} عبر منصة BricojobDz`,
      url: profileUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(profileUrl);
        if (onShowToast) onShowToast('تم نسخ رابط ملف الحرفي بنجاح!', 'success');
      } else {
        if (onShowToast) onShowToast('رابط الملف: ' + profileUrl, 'info');
      }
    } catch {
      if (onShowToast) onShowToast('تعذر نسخ الرابط تلقائياً', 'warning');
    }
  };

  const whatsappPhone = cleanPhoneForWhatsApp(artisan.phone);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingReview || !currentUser) return;

    if (isEditing && existingReview) {
      if (!canEditReview(currentUser, existingReview)) {
        if (onShowToast) onShowToast('غير مصرح لك بتعديل هذا التقييم.', 'error');
        return;
      }
    } else {
      if (!selectedOrderId) {
        if (onShowToast) onShowToast('يرجى تحديد الخدمة المكتملة المراد تقييمها.', 'warning');
        return;
      }
      const targetOrder = orderRepository.getById(selectedOrderId);
      if (!canReviewCompletedOrder(currentUser, targetOrder, artisan, artisan.reviews)) {
        if (onShowToast) onShowToast('غير مصرح لك بتقييم هذه الخدمة.', 'warning');
        return;
      }
    }

    if (!isValidRating(reviewRating)) {
      if (onShowToast) onShowToast('يرجى اختيار التقييم بالنجوم (1 إلى 5).', 'warning');
      return;
    }

    if (!reviewComment.trim()) {
      if (onShowToast) onShowToast('يرجى كتابة تعليق.', 'warning');
      return;
    }

    setIsSubmittingReview(true);
    try {
      if (isEditing && existingReview && onUpdateReview) {
        onUpdateReview(artisan.id, existingReview.id, reviewRating, reviewComment.trim(), currentUser.id);
        setIsEditing(false);
      } else {
        onAddReview(artisan.id, selectedOrderId, reviewRating, reviewComment.trim(), currentUser.name, currentUser.id);
      }
      setReviewComment('');
      setReviewRating(0);
      if (onShowToast) onShowToast('تم نشر تقييمك بنجاح!', 'success');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col font-['Cairo',sans-serif] animate-fade-in max-h-[100dvh]" dir="rtl">
      
      {/* Header Bar */}
      <div className="bg-white border-b border-stone-200/80 flex items-center justify-between px-4 py-3 shrink-0">
        <button onClick={onClose} className="p-2 text-stone-500 active:bg-stone-100 rounded-full cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="إغلاق">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-sm font-black text-stone-900">الملف المهني</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handleShareProfile}
            className="p-2 text-stone-500 hover:text-emerald-700 active:bg-stone-100 rounded-full transition cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="مشاركة الملف"
            aria-label="مشاركة الملف"
          >
            <Share2 className="w-5 h-5" />
          </button>
          {canFavoriteArtisan(currentUser, artisan) && (
            <button
              onClick={() => onToggleFavorite(artisan.id)}
              className={`p-2 rounded-full transition cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center ${isFavorite ? 'text-rose-600' : 'text-stone-400 hover:text-stone-600'}`}
              title="إضافة للمفضلة"
              aria-label="إضافة للمفضلة"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-rose-500' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Client Preview Read-Only Banner */}
      {isOwnProfile && (
        <div className="bg-emerald-50 border-b border-emerald-200/90 px-4 py-2.5 flex items-center justify-between text-xs font-bold text-emerald-950 shrink-0">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-emerald-700" />
            <span>معاينة كعميل (وضع القراءة فقط)</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-medium">هذا ما يراه العملاء عند تصفح ملفك المهني</span>
        </div>
      )}

      {/* Body Scrollable */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-[#FAF8F5]">
        <div className="p-4 space-y-5 pb-36">
          
          {/* Artisan Hero & Trust Info */}
          <div className="flex flex-col items-center text-center gap-2.5">
            <div className="relative">
              {artisan.avatar?.trim() && !avatarError ? (
                <img 
                  src={artisan.avatar} 
                  alt={artisan.name} 
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-sm" 
                />
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-emerald-50 text-emerald-700 flex items-center justify-center border-4 border-white shadow-sm">
                  <User className="w-10 h-10 text-emerald-700 stroke-[1.5]" />
                </div>
              )}
              {artisan.verified && (
                <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-700 text-white p-1 rounded-full border-2 border-white shadow-xs" title="حساب موثق">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-center gap-1.5">
                <h1 className="text-lg font-black text-stone-900">{artisan.name}</h1>
                {artisan.verified && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3 text-emerald-700" />
                    موثق
                  </span>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-xs font-bold text-emerald-700">{artisan.profession}</span>
                <span className="w-1 h-1 rounded-full bg-stone-300" />
                <span className="flex items-center gap-1 text-amber-600 font-bold text-xs">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>{artisan.rating}</span>
                  <span className="text-stone-400 font-medium">({artisan.reviewCount} تقييم)</span>
                </span>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-stone-500 text-xs mt-1">
                <MapPin className="w-3.5 h-3.5 text-stone-400" />
                <span>{artisan.city}، {artisan.wilaya}</span>
              </div>
            </div>
          </div>

          {/* Stats Info Cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white p-2.5 rounded-2xl border border-stone-200/80 shadow-2xs flex flex-col justify-between">
              <span className="text-[9px] text-stone-500 font-bold block mb-1">الخبرة الميدانية</span>
              <div className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="text-xs font-black text-stone-800 leading-tight">{formatExperienceYears(artisan.experienceYears)}</span>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-2xl border border-stone-200/80 shadow-2xs flex flex-col justify-between">
              <span className="text-[9px] text-stone-500 font-bold block mb-1">السعر المبدئي</span>
              <div className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="text-xs font-black text-emerald-700 leading-tight">
                  {formatStartingPrice(artisan.startingPrice)}
                </span>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-2xl border border-stone-200/80 shadow-2xs flex flex-col justify-between">
              <span className="text-[9px] text-stone-500 font-bold block mb-1">خدمات مكتملة</span>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="text-xs font-black text-emerald-800 leading-tight">
                  {artisan.completedJobs || 0} خدمات
                </span>
              </div>
            </div>
          </div>

          {/* Availability */}
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50/60 text-emerald-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-stone-500 font-bold block">أوقات العمل</span>
                <span className="text-xs font-black text-stone-800">{artisan.availableTimes}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {artisan.availableNow && (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  متاح الآن
                </span>
              )}
              {isArtisan247(artisan) && (
                <span className="bg-emerald-700 text-white text-[10px] font-black px-2 py-1 rounded-lg">24/7 طوارئ</span>
              )}
            </div>
          </div>

          {/* Bio / النبذة المهنية */}
          {artisan.bio?.trim() && (
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-stone-700">
                <FileText className="w-3.5 h-3.5 text-emerald-700" />
                <h3 className="text-xs font-black text-stone-900">النبذة المهنية</h3>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed font-medium">
                {artisan.bio}
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex bg-stone-100 p-1 rounded-2xl sticky top-2 z-10 shadow-xs">
            {['services', 'portfolio', 'reviews'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === tab ? 'bg-white text-emerald-700 shadow-xs' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {tab === 'services' ? 'الخدمات' : tab === 'portfolio' ? 'المعرض' : 'التقييمات'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="min-h-[180px]">
            {activeTab === 'services' && (
              <div className="space-y-3 animate-fade-in-up">
                {/* Services Header & Starting Price */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                      <Tag className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-500 font-bold block">السعر المبدئي التقديري</span>
                      <span className="text-xs font-black text-emerald-700">
                        {formatStartingPrice(artisan.startingPrice)}
                      </span>
                    </div>
                  </div>
                  {artisan.startingPrice === 0 && (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-lg">
                      معاينة / استشارة مجانية
                    </span>
                  )}
                </div>

                {/* Services List */}
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-stone-700 px-1">قائمة الخدمات المتاحة ({artisan.services.length})</h3>
                  {artisan.services.map((srv, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-2xl border border-stone-200/80 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span className="text-xs font-bold text-stone-800">{srv}</span>
                      </div>
                      <span className="text-[10px] font-bold text-stone-500 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-100">
                        {formatStartingPrice(artisan.startingPrice)}
                      </span>
                    </div>
                  ))}
                  {artisan.services.length === 0 && (
                    <div className="py-8 text-center text-stone-400 font-bold text-xs bg-white rounded-2xl border border-dashed border-stone-200/80">
                      لم يتم إضافة تفاصيل الخدمات بعد.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'portfolio' && (
              <div className="grid grid-cols-2 gap-3 animate-fade-in-up">
                {artisan.portfolio.map((img, idx) => (
                  <div key={idx} className="aspect-square rounded-2xl overflow-hidden bg-stone-100 border border-stone-200/80 cursor-pointer" onClick={() => setSelectedImage(img)}>
                    <img src={img} alt="عمل" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                ))}
                {artisan.portfolio.length === 0 && (
                   <div className="col-span-2 py-12 text-center text-stone-400 font-bold text-xs bg-white rounded-3xl border border-dashed border-stone-200/80">
                      لا يوجد صور في المعرض حالياً
                   </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4 animate-fade-in-up">
                {!currentUser && (
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 text-center space-y-2.5">
                    <p className="text-xs font-bold text-stone-600">يرجى تسجيل الدخول لتتمكن من إضافة تقييم لهذا الحرفي</p>
                    {onOpenLogin && (
                      <button 
                        type="button" 
                        onClick={() => {
                          onClose();
                          onOpenLogin();
                        }}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer"
                      >
                        تسجيل الدخول الآن
                      </button>
                    )}
                  </div>
                )}

                {currentUser && eligibleOrdersForReview.length > 0 && (
                  <div className="bg-emerald-50/70 p-4 rounded-3xl border border-emerald-200/80 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-700" />
                        <span>أضف تقييمك لخدمة مكتملة</span>
                      </h4>
                      <span className="bg-emerald-200/70 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-md">
                        {eligibleOrdersForReview.length} خدمة مؤهلة
                      </span>
                    </div>

                    <form onSubmit={handleSubmitReview} className="space-y-3">
                      {/* Order Selector (Requirement 23) */}
                      {eligibleOrdersForReview.length > 1 ? (
                        <div className="space-y-1">
                          <label className="text-[11px] font-black text-emerald-900 block">
                            اختر الخدمة المكتملة المراد تقييمها:
                          </label>
                          <select
                            value={selectedOrderId}
                            onChange={(e) => setSelectedOrderId(e.target.value)}
                            className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 shadow-2xs"
                          >
                            {eligibleOrdersForReview.map((ord) => (
                              <option key={ord.id} value={ord.id}>
                                {ord.serviceDetails} ({new Date(ord.createdAt).toLocaleDateString('ar-DZ')})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-200 text-xs font-bold text-stone-800 flex items-center justify-between">
                          <span className="text-emerald-900 font-black">
                            الخدمة: {eligibleOrdersForReview[0]?.serviceDetails}
                          </span>
                          <span className="text-[10px] text-stone-500">
                            {eligibleOrdersForReview[0]?.createdAt ? new Date(eligibleOrdersForReview[0].createdAt).toLocaleDateString('ar-DZ') : 'مكتملة'}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-center gap-1.5 py-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} type="button" onClick={() => setReviewRating(star)} className={`p-1 cursor-pointer transition-transform active:scale-110 ${star <= reviewRating ? 'text-amber-400' : 'text-stone-300'}`}>
                            <Star className={`w-7 h-7 ${star <= reviewRating ? 'fill-current' : ''}`} />
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="كيف كانت تجربتك مع الحرفي والجودة والالتزام بالمواعيد؟"
                        className="w-full bg-white border border-stone-200/80 rounded-xl p-3 text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 min-h-[85px]"
                      />

                      <button type="submit" disabled={isSubmittingReview || !reviewRating || !selectedOrderId} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 rounded-xl text-xs disabled:opacity-50 transition-all cursor-pointer shadow-xs active:scale-98">
                        {isSubmittingReview ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'نشر التقييم'}
                      </button>
                    </form>
                  </div>
                )}

                {currentUser && eligibleOrdersForReview.length === 0 && (
                  <div className="bg-stone-50/80 p-3.5 rounded-2xl border border-stone-200/80 text-center space-y-1">
                    {userCompletedOrdersWithArtisan.length > 0 ? (
                      <p className="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>شكرًا لك! لقد قمت بتقديم تقييم لجميع الخدمات المكتملة مسبقاً.</span>
                      </p>
                    ) : (
                      <p className="text-xs font-bold text-stone-600">
                        يمكنك تقييم الحرفي بعد إتمام الخدمة.
                      </p>
                    )}
                  </div>
                )}
                {artisan.reviews.map((rev) => (
                  <div key={rev.id} className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-stone-900">{rev.userName || (rev as any).authorName || 'مستخدم'}</span>
                      <div className="flex gap-0.5 text-amber-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3 h-3 ${i < rev.rating ? 'fill-current' : 'text-stone-200'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] font-bold text-stone-600 leading-relaxed">{rev.comment}</p>
                  </div>
                ))}
                {artisan.reviews.length === 0 && (
                  <div className="py-10 text-center text-stone-400 font-bold text-xs bg-white rounded-3xl border border-dashed border-stone-200/80">
                    {isOwnProfile ? 'لا توجد تقييمات لملفك المهني حتى الآن.' : 'لا توجد تقييمات لهذا الحرفي حتى الآن. كن أول من يقيّم!'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] bg-white/95 backdrop-blur-md border-t border-stone-200/80 flex flex-col gap-2 z-30">
        
        {/* Contact Request Button (for Customers) */}
        {canCreateContactRequest(currentUser, artisan) && (
          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                if (onShowToast) onShowToast('يرجى تسجيل الدخول أولاً لإرسال طلب تواصل.', 'info');
                if (onOpenLogin) onOpenLogin();
              } else {
                setIsContactRequestOpen(true);
              }
            }}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 active:scale-98 transition-all shadow-xs cursor-pointer min-h-[44px]"
          >
            <Send className="w-4 h-4" />
            <span>طلب تواصل مع الحرفي</span>
          </button>
        )}

        <div className="flex items-center gap-2">
          <a 
            href={`tel:${artisan.phone}`} 
            className="flex-1 bg-stone-900 hover:bg-stone-850 text-white font-black py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-98 transition-all shadow-xs min-h-[44px]"
          >
            <Phone className="w-4 h-4" />
            <span>اتصال هاتفي</span>
          </a>
          <a 
            href={`https://wa.me/${whatsappPhone}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex-1 bg-[#25D366] hover:bg-[#20bd5a] text-white font-black py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-98 transition-all shadow-xs min-h-[44px]"
          >
            <MessageSquare className="w-4 h-4" />
            <span>مراسلة واتساب</span>
          </a>
        </div>
      </div>

      {/* Contact Request Modal */}
      {isContactRequestOpen && (
        <ContactRequestModal
          artisan={artisan}
          currentUser={currentUser}
          onClose={() => setIsContactRequestOpen(false)}
          onShowToast={onShowToast}
        />
      )}

      {/* Lightbox Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-60 bg-black flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="عمل" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
};

