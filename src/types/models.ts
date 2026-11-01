/** Domain models. Firestore timestamps are converted to `Date` at the boundary. */

export type Role = 'admin' | 'resident';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  /** Apartment this resident is linked to. Ad NULL for admins. */
  apartmentId: string | null;
  active: boolean;
  createdAt: Date | null;
}

export interface BuildingSettings {
  name: string;
  address: string;
  currency: string;
  /** Default UI language for first-time visitors. */
  defaultLang: 'en' | 'ar';
  /**
   * Cash actually counted by hand at `cashCountedAt`. Payments recorded after
   * that moment are added on top, so the available balance reflects reality
   * even when the building's history started before this app existed.
   */
  cashOnHandMinor: number;
  cashCountedAt: Date | null;
}

export interface Apartment {
  id: string;
  name: string;
  floor: string;
  number: string;
  ownerName: string;
  phone: string;
  email: string;
  archived: boolean;
  order: number;
  createdAt: Date | null;
}

export interface Service {
  id: string;
  nameEn: string;
  nameAr: string;
  archived: boolean;
  order: number;
  /**
   * Building-wide expense: the treasurer enters ONE total per month and it is
   * split equally across every apartment instead of being typed per apartment.
   */
  shared: boolean;
  createdAt: Date | null;
}

export type PeriodStatus = 'draft' | 'open' | 'closed';

export interface Period {
  /** Document id, always `YYYY-MM`. */
  id: string;
  year: number;
  /** 1-12 */
  month: number;
  status: PeriodStatus;
  notes: string;
  /**
   * Building-wide totals entered for shared services, in minor units:
   * `serviceId -> total`. The per-apartment shares live in the charge docs.
   */
  sharedAmountsMinor: Record<string, number>;
  /** Free-text remark for the month's shared expenses (what the bills were for). */
  sharedNote: string;
  createdAt: Date | null;
  closedAt: Date | null;
}

/** Charges for one apartment in one period: serviceId -> amount in minor units. */
export interface Charge {
  id: string;
  apartmentId: string;
  amountsMinor: Record<string, number>;
}

export type PaymentMethod = 'cash' | 'bank' | 'other';

export interface Payment {
  id: string;
  periodId: string;
  apartmentId: string;
  serviceId: string;
  /** Integer minor units (JOD fils). */
  amountMinor: number;
  paidAt: Date | null;
  method: PaymentMethod;
  note: string;
  recordedBy: string;
  createdAt: Date | null;
}

export type PaymentStatus = 'paid' | 'partial' | 'unpaid' | 'none';
