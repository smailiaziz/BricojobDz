import React, { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Clock, 
  Coins, 
  Tag, 
  Send, 
  CheckCircle2, 
  Star, 
  ShieldCheck, 
  User, 
  Phone, 
  AlertCircle,
  Calendar,
  Layers,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { ServiceRequest, ServiceOffer, UserSession, Artisan } from '../types';
import { serviceRequestRepository, serviceOfferRepository } from '../repositories';
import { SERVICE_CATEGORIES } from '../data';
import { getStatusBadgeInfo, getUrgencyInfo, validateServiceOfferPrice } from '../domain/serviceRequests';
import { resolveCurrentArtisan } from '../domain/artisan';
import { canSubmitOffer, canAcceptOffer, canCancelServiceRequest, acceptOfferAndCreateOrder } from '../domain';
import { formatStartingPrice, formatPhoneNumber } from '../utils';

interface ServiceRequestDetailModalProps {
  request: ServiceRequest;
  currentUser: UserSession | null;
  artisans: Artisan[];
  onClose: () => void;
  onRefresh: () => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  onSelectArtisan?: (artisan: Artisan) => void;
}

export const ServiceRequestDetailModal: React.FC<ServiceRequestDetailModalProps> = ({
  request: initialRequest,
  currentUser,
  artisans,
  onClose,
  onRefresh,
  onShowToast,
  onSelectArtisan,
}) => {
  const [request, setRequest] = useState<ServiceRequest>(initialRequest);
  const [offers, setOffers] = useState<ServiceOffer[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Artisan Offer Form State
  const [proposedPrice, setProposedPrice] = useState<string>('');
  const [estimatedDuration, setEstimatedDuration] = useState<string>('');
  const [artisanMessage, setArtisanMessage] = useState<string>('');
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);
  const [offerErrors, setOfferErrors] = useState<Record<string, string>>({});

  // Accept Offer Confirmation State
  const [confirmingOffer, setConfirmingOffer] = useState<ServiceOffer | null>(null);
  const [isAcceptingOffer, setIsAcceptingOffer] = useState(false);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const isOwner = currentUser?.id === request.clientId;
  const isArtisan = currentUser?.role === 'artisan';
  const currentArtisan = isArtisan ? resolveCurrentArtisan(currentUser, artisans) : null;

  // Reload request and offers
  const loadData = () => {
    const updatedReq = serviceRequestRepository.getById(request.id);
    if (updatedReq) {
      setRequest(updatedReq);
    }
    const reqOffers = serviceOfferRepository.getByRequestId(request.id);
    setOffers(reqOffers);
  };

  useEffect(() => {
    loadData();
  }, [request.id]);

  const categoryItem = SERVICE_CATEGORIES.find(c => c.id === request.category);
  const statusInfo = getStatusBadgeInfo(request.status);
  const urgencyInfo = getUrgencyInfo(request.urgency);

  const myArtisanOffer = isArtisan && currentArtisan 
    ? offers.find(o => o.artisanId === currentArtisan.id)
    : null;

  // Handle Artisan Submitting Offer
  const handleSubmitOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentArtisan) {
      onShowToast('يرجى تسجيل الدخول كحرفي لتقديم عرض.', 'error');
      return;
    }

    if (!canSubmitOffer(currentUser, request, currentArtisan, offers)) {
      if (myArtisanOffer) {
        onShowToast('لقد قمت بتقديم عرض مسبقاً على هذا الطلب.', 'warning');
      } else if (request.clientId === currentUser.id) {
        onShowToast('لا يمكنك تقديم عرض على طلبك الشخصي.', 'warning');
      } else if (
        request.category &&
        currentArtisan.category &&
        request.category.toLowerCase() !== currentArtisan.category.toLowerCase()
      ) {
        onShowToast('هذا الطلب مخصص لمجال مهني مختلف عن تخصصك.', 'warning');
      } else {
        onShowToast('غير مصرح لك بتقديم عرض على هذا الطلب.', 'error');
      }
      return;
    }

    const offerValidation = validateServiceOfferPrice(proposedPrice);
    if (!offerValidation.isValid || offerValidation.parsedPrice === undefined) {
      setOfferErrors({ price: offerValidation.error || 'يرجى إدخال سعر مقترح صحيح بالدينار الجزائري.' });
      return;
    }
    const priceNum = offerValidation.parsedPrice;

    setOfferErrors({});
    setIsSubmittingOffer(true);

    try {
      const newOffer: ServiceOffer = {
        id: `off-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        requestId: request.id,
        artisanId: currentArtisan.id,
        artisanName: currentArtisan.name,
        artisanProfession: currentArtisan.profession,
        artisanAvatar: currentArtisan.avatar,
        artisanRating: currentArtisan.rating,
        artisanReviewCount: currentArtisan.reviewCount,
        artisanPhone: currentArtisan.phone,
        proposedPrice: priceNum,
        estimatedDuration: estimatedDuration.trim() || undefined,
        message: artisanMessage.trim() || undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      const saved = serviceOfferRepository.create(newOffer);
      if (!saved) {
        throw new Error('FAILED_TO_CREATE_OFFER');
      }

      // Update request status to 'offers_received' if it was 'open'
      if (request.status === 'open') {
        serviceRequestRepository.updateStatus(request.id, 'offers_received');
      }

      onShowToast('تم إرسال عرضك بنجاح! سيتمكن العميل من مراجعته والتواصل معك.', 'success');
      loadData();
      onRefresh();
    } catch {
      onShowToast('حدث خطأ أثناء إرسال العرض. يرجى المحاولة لاحقاً.', 'error');
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  // Initiate Client Accepting an Offer (Opens Confirmation Dialog)
  const handleInitiateAcceptOffer = (offer: ServiceOffer) => {
    if (!canAcceptOffer(currentUser, request, offer)) {
      if (!isOwner) {
        onShowToast('غير مصرح لك بقبول هذا العرض.', 'error');
      } else if (request.status === 'assigned') {
        onShowToast('تم تعيين حرفي لهذا الطلب مسبقاً.', 'warning');
      } else {
        onShowToast('لا يمكن قبول هذا العرض في وضعه الحالي.', 'warning');
      }
      return;
    }
    setConfirmingOffer(offer);
  };

  // Confirm and Execute Accepting an Offer (Atomic execution with rollback & verification)
  const confirmAcceptOffer = (offer: ServiceOffer) => {
    setIsAcceptingOffer(true);
    try {
      const result = acceptOfferAndCreateOrder(currentUser, request.id, offer.id);
      if (result.success && result.order) {
        onShowToast(`تم قبول عرض ${offer.artisanName || 'الحرفي'} بنجاح! يمكنك الآن التواصل لتنفيذ الخدمة.`, 'success');
      } else {
        if (result.error === 'INVALID_PROPOSED_PRICE') {
          onShowToast('عذراً، يحتوي العرض على سعر غير صالح.', 'error');
        } else if (result.error === 'NOT_REQUEST_OWNER' || result.error === 'UNAUTHORIZED') {
          onShowToast('غير مصرح لك بقبول هذا العرض.', 'error');
        } else if (result.error === 'CROSS_RESOURCE_MISMATCH') {
          onShowToast('العرض المختار لا ينتمي إلى هذا الطلب.', 'error');
        } else {
          onShowToast('عذراً، لم نتمكن من إتمام قبول العرض. يرجى المحاولة لاحقاً.', 'error');
        }
      }
      setConfirmingOffer(null);
      loadData();
      onRefresh();
    } catch {
      onShowToast('حدث خطأ أثناء قبول العرض. يرجى المحاولة مرة أخرى.', 'error');
    } finally {
      setIsAcceptingOffer(false);
    }
  };

  // Handle Client Cancelling Request
  const handleCancelRequest = () => {
    if (!canCancelServiceRequest(currentUser, request)) {
      onShowToast('لا يمكن إلغاء هذا الطلب في حالته الحالية.', 'warning');
      return;
    }

    const confirmed = window.confirm('هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟');
    if (!confirmed) return;

    try {
      serviceRequestRepository.cancel(request.id, currentUser.id);
      onShowToast('تم إلغاء الطلب بنجاح.', 'info');
      loadData();
      onRefresh();
      onClose();
    } catch {
      onShowToast('حدث خطأ أثناء إلغاء الطلب.', 'error');
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-['Cairo',sans-serif] animate-fade-in" 
      dir="rtl"
    >
      <div 
        className="bg-white w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-3xl max-h-[94dvh] flex flex-col shadow-2xl overflow-hidden border border-stone-200/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-white border-b border-stone-200/80 flex items-center justify-between px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="p-1.5 -mr-1.5 text-stone-500 hover:text-stone-800 active:bg-stone-100 rounded-full transition cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="رجوع"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm font-black text-stone-900 leading-tight">تفاصيل طلب الخدمة</h2>
              <span className="text-[10px] text-stone-500 font-bold">
                {new Date(request.createdAt).toLocaleDateString('ar-DZ', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>

          <div className={`px-2.5 py-1 rounded-full text-[11px] font-black border flex items-center gap-1.5 ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}>
            <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
            <span>{statusInfo.label}</span>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto bg-[#FAF8F5] p-5 space-y-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          
          {/* 1. Request Core Details Card */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-3">
            
            {/* Title & Category Badge */}
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-base font-black text-stone-900 leading-snug">
                {request.title}
              </h1>
              <span className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-100">
                {categoryItem?.name || request.category}
              </span>
            </div>

            {/* Meta Tags (Location, Urgency, Budget) */}
            <div className="flex flex-wrap gap-2 pt-1 text-xs">
              <div className="flex items-center gap-1 text-stone-600 bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200/60 font-bold">
                <MapPin className="w-3.5 h-3.5 text-stone-500" />
                <span>{request.city}، {request.wilaya}</span>
              </div>

              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold ${urgencyInfo.badgeColor}`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{urgencyInfo.label}</span>
              </div>

              {request.budgetMax !== undefined && request.budgetMax !== null && (
                <div className="flex items-center gap-1 text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 font-black">
                  <Coins className="w-3.5 h-3.5 text-amber-600" />
                  <span>الميزانية: {request.budgetMax === 0 ? 'مجاني / تطوعي' : `${request.budgetMax} دج`}</span>
                </div>
              )}

              {request.preferredDate && request.urgency === 'scheduled' && (
                <div className="flex items-center gap-1 text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/60 font-bold">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>الموعد: {request.preferredDate}</span>
                </div>
              )}
            </div>

            {/* Description Text */}
            <div className="pt-2 border-t border-stone-100">
              <h3 className="text-xs font-black text-stone-800 mb-1">وصف الطلب:</h3>
              <p className="text-xs text-stone-700 font-medium leading-relaxed whitespace-pre-line bg-[#FAF8F5] p-3 rounded-xl border border-stone-200/60">
                {request.description}
              </p>
            </div>

            {/* Photos (if attached) */}
            {request.photos && request.photos.length > 0 && (
              <div className="pt-1">
                <h3 className="text-xs font-black text-stone-800 mb-2">الصور المرفقة ({request.photos.length}):</h3>
                <div className="grid grid-cols-3 gap-2">
                  {request.photos.map((photo, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedPhoto(photo)}
                      className="aspect-square rounded-xl overflow-hidden border border-stone-200 bg-stone-100 cursor-pointer hover:opacity-90 transition"
                    >
                      <img src={photo} alt={`مرفق ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Photo Lightbox Modal */}
          {selectedPhoto && (
            <div 
              className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4 animate-fade-in"
              onClick={() => setSelectedPhoto(null)}
            >
              <button 
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-4 right-4 p-2 text-white bg-stone-800/80 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
              <img 
                src={selectedPhoto} 
                alt="صورة مكبرة" 
                className="max-w-full max-h-[85dvh] rounded-2xl object-contain shadow-2xl" 
              />
            </div>
          )}

          {/* 3. Section for ARTISAN view */}
          {isArtisan && (
            <div className="space-y-4">
              {myArtisanOffer ? (
                // Artisan Already Submitted an Offer Card
                <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                      <h3 className="text-xs font-black text-stone-900">عرضك المقدم لهذا الطلب</h3>
                    </div>
                    <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-md ${
                      myArtisanOffer.status === 'accepted' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : myArtisanOffer.status === 'not_selected'
                          ? 'bg-stone-100 text-stone-600'
                          : myArtisanOffer.status === 'withdrawn'
                            ? 'bg-stone-100 text-stone-500'
                            : myArtisanOffer.status === 'rejected'
                              ? 'bg-stone-100 text-stone-500'
                              : 'bg-amber-50 text-amber-800'
                    }`}>
                      {myArtisanOffer.status === 'accepted'
                        ? '✓ تم اختيار عرضك'
                        : myArtisanOffer.status === 'not_selected'
                          ? 'لم يتم اختيار عرضك'
                          : myArtisanOffer.status === 'withdrawn'
                            ? 'تم سحب عرضك'
                            : myArtisanOffer.status === 'rejected'
                              ? 'حالة قديمة'
                              : 'قيد مراجعة العميل'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
                    <div>
                      <span className="text-[10px] text-emerald-800 font-bold block">السعر المقترح من طرفك:</span>
                      <span className="text-base font-black text-emerald-900">
                        {myArtisanOffer.proposedPrice === 0 ? 'مجاني / استشارة مجانية' : `${myArtisanOffer.proposedPrice} دج`}
                      </span>
                    </div>
                    {myArtisanOffer.estimatedDuration && (
                      <div className="text-left">
                        <span className="text-[10px] text-emerald-800 font-bold block">المدة المقدرة:</span>
                        <span className="text-xs font-black text-stone-800">{myArtisanOffer.estimatedDuration}</span>
                      </div>
                    )}
                  </div>

                  {myArtisanOffer.message && (
                    <div className="text-xs text-stone-700 bg-stone-50 p-2.5 rounded-xl border border-stone-200/60 font-medium">
                      <span className="text-[10px] font-bold text-stone-500 block mb-0.5">رسالتك للعميل:</span>
                      {myArtisanOffer.message}
                    </div>
                  )}

                  {myArtisanOffer.status === 'accepted' && (
                    <div className="bg-emerald-700 text-white p-3.5 rounded-xl space-y-1.5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        <span className="text-xs font-black">مبروك! العميل اختار عرضك.</span>
                      </div>
                      <p className="text-[11px] text-emerald-100 font-medium">
                        صاحب الطلب: {request.clientName || 'العميل'} 
                        {request.clientPhone ? ` — هاتف: ${formatPhoneNumber(request.clientPhone)}` : ''}
                      </p>
                    </div>
                  )}
                </div>
              ) : request.status === 'open' || request.status === 'offers_received' ? (
                // Artisan Offer Submission Form
                <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-stone-900">تقديم عرض سعر لهذا الطلب</h3>
                      <p className="text-[10px] text-stone-500 font-bold">قدّم سعرك المقترح وموعد جاهزيتك للعميل</p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmitOffer} className="space-y-3 pt-1">
                    <div>
                      <label className="block text-xs font-black text-stone-800 mb-1">
                        السعر المقترح (دج) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        required
                        value={proposedPrice}
                        onChange={(e) => setProposedPrice(e.target.value)}
                        placeholder="مثال: 2500"
                        className={`w-full bg-white border ${offerErrors.price ? 'border-rose-500 bg-rose-50/20' : 'border-stone-200'} rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700`}
                      />
                      {offerErrors.price && (
                        <p className="text-[10px] font-bold text-rose-600 mt-1">{offerErrors.price}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-black text-stone-800 mb-1">
                        المدة المتوقعة للإنجاز <span className="text-stone-400 font-normal text-[10px]">(اختياري)</span>
                      </label>
                      <input
                        type="text"
                        value={estimatedDuration}
                        onChange={(e) => setEstimatedDuration(e.target.value)}
                        placeholder="مثال: ساعتان / يوم عمل واحد"
                        className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-stone-800 mb-1">
                        ملاحظة أو رسالة للعميل <span className="text-stone-400 font-normal text-[10px]">(اختياري)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={artisanMessage}
                        onChange={(e) => setArtisanMessage(e.target.value)}
                        placeholder="مثال: أستطيع الحضور اليوم بعد الساعة 17:00 مع كافة الأدوات المطلوبة..."
                        className="w-full bg-white border border-stone-200 rounded-xl p-3 text-xs text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingOffer}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 px-4 rounded-xl text-xs shadow-md shadow-emerald-700/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
                    >
                      {isSubmittingOffer ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>إرسال العرض للعميل</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="bg-stone-100 p-4 rounded-2xl text-center text-xs font-bold text-stone-600">
                  هذا الطلب لم يعد يستقبل عروضاً جديدة ({statusInfo.label}).
                </div>
              )}
            </div>
          )}

          {/* 4. Section for CLIENT / OWNER view: Offers List */}
          {isOwner && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-700" />
                  <span>عروض الحرفيين المقدمة ({offers.length})</span>
                </h3>
              </div>

              {offers.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-dashed border-stone-200 text-center space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-black text-stone-800">لم تصل عروض بعد</h4>
                  <p className="text-[11px] text-stone-500 font-medium max-w-xs mx-auto">
                    طلبك منشور ومتاح للحرفيين المتخصصين. ستظهر عروض الأسعار هنا فور تقديمها.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {offers.map((offer) => {
                    const matchedArtisan = artisans.find(a => a.id === offer.artisanId);
                    const isAccepted = offer.status === 'accepted';
                    const isNotSelected = offer.status === 'not_selected';
                    const isLegacyRejected = offer.status === 'rejected';

                    return (
                      <div 
                        key={offer.id}
                        className={`bg-white p-4 rounded-2xl border transition-all ${
                          isAccepted 
                            ? 'border-emerald-700 ring-2 ring-emerald-700/20 shadow-sm' 
                            : (isNotSelected || isLegacyRejected)
                              ? 'border-stone-200 opacity-70 bg-stone-50/50' 
                              : 'border-stone-200/90 shadow-2xs hover:border-stone-300'
                        }`}
                      >
                        {/* Artisan Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0 border border-stone-200/80 overflow-hidden">
                              {offer.artisanAvatar ? (
                                <img src={offer.artisanAvatar} alt={offer.artisanName} className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-black text-stone-900">{offer.artisanName || 'حرفي Bricojob'}</h4>
                                {matchedArtisan?.verified && (
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                )}
                              </div>
                              <p className="text-[10px] font-bold text-emerald-700">{offer.artisanProfession || 'حرفي متخصص'}</p>
                              
                              <div className="flex items-center gap-1 text-[10px] text-stone-500 font-semibold mt-0.5">
                                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                <span>{offer.artisanRating ? offer.artisanRating.toFixed(1) : 'جديد'}</span>
                                {offer.artisanReviewCount ? <span>({offer.artisanReviewCount} تقييم)</span> : null}
                              </div>
                            </div>
                          </div>

                          {/* Price Tag */}
                          <div className="text-left shrink-0">
                            <span className="text-sm font-black text-emerald-900 block">
                              {offer.proposedPrice === 0 ? 'مجاني / استشارة مجانية' : `${offer.proposedPrice} دج`}
                            </span>
                            {offer.estimatedDuration && (
                              <span className="text-[10px] text-stone-500 font-bold block">{offer.estimatedDuration}</span>
                            )}
                          </div>
                        </div>

                        {/* Message */}
                        {offer.message && (
                          <p className="mt-3 text-xs text-stone-700 bg-[#FAF8F5] p-2.5 rounded-xl border border-stone-200/60 font-medium">
                            "{offer.message}"
                          </p>
                        )}

                        {/* Offer Footer & Actions */}
                        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                          {matchedArtisan && onSelectArtisan ? (
                            <button
                              type="button"
                              onClick={() => onSelectArtisan(matchedArtisan)}
                              className="text-[11px] font-bold text-stone-600 hover:text-emerald-700 hover:underline cursor-pointer"
                            >
                              عرض الملف المهني للحرفي
                            </button>
                          ) : <div />}

                          {isAccepted ? (
                            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-black border border-emerald-200">
                              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                              <span>تم اختيار هذا الحرفي</span>
                            </div>
                          ) : isNotSelected ? (
                            <span className="text-[11px] font-bold text-stone-500">لم يتم اختيار هذا العرض</span>
                          ) : isLegacyRejected ? (
                            <span className="text-[11px] font-bold text-stone-400">عرض مستبعد</span>
                          ) : canAcceptOffer(currentUser, request, offer) ? (
                            <button
                              type="button"
                              onClick={() => handleInitiateAcceptOffer(offer)}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white font-black py-2 px-4 rounded-xl text-xs shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>قبول العرض واختيار الحرفي</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-stone-400">مغلق</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cancel Request Button */}
              {canCancelServiceRequest(currentUser, request) && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={handleCancelRequest}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer py-2"
                  >
                    إلغاء هذا الطلب
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Accept Offer Confirmation Dialog */}
      {confirmingOffer && (
        <div 
          className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-['Cairo',sans-serif]"
          onClick={() => setConfirmingOffer(null)}
          dir="rtl"
        >
          <div 
            className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-stone-200/80 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-stone-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-sm font-black text-stone-900">اختيار هذا العرض؟</h3>
                <p className="text-[11px] text-stone-500 font-semibold mt-0.5">
                  سيتم اختيار هذا الحرفي لهذا الطلب وتحديث حالة الخدمة.
                </p>
              </div>
            </div>

            <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-stone-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-stone-800">
                <span>الحرفي:</span>
                <span className="text-emerald-900 font-black">{confirmingOffer.artisanName || 'حرفي Bricojob'}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-stone-800">
                <span>السعر المقترح:</span>
                <span className="text-emerald-800 font-black">
                  {confirmingOffer.proposedPrice === 0 ? 'مجاني / استشارة مجانية' : `${confirmingOffer.proposedPrice.toLocaleString('ar-DZ')} دج`}
                </span>
              </div>
              {confirmingOffer.estimatedDuration && (
                <div className="flex items-center justify-between text-stone-600 font-semibold text-[11px]">
                  <span>المدة المقدرة:</span>
                  <span>{confirmingOffer.estimatedDuration}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmingOffer(null)}
                disabled={isAcceptingOffer}
                className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 px-3 rounded-xl text-xs transition cursor-pointer min-h-[40px]"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => confirmAcceptOffer(confirmingOffer)}
                disabled={isAcceptingOffer}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-2.5 px-3 rounded-xl text-xs shadow-sm active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[40px]"
              >
                {isAcceptingOffer ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>تأكيد الاختيار</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
