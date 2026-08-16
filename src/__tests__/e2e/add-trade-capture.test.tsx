import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AddTradeDialog } from "@/components/trades/AddTradeDialog";
import { setupTestEnvironment } from "@/test/helpers/stateSetup";

/**
 * Regression cover for the capability the 3-view refactor dropped.
 *
 * AddTrade.tsx and ImportTrades.tsx were deleted and /add redirected away, leaving
 * useQuickSellTrade (hardcoded trade_type: "sell") as the only insert into `trades`. The app
 * could close a position but never open one, and "mandatory thesis on buys" had no buy flow to
 * attach to.
 */

const insertedRows: any[] = [];

vi.mock("@/integrations/supabase/client", async () => {
  const actual = await vi.importActual<any>("@/integrations/supabase/client");
  return {
    ...actual,
    supabase: {
      ...actual.supabase,
      from: (table: string) => {
        if (table === "trades") {
          return {
            insert: (row: any) => ({
              select: () => ({
                single: () => {
                  insertedRows.push(row);
                  return Promise.resolve({ data: { id: "new-trade", ...row }, error: null });
                },
              }),
            }),
            select: () => ({
              eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
            }),
          };
        }
        if (table === "portfolios") {
          const rows = [{ id: "portfolio-1", user_id: "user-1", name: "Main", created_at: "2024-01-01" }];
          return {
            select: () => ({
              eq: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      },
      rpc: () => Promise.resolve({ data: null, error: null }),
    },
  };
});

vi.mock("@/hooks/useAuth", async () => {
  const actual = await vi.importActual<any>("@/hooks/useAuth");
  return {
    ...actual,
    useAuth: () => ({
      session: { user: { id: "user-1" } },
      user: { id: "user-1" },
      loading: false,
      signOut: async () => {},
    }),
  };
});

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AddTradeDialog open onOpenChange={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Trade capture (buys and dividends)", () => {
  let env: ReturnType<typeof setupTestEnvironment>;

  beforeEach(() => {
    insertedRows.length = 0;
    env = setupTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  it("refuses a buy without a declared thesis", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("Ticker"), { target: { value: "AAPL" } });
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Precio por unidad"), { target: { value: "230" } });

    fireEvent.click(screen.getByRole("button", { name: /^Registrar$/ }));

    await screen.findByText(/Por qué entro: mínimo 10 caracteres/);
    expect(insertedRows).toHaveLength(0);
  });

});
