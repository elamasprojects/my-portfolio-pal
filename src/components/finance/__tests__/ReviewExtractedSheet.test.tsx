import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ReviewExtractedSheet, type ReviewRow } from "../ReviewExtractedSheet";
import type { Category, FinancialAccount, PaymentMethod } from "@/types/finance";

/**
 * La revisión es lo único que separa a un movimiento mal leído de la base, y escribir ahí
 * mueve saldos por trigger. Estas pruebas cubren las tres formas de intervenir —descartar,
 * corregir el monto y bloquear lo que no se puede convertir— porque ninguna de las tres
 * tiene red abajo.
 */

beforeAll(() => {
  // jsdom no implementa la captura de puntero, que es lo que sostiene el arrastre cuando el
  // dedo se va del elemento.
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  }
});

const categories = [
  { id: "c-food", name: "Food", type: "expense", keywords: [] },
  { id: "c-travel", name: "Travel", type: "expense", keywords: [] },
  { id: "c-salary", name: "Sueldo", type: "income", keywords: [] },
  { id: "c-both", name: "Ajustes", type: "both", keywords: [] },
] as unknown as Category[];

const accounts = [
  { id: "a-1", name: "DolarApp", currency: "USD", is_active: true },
  { id: "a-2", name: "Mercado Pago", currency: "ARS", is_active: true },
] as unknown as FinancialAccount[];

const paymentMethods = [
  { id: "p-1", name: "DolarApp Credit Card", account_id: "a-1" },
] as unknown as PaymentMethod[];

const row = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  key: "k1",
  name: "Mercadona",
  amount: "10",
  currency: "USD",
  type: "expense",
  transactionDate: "2026-08-20",
  categoryId: "c-food",
  accountId: "a-1",
  paymentMethodId: "p-1",
  ...over,
});

function setup(rows: ReviewRow[], over: Partial<Parameters<typeof ReviewExtractedSheet>[0]> = {}) {
  const onConfirm = vi.fn();
  render(
    <ReviewExtractedSheet
      open
      onOpenChange={() => {}}
      rows={rows}
      categories={categories}
      accounts={accounts}
      paymentMethods={paymentMethods}
      mepRate={1500}
      isSaving={false}
      onConfirm={onConfirm}
      onBack={() => {}}
      {...over}
    />
  );
  return { onConfirm };
}

/** Un arrastre completo hacia la izquierda sobre el cuerpo de la tarjeta. */
function swipeLeft(card: HTMLElement, distance: number) {
  fireEvent.pointerDown(card, { clientX: 300, pointerId: 1 });
  fireEvent.pointerMove(card, { clientX: 300 - distance, pointerId: 1 });
  fireEvent.pointerUp(card, { clientX: 300 - distance, pointerId: 1 });
}

const cardOf = (name: string) =>
  screen.getByDisplayValue(name).closest("div.relative.space-y-2") as HTMLElement;

