import { describe, it, expect, beforeEach } from 'vitest';
import { artisanRepository } from '../repositories/artisanRepository';
import { orderRepository } from '../repositories/orderRepository';
import { appLocalStorage } from '../repositories/storage';
import { enrichArtisanWithDerivedMetrics, sanitizeArtisanProfileUpdate } from '../domain/artisan';
import { addReviewToArtisan, createReviewEntity } from '../domain/reviews';
import { Artisan, OrderItem } from '../types';

describe('Stage 13 — Derived Metrics Integrity (rating, reviewCount, completedJobs)', () => {
  const ARTISANS_STORAGE_KEY = 'bricojob_artisans';
  const ORDERS_STORAGE_KEY = 'bricojob_orders';

  beforeEach(() => {
    appLocalStorage.removeItem(ARTISANS_STORAGE_KEY);
    appLocalStorage.removeItem(ORDERS_STORAGE_KEY);
  });

  const getBaseArtisan = (overrides: Partial<Artisan> = {}): Artisan => ({
    id: 'art-derived-1',
    name: 'كريم سباك',
    profession: 'سباك',
    category: 'plumbing',
    wilaya: 'الجزائر',
    city: 'باب الزوار',
    phone: '0550112233',
    verified: true,
    experienceYears: 5,
    startingPrice: 1500,
    rating: 0,
    reviewCount: 0,
    completedJobs: 0,
    avatar: 'https://images.unsplash.com/avatar.jpg',
    bio: 'سباك محترف ذو خبرة',
    services: ['تركيب الأنابيب', 'إصلاح التسربات'],
    availableTimes: '08:00 - 18:00',
    availableNow: true,
    portfolio: [],
    reviews: [],
    ...overrides,
  });

  // 1. "rating" مشتق من Reviews وليس من قيمة persisted قديمة
  it('1. rating is derived from Reviews and not from old persisted value', () => {
    const rawLegacyArtisan = getBaseArtisan({
      reviews: [
        {
          id: 'rev-1',
          userId: 'user-1',
          userName: 'مراد',
          rating: 4,
          comment: 'عمل جيد',
          date: '2026-09-01',
        },
        {
          id: 'rev-2',
          userId: 'user-2',
          userName: 'سمير',
          rating: 5,
          comment: 'ممتاز',
          date: '2026-09-02',
        },
      ],
      // Simulated legacy stale rating that conflicts with reviews average (4.5)
      rating: 2.0 as any,
    });

    // Save directly to storage
    appLocalStorage.setItem(ARTISANS_STORAGE_KEY, [rawLegacyArtisan]);

    const retrieved = artisanRepository.getAll().find(a => a.id === 'art-derived-1');
    expect(retrieved?.rating).toBe(4.5);
  });

  // 2. "reviewCount" مشتق من Reviews
  it('2. reviewCount is derived from Reviews count', () => {
    const rawArtisan = getBaseArtisan({
      reviews: [
        {
          id: 'rev-1',
          userId: 'user-1',
          userName: 'مراد',
          rating: 5,
          comment: 'ممتاز',
          date: '2026-09-01',
        },
      ],
      reviewCount: 99 as any, // Stale legacy number
    });

    appLocalStorage.setItem(ARTISANS_STORAGE_KEY, [rawArtisan]);

    const retrieved = artisanRepository.getAll().find(a => a.id === 'art-derived-1');
    expect(retrieved?.reviewCount).toBe(1);
  });

  // 3. "completedJobs" مشتق من Orders المكتملة فقط
  it('3. completedJobs is derived only from completed orders belonging to this artisan', () => {
    const artisan = getBaseArtisan({ completedJobs: 88 as any });
    appLocalStorage.setItem(ARTISANS_STORAGE_KEY, [artisan]);

    const orders: OrderItem[] = [
      {
        id: 'ord-1',
        artisanId: 'art-derived-1',
        artisanName: 'كريم سباك',
        clientId: 'cli-1',
        clientName: 'عميل 1',
        clientPhone: '0550000001',
        status: 'completed',
        createdAt: '2026-09-01T10:00:00Z',
      },
      {
        id: 'ord-2',
        artisanId: 'art-derived-1',
        artisanName: 'كريم سباك',
        clientId: 'cli-2',
        clientName: 'عميل 2',
        clientPhone: '0550000002',
        status: 'in_progress', // Not completed
        createdAt: '2026-09-02T10:00:00Z',
      },
      {
        id: 'ord-3',
        artisanId: 'another-artisan', // Different artisan
        artisanName: 'آخر',
        clientId: 'cli-1',
        clientName: 'عميل 1',
        clientPhone: '0550000001',
        status: 'completed',
        createdAt: '2026-09-03T10:00:00Z',
      },
    ];
    appLocalStorage.setItem(ORDERS_STORAGE_KEY, orders);

    const retrieved = artisanRepository.getAll().find(a => a.id === 'art-derived-1');
    expect(retrieved?.completedJobs).toBe(1);
  });

  // 4. تغيير/إضافة Review ينعكس على القيم المشتقة عند القراءة
  it('4. adding a review reflects on derived metrics at read-time', () => {
    const artisan = getBaseArtisan();
    appLocalStorage.setItem(ARTISANS_STORAGE_KEY, [artisan]);

    expect(artisanRepository.getAll()[0].rating).toBe(0);
    expect(artisanRepository.getAll()[0].reviewCount).toBe(0);

    const review = createReviewEntity({
      userId: 'user-10',
      userName: 'جمال',
      rating: 5,
      comment: 'خدمة احترافية جداً',
    });

    const updatedArtisan = addReviewToArtisan(artisan, review);
    artisanRepository.saveAll([updatedArtisan]);

    const retrieved = artisanRepository.getAll()[0];
    expect(retrieved.rating).toBe(5);
    expect(retrieved.reviewCount).toBe(1);
  });

  // 5. تغيير Order إلى completed ينعكس على "completedJobs"
  it('5. updating order status to completed reflects on completedJobs count', () => {
    const artisan = getBaseArtisan();
    appLocalStorage.setItem(ARTISANS_STORAGE_KEY, [artisan]);

    const order: OrderItem = {
      id: 'ord-100',
      artisanId: 'art-derived-1',
      artisanName: 'كريم سباك',
      clientId: 'cli-1',
      clientName: 'عميل 1',
      clientPhone: '0550000001',
      status: 'assigned',
      createdAt: '2026-09-01T10:00:00Z',
    };
    orderRepository.save(order);

    expect(artisanRepository.getAll()[0].completedJobs).toBe(0);

    // Transition order through state machine: assigned -> in_progress -> completed
    orderRepository.updateStatus('ord-100', 'in_progress');
    expect(artisanRepository.getAll()[0].completedJobs).toBe(0);

    orderRepository.updateStatus('ord-100', 'completed');
    expect(artisanRepository.getAll()[0].completedJobs).toBe(1);
  });

  // 6. persisted derived values قديمة لا تطغى على القيم المحسوبة
  it('6. stale persisted derived values in raw storage never override freshly calculated values', () => {
    const rawData = [
      {
        id: 'art-derived-1',
        name: 'كريم سباك',
        profession: 'سباك',
        category: 'plumbing',
        wilaya: 'الجزائر',
        city: 'باب الزوار',
        phone: '0550112233',
        rating: 5.0, // Stale high rating in storage
        reviewCount: 50, // Stale count
        completedJobs: 100, // Stale jobs
        reviews: [], // No real reviews in list
      },
    ];
    appLocalStorage.setItem(ARTISANS_STORAGE_KEY, rawData);

    const retrieved = artisanRepository.getAll()[0];
    expect(retrieved.rating).toBe(0);
    expect(retrieved.reviewCount).toBe(0);
    expect(retrieved.completedJobs).toBe(0);
  });

  // 7. تحديث Artisan لحقول مهنية لا يؤدي إلى حفظ derived metrics كمصدر حقيقة
  it('7. updating artisan professional fields strips derived metrics when saving to storage', () => {
    const artisan = getBaseArtisan({
      reviews: [
        {
          id: 'rev-1',
          userId: 'user-1',
          userName: 'علي',
          rating: 4,
          comment: 'جيد',
          date: '2026-09-01',
        },
      ],
    });
    artisanRepository.saveAll([artisan]);

    // Inspect raw storage directly
    const storedRaw = appLocalStorage.getItem<any[]>(ARTISANS_STORAGE_KEY, []);
    expect(storedRaw[0].rating).toBeUndefined();
    expect(storedRaw[0].reviewCount).toBeUndefined();
    expect(storedRaw[0].completedJobs).toBeUndefined();

    // But reading via repository returns correctly derived metrics
    const fromRepo = artisanRepository.getAll()[0];
    expect(fromRepo.rating).toBe(4);
    expect(fromRepo.reviewCount).toBe(1);
  });

  // 8. "verified" يبقى محميًا كما هو
  it('8. verified remains strictly platform-controlled and protected from client updates', () => {
    const artisan = getBaseArtisan({ verified: false });
    const sanitized = sanitizeArtisanProfileUpdate(artisan, {
      name: 'كريم محدث',
      verified: true as any,
    });

    expect(sanitized.verified).toBe(false);
    expect(sanitized.name).toBe('كريم محدث');
  });

  // 9. "experienceYears" و"availability" لا تتأثران بالإصلاح
  it('9. experienceYears and availability fields are properly updated and preserved', () => {
    const artisan = getBaseArtisan({ experienceYears: 3, availableTimes: '09:00 - 17:00' });
    const updated = sanitizeArtisanProfileUpdate(artisan, {
      experienceYears: 7,
      availableTimes: '24/7 طوارئ',
      availableNow: true,
    });

    expect(updated.experienceYears).toBe(7);
    expect(updated.availableTimes).toBe('24/7 طوارئ');
    expect(updated.availableNow).toBe(true);
  });

  // 10. Search / Card / Detail / Workspace تحصل على نفس derived metrics من نفس المصدر
  it('10. multiple reads across views all receive identical metrics computed from canonical source', () => {
    const artisan = getBaseArtisan({
      reviews: [
        {
          id: 'rev-1',
          userId: 'user-1',
          userName: 'حمزة',
          rating: 5,
          comment: 'خدمة ممتازة',
          date: '2026-09-01',
        },
      ],
    });
    artisanRepository.saveAll([artisan]);

    const order: OrderItem = {
      id: 'ord-1',
      artisanId: 'art-derived-1',
      artisanName: 'كريم سباك',
      clientId: 'cli-1',
      clientName: 'عميل 1',
      clientPhone: '0550000001',
      status: 'completed',
      createdAt: '2026-09-01T10:00:00Z',
    };
    orderRepository.save(order);

    // Multiple calls as would happen across Card, Detail, Search and Workspace
    const listA = artisanRepository.getAll();
    const listB = artisanRepository.getAll();

    const artA = listA.find(a => a.id === 'art-derived-1');
    const artB = listB.find(a => a.id === 'art-derived-1');

    expect(artA?.rating).toBe(5);
    expect(artA?.reviewCount).toBe(1);
    expect(artA?.completedJobs).toBe(1);

    expect(artB?.rating).toBe(artA?.rating);
    expect(artB?.reviewCount).toBe(artA?.reviewCount);
    expect(artB?.completedJobs).toBe(artA?.completedJobs);
  });
});
