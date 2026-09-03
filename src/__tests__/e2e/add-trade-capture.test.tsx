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
        if (table === "user_brokers") {
          const rows = [
            { id: "ub-1", user_id: "user-1", broker_id: "b-ieb", is_default: false,
              broker: { id: "b-ieb", name: "IEB+", country: "AR", category: "local", display_order: 1 } },
            { id: "ub-2", user_id: "user-1", broker_id: "b-arq", is_default: true,
              broker: { id: "b-arq", name: "ARQ", country: "AR", category: "local", display_order: 2 } },
          ];
          return {
            select: () => ({
              eq: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }),
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

function renderDialogControlled() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AddTradeDialog open onOpenChange={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { ...utils, client };
}

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

  /** El formulario ya no es la primera pantalla: se llega por "cargala a mano". */
  async function abrirFormulario() {
    fireEvent.click(screen.getByRole("button", { name: /cargala a mano/i }));
    // El alta necesita el portfolio activo, que llega por query: sin esperarlo, el submit
    // sale con "User or active portfolio missing".
    await screen.findByLabelText("Ticker");
    await waitFor(() =>
      expect(screen.getByLabelText("Broker (opcional)")).toHaveTextContent(/ARQ|Sin asignar/)
    );
  }

  it("abre en la captura del comprobante, no en el formulario", () => {
    renderDialog();

    expect(screen.getByText(/subí la captura de la orden/i)).toBeInTheDocument();
    // Los diez campos de la operación no son lo primero que se ve.
    expect(screen.queryByLabelText("Ticker")).not.toBeInTheDocument();
  });

  it("registra una compra sin tesis declarada", async () => {
    // Antes exigía 10 caracteres de tesis. Este formulario anota una compra que ya se
    // ejecutó: pedirlos no cambiaba la decisión, sólo impedía registrar el hecho.
    renderDialog();
    await abrirFormulario();

    fireEvent.change(screen.getByLabelText("Ticker"), { target: { value: "AAPL" } });
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Precio por unidad"), { target: { value: "230" } });

    fireEvent.click(screen.getByRole("button", { name: /^Registrar$/ }));

    await waitFor(() => expect(insertedRows).toHaveLength(1));
    expect(insertedRows[0].symbol).toBe("AAPL");
    expect(insertedRows[0].entry_thesis ?? null).toBeNull();
  });

  it("registra una venta, que la fricción invertida bloqueaba por completo", async () => {
    // `useAddTrade` corría el chequeo de salida no planificada y exigía 20 caracteres de
    // justificación, pero este formulario no tiene dónde escribirla: ninguna venta entraba.
    renderDialog();
    await abrirFormulario();

    fireEvent.click(screen.getByRole("button", { name: /venta/i }));
    fireEvent.change(screen.getByLabelText("Ticker"), { target: { value: "ORCL" } });
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Precio por unidad"), { target: { value: "151.55" } });

    fireEvent.click(screen.getByRole("button", { name: /^Registrar$/ }));

    await waitFor(() => expect(insertedRows).toHaveLength(1));
    expect(insertedRows[0].trade_type).toBe("sell");
  });

  it("precarga el broker marcado como predeterminado", async () => {
    renderDialog();
    await abrirFormulario();

    // ARQ es el `is_default` del usuario; antes había que elegirlo en cada alta.
    await waitFor(() => {
      expect(screen.getByLabelText("Broker (opcional)")).toHaveTextContent("ARQ");
    });
  });

  it("el selector de broker ofrece los del usuario, no el catálogo entero", async () => {
    renderDialog();
    await abrirFormulario();

    const selector = await screen.findByLabelText("Broker (opcional)");
    fireEvent.keyDown(selector, { key: "Enter" });

    expect(await screen.findByRole("option", { name: "IEB+" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "ARQ" })).toBeInTheDocument();
    // Del catálogo completo, que tiene 23.
    expect(screen.queryByRole("option", { name: "Robinhood" })).not.toBeInTheDocument();
  });


  it("elegir «Sin asignar» no se pisa con el predeterminado", async () => {
    // El efecto que precarga el default miraba `brokerId`: volver a "none" lo hacía correr
    // otra vez y devolvía ARQ encima de la elección.
    renderDialog();
    await abrirFormulario();

    const selector = screen.getByLabelText("Broker (opcional)");
    fireEvent.keyDown(selector, { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Sin asignar" }));

    await waitFor(() => expect(selector).toHaveTextContent("Sin asignar"));

    fireEvent.change(screen.getByLabelText("Ticker"), { target: { value: "AAPL" } });
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Precio por unidad"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /^Registrar$/ }));

    await waitFor(() => expect(insertedRows).toHaveLength(1));
    expect(insertedRows[0].broker_id).toBeNull();
  });

  it("una venta se puede declarar planificada", async () => {
    // Sin este control toda venta manual entraba como no planificada, y la regla B1 del Game
    // Review califica de blunder una salida así por debajo de la invalidación.
    renderDialog();
    await abrirFormulario();

    fireEvent.click(screen.getByRole("button", { name: /venta/i }));
    fireEvent.change(screen.getByLabelText("Ticker"), { target: { value: "ORCL" } });
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Precio por unidad"), { target: { value: "151.55" } });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: /^Registrar$/ }));

    await waitFor(() => expect(insertedRows).toHaveLength(1));
    expect(insertedRows[0].is_planned_exit).toBe(true);
  });

  it("cancelar deja el diálogo limpio para la próxima apertura", async () => {
    // No se desmonta: sin resetear, la próxima vez aparecía el alta abandonada ya cargada.
    const { rerender, client } = renderDialogControlled();
    await abrirFormulario();
    fireEvent.change(screen.getByLabelText("Ticker"), { target: { value: "AAPL" } });

    fireEvent.click(screen.getByRole("button", { name: /^Cancelar$/ }));
    rerender(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AddTradeDialog open onOpenChange={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Vuelve al primer paso, sin arrastrar lo tipeado.
    expect(screen.getByText(/subí la captura de la orden/i)).toBeInTheDocument();
    expect(screen.queryByDisplayValue("AAPL")).not.toBeInTheDocument();
  });
});
