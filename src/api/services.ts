import { addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { serviceDocRef, servicesCol } from '@/firebase/collections';
import type { Service } from '@/types/models';

export interface ServiceInput {
  nameEn: string;
  nameAr: string;
  /** Building-wide expense: one total per month, split over all apartments. */
  shared: boolean;
}

export async function createService(input: ServiceInput, order: number): Promise<void> {
  const payload = {
    nameEn: input.nameEn.trim() || input.nameAr.trim(),
    nameAr: input.nameAr.trim() || input.nameEn.trim(),
    archived: false,
    order,
    shared: input.shared,
    createdAt: new Date(),
  } as Service;
  await addDoc(servicesCol(), payload);
}

export async function updateService(id: string, input: ServiceInput): Promise<void> {
  await updateDoc(serviceDocRef(id), {
    nameEn: input.nameEn.trim() || input.nameAr.trim(),
    nameAr: input.nameAr.trim() || input.nameEn.trim(),
    shared: input.shared,
  });
}

/**
 * Services are archive-only. Archiving hides the service from new months while
 * every existing month keeps rendering it, so old statements stay accurate.
 */
export async function setServiceArchived(id: string, archived: boolean): Promise<void> {
  await updateDoc(serviceDocRef(id), { archived });
}

export async function deleteService(id: string): Promise<void> {
  await deleteDoc(serviceDocRef(id));
}

export async function reorderServices(services: Array<{ id: string; order: number }>): Promise<void> {
  await Promise.all(
    services.map((service) => updateDoc(serviceDocRef(service.id), { order: service.order })),
  );
}
