import { useState, useEffect, useMemo, useCallback } from 'react';
import { Artisan, UserSession } from '../types';
import { SERVICE_CATEGORIES } from '../data';
import { artisanRepository, orderRepository } from '../repositories';
import {
  hasUserReviewedArtisan,
  createReviewEntity,
  addReviewToArtisan,
  updateReviewInArtisan,
  deleteReviewFromArtisan,
  calculateCategoryCounts,
  isOwnArtisanProfile,
  canReviewCompletedOrder,
  isValidRating,
  sanitizeArtisanProfileUpdate,
} from '../domain';

interface UseArtisansOptions {
  currentUser: UserSession | null;
  onToast?: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export function useArtisans({ currentUser, onToast }: UseArtisansOptions) {
  const [artisans, setArtisans] = useState<Artisan[]>(() => {
    return artisanRepository.getAll();
  });

  // Sync Artisans with Local Storage Repository
  useEffect(() => {
    artisanRepository.saveAll(artisans);
  }, [artisans]);

  // Dynamic Categories calculation with real counts (via pure domain selector)
  const computedCategories = useMemo(() => {
    return calculateCategoryCounts(SERVICE_CATEGORIES, artisans);
  }, [artisans]);

  // Add a newly registered artisan (strictly initialized with verified: false)
  const addArtisan = useCallback((newArtisan: Artisan) => {
    const sanitized: Artisan = {
      ...newArtisan,
      verified: false,
      rating: 0,
      reviewCount: 0,
      completedJobs: 0,
      reviews: [],
    };
    setArtisans(prev => [sanitized, ...prev]);
  }, []);

  // Update an existing artisan profile (strictly protecting platform-controlled fields)
  const updateArtisan = useCallback((updatedArtisan: Artisan) => {
    setArtisans(prev => prev.map(art => {
      if (art.id === updatedArtisan.id) {
        return sanitizeArtisanProfileUpdate(art, updatedArtisan);
      }
      return art;
    }));
  }, []);

  // Add Review tied to completed Order
  const addReview = useCallback((
    artisanId: string, 
    orderId: string,
    rating: number, 
    comment: string, 
    authorName: string, 
    userId: string
  ) => {
    if (!currentUser || currentUser.id !== userId) {
      onToast?.('يرجى تسجيل الدخول للحساب أولاً لإضافة تقييم.', 'warning');
      return;
    }

    if (!isValidRating(rating)) {
      onToast?.('يرجى اختيار تقييم صحيح بالنجوم (من 1 إلى 5).', 'warning');
      return;
    }

    if (!comment || !comment.trim()) {
      onToast?.('يرجى كتابة تعليق على الخدمة.', 'warning');
      return;
    }

    // Step 10: Re-fetch fresh Order and Artisan to prevent stale React state evaluation
    const freshOrder = orderRepository.getById(orderId);
    if (!freshOrder) {
      onToast?.('لم يتم العثور على الخدمة المطلوبة.', 'error');
      return;
    }

    const currentAllArtisans = artisanRepository.getAll();
    const targetArtisan = currentAllArtisans.find(a => a.id === artisanId) || artisans.find(a => a.id === artisanId);
    if (!targetArtisan) {
      onToast?.('لم يتم العثور على الحرفي المطلوب.', 'error');
      return;
    }

    // Authorization & Eligibility Check
    if (!canReviewCompletedOrder(currentUser, freshOrder, targetArtisan, targetArtisan.reviews)) {
      if (freshOrder.status !== 'completed') {
        onToast?.('لا يمكنك تقييم الخدمة إلا بعد إكتمالها تماماً.', 'warning');
      } else if (targetArtisan.reviews?.some(r => r.orderId === orderId)) {
        onToast?.('لقد قمت بتقديم تقييم لهذه الخدمة المكتملة مسبقاً.', 'info');
      } else {
        onToast?.('غير مصرح لك بتقديم تقييم لهذه الخدمة.', 'error');
      }
      return;
    }

    const newReview = createReviewEntity({
      orderId,
      userId,
      userName: authorName || currentUser.name,
      userAvatar: currentUser.avatar,
      rating,
      comment,
    });

    setArtisans(prevArtisans =>
      prevArtisans.map(art => art.id === artisanId ? addReviewToArtisan(art, newReview) : art)
    );
  }, [artisans, currentUser, onToast]);

  // Update Review
  const updateReview = useCallback((
    artisanId: string, 
    reviewId: string, 
    rating: number, 
    comment: string, 
    userId: string
  ) => {
    if (!currentUser || currentUser.id !== userId) {
      onToast?.('يرجى تسجيل الدخول للحساب أولاً لتعديل التقييم.', 'warning');
      return;
    }

    const targetArtisan = artisans.find(a => a.id === artisanId);
    if (!targetArtisan) return;

    // Self-Rating Guard: Prevent artisan from modifying reviews on own profile
    if (isOwnArtisanProfile(targetArtisan, currentUser)) {
      onToast?.('لا يمكنك تعديل تقييم على ملفك المهني الخاص.', 'warning');
      return;
    }

    const updatePayload = { rating, comment, userId };
    setArtisans(prev => prev.map(art => art.id === artisanId ? updateReviewInArtisan(art, reviewId, updatePayload) : art));
    onToast?.('تم تحديث تقييمك بنجاح!', 'success');
  }, [artisans, currentUser, onToast]);

  // Delete Review
  const deleteReview = useCallback((
    artisanId: string, 
    reviewId: string, 
    userId: string
  ) => {
    if (!currentUser || currentUser.id !== userId) {
      onToast?.('يرجى تسجيل الدخول للحساب أولاً لحذف التقييم.', 'warning');
      return;
    }

    setArtisans(prev => prev.map(art => art.id === artisanId ? deleteReviewFromArtisan(art, reviewId, userId) : art));
    onToast?.('تم حذف تقييمك بنجاح.', 'info');
  }, [currentUser, onToast]);

  return {
    artisans,
    computedCategories,
    addArtisan,
    updateArtisan,
    addReview,
    updateReview,
    deleteReview,
  };
}
