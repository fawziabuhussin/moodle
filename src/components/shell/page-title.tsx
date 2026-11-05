"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const PageTitleContext = createContext<{
  title: string | null;
  setTitle: (title: string | null) => void;
}>({ title: null, setTitle: () => {} });

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const value = useMemo(() => ({ title, setTitle }), [title]);
  return <PageTitleContext.Provider value={value}>{children}</PageTitleContext.Provider>;
}

export function usePageTitle() {
  return useContext(PageTitleContext).title;
}

export function RegisterPageTitle({ title }: { title: string }) {
  const { setTitle } = useContext(PageTitleContext);
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [setTitle, title]);
  return null;
}
