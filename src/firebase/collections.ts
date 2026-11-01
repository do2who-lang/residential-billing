import {
  collection,
  doc,
  Timestamp,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from 'firebase/firestore';
import { db } from './config';
import type {
  Apartment,
  AppUser,
  BuildingSettings,
  Charge,
  Payment,
  Period,
  Service,
} from '@/types/models';

export type WithId<T> = T & { id: string };

/** Firestore Timestamp -> Date, tolerating nulls and plain dates from the emulator. */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybe = value as { toDate: () => Date };
    if (typeof maybe.toDate === 'function') return maybe.toDate();
  }
  return null;
}

function fromDate(value: unknown): Timestamp | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  return null;
}

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const bool = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

// --------------------------------------------------------------------------
// settings/building
// --------------------------------------------------------------------------
export const settingsConverter: FirestoreDataConverter<BuildingSettings> = {
  toFirestore(settings) {
    return {
      name: settings.name,
      address: settings.address,
      currency: settings.currency,
      defaultLang: settings.defaultLang,
      cashOnHandMinor: settings.cashOnHandMinor,
      cashCountedAt: fromDate(settings.cashCountedAt),
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): BuildingSettings {
    const data = snapshot.data(options);
    return {
      name: str(data.name, 'My Building'),
      address: str(data.address),
      currency: str(data.currency, 'JOD'),
      defaultLang: data.defaultLang === 'ar' ? 'ar' : 'en',
      cashOnHandMinor: num(data.cashOnHandMinor),
      cashCountedAt: toDate(data.cashCountedAt),
    };
  },
};

// --------------------------------------------------------------------------
// users/{uid}
// --------------------------------------------------------------------------
export function userFromSnap(uid: string, data: Record<string, unknown>): AppUser {
  return {
    uid,
    email: str(data.email),
    displayName: str(data.displayName),
    role: data.role === 'admin' ? 'admin' : 'resident',
    apartmentId: typeof data.apartmentId === 'string' && data.apartmentId ? data.apartmentId : null,
    active: bool(data.active, true),
    createdAt: toDate(data.createdAt),
  };
}

export const userConverter: FirestoreDataConverter<AppUser> = {
  toFirestore(user) {
    return {
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      apartmentId: user.apartmentId,
      active: user.active,
      createdAt: fromDate(user.createdAt),
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): AppUser {
    return userFromSnap(snapshot.id, snapshot.data(options));
  },
};

// --------------------------------------------------------------------------
// apartments/{id}
// --------------------------------------------------------------------------
export const apartmentConverter: FirestoreDataConverter<Apartment> = {
  toFirestore(apartment) {
    return {
      name: apartment.name,
      floor: apartment.floor,
      number: apartment.number,
      ownerName: apartment.ownerName,
      phone: apartment.phone,
      email: apartment.email,
      archived: apartment.archived,
      order: apartment.order,
      createdAt: fromDate(apartment.createdAt),
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Apartment {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      name: str(data.name, snapshot.id),
      floor: str(data.floor),
      number: str(data.number),
      ownerName: str(data.ownerName),
      phone: str(data.phone),
      email: str(data.email),
      archived: bool(data.archived),
      order: num(data.order, 0),
      createdAt: toDate(data.createdAt),
    };
  },
};

// --------------------------------------------------------------------------
// services/{id}
// --------------------------------------------------------------------------
export const serviceConverter: FirestoreDataConverter<Service> = {
  toFirestore(service) {
    return {
      nameEn: service.nameEn,
      nameAr: service.nameAr,
      archived: service.archived,
      order: service.order,
      shared: service.shared,
      createdAt: fromDate(service.createdAt),
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Service {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      nameEn: str(data.nameEn, str(data.nameAr, snapshot.id)),
      nameAr: str(data.nameAr, str(data.nameEn, snapshot.id)),
      archived: bool(data.archived),
      order: num(data.order, 0),
      shared: bool(data.shared),
      createdAt: toDate(data.createdAt),
    };
  },
};

// --------------------------------------------------------------------------
// periods/{YYYY-MM}
// --------------------------------------------------------------------------
export const periodConverter: FirestoreDataConverter<Period> = {
  toFirestore(period) {
    return {
      year: period.year,
      month: period.month,
      status: period.status,
      notes: period.notes,
      sharedAmountsMinor: period.sharedAmountsMinor ?? {},
      sharedNote: period.sharedNote ?? '',
      createdAt: fromDate(period.createdAt),
      closedAt: fromDate(period.closedAt),
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Period {
    const data = snapshot.data(options);
    const [yearRaw, monthRaw] = snapshot.id.split('-');
    const status =
      data.status === 'closed' ? 'closed' : data.status === 'draft' ? 'draft' : 'open';
    const rawShared = (data.sharedAmountsMinor ?? {}) as Record<string, unknown>;
    const sharedAmountsMinor: Record<string, number> = {};
    for (const [serviceId, value] of Object.entries(rawShared)) {
      const amount = num(value, 0);
      if (amount !== 0) sharedAmountsMinor[serviceId] = Math.round(amount);
    }
    return {
      id: snapshot.id,
      year: num(data.year, Number(yearRaw)),
      month: num(data.month, Number(monthRaw)),
      status,
      notes: str(data.notes),
      sharedAmountsMinor,
      sharedNote: str(data.sharedNote),
      createdAt: toDate(data.createdAt),
      closedAt: toDate(data.closedAt),
    };
  },
};

// --------------------------------------------------------------------------
// periods/{YYYY-MM}/charges/{apartmentId}
// --------------------------------------------------------------------------
export const chargeConverter: FirestoreDataConverter<Charge> = {
  toFirestore(charge) {
    return { apartmentId: charge.apartmentId, amountsMinor: charge.amountsMinor };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Charge {
    const data = snapshot.data(options);
    const raw = (data.amountsMinor ?? {}) as Record<string, unknown>;
    const amountsMinor: Record<string, number> = {};
    for (const [serviceId, value] of Object.entries(raw)) {
      const amount = num(value, 0);
      if (amount !== 0) amountsMinor[serviceId] = Math.round(amount);
    }
    return {
      id: snapshot.id,
      apartmentId: str(data.apartmentId, snapshot.id),
      amountsMinor,
    };
  },
};

// --------------------------------------------------------------------------
// payments/{id}
// --------------------------------------------------------------------------
export const paymentConverter: FirestoreDataConverter<Payment> = {
  toFirestore(payment) {
    return {
      periodId: payment.periodId,
      apartmentId: payment.apartmentId,
      serviceId: payment.serviceId,
      amountMinor: payment.amountMinor,
      paidAt: fromDate(payment.paidAt),
      method: payment.method,
      note: payment.note,
      recordedBy: payment.recordedBy,
      createdAt: fromDate(payment.createdAt),
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Payment {
    const data = snapshot.data(options);
    const method =
      data.method === 'bank' ? 'bank' : data.method === 'other' ? 'other' : 'cash';
    return {
      id: snapshot.id,
      periodId: str(data.periodId),
      apartmentId: str(data.apartmentId),
      serviceId: str(data.serviceId),
      amountMinor: Math.round(num(data.amountMinor, 0)),
      paidAt: toDate(data.paidAt),
      method,
      note: str(data.note),
      recordedBy: str(data.recordedBy),
      createdAt: toDate(data.createdAt),
    };
  },
};

// --------------------------------------------------------------------------
// Typed references — the only place collection paths are written down.
// --------------------------------------------------------------------------
export const settingsDocRef = () => doc(db, 'settings', 'building').withConverter(settingsConverter);

export const usersCol = () => collection(db, 'users').withConverter(userConverter);
export const userDocRef = (uid: string) => doc(db, 'users', uid).withConverter(userConverter);

export const apartmentsCol = () => collection(db, 'apartments').withConverter(apartmentConverter);
export const apartmentDocRef = (id: string) =>
  doc(db, 'apartments', id).withConverter(apartmentConverter);

export const servicesCol = () => collection(db, 'services').withConverter(serviceConverter);
export const serviceDocRef = (id: string) => doc(db, 'services', id).withConverter(serviceConverter);

export const periodsCol = () => collection(db, 'periods').withConverter(periodConverter);
export const periodDocRef = (id: string) => doc(db, 'periods', id).withConverter(periodConverter);

export const chargesCol = (periodId: string) =>
  collection(db, 'periods', periodId, 'charges').withConverter(chargeConverter);
export const chargeDocRef = (periodId: string, apartmentId: string) =>
  doc(db, 'periods', periodId, 'charges', apartmentId).withConverter(chargeConverter);

export const paymentsCol = () => collection(db, 'payments').withConverter(paymentConverter);
export const paymentDocRef = (id: string) => doc(db, 'payments', id).withConverter(paymentConverter);

// --------------------------------------------------------------------------
// Raw (un-converted) references — needed for partial updates, `deleteField()`
// and batch writes, where a full model object is not available.
// --------------------------------------------------------------------------
export { db };
export const userRawRef = (uid: string) => doc(db, 'users', uid);
export const periodRawRef = (id: string) => doc(db, 'periods', id);
export const paymentsRawCol = () => collection(db, 'payments');
export const paymentRawRef = (id: string) => doc(db, 'payments', id);
export const chargesRawCol = (periodId: string) => collection(db, 'periods', periodId, 'charges');
export const chargeRawRef = (periodId: string, apartmentId: string) =>
  doc(db, 'periods', periodId, 'charges', apartmentId);
