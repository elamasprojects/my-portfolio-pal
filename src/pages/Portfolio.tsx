import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { makeFormatters } from "@/lib/format";
import { useLanguage } from "@/i18n";
import { CopyPortfolioImageButton } from "@/components/CopyPortfolioImageButton";
import { useDemoData } from "./demo/data/useDemoData";
import { enrichHoldings } from "./demo/data/portfolioMetrics";
import { DemoContext, type DemoContextValue } from "./demo/DemoContext";
import { PortfolioScreen } from "./demo/screens/PortfolioScreen";
import type { DemoCurrency, DemoScreenId } from "./demo/data/types";

/**
 * Production /portfolio — the redesigned Portfolio screen from /demo (Allocation / Terminal /
 * Heatmap) on real account data, plus a "Copy image" action. We feed the demo screen via a
 * DemoContext provider so the exact same components are reused (and /demo keeps working).
 */
export default function Portfolio() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { profile } = useProfile();
  const data = useDemoData();

  const currency = (profile?.default_currency as DemoCurrency) || "USD";
  const fmt = useMemo(() => makeFormatters(currency, data.mepRate), [currency, data.mepRate]);

  const ctx = useMemo<DemoContextValue>(
    () => ({
      data,
      fmt,
      currency,
      setCurrency: () => {},
      device: "desktop",
      setDevice: () => {},
      isPhone: false,
      screen: "portfolio" as DemoScreenId,
      setScreen: (s: DemoScreenId) => {
        if (s === "addTrade") navigate("/add");
        else if (s === "trades") navigate("/trades");
        else if (s === "analysis") navigate("/analysis");
      },
      selectedSymbol: null,
      openAsset: (symbol: string) => navigate(`/asset/${symbol}`),
    }),
    [data, fmt, currency, navigate],
  );

  const name = profile?.username || profile?.display_name || "Trader";
  const shareItems = useMemo(() => {
    const { items } = enrichHoldings(data.holdings, data.prices, data.previousCloses);
    return items.map((h) => ({ symbol: h.symbol, name: h.name, weight: h.weight }));
  }, [data.holdings, data.prices, data.previousCloses]);

  return (
    <DemoContext.Provider value={ctx}>
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="pr-12 md:pr-0">
          <h1 className="text-2xl chess-title">{t("portfolio.pageTitle")}</h1>
        </div>
        <PortfolioScreen
          compositionAction={<CopyPortfolioImageButton iconOnly name={name} items={shareItems} />}
        />
      </div>
    </DemoContext.Provider>
  );
}
