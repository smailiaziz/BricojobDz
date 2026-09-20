import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  ClipboardList, 
  MapPin, 
  Clock, 
  Coins, 
  ChevronLeft, 
  MessageSquare, 
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Play,
  Briefcase,
  Star,
  User,
  Phone
} from 'lucide-react';
import { ServiceRequest, UserSession, Artisan, ServiceContactRequest, OrderItem } from '../types';
import { serviceRequestRepository, serviceOfferRepository, contactRequestRepository, orderRepository } from '../repositories';
import { SERVICE_CATEGORIES } from '../data';
import { getStatusBadgeInfo, getUrgencyInfo, matchRequestsForArtisan, formatOffersCountLabel } from '../domain/serviceRequests';
import { resolveCurrentArtisan } from '../domain/artisan';
import { filterUserOrders, filterArtisanOrders, canStartJob, canCompleteJob, hasOrderBeenReviewed } from '../domain';
import { CreateServiceRequestModal } from './CreateServiceRequestModal';
import { ServiceRequestDetailModal } from './ServiceRequestDetailModal';

interface OrdersScreenProps {
  currentUser: UserSession | null;
  artisans: Artisan[];
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  onSelectArtisan?: (artisan: Artisan) => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  currentUser,
  artisans,
  onShowToast,
  onSelectArtisan,
}) => {
  const [allRequests, setAllRequests] = useState<ServiceRequest[]>([]);
  const [allOrders, setAllOrders] = useState<OrderItem[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

  // Artisan Filter Tabs: 'suitable' | 'all' | 'jobs'
  const [artisanTab, setArtisanTab] = useState<'suitable' | 'all' | 'jobs'>('suitable');

  // Customer View Sub-Tabs: 'service_requests' | 'jobs' | 'contact_requests'
  const [customerTab, setCustomerTab] = useState<'service_requests' | 'jobs' | 'contact_requests'>('service_requests');

  // Load all requests, offers, and orders
  const refreshRequests = () => {
    const requestsData = serviceRequestRepository.getAll();
    setAllRequests(requestsData);

    const ordersData = orderRepository.getAll();
    setAllOrders(ordersData);

    if (selectedRequest) {
      const updated = requestsData.find(r => r.id === selectedRequest.id);
      if (updated) setSelectedRequest(updated);
    }
  };

  useEffect(() => {
    refreshRequests();
  }, []);

  const isArtisan = currentUser?.role === 'artisan';
  const currentArtisan = isArtisan ? resolveCurrentArtisan(currentUser, artisans) : null;

  // 1. User Requests (Client-specific)
  const userRequests = useMemo(() => {
    if (!currentUser || isArtisan) return [];
    return allRequests.filter(r => r.clientId === currentUser.id);
  }, [allRequests, currentUser, isArtisan]);

  // 1b. User Orders / Jobs (Client-specific execution entities)
  const userOrders = useMemo(() => {
    if (!currentUser || isArtisan || !currentUser.id) return [];
    return filterUserOrders(allOrders, currentUser.id);
  }, [allOrders, currentUser, isArtisan]);

  // 1c. User Contact Requests (Client-specific contact history)
  const userContactRequests = useMemo(() => {
    if (!currentUser || isArtisan || !currentUser.id) return [];
    return contactRequestRepository.getByCustomer(currentUser.id);
  }, [currentUser, isArtisan]);

  // 2. Artisan Requests (Filtered/Matched)
  const artisanMatchedRequests = useMemo(() => {
    if (!isArtisan) return [];
    if (currentArtisan) {
      return matchRequestsForArtisan(allRequests, currentArtisan, artisanTab === 'jobs' ? 'all' : artisanTab);
    }
    return allRequests.filter(r => r.status !== 'cancelled');
  }, [allRequests, isArtisan, currentArtisan, artisanTab]);

  // 2b. Artisan Jobs (Assigned execution entities)
  const artisanJobs = useMemo(() => {
    if (!isArtisan) return [];
    const artisanId = currentArtisan?.id || currentUser?.artisanId || currentUser?.id;
    return filterArtisanOrders(allOrders, artisanId);
  }, [allOrders, isArtisan, currentArtisan, currentUser]);

  // Helper to get offers count for a request
  const getOfferCount = (requestId: string) => {
    return serviceOfferRepository.getByRequestId(requestId).length;
  };

  // Helper to check if artisan submitted offer
  const getArtisanOfferStatus = (requestId: string) => {
    if (!currentArtisan) return null;
    return serviceOfferRepository.getByRequestAndArtisan(requestId, currentArtisan.id);
  };

  // Artisan Action Handlers
  const handleStartJob = (job: OrderItem) => {
    if (!canStartJob(currentUser, job, currentArtisan)) {
      onShowToast('غير مصرح لك ببدء العمل على هذه الخدمة.', 'error');
      return;
    }
    const success = orderRepository.updateStatus(job.id, 'in_progress');
    if (success) {
      onShowToast('تمت المباشرة في العمل على الخدمة بنجاح!', 'success');
      refreshRequests();
    } else {
      onShowToast('حدث خطأ أثناء تحديث حالة الخدمة.', 'error');
    }
  };

  const handleCompleteJob = (job: OrderItem) => {
    if (!canCompleteJob(currentUser, job, currentArtisan)) {
      onShowToast('غير مصرح لك بإكمال هذه الخدمة.', 'error');
      return;
    }
    const success = orderRepository.updateStatus(job.id, 'completed');
    if (success) {
      onShowToast('تم إكمال الخدمة بنجاح! شكراً لك.', 'success');
      refreshRequests();
    } else {
      onShowToast('حدث خطأ أثناء تحديث حالة الخدمة.', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full bg-[#FAF8F5] font-['Cairo',sans-serif] min-h-[100dvh] animate-fade-in" dir="rtl">
      
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-5 py-3.5 flex items-center justify-between shadow-2xs">
        <div>
          <h1 className="text-base font-black text-stone-900 leading-tight">
            {isArtisan ? 'الطلبات' : 'طلباتي'}
          </h1>
          <p className="text-[11px] text-stone-500 font-semibold">
            {isArtisan 
              ? 'تصفح طلبات العملاء وقدم عروض أسعارك' 
              : 'متابعة طلبات الخدمات والعروض المستلمة'}
          </p>
        </div>

        {/* Action Button for User: + طلب خدمة */}
        {!isArtisan && currentUser && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer min-h-[38px]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>طلب خدمة</span>
          </button>
        )}
      </header>

      {/* 2. Main Body Content */}
      <main className="flex-1 p-4 space-y-4 max-w-md mx-auto w-full">
        
        {/* =========================================
            USER VIEW: Client Requests & Jobs List
           ========================================= */}
        {!isArtisan && (
          <div className="space-y-3.5">
            {/* Customer Navigation Sub-Tabs */}
            <div className="grid grid-cols-3 gap-1.5 bg-stone-100/90 p-1 rounded-xl border border-stone-200/80 text-[11px]">
              <button
                type="button"
                onClick={() => setCustomerTab('service_requests')}
                className={`py-2 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                  customerTab === 'service_requests'
                    ? 'bg-white text-emerald-800 font-black shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>طلباتي ({userRequests.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCustomerTab('jobs')}
                className={`py-2 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                  customerTab === 'jobs'
                    ? 'bg-white text-emerald-800 font-black shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>الخدمات ({userOrders.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCustomerTab('contact_requests')}
                className={`py-2 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                  customerTab === 'contact_requests'
                    ? 'bg-white text-emerald-800 font-black shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>التواصل ({userContactRequests.length})</span>
              </button>
            </div>

            {/* TAB 1: SERVICE REQUESTS */}
            {customerTab === 'service_requests' && (
              <div className="space-y-3">
                {userRequests.length === 0 ? (
                  // Empty State for User Service Requests
                  <div className="bg-white rounded-3xl p-8 border border-stone-200/80 shadow-2xs text-center space-y-4 my-6">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto shadow-2xs">
                      <ClipboardList className="w-8 h-8 stroke-[1.75]" />
                    </div>
                    
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-black text-stone-900">
                        لا توجد لديك طلبات خدمة بعد
                      </h3>
                      <p className="text-xs text-stone-500 font-medium leading-relaxed max-w-xs mx-auto">
                        أنشئ طلبك الأول ودع الحرفيين المناسبين يقدمون لك عروضهم.
                      </p>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 px-5 rounded-xl text-xs shadow-md shadow-emerald-700/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ طلب خدمة</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  // User Requests Cards List
                  userRequests.map((req) => {
                    const categoryObj = SERVICE_CATEGORIES.find(c => c.id === req.category);
                    const statusInfo = getStatusBadgeInfo(req.status);
                    const urgencyInfo = getUrgencyInfo(req.urgency);
                    const offersCount = getOfferCount(req.id);

                    return (
                      <div
                        key={req.id}
                        onClick={() => setSelectedRequest(req)}
                        className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs hover:shadow-xs hover:border-stone-300 transition-all cursor-pointer active:scale-[0.99] space-y-3"
                      >
                        {/* Header: Title & Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-black text-stone-900 truncate">
                              {req.title}
                            </h3>
                            <p className="text-[10px] text-stone-500 font-semibold mt-0.5">
                              {new Date(req.createdAt).toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short' })}
                            </p>
                          </div>

                          <div className={`px-2 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 shrink-0 ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                            <span>{statusInfo.label}</span>
                          </div>
                        </div>

                        {/* Metadata Row: Category & Location */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-100">
                            {categoryObj?.name || req.category}
                          </span>

                          <span className="flex items-center gap-1 text-stone-600 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200/60 font-semibold">
                            <MapPin className="w-3 h-3 text-stone-400" />
                            <span>{req.city}، {req.wilaya}</span>
                          </span>

                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md border font-semibold ${urgencyInfo.badgeColor}`}>
                            <Clock className="w-3 h-3" />
                            <span>{urgencyInfo.label}</span>
                          </span>
                        </div>

                        {/* Footer: Offers Count Badge & View Details */}
                        <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                            <span className="font-bold text-stone-800 text-[11px]">
                              {formatOffersCountLabel(offersCount)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                            <span>عرض التفاصيل</span>
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 2: EXECUTING JOBS / ORDERS (Customer View) */}
            {customerTab === 'jobs' && (
              <div className="space-y-3">
                {userOrders.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 border border-stone-200/80 shadow-2xs text-center space-y-3 my-6">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto shadow-2xs">
                      <Briefcase className="w-8 h-8 stroke-[1.75]" />
                    </div>
                    
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-black text-stone-900">
                        لا توجد خدمات قيد التنفيذ حاليًا
                      </h3>
                      <p className="text-xs text-stone-500 font-medium leading-relaxed max-w-xs mx-auto">
                        عندما تقوم بقبول عرض سعر من أحد الحرفيين، ستظهر الخدمة ومراحل التنفيذ هنا.
                      </p>
                    </div>
                  </div>
                ) : (
                  userOrders.map((order) => {
                    const targetArtisan = artisans.find(a => a.id === order.artisanId);
                    const isCompleted = order.status === 'completed';
                    const isInProgress = order.status === 'in_progress';
                    const formattedDate = new Date(order.createdAt).toLocaleDateString('ar-DZ', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });

                    return (
                      <div
                        key={order.id}
                        className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-3"
                      >
                        {/* Header: Service Details & Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs font-black text-stone-900 truncate">
                              {order.serviceDetails}
                            </h3>
                            <p className="text-[10px] text-stone-500 font-semibold mt-0.5">
                              الحرفي: {order.artisanName} ({order.artisanProfession || 'حرفي'})
                            </p>
                          </div>

                          <div
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 shrink-0 ${
                              isCompleted
                                ? 'bg-stone-100 text-stone-700 border-stone-200'
                                : isInProgress
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isInProgress ? 'bg-amber-500 animate-pulse' : isCompleted ? 'bg-stone-400' : 'bg-emerald-600'}`} />
                            <span>
                              {isCompleted ? 'مكتملة' : isInProgress ? 'جاري التنفيذ' : 'مسندة للحرفي'}
                            </span>
                          </div>
                        </div>

                        {/* Price & Preferred Date */}
                        <div className="bg-stone-50/80 p-2.5 rounded-xl border border-stone-200/60 flex items-center justify-between text-xs">
                          <span className="text-stone-600 font-bold">السعر المتفق عليه:</span>
                          <span className="text-emerald-800 font-black">
                            {order.proposedPrice === 0 ? 'مجاني / تطوعي' : `${order.proposedPrice} دج`}
                          </span>
                        </div>

                        {/* Footer: Date & Review CTA */}
                        <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
                          <span className="text-stone-400 font-medium">
                            تاريخ البدء: {formattedDate}
                          </span>

                          {isCompleted && (
                            hasOrderBeenReviewed(targetArtisan, order.id) ? (
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>تم التقييم ⭐</span>
                              </span>
                            ) : (
                              targetArtisan && onSelectArtisan && (
                                <button
                                  type="button"
                                  onClick={() => onSelectArtisan(targetArtisan)}
                                  className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-2xs"
                                >
                                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                                  <span>قيّم الخدمة</span>
                                </button>
                              )
                            )
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 3: CONTACT REQUESTS (Customer Contact History) */}
            {customerTab === 'contact_requests' && (
              <div className="space-y-3">
                {userContactRequests.length === 0 ? (
                  // Empty State for Customer Contact Requests
                  <div className="bg-white rounded-3xl p-8 border border-stone-200/80 shadow-2xs text-center space-y-3 my-6">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto shadow-2xs">
                      <MessageSquare className="w-8 h-8 stroke-[1.75]" />
                    </div>
                    
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-black text-stone-900">
                        لا توجد طلبات تواصل بعد
                      </h3>
                      <p className="text-xs text-stone-500 font-medium leading-relaxed max-w-xs mx-auto">
                        عندما تتواصل مع أحد الحرفيين، ستظهر طلباتك هنا.
                      </p>
                    </div>
                  </div>
                ) : (
                  // Customer Contact Requests List
                  userContactRequests.map((req) => {
                    const targetArtisan = artisans.find(a => a.id === req.artisanId);
                    const artisanDisplayName = targetArtisan?.name || req.artisanName || 'حرفي غير محدد';
                    const isPending = req.status === 'pending';
                    const formattedDate = new Date(req.createdAt).toLocaleDateString('ar-DZ', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });

                    return (
                      <div
                        key={req.id}
                        className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs hover:shadow-xs transition-all space-y-3"
                      >
                        {/* Header: Artisan Info & Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center justify-center font-black text-xs shrink-0">
                              {artisanDisplayName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-xs font-black text-stone-900 truncate">
                                {artisanDisplayName}
                              </h3>
                              {targetArtisan ? (
                                <p className="text-[10px] text-emerald-700 font-bold truncate">
                                  {targetArtisan.profession} · {targetArtisan.city}
                                </p>
                              ) : (
                                <p className="text-[10px] text-stone-400 font-medium truncate">
                                  تاريخ الطلب: {formattedDate}
                                </p>
                              )}
                            </div>
                          </div>

                          <div
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 shrink-0 ${
                              isPending
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-stone-100 text-stone-700 border-stone-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isPending ? 'bg-emerald-600 animate-pulse' : 'bg-stone-400'}`} />
                            <span>{isPending ? 'قيد المتابعة' : 'تمت المعالجة'}</span>
                          </div>
                        </div>

                        {/* Body: Service & Description */}
                        <div className="space-y-1.5 text-xs text-stone-800">
                          <div className="bg-stone-50/80 p-2.5 rounded-xl border border-stone-200/60 flex items-center justify-between text-xs font-bold">
                            <span className="text-stone-600">الخدمة:</span>
                            <span className="text-stone-900 font-black">{req.service}</span>
                          </div>

                          {req.description && (
                            <p className="text-[11.5px] text-stone-600 font-medium bg-white p-2.5 rounded-xl border border-stone-100 leading-relaxed">
                              {req.description}
                            </p>
                          )}
                        </div>

                        {/* Footer: Date & Preferred Contact */}
                        <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500 font-semibold">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-stone-400" />
                            <span>{formattedDate}</span>
                          </div>

                          {targetArtisan && onSelectArtisan && (
                            <button
                              type="button"
                              onClick={() => onSelectArtisan(targetArtisan)}
                              className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <span>عرض ملف الحرفي</span>
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* =========================================
            ARTISAN VIEW: Marketplace Requests & Jobs
           ========================================= */}
        {isArtisan && (
          <div className="space-y-3.5">
            
            {/* Filter Tabs: 'suitable' | 'all' | 'jobs' */}
            <div className="grid grid-cols-3 gap-1.5 bg-stone-100/90 p-1 rounded-xl border border-stone-200/80 text-[11px]">
              <button
                type="button"
                onClick={() => setArtisanTab('suitable')}
                className={`py-2 px-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                  artisanTab === 'suitable'
                    ? 'bg-white text-emerald-800 font-black shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>مناسبة لك</span>
              </button>

              <button
                type="button"
                onClick={() => setArtisanTab('all')}
                className={`py-2 px-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                  artisanTab === 'all'
                    ? 'bg-white text-emerald-800 font-black shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span>جميع الطلبات</span>
              </button>

              <button
                type="button"
                onClick={() => setArtisanTab('jobs')}
                className={`py-2 px-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                  artisanTab === 'jobs'
                    ? 'bg-white text-emerald-800 font-black shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>خدماتي ({artisanJobs.length})</span>
              </button>
            </div>

            {/* Matching Indicator Info */}
            {currentArtisan && artisanTab === 'suitable' && (
              <div className="bg-emerald-50/70 border border-emerald-100 p-2.5 rounded-xl flex items-center justify-between text-[11px]">
                <span className="font-bold text-emerald-900">
                  المجال: {currentArtisan.profession} ({currentArtisan.wilaya})
                </span>
                <span className="text-stone-500 font-medium">
                  {artisanMatchedRequests.length} طلب متاح
                </span>
              </div>
            )}

            {/* ARTISAN JOBS LIST (Execution entity view for artisan) */}
            {artisanTab === 'jobs' && (
              <div className="space-y-3">
                {artisanJobs.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 border border-stone-200/80 shadow-2xs text-center space-y-3 my-6">
                    <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto">
                      <Briefcase className="w-7 h-7 stroke-[1.5]" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-black text-stone-800">
                        لا توجد خدمات مسندة إليك حاليًا
                      </h3>
                      <p className="text-[11px] text-stone-500 font-medium">
                        عندما يقبل أحد العملاء عرض السعر الخاص بك، ستظهر الخدمة هنا لبدء ومتابعة التنفيذ.
                      </p>
                    </div>
                  </div>
                ) : (
                  artisanJobs.map((job) => {
                    const isAssigned = job.status === 'assigned' || job.status === 'pending';
                    const isInProgress = job.status === 'in_progress';
                    const isCompleted = job.status === 'completed';
                    const formattedDate = new Date(job.createdAt).toLocaleDateString('ar-DZ', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });

                    return (
                      <div
                        key={job.id}
                        className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-3"
                      >
                        {/* Header: Service Details & Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs font-black text-stone-900 truncate">
                              {job.serviceDetails}
                            </h3>
                            <p className="text-[10px] text-stone-500 font-semibold mt-0.5">
                              العميل: {job.clientName || 'عميل'} {job.clientPhone ? `(${job.clientPhone})` : ''}
                            </p>
                          </div>

                          <div
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 shrink-0 ${
                              isCompleted
                                ? 'bg-stone-100 text-stone-700 border-stone-200'
                                : isInProgress
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isInProgress ? 'bg-amber-500 animate-pulse' : isCompleted ? 'bg-stone-400' : 'bg-emerald-600'}`} />
                            <span>
                              {isCompleted ? 'مكتملة' : isInProgress ? 'قيد التنفيذ' : 'مسندة إليك'}
                            </span>
                          </div>
                        </div>

                        {/* Price & Date Row */}
                        <div className="bg-stone-50/80 p-2.5 rounded-xl border border-stone-200/60 flex items-center justify-between text-xs">
                          <span className="text-stone-600 font-bold">المبلغ المتفق عليه:</span>
                          <span className="text-emerald-800 font-black">
                            {job.proposedPrice === 0 ? 'مجاني / تطوعي' : `${job.proposedPrice} دج`}
                          </span>
                        </div>

                        {/* Footer & Action CTAs */}
                        <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-stone-400 font-medium">
                            {formattedDate}
                          </span>

                          {/* Action CTA buttons guarded by authorization predicates */}
                          {canStartJob(currentUser, job, currentArtisan) && (
                            <button
                              type="button"
                              onClick={() => handleStartJob(job)}
                              className="bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-black py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer min-h-[36px]"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              <span>بدء العمل</span>
                            </button>
                          )}

                          {canCompleteJob(currentUser, job, currentArtisan) && (
                            <button
                              type="button"
                              onClick={() => handleCompleteJob(job)}
                              className="bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-black py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer min-h-[36px]"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>إنهاء الخدمة</span>
                            </button>
                          )}

                          {isCompleted && (
                            <span className="bg-stone-100 text-stone-700 font-bold text-[11px] px-2.5 py-1 rounded-lg border border-stone-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>تم الإكمال بنجاح</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* List of Requests for Artisan (suitable / all) */}
            {artisanTab !== 'jobs' && (
              artisanMatchedRequests.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 border border-stone-200/80 shadow-2xs text-center space-y-3 my-6">
                  <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto">
                    <ClipboardList className="w-7 h-7 stroke-[1.5]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-black text-stone-800">
                      {artisanTab === 'suitable' 
                        ? 'لا توجد طلبات مناسبة حاليًا' 
                        : 'لا توجد طلبات متاحة حاليًا'}
                    </h3>
                    <p className="text-[11px] text-stone-500 font-medium">
                      {artisanTab === 'suitable' 
                        ? 'تحقق لاحقًا من الطلبات الجديدة المتوافقة مع تخصصك.' 
                        : 'تحقق لاحقًا من الطلبات الجديدة المضافة من العملاء.'}
                    </p>
                  </div>
                  {artisanTab === 'suitable' && (
                    <button
                      type="button"
                      onClick={() => setArtisanTab('all')}
                      className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer pt-1"
                    >
                      عرض جميع الطلبات ←
                    </button>
                  )}
                </div>
              ) : (
                artisanMatchedRequests.map((req) => {
                  const categoryObj = SERVICE_CATEGORIES.find(c => c.id === req.category);
                  const statusInfo = getStatusBadgeInfo(req.status);
                  const urgencyInfo = getUrgencyInfo(req.urgency);
                  const existingOffer = getArtisanOfferStatus(req.id);
                  const isExactMatch = currentArtisan?.category === req.category;

                  return (
                    <div
                      key={req.id}
                      onClick={() => setSelectedRequest(req)}
                      className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs hover:shadow-xs hover:border-stone-300 transition-all cursor-pointer active:scale-[0.99] space-y-3"
                    >
                      {/* Header: Title & Matching Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-xs font-black text-stone-900 truncate">
                              {req.title}
                            </h3>
                            {isExactMatch && (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded">
                                مطابق
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-stone-500 font-semibold mt-0.5">
                            {new Date(req.createdAt).toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>

                        {/* Offer Status Badge */}
                        {existingOffer ? (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>عرضك: {existingOffer.proposedPrice} دج</span>
                          </span>
                        ) : (
                          <div className={`px-2 py-0.5 rounded-full text-[10px] font-black border shrink-0 ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}>
                            <span>{statusInfo.label}</span>
                          </div>
                        )}
                      </div>

                      {/* Metadata: Category, Location, Urgency, Budget */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-100">
                          {categoryObj?.name || req.category}
                        </span>

                        <span className="flex items-center gap-1 text-stone-600 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200/60 font-semibold">
                          <MapPin className="w-3 h-3 text-stone-400" />
                          <span>{req.city}، {req.wilaya}</span>
                        </span>

                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md border font-semibold ${urgencyInfo.badgeColor}`}>
                          <Clock className="w-3 h-3" />
                          <span>{urgencyInfo.label}</span>
                        </span>

                        {req.budgetMax !== undefined && req.budgetMax !== null && (
                          <span className="flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 font-black">
                            <Coins className="w-3 h-3 text-amber-600" />
                            <span>{req.budgetMax === 0 ? 'مجاني / تطوعي' : `${req.budgetMax} دج`}</span>
                          </span>
                        )}
                      </div>

                      {/* Footer Action Button */}
                      <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-stone-500 font-medium">
                          {existingOffer ? 'تم تقديم عرضك' : 'بانتظار العروض'}
                        </span>

                        <div className="flex items-center gap-1 text-emerald-700 font-black text-xs">
                          <span>{existingOffer ? 'متابعة العرض' : 'تقديم عرض سعر'}</span>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        )}

      </main>

      {/* 3. Create Service Request Modal */}
      {isCreateModalOpen && currentUser && (
        <CreateServiceRequestModal
          currentUser={currentUser}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(newReq) => {
            refreshRequests();
            setSelectedRequest(newReq);
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* 4. Request Detail Modal */}
      {selectedRequest && (
        <ServiceRequestDetailModal
          request={selectedRequest}
          currentUser={currentUser}
          artisans={artisans}
          onClose={() => setSelectedRequest(null)}
          onRefresh={refreshRequests}
          onShowToast={onShowToast}
          onSelectArtisan={onSelectArtisan}
        />
      )}

    </div>
  );
};
