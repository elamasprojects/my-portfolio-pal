import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  sampleTradeFixtures,
  sampleInflationFixtures,
  sampleFxRateFixtures,
  sampleGameReviewFixtures,
} from './fixtures/types';
import { createMockSupabaseClient } from './mocks/mockSupabase';
import { setupExternalApiMocks, resetExternalApiMocks } from './mocks/mockExternalApis';
import { setupTestEnvironment, advanceCoolingTimer, triggerSundayWeeklyBrief } from './helpers/stateSetup';

describe('E2E Test Infrastructure & Mock Helpers', () => {
  describe('Mock Supabase Client Factory', () => {
    it('seeds initial data and handles chainable select and single', async () => {
      const mockSupabase = createMockSupabaseClient({
        trades: sampleTradeFixtures,
      });

      const res = await mockSupabase.from('trades').select('*').eq('id', 'trade-001').single();
      expect(res.error).toBeNull();
      expect(res.data).toBeDefined();
      expect(res.data?.symbol).toBe('AAPL');
    });

    it('handles stateful insert, update, and delete operations', async () => {
      const mockSupabase = createMockSupabaseClient({
        trades: [],
      });

      // Insert trade
      const newTrade = {
        id: 'trade-test-insert',
        user_id: 'u1',
        symbol: 'NVDA',
        asset_category: 'cedear' as const,
        buy_date: '2024-01-01',
        buy_price_ars: 500.0,
        quantity: 10,
        entry_thesis: 'AI boom catalyst',
        target_price_ars: 1000.0,
        invalidation_condition: 'Market crash',
        status: 'open' as const,
      };

      await mockSupabase.from('trades').insert(newTrade);

      // Verify insertion
      const listRes = await mockSupabase.from('trades').select('*').eq('symbol', 'NVDA');
      expect(listRes.data).toHaveLength(1);

      // Update trade
      await mockSupabase.from('trades').update({ status: 'closed', sell_price_ars: 1100.0 }).eq('id', 'trade-test-insert');
      const updatedRes = await mockSupabase.from('trades').select('*').eq('id', 'trade-test-insert').single();
      expect(updatedRes.data?.status).toBe('closed');
      expect(updatedRes.data?.sell_price_ars).toBe(1100.0);

      // Delete trade
      await mockSupabase.from('trades').delete().eq('id', 'trade-test-insert');
      const deleteCheck = await mockSupabase.from('trades').select('*').eq('id', 'trade-test-insert');
      expect(deleteCheck.data).toHaveLength(0);
    });

    it('deep clones initial fixtures so mutations do not leak into source objects', async () => {
      const originalBuyPrice = sampleTradeFixtures[0].buy_price_ars;
      const mockSupabase = createMockSupabaseClient({
        trades: sampleTradeFixtures,
      });

      await mockSupabase
        .from('trades')
        .update({ buy_price_ars: 999999 })
        .eq('id', sampleTradeFixtures[0].id);

      const res = await mockSupabase.from('trades').select('*').eq('id', sampleTradeFixtures[0].id).single();
      expect(res.data?.buy_price_ars).toBe(999999);
      expect(sampleTradeFixtures[0].buy_price_ars).toBe(originalBuyPrice);
    });

    it('executes backup dry run RPC accurately', async () => {
      const mockSupabase = createMockSupabaseClient();
      const rpcRes = await mockSupabase.rpc('perform_backup_dry_run', {
        backup_data: {
          data: {
            trades: sampleTradeFixtures,
          },
        },
      });

      expect(rpcRes.error).toBeNull();
      expect(rpcRes.data?.valid).toBe(true);
      expect(rpcRes.data?.rowsRestored).toBe(2);
    });
  });

  describe('External API Mock Handlers', () => {
    beforeEach(() => {
      setupExternalApiMocks();
    });

    afterEach(() => {
      resetExternalApiMocks();
    });

    it('intercepts ArgentinaDatos inflation API fetch request', async () => {
      const response = await fetch('https://api.argentinadatos.com/v1/finanzas/indices/inflacion');
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].fecha).toBe('2024-01-01');
      expect(data[0].valor).toBe(20.6);
    });

    it('intercepts DolarAPI CCL rate fetch request', async () => {
      const response = await fetch('https://dolarapi.com/v1/dolares/ccl');
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.casa).toBe('ccl');
      expect(data.venta).toBe(1250.0);
    });
  });

  describe('State Setup & Timer Helpers', () => {
    it('initializes environment with fake timers disabled by default', () => {
      const env = setupTestEnvironment();
      expect(env.mockSupabase).toBeDefined();
      env.cleanup();
    });

    it('initializes full environment and manages timer advancement when useFakeTimers is true', async () => {
      const env = setupTestEnvironment({
        initialData: {
          inflation_index: sampleInflationFixtures,
          fx_rates: sampleFxRateFixtures,
        },
        useFakeTimers: true,
      });

      expect(env.mockSupabase).toBeDefined();

      // Test cooling timer advancement
      await env.advanceCoolingTimer(60);

      // Test Sunday weekly brief timer jump
      env.triggerSundayWeeklyBrief();
      expect(new Date().toISOString()).toContain('2026-08-16');

      env.cleanup();
    });
  });
});
