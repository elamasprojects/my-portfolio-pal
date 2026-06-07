// Context that distributes demo data + UI state to all screens/components.
import { createContext, useContext } from "react";
import type { DemoData, DemoCurrency, DeviceKind, DemoScreenId, Formatters } from "./data/types";

export interface DemoContextValue {
  data: DemoData;
  fmt: Formatters;
  currency: DemoCurrency;
  setCurrency: (c: DemoCurrency) => void;
  device: DeviceKind;
  setDevice: (d: DeviceKind) => void;
  /** True when the active frame is a phone (mobile layout), regardless of real viewport. */
  isPhone: boolean;
  screen: DemoScreenId;
  setScreen: (s: DemoScreenId) => void;
  selectedSymbol: string | null;
  openAsset: (symbol: string) => void;
}

export const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within the DemoShell provider");
  return ctx;
}
