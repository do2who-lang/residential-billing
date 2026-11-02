import { formatPhoneNumber } from '@/lib/phoneAuth';
import type { AppUser } from '@/types/models';

export function userIdentifier(user: AppUser | null | undefined): string {
  return user?.phone ? formatPhoneNumber(user.phone) : user?.email || '';
}

export function userDisplayName(user: AppUser | null | undefined): string {
  return user?.displayName ? formatPhoneNumber(user.displayName) : userIdentifier(user);
}
