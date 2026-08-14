import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "@/App";

describe("M2 Challenger 1: Adversarial Router & Legacy Redirect Stress Suite", () => {
  const tableroRoutes = [
    "/players",
    "/player/grandmaster_magnus",
    "/security",
    "/progress",
    "/analysis",
    "/analysis/deep-dive",
    "/portfolio",
    "/chess",
    "/settings",
    "/demo",
    "/watch",
    "/landing",
    "/install",
    "/tools",
    "/tools/compound-calculator",
    "/export",
    "/performance",
    "/report",
    "/achievements",
    "/unknown-random-legacy-route-123"
  ];

  const movementsRoutes = [
    "/trades",
    "/add",
    "/add/new-trade",
    "/finance",
    "/finance/expenses",
    "/finance/incomes",
    "/finance/analytics",
    "/import",
    "/timeline"
  ];

  const strategyRoutes = [
    "/watchlist",
    "/alerts",
    "/progress/discipline",
    "/discipline"
  ];

  tableroRoutes.forEach((route) => {
    it(`redirects legacy route '${route}' gracefully to Tablero (/)`, async () => {
      window.history.pushState({}, "Test", route);
      const { unmount } = render(<App />);

      await screen.findByText("CHESS");
      expect(window.location.pathname).toBe("/");
      unmount();
    });
  });

  movementsRoutes.forEach((route) => {
    it(`redirects legacy route '${route}' gracefully to Movimientos (/movements)`, async () => {
      window.history.pushState({}, "Test", route);
      const { unmount } = render(<App />);

      await screen.findByText("CHESS");
      expect(window.location.pathname).toBe("/movements");
      unmount();
    });
  });

  strategyRoutes.forEach((route) => {
    it(`redirects legacy route '${route}' gracefully to Estrategia (/strategy)`, async () => {
      window.history.pushState({}, "Test", route);
      const { unmount } = render(<App />);

      await screen.findByText("CHESS");
      expect(window.location.pathname).toBe("/strategy");
      unmount();
    });
  });
});
