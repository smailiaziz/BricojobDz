export interface Review {
  id: string;
  orderId?: string;
  userId?: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Artisan {
  id: string;
  name: string;
  profession: string;
  category: string;
  city: string;
  wilaya: string;
  rating: number;
  reviewCount: number;
  completedJobs?: number;
  startingPrice: number | null;
  avatar: string;
  verified: boolean;
  experienceYears: number;
  bio: string;
  services: string[];
  portfolio: string[];
  reviews: Review[];
  availableTimes: string;
  phone: string;
  availableNow?: boolean;
}

export interface ServiceCategory {
  id: string;
  name: string;
  iconName: string;
  count: number;
  color: string;
  description?: string;
}

export interface ToastMessage {
  id?: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'artisan';
  artisanId?: string;
  wilaya?: string;
  city?: string;
  phone?: string;
  profession?: string;
  avatar?: string;
  createdAt: string;
}

export type ContactRequestStatus = 'pending' | 'handled';

export interface ServiceContactRequest {
  id: string;
  artisanId: string;
  artisanName: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  service: string;
  description: string;
  preferredContact: 'phone' | 'whatsapp';
  createdAt: string;
  status: ContactRequestStatus;
}

export type RequestUrgency = 'now' | 'today' | 'scheduled' | 'flexible';
export type ServiceRequestStatus = 'open' | 'offers_received' | 'assigned' | 'completed' | 'cancelled';
export type ServiceOfferStatus =
  | 'pending'
  | 'accepted'
  | 'not_selected'
  | 'rejected'
  | 'withdrawn';

export interface ServiceRequest {
  id: string;
  clientId: string;
  clientName?: string;
  clientPhone?: string;
  category: string;
  title: string;
  description: string;
  wilaya: string;
  city: string;
  photos?: string[];
  budgetMin?: number;
  budgetMax?: number;
  urgency: RequestUrgency;
  preferredDate?: string;
  status: ServiceRequestStatus;
  createdAt: string;
  assignedArtisanId?: string;
  assignedOfferId?: string;
}

export interface ServiceOffer {
  id: string;
  requestId: string;
  artisanId: string;
  artisanName?: string;
  artisanProfession?: string;
  artisanAvatar?: string;
  artisanRating?: number;
  artisanReviewCount?: number;
  artisanPhone?: string;
  proposedPrice: number;
  estimatedDuration?: string;
  message?: string;
  status: ServiceOfferStatus;
  createdAt: string;
}

export type OrderStatus = 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'pending';

export interface OrderItem {
  id: string;
  requestId?: string;
  offerId?: string;
  clientId?: string;
  clientEmail?: string;
  artisanId: string;
  artisanName: string;
  artisanProfession?: string;
  clientName?: string;
  clientPhone?: string;
  preferredDate?: string;
  serviceDetails?: string;
  proposedPrice?: number;
  status: OrderStatus;
  createdAt: string;
}

