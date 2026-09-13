import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Transaction } from "@/types/finance";
import type { Trip, TripItem } from "@/lib/tripSummary";

/**
 * La pantalla del viaje sobre los datos que la motivaron.
 *
 * Lo que se verifica no es que dibuje: es que el titular sea el total corregido y no el de la
 * ventana cruda. Entre los dos hay US$ 2.360 de vuelo y hospedaje que la ventana no alcanza y
 * US$ 319 de gastos de casa que sí alcanza y no debería.
 */

const TRIP: Trip = {
  id: "trip-eu",
  user_id: "u1",
  name: "Europa 2026",
  destination: "España, Italia y Reino Unido",
  start_date: "2026-06-24",
  end_date: "2026-09-08",
};

let seq = 0;
const tx = (over: Partial<Transaction>): Transaction =>
  ({
    id: `tx-${++seq}`,
    user_id: "u1",
    type: "expense",
    name: "Gasto",
    amount_usd: 10,
    transaction_date: "2026-07-15",
    category_id: "c-travel",
    payment_method_id: "p-1",
    source: "manual",
    confidence: "high",
    needs_review: false,
    created_at: "2026-07-15T00:00:00Z",
    ...over,
  }) as Transaction;

const vuelo = tx({ name: "Vuelo BUE ↔ MAD (TAP)", amount_usd: 1079, transaction_date: "2026-05-22" });
const luz = tx({ name: "Edesur", amount_usd: 24.68, transaction_date: "2026-07-27", category_id: "c-house" });
const enDestino = tx({ name: "SEVEN HOSTEL", amount_usd: 52.94, transaction_date: "2026-08-30" });
const comida = tx({ name: "Mercadona", amount_usd: 19.58, transaction_date: "2026-09-08", category_id: "c-food", payment_method_id: "p-2" });
const sueldo = tx({ name: "Ganancias Agosto UGC STUDIO", amount_usd: 1146.76, type: "income", transaction_date: "2026-09-03" });
const reembolso = tx({ name: "Refund Globalblue.com", amount_usd: 8.54, type: "income", transaction_date: "2026-08-12" });

const TRANSACTIONS = [vuelo, luz, enDestino, comida, sueldo, reembolso];

const ITEMS: TripItem[] = [
  { id: "i1", trip_id: "trip-eu", transaction_id: vuelo.id, mode: "include", reason: "Vuelo del viaje, pagado un mes antes" },
  { id: "i2", trip_id: "trip-eu", transaction_id: reembolso.id, mode: "include", reason: "Tax free" },
  { id: "i3", trip_id: "trip-eu", transaction_id: luz.id, mode: "exclude", reason: "Luz de casa, no del viaje" },
];

const setItem = vi.fn();
const clearItem = vi.fn();

vi.mock("@/hooks/useTrips", () => ({
  useTrips: () => ({ trips: [TRIP], isLoading: false, isError: false }),
  useAllTripItems: () => ({ items: ITEMS, isLoading: false }),
  useTripItems: () => ({
    items: ITEMS,
    isLoading: false,
    setItem: { mutate: setItem, isPending: false },
    clearItem: { mutate: clearItem, isPending: false },
  }),
}));

vi.mock("@/hooks/useFinance", () => ({
  useTransactions: () => ({ transactions: TRANSACTIONS, isLoading: false }),
  useCategories: () => ({
    categories: [
      { id: "c-travel", name: "Travel" },
      { id: "c-food", name: "Food" },
      { id: "c-house", name: "House" },
    ],
  }),
  usePaymentMethods: () => ({
    paymentMethods: [
      { id: "p-1", name: "DolarApp Credit Card" },
      { id: "p-2", name: "Mercado Pago" },
    ],
  }),
}));

import ViajeDetalle from "@/pages/ViajeDetalle";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/viajes/trip-eu"]}>
      <Routes>
        <Route path="/viajes/:id" element={<ViajeDetalle />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Pantalla del viaje", () => {
  beforeEach(() => {
    setItem.mockClear();
    clearItem.mockClear();
  });

  it("el titular cuenta lo prepago y descuenta el reembolso", () => {
    renderPage();
    // 1079 + 52,94 + 19,58 = 1151,52 de gasto, menos 8,54 de tax free.
    expect(screen.getByText("US$ 1.142,98")).toBeInTheDocument();
    expect(screen.getByText(/US\$ 1\.151,52 gastados/)).toBeInTheDocument();
  });

  it("separa el prepago del gasto en destino en vez de mezclarlos", () => {
    renderPage();
    const tile = (label: string) =>
      screen.getByText(label).parentElement as HTMLElement;

    expect(within(tile("Prepago")).getByText("US$ 1.079,00")).toBeInTheDocument();
    // Neto del tax free acreditado en pleno viaje: 52,94 + 19,58 − 8,54.
    expect(within(tile("En destino")).getByText("US$ 63,98")).toBeInTheDocument();
  });

  it("no cuenta la luz de casa aunque haya caído en pleno viaje", () => {
    renderPage();
    // Aparece una sola vez, en la lista de excepciones, y nunca entre los gastos del viaje.
    expect(screen.queryByText("US$ 24,68")).not.toBeInTheDocument();
    expect(screen.getByText(/Luz de casa, no del viaje/)).toBeInTheDocument();
  });

  it("no cuenta el sueldo que entró durante el viaje", () => {
    renderPage();
    // Si la ventana arrastrara los ingresos, el viaje figuraría con ganancia.
    expect(screen.queryByText("Ganancias Agosto UGC STUDIO")).not.toBeInTheDocument();
  });

  it("muestra las excepciones con su motivo, para poder auditar el total", () => {
    renderPage();
    expect(screen.getByText(/Traídas al viaje \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Sacadas del viaje \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Vuelo del viaje, pagado un mes antes/)).toBeInTheDocument();
  });

  it("reparte por categoría sobre el gasto bruto", () => {
    renderPage();
    // Por la etiqueta accesible de cada barra: además de ubicarla, verifica que el reparto no
    // dependa sólo del color.
    expect(screen.getByLabelText(/^Travel: US\$ 1\.131,94/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Food: US\$ 19,58/)).toBeInTheDocument();
    // La categoría de la luz excluida no puede aparecer.
    expect(screen.queryByLabelText(/^House:/)).not.toBeInTheDocument();
  });

  it("marca en el top los gastos que no son de la ventana", () => {
    renderPage();
    // El vuelo figura dos veces: en el top y en la lista de excepciones. La del top es la que
    // tiene que decir que se pagó antes de salir.
    const enTop = screen
      .getAllByText("Vuelo BUE ↔ MAD (TAP)")
      .map((n) => n.closest("li"))
      .find((li) => li && /prepago/.test(li.textContent || ""));
    expect(enTop).toBeTruthy();
  });
});
