import "@testing-library/jest-dom";
import { vi, beforeEach } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { resetIngestionCache } from "@/lib/apiIngestion";
import { resetBenchmarkCache } from "@/lib/benchmarks";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom has no layout engine, so scrollTo is unimplemented and AppLayout's route-change
// scroll reset logs a noisy "Not implemented" error on every navigation assertion.
Object.defineProperty(window, "scrollTo", { writable: true, value: () => {} });

// jsdom ships no PointerEvent at all, so fireEvent.pointerDown falls back to a plain Event and
// silently drops clientX — a drag handler reads NaN and no gesture test can ever pass. Deriving
// the stub from MouseEvent is what restores the coordinates, since that is where they live.
if (typeof window.PointerEvent === "undefined") {
  class PointerEventStub extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  window.PointerEvent = PointerEventStub as unknown as typeof window.PointerEvent;
}

// jsdom has no layout engine, so scrollIntoView is unimplemented; Radix's Select calls it on
// every open and the rejection surfaced as an unhandled error that could fail unrelated tests.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom ships no ResizeObserver, which recharts' ResponsiveContainer constructs on mount.
// Without this, every test that renders a chart threw an uncaught ReferenceError during the
// commit phase and the runner hung instead of failing — which is why the suite never finished.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

/**
 * Tests that render <App /> exercise the signed-in application, so the harness supplies a
 * signed-in session. The app itself must never invent one: without this stub the auth gate
 * correctly redirects to /auth.
 */
export const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";

export const TEST_SESSION = {
  access_token: "test-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "test-refresh-token",
  user: {
    id: TEST_USER_ID,
    email: "tester@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2024-01-01T00:00:00.000Z",
  },
} as unknown as Session;

function stubAuth() {
  vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
    data: { session: TEST_SESSION },
    error: null,
  } as never);

  vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
    data: { user: TEST_SESSION.user },
    error: null,
  } as never);

  // Return an inert subscription: the session is delivered via getSession above, and invoking
  // the callback synchronously here would set state during render.
  vi.spyOn(supabase.auth, "onAuthStateChange").mockReturnValue({
    data: { subscription: { id: "test-sub", callback: () => {}, unsubscribe: () => {} } },
  } as never);
}

stubAuth();

beforeEach(() => {
  stubAuth();
  // The inflation/FX/SPY series are memoised per session, so one test's resolved series
  // must not leak into the next.
  resetIngestionCache();
  resetBenchmarkCache();
});
