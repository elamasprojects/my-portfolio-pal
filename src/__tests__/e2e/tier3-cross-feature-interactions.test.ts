import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  auditClosedTrade,
  ClosedTradeAuditInput,
  TradeOutcome,
  CounterfactualMetrics,
} from '@/lib/gameReview';
import { validatePreTradeThesis, PreTradeThesis } from '@/components/discipline/PreTradeThesisModal';
import { processSellExecution, SellExecutionRequest } from '@/components/discipline/FrictionCoolingTimerModal';
import { computeUnifiedNetWorth, buildPersonalSankeyData } from '@/lib/financialMath';
import { matchTradesFIFO } from '@/lib/tradeMatching';
import { computeHoldings, computePerformance, computeCash, Trade as PortfolioTrade } from '@/hooks/usePortfolio';
import { makeTrade } from '@/test/factories';
import { createMockSupabaseClient } from '@/test/mocks/mockSupabase';
import { setupExternalApiMocks, resetExternalApiMocks } from '@/test/mocks/mockExternalApis';
import { setupTestEnvironment, advanceCoolingTimer } from '@/test/helpers/stateSetup';
import {
  InflationIndexFixture,
  FxRateFixture,
  TradeFixture,
  GameReviewFixture,
  sampleInflationFixtures,
  sampleFxRateFixtures,
} from '@/test/fixtures/types';


