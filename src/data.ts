import { Artisan, ServiceCategory } from './types';

export const WILAYAS_COMMUNES: Record<string, string[]> = {
  'الجزائر': [
    'باب الزوار', 'حيدرة', 'القبة', 'بئر خادم', 'الرويبة', 'الدار البيضاء', 
    'زرالدة', 'الشراقة', 'بني مسوس', 'بئر التوتة', 'سطاوالي', 'الأبيار', 
    'سيدي امحمد', 'عين النعجة', 'بوزريعة', 'الكاليتوس', 'درارية', 'أولاد فايت', 
    'الخروبة', 'حسين داي', 'براقي', 'باش جراح', 'عين طاية', 'برج الكيفان'
  ],
  'وهران': [
    'حي النخيل', 'السانية', 'بئر الجير', 'عين الترك', 'قديل', 'أرزيو', 
    'ميسرغين', 'الكرمة', 'بطيوة', 'وهران وسط', 'سيدي الشحمي', 'العنصر'
  ],
  'قسنطينة': [
    'علي منجلي', 'الخروب', 'قسنطينة وسط', 'عين سمارة', 'زيغود يوسف', 
    'حامة بوزيان', 'ديدوش مراد', 'ابن باديس', 'أولاد رحمون'
  ],
  'البليدة': [
    'أولاد يعيش', 'بوفاريك', 'موزاية', 'العفرون', 'البليدة وسط', 
    'بني مراد', 'وادي العلايق', 'الصومعة', 'الشبلي', 'بوقرة'
  ],
  'عنابة': [
    'سيدي عمار', 'البوني', 'عنابة وسط', 'برحال', 'الحجار', 
    'سرايدي', 'وادي العنب', 'عين الباردة', 'شطايبي'
  ],
  'سطيف': [
    'سطيف وسط', 'حي 1000 مسكن', 'العلمة', 'عين أرنات', 'عين ولمان', 
    'بوقاعة', 'عموشة', 'عين الكبيرة', 'صالح باي'
  ],
  'تيزي وزو': [
    'تيزي وزو وسط', 'ذراع بن خدة', 'تيزي راشد', 'أزفون', 'عين الحمام', 
    'بوغني', 'الأربعاء نايث إيراثن', 'واقنون', 'تفريت'
  ],
  'باتنة': [
    'باتنة وسط', 'بريكة', 'عين التوتة', 'مروانة', 'آريس', 
    'نقاوس', 'المعذر', 'رأس العيون', 'تازولت'
  ],
  'تلمسان': [
    'تلمسان وسط', 'منصورة', 'شتوان', 'مغنية', 'الغزوات', 
    'الرمشي', 'سبدو', 'ندرومة', 'الحناية'
  ],
  'بجاية': [
    'بجاية وسط', 'أقبو', 'أميزور', 'القصر', 'تيشي', 
    'سوق الإثنين', 'صدوق', 'أوقاس', 'خراطة'
  ],
  'الشلف': [
    'الشلف وسط', 'وادي الفضة', 'تنس', 'بوقادير', 'عين مران', 
    'أولاد فارس', 'الكريمية', 'الزبوجة'
  ],
  'بومرداس': [
    'بومرداس وسط', 'بودواو', 'الثنية', 'برج منايل', 'خميس الخشنة', 
    'يسّر', 'دلس', 'زموري', 'قورصو', 'سي مصطفى'
  ],
  'تيبازة': [
    'تيبازة وسط', 'القليعة', 'بوسماعيل', 'حجوط', 'فوكة', 
    'شرشال', 'الداموس', 'سيدي غيلاس'
  ],
  'المدية': [
    'المدية وسط', 'وزرة', 'البرواقية', 'قصر البخاري', 'بني سليمان', 
    'تابلاط', 'العمارية', 'سغوان'
  ],
  'مستغانم': [
    'مستغانم وسط', 'حاسي ماماش', 'عين تادلس', 'سيدي علي', 'ماسرى', 
    'خير الدين', 'مزغران', 'بوقيرات'
  ],
  'سيدي بلعباس': [
    'سيدي بلعباس وسط', 'تلاغ', 'ابن باديس', 'سفيزف', 'رجم دموش', 
    'سيدي علي بن يوب', 'تنيرة'
  ],
  'بسكرة': [
    'بسكرة وسط', 'طولقة', 'سيدي عقبة', 'زريبة الوادي', 'أورلال', 
    'فوغالة', 'لوطاية'
  ],
  'ورقلة': [
    'ورقلة وسط', 'تقرت', 'حاسي مسعود', 'الرويسات', 'الطيبات', 
    'تماسين', 'سيدي خويلد'
  ],
  'جيجل': [
    'جيجل وسط', 'الطاهير', 'الميلية', 'العوانة', 'زيامة منصورية', 
    'الشقفة', 'العنصر'
  ],
  'سكيكدة': [
    'سكيكدة وسط', 'الحروش', 'القل', 'عزابة', 'تمالوس', 
    'رمضان جمال', 'سيدي مزغيش'
  ]
};

