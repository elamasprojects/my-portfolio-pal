import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { DemoContext, type DemoContextValue } from "./DemoContext";
import { useDemoData } from "./data/useDemoData";
import { makeFormatters } from "./data/format";
import { DeviceFrame } from "./components/DeviceFrame";
import { DemoAppChrome } from "./components/DemoAppChrome";
import { DemoControlBar } from "./components/DemoControlBar";
import { WatchScreen } from "./screens/WatchScreen";
import type { DemoCurrency, DemoScreenId, DeviceKind } from "./data/types";

const DEVICE_KEY = "demo.device";

export function DemoShell() {
  const { profile } = useProfile();
  const data = useDemoData();

  const [device, setDeviceState] = useState<DeviceKind>(() => {
    try {
      const s = localStorage.getItem(DEVICE_KEY);
      if (s === "desktop" || s === "phone" || s === "watch") return s;
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) return "phone";
    return "desktop";
  });
  const [screen, setScreen] = useState<DemoScreenId>("dashboard");
  const [currency, setCurrencyState] = useState<DemoCurrency>("USD");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const currencyTouched = useRef(false);

  const setCurrency = useCallback((c: DemoCurrency) => {
    currencyTouched.current = true;
    setCurrencyState(c);
  }, []);

  // Apply the profile's default currency once it loads — unless the user already chose one.
  useEffect(() => {
    if (currencyTouched.current) return;
    const c = profile?.default_currency;
    if (c === "USD" || c === "ARS") setCurrencyState(c);
  }, [profile]);

  const setDevice = useCallback((d: DeviceKind) => {
    setDeviceState(d);
    try {
      localStorage.setItem(DEVICE_KEY, d);
    } catch {
      /* ignore */
    }
  }, []);

  const openAsset = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    setScreen("assetDetail");
  }, []);

  const fmt = useMemo(() => makeFormatters(currency, data.mepRate), [currency, data.mepRate]);

  const resolvedDevice: DeviceKind = device;

  const value: DemoContextValue = {
    data,
    fmt,
    currency,
    setCurrency,
    device: resolvedDevice,
    setDevice,
    isPhone: resolvedDevice === "phone",
    screen,
    setScreen,
    selectedSymbol,
    openAsset,
  };

  return (
    <DemoContext.Provider value={value}>
      <DeviceFrame device={resolvedDevice} app={<DemoAppChrome />} watch={<WatchScreen />} />
      <DemoControlBar />
    </DemoContext.Provider>
  );
}
