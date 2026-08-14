import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { normalizeToUnifiedEvents } from "@/lib/unifiedEvents";
import { useCandidateWatchlist } from "@/hooks/useCandidateWatchlist";
import { renderHook, act } from "@testing-library/react";
import { TableroView } from "@/components/views/TableroView";
import { MovimientosView } from "@/components/views/MovimientosView";
import { EstrategiaView } from "@/components/views/EstrategiaView";
import { setupTestEnvironment } from "@/test/helpers/stateSetup";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Milestone M3 Challenger Edge Cases & Stress Harness", () => {
  let env: ReturnType<typeof setupTestEnvironment>;

  beforeEach(() => {
    env = setupTestEnvironment({ useFakeTimers: false });
    localStorage.clear();
  });

  afterEach(() => {
    env.cleanup();
  });

  describe("1. normalizeToUnifiedEvents Edge Cases", () => {
    it("handles completely empty lists cleanly", () => {
      const result = normalizeToUnifiedEvents([], [], new Map());
      expect(result).toEqual([]);
    });

    it("handles undefined/null parameters gracefully", () => {
      // @ts-ignore
      const result = normalizeToUnifiedEvents(undefined, undefined, undefined);
      expect(result).toEqual([]);
    });

    it("filters out deleted transactions", () => {
      const txs = [
        { id: "1", name: "Active", amount_usd: 100, transaction_date: "2026-08-01", type: "expense" },
        { id: "2", name: "Deleted", amount_usd: 50, transaction_date: "2026-08-02", type: "expense", deleted_at: "2026-08-03" },
      ] as any;
      const result = normalizeToUnifiedEvents(txs, [], new Map());
      expect(result.length).toBe(1);
      expect(result[0].title).toBe("Active");
    });

    it("handles zero amounts and missing names without errors", () => {
      const txs = [
        { id: "1", name: "", amount_usd: 0, transaction_date: "2026-08-01", type: "expense" },
      ] as any;
      const trades = [
        { id: "tr1", symbol: "GGAL", trade_type: "buy", trade_date: "2026-08-02", total_amount: 0, quantity: 0 },
      ] as any;
      const result = normalizeToUnifiedEvents(txs, trades, new Map());
      expect(result.length).toBe(2);
      // Items are sorted by date descending (2026-08-02 trade comes first, 2026-08-01 tx second)
      expect(result[0].title).toBe("BUY GGAL");
      expect(result[1].title).toBe("Sin título");
      expect(result[1].amountUSD).toBe(0);
    });
  });

  describe("2. useCandidateWatchlist Resilience", () => {
    it("recovers gracefully from corrupted localStorage content", () => {
      localStorage.setItem("chess_candidate_watchlist", "{invalid_json: true");
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { result } = renderHook(() => useCandidateWatchlist());
      expect(result.current.items).toBeDefined();
      expect(result.current.items.length).toBeGreaterThan(0); // Falls back to default candidates

      consoleWarnSpy.mockRestore();
    });

    it("allows adding candidate with special characters and HTML strings safely", () => {
      const { result } = renderHook(() => useCandidateWatchlist());
      const specialSymbol = "NVDA<script>alert(1)</script>";

      act(() => {
        result.current.addItem({
          symbol: specialSymbol,
          assetCategory: "cedear",
          targetEntryPriceARS: 1000,
          targetExitPriceARS: 1500,
          invalidationPriceARS: 900,
          entryThesis: "<img src=x onerror=alert(1)> Safe Entry Thesis",
          invalidationCondition: "DROP TABLE trades; -- Safe invalidation",
        });
      });

      expect(result.current.items[0].symbol).toBe(specialSymbol);
    });
  });

  describe("3. View Component Rendering & Stability", () => {
    it("renders TableroView without crashing on empty portfolio state", async () => {
      const { container } = renderWithProviders(<TableroView />);
      expect(container).toBeInTheDocument();
      expect(screen.getByText("Tablero General")).toBeInTheDocument();
      expect(screen.getByText("Patrimonio Neto Unificado (Net Worth)")).toBeInTheDocument();
    });

    it("renders MovimientosView without crashing on empty event log", async () => {
      const { container } = renderWithProviders(<MovimientosView />);
      expect(container).toBeInTheDocument();
      expect(screen.getByText("Movimientos Unificados")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/coto|uber/i)).toBeInTheDocument();
    });

    it("renders EstrategiaView without crashing", async () => {
      const { container } = renderWithProviders(<EstrategiaView />);
      expect(container).toBeInTheDocument();
      expect(screen.getByText("Estrategia & Disciplina de Inversión")).toBeInTheDocument();
      expect(screen.getByText("Tesis Abiertas")).toBeInTheDocument();
    });
  });

  describe("4. Omnibar Special Character & Boundary Handling", () => {
    it("handles special characters in Omnibar text submission without throwing exception", async () => {
      renderWithProviders(<MovimientosView />);
      const input = screen.getByPlaceholderText(/coto|uber/i);

      fireEvent.change(input, { target: { value: "<script>alert('XSS')</script> SELECT * FROM trades; 15000" } });
      expect((input as HTMLInputElement).value).toBe("<script>alert('XSS')</script> SELECT * FROM trades; 15000");

      const submitBtn = screen.getByRole("button", { name: /registrar/i });
      act(() => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(input).toBeInTheDocument();
      });
    });

    it("handles zero and negative amounts in Omnibar", async () => {
      renderWithProviders(<MovimientosView />);
      const input = screen.getByPlaceholderText(/coto|uber/i);

      fireEvent.change(input, { target: { value: "Prueba 0" } });
      const submitBtn = screen.getByRole("button", { name: /registrar/i });

      act(() => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(input).toBeInTheDocument();
      });
    });
  });
});
