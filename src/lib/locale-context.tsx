"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { type Locale, t as translate, getStageLabel as getStageLabelFn } from "./i18n";

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  stageLabel: (stage: string) => string;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: "zh",
  setLocale: () => {},
  t: (key) => key,
  stageLabel: (stage) => stage,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    const saved = localStorage.getItem("allinai-locale") as Locale;
    if (saved && (saved === "zh" || saved === "en")) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("allinai-locale", l);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(key as any, locale, params);

  const stageLabel = (stage: string) => getStageLabelFn(stage, locale);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, stageLabel }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
