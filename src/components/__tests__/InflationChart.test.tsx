import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InflationChart } from "@/components/InflationChart";
import type { InflationHistory } from "@/hooks/useInflationHistory";

const useInflationHistory = vi.fn();
vi.mock("@/hooks/useInflationHistory", () => ({
  useInflationHistory: () => useInflationHistory(),
}));

function months(rates: number[]): InflationHistory["points"] {
  // Ends at 2026-08 so the most recent month is the last entry.
  return rates.map((rate, i) => {
    const d = new Date(2026, 7 - (rates.length - 1 - i), 1);
    return {
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
      monthlyRate: rate,
    };
  });
}

function mockHistory(overrides: Partial<InflationHistory & { isLoading: boolean; isError: boolean }> = {}) {
  useInflationHistory.mockReturnValue({
    data: {
      points: overrides.points ?? months([2, 3, 4]),
      isEstimated: overrides.isEstimated ?? false,
      source: overrides.source ?? "argentinadatos_indec",
    },
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
  });
}

describe("InflationChart", () => {
  beforeEach(() => {
    useInflationHistory.mockReset();
  });

  it("reports the four windows the page is for", () => {
    mockHistory();
    render(<InflationChart />);

    expect(screen.getByText("Último mes")).toBeInTheDocument();
    expect(screen.getByText("Últimos 3 meses")).toBeInTheDocument();
    expect(screen.getByText("Último año")).toBeInTheDocument();
    expect(screen.getByText("Últimos 3 años")).toBeInTheDocument();
  });

  /** The figure rendered inside the tile carrying `label`. */
  function tileValue(label: string): string {
    const tile = screen.getByText(label).parentElement;
    return tile?.querySelector("span:last-child")?.textContent ?? "";
  }

  it("compounds the window rather than summing the months", () => {
    mockHistory({ points: months([2, 3, 4]) });
    render(<InflationChart />);

    expect(tileValue("Último mes")).toBe("+4%");
    // 1.02 * 1.03 * 1.04 - 1 = 9.3%, not 2 + 3 + 4 = 9%.
    expect(tileValue("Últimos 3 meses")).toBe("+9,3%");
    // Only three months exist, so the longer windows report what is actually published.
    expect(tileValue("Último año")).toBe("+9,3%");
  });

  it("says so when the series is the synthetic fallback", () => {
    mockHistory({ isEstimated: true });
    render(<InflationChart />);

    expect(screen.getByText(/Serie estimada/)).toBeInTheDocument();
  });

  it("does not claim an estimate when the data is published", () => {
    mockHistory({ isEstimated: false });
    render(<InflationChart />);

    expect(screen.queryByText(/Serie estimada/)).not.toBeInTheDocument();
  });

  it("shows an empty state instead of zeroes when there is no data", () => {
    mockHistory({ points: [] });
    render(<InflationChart />);

    expect(screen.getByText(/No hay datos de inflación/)).toBeInTheDocument();
    expect(screen.queryByText("Último mes")).not.toBeInTheDocument();
  });

  it("states plainly that it is not applied to the portfolio", () => {
    mockHistory();
    render(<InflationChart />);

    expect(
      screen.getByText(/No se aplica a tus posiciones ni a tus resultados/)
    ).toBeInTheDocument();
  });
});
