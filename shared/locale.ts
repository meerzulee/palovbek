export type Locale = 'en' | 'ru';
export const LANGUAGE_KEY = 'plov-language-v1';
// Product language defaults, kept explicit so deployment owners can adjust them.
export const RUSSIAN_DEFAULT_COUNTRIES = ['AM', 'AZ', 'BY', 'KZ', 'KG', 'MD', 'RU', 'TJ', 'TM', 'UZ'];
export function countryLocale(country?: string): Locale | null {
  if (!country || !/^[A-Z]{2}$/i.test(country) || ['XX', 'T1'].includes(country.toUpperCase())) return null;
  return RUSSIAN_DEFAULT_COUNTRIES.includes(country.toUpperCase()) ? 'ru' : 'en';
}
export function browserLocale(languages: readonly string[]): Locale {
  return languages[0]?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}