/**
 * Pure Geographic Selectors
 * Single Source of Truth: WILAYAS_COMMUNES
 */

/**
 * Returns all available Wilayas (provinces) as a fresh array.
 */
export const getAllWilayas = (): string[] => {
  return Object.keys(WILAYAS_COMMUNES);
};

/**
 * Returns all communes for a specific Wilaya.
 * Returns an empty array if the wilaya is not specified, 'الكل', or not found.
 */
export const getCommunesByWilaya = (wilaya?: string | null): string[] => {
  if (!wilaya || wilaya === 'الكل' || !WILAYAS_COMMUNES[wilaya]) {
    return [];
  }
  return [...WILAYAS_COMMUNES[wilaya]];
};

/**
 * Returns all cities/communes across all Wilayas flattened into a single list.
 */
export const getAllCities = (): string[] => {
  return Object.values(WILAYAS_COMMUNES).flat();
};

/**
 * Returns Wilaya list with the "الكل" (All) filter option included.
 */
export const getWilayaFilterOptions = (): string[] => {
  return ['الكل', ...Object.keys(WILAYAS_COMMUNES)];
};

/**
 * Validates whether a Wilaya exists in the canonical geographic dataset.
 */
export const isValidWilaya = (wilaya?: string | null): boolean => {
  if (!wilaya) return false;
  return Object.prototype.hasOwnProperty.call(WILAYAS_COMMUNES, wilaya);
};

/**
 * Validates whether a Commune exists, optionally scoped to a specific Wilaya.
 */
export const isValidCommune = (commune?: string | null, wilaya?: string | null): boolean => {
  if (!commune) return false;
  if (wilaya && wilaya !== 'الكل') {
    const list = WILAYAS_COMMUNES[wilaya];
    return Array.isArray(list) && list.includes(commune);
  }
  return Object.values(WILAYAS_COMMUNES).some(list => list.includes(commune));
};

export const WILAYAS = getWilayaFilterOptions();

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'all', name: 'جميع المهن', iconName: 'Layers', count: 0, color: 'bg-slate-100 text-slate-800', description: 'تصفح كافة الحرف والخدمات' },
  { id: 'plumbing', name: 'السباكة والترصيص', iconName: 'Wrench', count: 0, color: 'bg-blue-50 text-blue-600', description: 'تصليح التسربات، السخانات وتجهيز شبكات المياه' },
  { id: 'electrical', name: 'الكهرباء والإنارة', iconName: 'Zap', count: 0, color: 'bg-amber-50 text-amber-600', description: 'تمديدات كهربائية منزلية وصيانة الأعطال' },
  { id: 'ac', name: 'التكييف والتبريد', iconName: 'Snowflake', count: 0, color: 'bg-cyan-50 text-cyan-600', description: 'شحن الغاز، صيانة المكيفات وغرف التبريد' },
  { id: 'painting', name: 'الطلاء والديكور', iconName: 'Palette', count: 0, color: 'bg-rose-50 text-rose-600', description: 'دهان الجدران، الديكورات الحديثة والجبس' },
  { id: 'carpentry', name: 'النجارة والأثاث', iconName: 'Hammer', count: 0, color: 'bg-amber-50 text-amber-800', description: 'تصنيع وصيانة الأثاث، الأبواب والمطابخ' },
  { id: 'construction', name: 'البناء والترميم', iconName: 'Building', count: 0, color: 'bg-orange-50 text-orange-600', description: 'أشغال البناء، التبليط، الفايونس والترميم' },
  { id: 'cleaning', name: 'التنظيف المنزلي', iconName: 'Sparkles', count: 0, color: 'bg-emerald-50 text-emerald-600', description: 'تنظيف وتطهير المنازل والمكاتب والواجهات' },
  { id: 'mechanic', name: 'ميكانيك السيارات', iconName: 'Car', count: 0, color: 'bg-indigo-50 text-indigo-600', description: 'فحص ميكانيكي، تصليح الأعطال والكهرباء' },
  { id: 'appliances', name: 'صيانة الأجهزة', iconName: 'Smartphone', count: 0, color: 'bg-purple-50 text-purple-600', description: 'تصليح الغسالات، الثلاجات والأجهزة الكهرومنزلية' },
  { id: 'gardening', name: 'البستنة والحدائق', iconName: 'Flower2', count: 0, color: 'bg-green-50 text-green-700', description: 'تنسيق الحدائق، غرس الأشجار وصيانة المساحات الخضراء' },
];

export const INITIAL_ARTISANS: Artisan[] = [];