describe('Tier 3: Pairwise Cross-Feature Interactions Test Suite', () => {
  let env: ReturnType<typeof setupTestEnvironment>;

  beforeEach(() => {
    setupExternalApiMocks();
    env = setupTestEnvironment({
      initialData: {
        inflation_index: sampleInflationFixtures,
        fx_rates: sampleFxRateFixtures,
      },
    });
  });

  afterEach(() => {
    resetExternalApiMocks();
    env.cleanup();
  });

  /**
   * TC-T3-01: Planned Buy to 1-Click Target Exit with Real-Time 3-Column P&L and Brillante Audit
   */
  it('TC-T3-01: Planned Buy to 1-Click Target Exit with Real-Time 3-Column P&L and Brillante Audit', async () => {
    const buyPrice = 1000;
    const quantity = 100;
    const initialAmount = buyPrice * quantity; // 100,000 ARS

    const thesis: PreTradeThesis = {
      entryThesis: 'Strong quarterly earnings growth forecast for Q1',
      targetPriceUSD: 1500,
      invalidationCondition: 'Revenue growth below 5% YoY',
    };

    // 1. Pre-trade thesis validation
    const thesisValidation = validatePreTradeThesis(thesis, buyPrice);
    expect(thesisValidation.valid).toBe(true);

    // 2. Record trade in mock Supabase store
    const tradeRow: TradeFixture = {
      id: 'trade-t3-01',
      user_id: 'user-t3',
      symbol: 'AAPL',
      asset_category: 'cedear',
      buy_date: '2024-01-01',
      buy_price_ars: buyPrice,
      quantity,
      entry_thesis: thesis.entryThesis,
      target_price_usd: thesis.targetPriceUSD,
      invalidation_condition: thesis.invalidationCondition,
      status: 'open',
      created_at: '2024-01-01T10:00:00Z',
    };
    await env.mockSupabase.from('trades').insert(tradeRow);

    // 3. Market advances to Target Price (1500 ARS), IPC = 110.0 (+10%), CCL = 1200 ARS/USD (+20%)
    const currentPrice = 1500;
    const isTargetHit = currentPrice >= thesis.targetPriceUSD;
    expect(isTargetHit).toBe(true);

    // 4. Planned Exit: 1-click execution bypassing 60s cooling timer
    const sellRequest: SellExecutionRequest = {
      tradeId: 'trade-t3-01',
      sellQuantity: quantity,
      sellPriceARS: currentPrice,
      isPlannedExit: isTargetHit,
    };
    const executionResult = processSellExecution(sellRequest);
    expect(executionResult.success).toBe(true);
    expect(executionResult.coolingOffApplied).toBe(false);

    // 5. Realised P&L. Nominal only — inflation is no longer applied to portfolio figures.
    const sellProceeds = currentPrice * quantity; // 150,000 ARS
    const nominalPnl = sellProceeds - initialAmount; // +50,000 ARS

    expect(nominalPnl).toBe(50000);

    // 6. Game Review Audit Evaluation
    const auditResult = await auditClosedTrade({
      tradeId: 'trade-t3-01',
      symbol: 'AAPL',
      buyDate: '2024-01-01',
      sellDate: '2024-02-01',
      buyPriceARS: buyPrice,
      sellPriceARS: currentPrice,
      quantity,
      targetPriceARS: thesis.targetPriceUSD,
      spyReturnPct: 15.0,
      cclReturnPct: 20.0,
      fixedDepositReturnPct: 5.0,
    });

    expect(auditResult.outcomeClassification).toBe('Brillante');
    expect(auditResult.netCostOfTradingUSD).toBe(0.0);
  });

  /**
   * TC-T3-02: Unplanned Sell under Friction Inversion with Invalidation Hit, High Inflation & Blunder Audit
   */
  it('TC-T3-02: Unplanned Sell under Friction Inversion with Invalidation Hit, High Inflation & Blunder Audit', async () => {
    const buyPrice = 1000;
    const quantity = 100;
    const initialAmount = buyPrice * quantity; // 100,000 ARS

    const thesis: PreTradeThesis = {
      entryThesis: 'Banking sector recovery play on macroeconomic reforms',
      targetPriceUSD: 1500,
      invalidationCondition: 'Stock breaks below 800 ARS support level',
    };

    // Market drops to 750 ARS (Invalidation hit)
    const currentPrice = 750;
    const isInvalidationHit = currentPrice <= 800;
    expect(isInvalidationHit).toBe(true);

    // User attempts panic sell (Unplanned Exit)
    const sellRequest: SellExecutionRequest = {
      tradeId: 'trade-t3-02',
      sellQuantity: quantity,
      sellPriceARS: currentPrice,
      isPlannedExit: false,
      coolingOffDurationSeconds: 15,
      unplannedRationale: 'Panic sell', // 10 chars, invalid
    };

    // Submitting early at 15s fails
    const earlyAttempt = processSellExecution(sellRequest);
    expect(earlyAttempt.success).toBe(false);
    expect(earlyAttempt.error).toContain('Cooling-off period of 60s has not elapsed');

    // Submitting at 60s with short rationale (<20 chars) fails
    sellRequest.coolingOffDurationSeconds = 60;
    const shortRationaleAttempt = processSellExecution(sellRequest);
    expect(shortRationaleAttempt.success).toBe(false);
    expect(shortRationaleAttempt.error).toContain('Rationale must be at least 20 characters');

    // Submitting at 60s with complete rationale (>=20 chars) succeeds
    sellRequest.unplannedRationale = 'Selling due to panic over market rumor despite no thesis change';
    const validAttempt = processSellExecution(sellRequest);
    expect(validAttempt.success).toBe(true);
    expect(validAttempt.coolingOffApplied).toBe(true);

    // Realised P&L, nominal only.
    const sellProceeds = currentPrice * quantity; // 75,000 ARS
    const nominalPnl = sellProceeds - initialAmount; // -25,000 ARS

    expect(nominalPnl).toBe(-25000);

    // Counterfactual Game Review Audit: Asset recovered to 1200 ARS 30d later
    const auditResult = await auditClosedTrade({
      tradeId: 'trade-t3-02',
      symbol: 'GGAL',
      buyDate: '2024-01-15',
      sellDate: '2024-02-15',
      buyPriceARS: buyPrice,
      sellPriceARS: currentPrice,
      quantity,
      invalidationPriceARS: 800,
      holdingPriceAtSellDateARS: 1200,
      spyReturnPct: 10.0,
      cclReturnPct: 25.0,
      fixedDepositReturnPct: 5.0,
      isPlannedExit: false,
    });


    expect(auditResult.outcomeClassification).toBe('Blunder');
    expect(auditResult.netCostOfTradingUSD).toBe(45.0);
  });

  /**
   * TC-T3-03: Partial Position Execution with Prorated Cost Basis & Multi-Currency Real Return Sync
   */
  it('TC-T3-03: Partial Position Execution with Prorated Cost Basis & Multi-Currency Real Return Sync', () => {
    // 200 AL30 bonds in two tranches: 100 @ 50,000 ARS, 100 @ 60,000 ARS
    const trades: PortfolioTrade[] = ([
      {
        id: 't1',
        portfolio_id: 'p1',
        user_id: 'u1',
        symbol: 'AL30',
        asset_name: 'Bono AL30',
        asset_type: 'bond',
        trade_type: 'buy',
        quantity: 100,
        price_per_unit: 50000,
        total_amount: 5000000,
        trade_date: '2024-01-01T10:00:00Z',
        notes: 'Tranche 1',
        created_at: '2024-01-01T10:00:00Z',
        strategy_id: null,
        original_currency: 'ARS',
        original_price: 50000,
        broker_id: null,
        commission_pct: 0,
        commission_amount: 0,
        mep_rate: null,
        journal_notes: null,
      },
      {
        id: 't2',
        portfolio_id: 'p1',
        user_id: 'u1',
        symbol: 'AL30',
        asset_name: 'Bono AL30',
        asset_type: 'bond',
        trade_type: 'buy',
        quantity: 100,
        price_per_unit: 60000,
        total_amount: 6000000,
        trade_date: '2024-01-15T10:00:00Z',
        notes: 'Tranche 2',
        created_at: '2024-01-15T10:00:00Z',
        strategy_id: null,
        original_currency: 'ARS',
        original_price: 60000,
        broker_id: null,
        commission_pct: 0,
        commission_amount: 0,
        mep_rate: null,
        journal_notes: null,
      },
    ] satisfies Partial<PortfolioTrade>[]).map(makeTrade);

    // Compute holdings before partial sell
    const holdingsBefore = computeHoldings(trades);
    expect(holdingsBefore[0].net_quantity).toBe(200);
    expect(holdingsBefore[0].avg_cost).toBe(55000); // (50,000 + 60,000) / 2

    // Partial sell of 100 bonds at 70,000 ARS
    const partialSell: PortfolioTrade = makeTrade({
      id: 't3',
      portfolio_id: 'p1',
      user_id: 'u1',
      symbol: 'AL30',
      asset_name: 'Bono AL30',
      asset_type: 'bond',
      trade_type: 'sell',
      quantity: 100,
      price_per_unit: 70000,
      total_amount: 7000000,
      trade_date: '2024-02-01T10:00:00Z',
      notes: 'Partial sell at target',
      created_at: '2024-02-01T10:00:00Z',
      strategy_id: null,
      original_currency: 'ARS',
      original_price: 70000,
      broker_id: null,
      commission_pct: 0,
      commission_amount: 0,
      mep_rate: null,
      journal_notes: null,
    });

    const updatedTrades = [...trades, partialSell];
    const holdingsAfter = computeHoldings(updatedTrades);

    // Assert remaining 100 bonds retain average cost basis of 55,000 ARS
    expect(holdingsAfter[0].net_quantity).toBe(100);
    expect(holdingsAfter[0].avg_cost).toBe(55000);
    expect(holdingsAfter[0].total_invested).toBe(5500000);

    // FIFO matching check for realized P&L
    const fifoResult = matchTradesFIFO(updatedTrades);
    expect(fifoResult.closedTrades).toHaveLength(1);
    expect(fifoResult.closedTrades[0].quantity).toBe(100);
    expect(fifoResult.closedTrades[0].buyPrice).toBe(50000); // FIFO matches first tranche @ 50,000 ARS
    expect(fifoResult.closedTrades[0].pnl).toBe(2000000); // (70,000 - 50,000) * 100
  });

  /**
   * TC-T3-04: Concurrent Multi-Asset Trade Execution with Real-Time FX / IPC Cache Invalidation
   */
  /**
   * TC-T3-05: Dynamic Pre-Trade Thesis Modification & Retrospective Audit Alignment
   */
  it('TC-T3-05: Dynamic Pre-Trade Thesis Modification & Retrospective Audit Alignment', async () => {
    // Open thesis for NVDA: Buy @ 1500 ARS, Original Target = 2000 ARS
    let targetPriceARS = 2000;

    // User updates strategy target price in Estrategia to 2500 ARS
    targetPriceARS = 2500;

    // Price reaches 2200 ARS and user sells
    const sellPriceARS = 2200;
    const isPlannedExit = sellPriceARS >= targetPriceARS; // 2200 >= 2500 -> false

    expect(isPlannedExit).toBe(false);

    // Since sell is at 2200 ARS (< updated 2500 ARS target), system forces 60s cooling timer + rationale
    const sellRequest: SellExecutionRequest = {
      tradeId: 'nvda-001',
      sellQuantity: 10,
      sellPriceARS,
      isPlannedExit,
      coolingOffDurationSeconds: 60,
      unplannedRationale: 'Exiting early at 2200 ARS prior to reaching updated 2500 ARS target',
    };

    const execution = processSellExecution(sellRequest);
    expect(execution.success).toBe(true);
    expect(execution.coolingOffApplied).toBe(true);

    // Retrospective Game Review evaluates strategy adherence against updated target of 2500 ARS
    const auditResult = await auditClosedTrade({
      tradeId: 'nvda-001',
      symbol: 'NVDA',
      buyDate: '2024-01-01',
      sellDate: '2024-02-01',
      buyPriceARS: 1500,
      sellPriceARS,
      quantity: 10,
      targetPriceARS,
      spyReturnPct: 15.0,
      cclReturnPct: 20.0,
    });

    // Evaluated against 2500 target, selling at 2200 (< 95% target threshold of 2375) classifies as Correcta
    expect(auditResult.outcomeClassification).toBe('Correcta');
  });

  /**
   * TC-T3-06: Pre-Trade Thesis Form Input Invalidation & Review Queue Interception
   */
  it('TC-T3-06: Pre-Trade Thesis Form Input Invalidation & Review Queue Interception', () => {
    const buyPrice = 60000;
    const invalidThesis: Partial<PreTradeThesis> = {
      entryThesis: 'Short', // < 10 chars
      targetPriceUSD: 55000, // invalid: target <= buyPrice
      invalidationCondition: '',
    };

    const validation = validatePreTradeThesis(invalidThesis, buyPrice);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toHaveLength(3);

    // Simulating Omnibar trade creation with needs_review = true flag
    const rawOmnibarTransaction = {
      id: 'tx-review-001',
      user_id: 'u1',
      type: 'investment' as const,
      name: 'BTC Buy',
      amount_usd: 60000,
      transaction_date: '2024-01-01',
      source: 'text' as const,
      confidence: 'low' as const,
      needs_review: !validation.valid,
    };

    expect(rawOmnibarTransaction.needs_review).toBe(true);
  });

  /**
   * TC-T3-07: Real Return Deflator under Negative IPC Inflation (Deflationary Period)
   */
  /**
   * TC-T3-08: Cross-View Navigation State Synchronization
   */
  it('TC-T3-08: Cross-View Navigation State Synchronization', async () => {
    // 1. Execute planned trade in Movimientos view (/movements)
    const newTrade: TradeFixture = {
      id: 'trade-msft-sync',
      user_id: 'user-sync',
      symbol: 'MSFT',
      asset_category: 'cedear',
      buy_date: '2024-01-01',
      buy_price_ars: 3000,
      quantity: 50,
      entry_thesis: 'Cloud expansion thesis and AI platform dominance',
      target_price_usd: 4500,
      invalidation_condition: 'Azure growth decelerates below 20%',
      status: 'open',
      created_at: '2024-01-01T10:00:00Z',
    };

    await env.mockSupabase.from('trades').insert(newTrade);

    // 2. Navigate to Tablero (/): Verify Holdings & Net Worth state
    const fetchedTrades = (await env.mockSupabase.from('trades').select('*').eq('user_id', 'user-sync')).data || [];
    expect(fetchedTrades).toHaveLength(1);

    const portfolioTrades: PortfolioTrade[] = fetchedTrades.map((t: any) => ({
      id: t.id,
      portfolio_id: 'p1',
      user_id: t.user_id,
      symbol: t.symbol,
      asset_name: t.symbol,
      asset_type: 'stock',
      trade_type: 'buy',
      quantity: t.quantity,
      price_per_unit: t.buy_price_ars,
      total_amount: t.quantity * t.buy_price_ars,
      trade_date: t.buy_date,
      notes: t.entry_thesis,
      created_at: t.created_at,
      strategy_id: null,
      original_currency: 'ARS',
      original_price: t.buy_price_ars,
      broker_id: null,
      commission_pct: 0,
      commission_amount: 0,
      mep_rate: null,
      journal_notes: null,
    }));

    const holdings = computeHoldings(portfolioTrades);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].symbol).toBe('MSFT');
    expect(holdings[0].net_quantity).toBe(50);
    expect(holdings[0].total_invested).toBe(150000);

    // 3. Navigate to Estrategia (/strategy): Verify Active Thesis list
    const activeTheses = fetchedTrades.filter((t: any) => t.status === 'open');
    expect(activeTheses).toHaveLength(1);
    expect(activeTheses[0].target_price_usd).toBe(4500);
    expect(activeTheses[0].invalidation_condition).toBe('Azure growth decelerates below 20%');
  });
});
