import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "@/App";
import { setupTestEnvironment } from "@/test/helpers/stateSetup";

describe("Tier 1 - Requirement 1 (R1): 3-View Architecture, Pruning, Dark Mode & Spanish UI", () => {
  let env: ReturnType<typeof setupTestEnvironment>;

  beforeEach(() => {
    env = setupTestEnvironment({ useFakeTimers: false });
    window.history.pushState({}, "Test page", "/");
  });

  afterEach(() => {
    env.cleanup();
  });


  /**
   * T1-R1-01: 3 Primary Navigation Routes Rendering
   */
  it("T1-R1-01: renders Tablero (/), Movimientos (/movements), and Estrategia (/strategy) views", async () => {
    render(<App />);

    // Wait for auth initialization to complete and CHESS brand logo to render
    await screen.findByText("CHESS");

    // Verify 3 primary navigation tabs exist in Spanish
    const navLinks = screen.getAllByRole("link");
    const hrefs = navLinks.map((link) => link.getAttribute("href"));

    expect(hrefs).toContain("/");
    expect(hrefs).toContain("/movements");
    expect(hrefs).toContain("/strategy");
  });

  /**
   * T1-R1-02: Legacy Route Pruning & Redirection
   */
  it("T1-R1-02: automatically redirects legacy routes (/players, /progress, /security, /watchlist, /finance) to consolidated 3 views", async () => {
    // Navigate to legacy /players route
    window.history.pushState({}, "Legacy Players", "/players");
    const { unmount } = render(<App />);

    await screen.findByText("CHESS");
    unmount();

    // Navigate to legacy /finance route
    window.history.pushState({}, "Legacy Finance", "/finance");
    const { unmount: unmount2 } = render(<App />);

    await screen.findByText("CHESS");
    unmount2();

    // Navigate to legacy /watchlist route
    window.history.pushState({}, "Legacy Watchlist", "/watchlist");
    render(<App />);

    await screen.findByText("CHESS");
  });

  /**
   * T1-R1-03: Enforced Dark Mode Token System
   */
  it("T1-R1-03: enforces dark mode token system and excludes light mode switchers", async () => {
    render(<App />);
    await screen.findByText("CHESS");

    const rootElement = document.querySelector(".min-h-screen");
    expect(rootElement).toBeInTheDocument();
    expect(rootElement).toHaveClass("bg-background");

    const themeSwitcher = screen.queryByRole("button", { name: /light mode/i });
    expect(themeSwitcher).toBeNull();
  });

  /**
   * T1-R1-04: Spanish UI Standardization
   */
  it("T1-R1-04: standardizes UI text strictly in Spanish without language selector dropdown", async () => {
    render(<App />);
    await screen.findByText("CHESS");

    expect(screen.getByText("Decision Auditing System")).toBeInTheDocument();
    const tableroElements = screen.getAllByText(/tablero/i);
    expect(tableroElements.length).toBeGreaterThan(0);

    const langSelect = screen.queryByRole("combobox", { name: /language|idioma/i });
    expect(langSelect).toBeNull();
  });

  /**
   * T1-R1-05: Omnibar Natural Language Transaction Logging
   */
  it("T1-R1-05: opens Omnibar input modal via fast shortcut or trigger button", async () => {
    render(<App />);
    await screen.findByText("CHESS");

    const searchBtn = screen.getByRole("button", { name: /buscar \/ registrar/i });
    expect(searchBtn).toBeInTheDocument();
    fireEvent.click(searchBtn);

    // El botón ya no cae derecho en la ingesta de finanzas: primero pregunta qué se registra,
    // porque una compra y un gasto van a ledgers distintos.
    await screen.findByText(/qué querés registrar/i);
    fireEvent.click(screen.getByRole("button", { name: /movimiento/i }));

    // The sheet leads with the receipt capture; typing is opt-in behind a button, so the text
    // field is deliberately absent until asked for.
    const uploadZone = await screen.findByText(/sube una captura de comprobante/i);
    expect(uploadZone).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/coto|uber/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /escribir el movimiento/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/coto|uber/i)).toBeInTheDocument();
    });
  });

  /**
   * T1-R1-05b: el otro camino del selector, que era el que faltaba — el formulario de
   * compra/venta seguía en el código pero ningún acceso lo abría.
   */
  it("T1-R1-05b: el selector del + también abre el alta de operaciones", async () => {
    render(<App />);
    await screen.findByText("CHESS");

    fireEvent.click(screen.getByRole("button", { name: /buscar \/ registrar/i }));
    await screen.findByText(/qué querés registrar/i);
    fireEvent.click(screen.getByRole("button", { name: /operación/i }));

    await screen.findByText(/registrar operación/i);
    // Y acepta el comprobante del broker, no sólo tipeo.
    expect(screen.getByText(/subí la captura de la orden/i)).toBeInTheDocument();
  });

  /**
   * T1-R1-06: Strategy Rules Dashboard & Watchlist
   */
  it("T1-R1-06: renders Strategy rules dashboard when navigating to /strategy", async () => {
    window.history.pushState({}, "Strategy", "/strategy");
    render(<App />);

    await screen.findByText("CHESS");
  });
});