describe("ReviewExtractedSheet", () => {
  it("no guarda nada hasta que se confirma", () => {
    const { onConfirm } = setup([row()]);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Mercadona")).toBeInTheDocument();
  });

  it("el total del botón suma lo convertido a dólares, no los montos crudos", () => {
    setup([
      row({ key: "a", name: "En dolares", amount: "10", currency: "USD" }),
      // 15.000 pesos a 1500 son 10 dólares: sumar el crudo daría 15.010.
      row({ key: "b", name: "En pesos", amount: "15000", currency: "ARS" }),
    ]);
    expect(screen.getByRole("button", { name: /registrar 2 movimientos · US\$ 20,00/i })).toBeInTheDocument();
  });

  it("separa lo que sale de lo que entra en vez de sumarlos", () => {
    // 45.000 pesos de gasto y 850.000 de ingreso daban un solo "US$ 592,71", que no es lo que
    // sale, ni lo que entra, ni el neto.
    setup([
      row({ key: "a", name: "Coto", amount: "45000", currency: "ARS", type: "expense" }),
      row({ key: "b", name: "Honorarios", amount: "850000", currency: "ARS", type: "income", categoryId: null }),
    ]);

    const boton = screen.getByRole("button", { name: /registrar 2 movimientos/i });
    expect(boton).toHaveTextContent("−US$ 30,00");
    expect(boton).toHaveTextContent("+US$ 566,67");
  });

  it("con un solo signo, el total va entero y firmado", () => {
    setup([
      row({ key: "a", amount: "10", currency: "USD", type: "income", categoryId: null }),
      row({ key: "b", amount: "15", currency: "USD", type: "income", categoryId: null }),
    ]);
    expect(screen.getByRole("button", { name: /registrar 2 movimientos/i })).toHaveTextContent("+US$ 25,00");
  });

  it("descarta la fila al arrastrarla lo suficiente hacia la izquierda", async () => {
    setup([row({ key: "a", name: "Mercadona" }), row({ key: "b", name: "Lidl" })]);

    swipeLeft(cardOf("Mercadona"), 150);

    await waitFor(() => {
      expect(screen.queryByDisplayValue("Mercadona")).not.toBeInTheDocument();
    });
    // La otra sigue en pie: el gesto descarta una, no la tanda.
    expect(screen.getByDisplayValue("Lidl")).toBeInTheDocument();
  });

  it("un arrastre corto no descarta — es el que se hace sin querer al scrollear", async () => {
    setup([row({ name: "Mercadona" })]);

    swipeLeft(cardOf("Mercadona"), 40);

    await new Promise((r) => setTimeout(r, 200));
    expect(screen.getByDisplayValue("Mercadona")).toBeInTheDocument();
  });

  it("lo descartado se puede recuperar", async () => {
    setup([row({ name: "Mercadona" })]);
    swipeLeft(cardOf("Mercadona"), 150);

    const undo = await screen.findByRole("button", { name: /recuperar el último descartado/i });
    fireEvent.click(undo);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Mercadona")).toBeInTheDocument();
    });
  });

  it("confirma sólo lo que sobrevivió, con las ediciones aplicadas", async () => {
    const { onConfirm } = setup([
      row({ key: "a", name: "Mercadona", amount: "10" }),
      row({ key: "b", name: "Lidl", amount: "25" }),
    ]);

    swipeLeft(cardOf("Lidl"), 150);
    await waitFor(() => expect(screen.queryByDisplayValue("Lidl")).not.toBeInTheDocument());

    // Pagaste 10 pero te devolvieron parte: el monto es editable a propósito.
    fireEvent.change(screen.getByDisplayValue("10"), { target: { value: "7.5" } });
    fireEvent.change(screen.getByDisplayValue("Mercadona"), { target: { value: "Mercadona centro" } });

    fireEvent.click(screen.getByRole("button", { name: /registrar 1 movimiento/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const saved = onConfirm.mock.calls[0][0] as ReviewRow[];
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe("Mercadona centro");
    expect(saved[0].amount).toBe("7.5");
  });

  it("sin cotización, un monto en pesos bloquea el guardado en vez de entrar como dólares", () => {
    setup([row({ amount: "15000", currency: "ARS" })], { mepRate: 0 });

    expect(screen.getByRole("button", { name: /registrar/i })).toBeDisabled();
    expect(screen.getAllByText(/no hay cotización/i).length).toBeGreaterThan(0);
  });

  it("borrar el monto bloquea, en vez de guardar un movimiento de cero", () => {
    setup([row({ amount: "10" })]);
    // `Number("")` es 0, no NaN: la conversión daba "ok" y el botón seguía habilitado.
    fireEvent.change(screen.getByDisplayValue("10"), { target: { value: "" } });

    expect(screen.getByRole("button", { name: /registrar/i })).toBeDisabled();
    expect(screen.getAllByText(/número mayor a cero/i).length).toBeGreaterThan(0);
  });

  it("una transferencia no se guarda como si fuera un gasto", () => {
    // El trigger debita el origen y acredita el destino; sin cuenta destino, dejarla pasar
    // como gasto sacaba la plata de un lado y no la ponía en ninguno.
    setup([row({ type: "transfer" })]);

    expect(screen.getByRole("button", { name: /registrar/i })).toBeDisabled();
    expect(screen.getAllByText(/transferencias/i).length).toBeGreaterThan(0);
  });

  it("las categorías 'both' aparecen para gastos y para ingresos", async () => {
    setup([row({ categoryId: null })]);

    fireEvent.keyDown(screen.getByLabelText("Categoría"), { key: "Enter" });
    expect(await screen.findByRole("option", { name: "Ajustes" })).toBeInTheDocument();
  });

  it("elegir el medio de pago arrastra su cuenta, que es la que termina moviéndose", async () => {
    const { onConfirm } = setup([row({ accountId: null, paymentMethodId: null })]);

    fireEvent.keyDown(screen.getByLabelText("Medio de pago"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "DolarApp Credit Card" }));

    fireEvent.click(screen.getByRole("button", { name: /registrar 1 movimiento/i }));
    const saved = onConfirm.mock.calls[0][0] as ReviewRow[];
    expect(saved[0].paymentMethodId).toBe("p-1");
    expect(saved[0].accountId).toBe("a-1");
  });

  it("cambiar el tipo limpia la categoría, que pertenecía al tipo anterior", async () => {
    const { onConfirm } = setup([row({ categoryId: "c-food" })]);

    const tipo = screen.getByLabelText("Tipo");
    fireEvent.keyDown(tipo, { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Ingreso" }));

    fireEvent.click(screen.getByRole("button", { name: /registrar 1 movimiento/i }));
    const saved = onConfirm.mock.calls[0][0] as ReviewRow[];
    expect(saved[0].type).toBe("income");
    expect(saved[0].categoryId).toBeNull();
  });

  it("marca la cuenta que quedó adivinada", () => {
    setup([row({ accountWasGuessed: true })]);
    expect(screen.getByText(/no se reconoció la cuenta/i)).toBeInTheDocument();
  });

  it("el botón de descarte funciona sin gesto, para teclado y desktop", async () => {
    setup([row({ name: "Mercadona" })]);
    const card = cardOf("Mercadona");
    fireEvent.click(within(card).getByRole("button", { name: /descartar mercadona/i }));

    await waitFor(() => {
      expect(screen.queryByDisplayValue("Mercadona")).not.toBeInTheDocument();
    });
  });
});
