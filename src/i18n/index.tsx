import { createContext, useContext, ReactNode, useCallback } from "react";
import { en, TranslationKey } from "./en";
import { es } from "./es";

export type Language = "en" | "es";

const translations: Record<Language, Record<string, string>> = { en, es };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "es",
  setLanguage: () => {},
  t: (key) => translations.es[key] || translations.en[key] || key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language: Language = "es";

  const setLanguage = useCallback((_lang: Language) => {
    // Locked to Spanish
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      let text = translations.es[key] || translations.en[key] || key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, String(v));
        });
      }
      return text;
    },
    []
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
export type { TranslationKey };
