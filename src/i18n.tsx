import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { LANGUAGE_KEY, browserLocale } from '../shared/locale';
import type { Locale } from '../shared/locale';
import { translateText } from './translation';

export async function initialLocale(): Promise<Locale> {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'ru' || saved === 'en') return saved;
  } catch { /* Language switching still works without storage. */ }
  try {
    const response = await fetch('/api/locale', { cache: 'no-store', signal: AbortSignal.timeout(1200) });
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const { locale } = await response.json();
      if (locale === 'ru' || locale === 'en') return locale;
    }
  } catch { /* Local development, offline, or an unavailable edge lookup. */ }
  return browserLocale(navigator.languages);
}

const LanguageContext = createContext({ locale: 'en' as Locale, setLocale: (_locale: Locale) => {}, t: (text: string) => text });
export function LanguageProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const [locale, updateLocale] = useState(initial);
  const setLocale = useCallback((value: Locale) => {
    updateLocale(value);
    try { localStorage.setItem(LANGUAGE_KEY, value); } catch { /* Session-only preference. */ }
  }, []);
  const t = useCallback((text: string) => translateText(text, locale), [locale]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return <LanguageContext.Provider value={{ locale, setLocale, t }}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();
  return <div className="language-switch" role="group" aria-label={t('Language')}>
    <button lang="en" aria-label="English" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
    <button lang="ru" aria-label="Русский" aria-pressed={locale === 'ru'} onClick={() => setLocale('ru')}>RU</button>
  </div>;
}
