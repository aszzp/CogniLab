'use client';

import { createContext, useContext } from 'react';

export interface KunCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  quote: string;
  setQuote: (v: string) => void;
  ask: (text: string) => void;
}

export const Ctx = createContext<KunCtx>({
  open: false, setOpen: () => {}, quote: '', setQuote: () => {}, ask: () => {},
});

export const useKun = () => useContext(Ctx);
