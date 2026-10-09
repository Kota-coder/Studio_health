// The hospital's branding (hospital_profile table), shared by server and browser code.
import type { Responsibilities } from '@/config/responsibilities';
import type { PageAccess } from '@/config/permissions';

export interface HospitalProfile {
  name: string;
  shortName?: string | null;
  tagline?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  registrationNumber?: string | null;
  brandColor: string; // #rrggbb
  logoFolder?: string | null;
  disabledModules?: string[]; // menu sections switched off (src/config/modules.ts)
  responsibilities?: Responsibilities; // which roles do each department's duties (src/config/responsibilities.ts)
  pageAccess?: PageAccess; // which roles may open each page, where changed (src/config/permissions.ts)
  configuredAt?: string | null;
}

export const DEFAULT_PROFILE: HospitalProfile = { name: 'Seva', brandColor: '#2563eb' };

// Colours that keep white text readable (contrast of at least 4.5:1).
export const BRAND_COLORS: Array<{ name: string; hex: string }> = [
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Navy', hex: '#1e3a8a' },
  { name: 'Teal', hex: '#0f766e' },
  { name: 'Green', hex: '#15803d' },
  { name: 'Violet', hex: '#6d28d9' },
  { name: 'Maroon', hex: '#9f1239' },
  { name: 'Rust', hex: '#b45309' },
  { name: 'Slate', hex: '#334155' },
];

export const isSevaDefault = (profile: HospitalProfile) => !profile.configuredAt;
export const displayName = (profile: HospitalProfile) => profile.shortName?.trim() || profile.name;

// Public URLs of the logo and app icons uploaded by the Super Admin.
export function brandingUrls(profile: HospitalProfile, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '') {
  if (!profile.logoFolder || !supabaseUrl) return null;
  const base = `${supabaseUrl}/storage/v1/object/public/branding/${profile.logoFolder}`;
  return {
    logo: `${base}/logo.png`,
    logoSmall: `${base}/logo-96.png`,
    icon192: `${base}/icon-192.png`,
    icon512: `${base}/icon-512.png`,
    maskable512: `${base}/maskable-512.png`,
    apple: `${base}/apple-icon.png`,
  };
}

// "Sri Ram Multispeciality Hospital" -> "SR"; skips words like "the", "of", "hospital".
export function initialsFor(name: string): string {
  const skip = new Set(['the', 'of', 'and', '&', 'hospital', 'hospitals', 'clinic', 'clinics', 'centre', 'center', 'pvt', 'ltd', 'multispeciality', 'multi-speciality', 'super', 'speciality']);
  const words = name.replace(/[^\p{L}\p{N}\s&-]/gu, ' ').split(/\s+/).filter(Boolean);
  const meaningful = words.filter(w => !skip.has(w.toLowerCase()));
  const picked = (meaningful.length ? meaningful : words).slice(0, 2).map(w => w[0]);
  return picked.join('').toUpperCase() || 'H';
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// "#2563eb" -> "221 83% 53%" (the format the theme's CSS variables use).
export function hexToHslTriplet(hex: string, lightnessOverride?: number): string {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  const light = lightnessOverride ?? Math.round(l * 100);
  return `${Math.round(h)} ${Math.round(s * 100)}% ${light}%`;
}

// WCAG contrast ratio of white text on this colour.
export function contrastWithWhite(hex: string): number {
  const lum = hexToRgb(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
  return 1.05 / (L + 0.05);
}

// Mixes the colour with white (amount 0..1), e.g. for a pale background tile.
export function tint(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex).map(v => Math.round(v + (255 - v) * amount));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

export type MonogramShape = 'circle' | 'rounded' | 'shield' | 'hexagon';
export type MonogramEmblem = 'none' | 'cross' | 'heart' | 'leaf';

// A distinctive logo made from the hospital's initials: a coloured shape with white
// letters and an optional small emblem. Returned as SVG markup (also used before a logo
// has been uploaded).
export function monogramSvg(initials: string, color: string, shape: MonogramShape = 'shield', emblem: MonogramEmblem = 'cross'): string {
  const shapes: Record<MonogramShape, string> = {
    circle: '<circle cx="64" cy="64" r="60"/>',
    rounded: '<rect x="6" y="6" width="116" height="116" rx="28"/>',
    shield: '<path d="M64 4 L116 22 V60 C116 92 94 114 64 124 C34 114 12 92 12 60 V22 Z"/>',
    hexagon: '<path d="M64 4 L118 34 V94 L64 124 L10 94 V34 Z"/>',
  };
  const text = initials.slice(0, 2).toUpperCase().replace(/[<>&"]/g, '');
  const size = text.length > 1 ? 46 : 58;
  const textY = emblem === 'none' ? 80 : 74;
  const emblems: Record<MonogramEmblem, string> = {
    none: '',
    cross: '<path d="M60 88 h8 v8 h8 v8 h-8 v8 h-8 v-8 h-8 v-8 h8 z" fill="#fff"/>',
    heart: '<path d="M64 112 C52 104 46 99 46 92 C46 87 50 84 54 84 C58 84 61 86 64 90 C67 86 70 84 74 84 C78 84 82 87 82 92 C82 99 76 104 64 112 Z" fill="#fff"/>',
    leaf: '<path d="M64 112 C52 106 50 94 56 86 C66 84 76 92 72 106 Z M64 112 L60 98" fill="#fff" stroke="#fff" stroke-width="1.5"/>',
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><g fill="${color}">${shapes[shape]}</g>`
    + `<text x="64" y="${textY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${size}" fill="#fff" letter-spacing="1">${text}</text>`
    + `${emblems[emblem]}</svg>`;
}
