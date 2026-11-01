import { addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { apartmentDocRef, apartmentsCol } from '@/firebase/collections';
import type { Apartment } from '@/types/models';

export interface ApartmentInput {
  name: string;
  floor: string;
  number: string;
  ownerName: string;
  phone: string;
  email: string;
}

const normalize = (input: ApartmentInput): ApartmentInput => ({
  name: input.name.trim(),
  floor: input.floor.trim(),
  number: input.number.trim(),
  ownerName: input.ownerName.trim(),
  phone: input.phone.trim(),
  email: input.email.trim(),
});

export async function createApartment(input: ApartmentInput, order: number): Promise<void> {
  const payload = {
    ...normalize(input),
    archived: false,
    order,
    createdAt: new Date(),
  } as Apartment;
  await addDoc(apartmentsCol(), payload);
}

export async function updateApartment(id: string, input: ApartmentInput): Promise<void> {
  await updateDoc(apartmentDocRef(id), { ...normalize(input) });
}

export async function setApartmentArchived(id: string, archived: boolean): Promise<void> {
  await updateDoc(apartmentDocRef(id), { archived });
}

/**
 * Hard delete is only offered for apartments created by mistake. Charges and
 * payments are intentionally left untouched so financial history never silently
 * disappears; the UI steers users towards archiving instead.
 */
export async function deleteApartment(id: string): Promise<void> {
  await deleteDoc(apartmentDocRef(id));
}
