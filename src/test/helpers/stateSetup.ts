import { vi } from 'vitest';
import { createMockSupabaseClient, MockSupabaseStore } from '../mocks/mockSupabase';
import { setupExternalApiMocks, resetExternalApiMocks, ExternalApiMockOverrides } from '../mocks/mockExternalApis';

export interface SetupTestEnvironmentOptions {
  initialData?: Partial<MockSupabaseStore>;
  apiOverrides?: ExternalApiMockOverrides;
  useFakeTimers?: boolean;
}

/**
 * Helper to advance cooling off countdown timer in unit/E2E integration tests.
 * @param seconds Number of seconds to advance fake timers by
 */
export async function advanceCoolingTimer(seconds: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(seconds * 1000);
}

/**
 * Helper to trigger Sunday weekly brief time jump.
 * Sets fake system time to upcoming Sunday 09:00:00 UTC.
 */
export function triggerSundayWeeklyBrief(dateString = '2026-08-16T09:00:00Z'): void {
  const sundayDate = new Date(dateString);
  vi.setSystemTime(sundayDate);
}

/**
 * Initializes clean test environment with mock Supabase client and external API stubs.
 * Fake timers are disabled by default to maintain compatibility with React Testing Library async helpers,
 * and only enabled when options.useFakeTimers is explicitly set to true.
 */
export function setupTestEnvironment(
  arg1?: Partial<MockSupabaseStore> | SetupTestEnvironmentOptions,
  arg2?: SetupTestEnvironmentOptions
) {
  let initialData: Partial<MockSupabaseStore> | undefined;
  let apiOverrides: ExternalApiMockOverrides | undefined;
  let useFakeTimers = false;

  if (arg1) {
    if ('initialData' in arg1 || 'apiOverrides' in arg1 || 'useFakeTimers' in arg1) {
      const opts = arg1 as SetupTestEnvironmentOptions;
      initialData = opts.initialData;
      apiOverrides = opts.apiOverrides;
      useFakeTimers = opts.useFakeTimers ?? false;
    } else {
      initialData = arg1 as Partial<MockSupabaseStore>;
    }
  }

  if (arg2) {
    if (arg2.initialData) {
      initialData = { ...(initialData || {}), ...arg2.initialData };
    }
    if (arg2.apiOverrides) {
      apiOverrides = arg2.apiOverrides;
    }
    if (arg2.useFakeTimers !== undefined) {
      useFakeTimers = arg2.useFakeTimers;
    }
  }

  if (useFakeTimers) {
    vi.useFakeTimers();
  }

  const mockSupabase = createMockSupabaseClient(initialData || {});
  const apiMocks = setupExternalApiMocks(apiOverrides || {});

  const cleanup = () => {
    resetExternalApiMocks();
    if (useFakeTimers) {
      vi.useRealTimers();
    }
  };

  return {
    mockSupabase,
    apiMocks,
    advanceCoolingTimer,
    triggerSundayWeeklyBrief,
    cleanup,
  };
}
