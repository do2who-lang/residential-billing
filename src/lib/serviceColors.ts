/**
 * Colour tokens for the per-service payment breakdown.
 *
 * Services have no colour of their own, so the dashboard assigns one from a
 * fixed palette by position. The class names stay complete strings so Tailwind
 * can see them during the build.
 */
const SERVICE_COLORS = [
  'bg-brand-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-indigo-500',
  'bg-lime-500',
  'bg-fuchsia-500',
] as const;

/** Stable colour for the service at `index` in the ordered service list. */
export function serviceColorClass(index: number): string {
  return SERVICE_COLORS[index % SERVICE_COLORS.length];
}
