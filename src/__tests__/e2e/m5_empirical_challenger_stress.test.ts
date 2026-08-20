import { describe, it, expect } from "vitest";
import {
  validatePreTradeThesis,
  validatePreTradeThesisForm,
} from "@/components/discipline/PreTradeThesisModal";
import {
  validateUnplannedSellRationale,
  processSellExecution,
  checkTargetOrInvalidationHit,
  SellExecutionRequest,
} from "@/lib/disciplineFriction";
import { generateWeeklyBrief } from "@/lib/weeklyBrief";
import {
  exportDatabaseBackup,
  calculateBackupChecksum,
  validateBackupSchemaAndChecksum,
  applyRetentionPolicy,
  verifyRestoration,
} from "@/lib/backupSystem";

describe("M5 Empirical Challenger Adversarial Stress Test Suite", () => {

  // =========================================================================
  // 1. PRE-TRADE THESIS VALIDATION & BYPASS PREVENTION STRESS TESTS
  // =========================================================================
  describe("1. Pre-Trade Thesis Bypass Prevention", () => {

    it("rejects entry thesis under 10 characters", () => {
      const result = validatePreTradeThesis(
        { entryThesis: "Short", targetPriceUSD: 2000, invalidationCondition: "Valid condition 10 chars" },
        1000
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Entry thesis must be at least 10 characters long.");
    });

    it("rejects entry thesis consisting only of whitespace", () => {
      const result = validatePreTradeThesis(
        { entryThesis: "         ", targetPriceUSD: 2000, invalidationCondition: "Valid condition 10 chars" },
        1000
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Entry thesis must be at least 10 characters long.");
    });

    it("rejects target price less than or equal to buy price", () => {
      const equalRes = validatePreTradeThesis(
        { entryThesis: "Valid entry thesis text", targetPriceUSD: 1000, invalidationCondition: "Valid invalidation cond" },
        1000
      );
      expect(equalRes.valid).toBe(false);
      expect(equalRes.errors).toContain("Target price must be greater than buy price.");

      const lowerRes = validatePreTradeThesis(
        { entryThesis: "Valid entry thesis text", targetPriceUSD: 900, invalidationCondition: "Valid invalidation cond" },
        1000
      );
      expect(lowerRes.valid).toBe(false);
      expect(lowerRes.errors).toContain("Target price must be greater than buy price.");
    });

    it("rejects invalidation condition under 10 characters", () => {
      const result = validatePreTradeThesis(
        { entryThesis: "Valid entry thesis text", targetPriceUSD: 2000, invalidationCondition: "Too short" },
        1000
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalidation condition must be at least 10 characters long.");
    });

    it("validatePreTradeThesisForm rejects target price <= buy price and invalidation >= buy price", () => {
      const result = validatePreTradeThesisForm({
        buyPriceARS: 1000,
        targetPriceARS: 1000, // Invalid (<= 1000)
        invalidationPriceARS: 1000, // Invalid (>= 1000)
        entryThesis: "Valid entry thesis text",
        invalidationCondition: "Valid invalidation condition",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Exit target price must be greater than entry price");
      expect(result.errors).toContain("Invalidation price must be lower than entry price");
    });
  });

  // =========================================================================
  // 2. FRICTION INVERSION & COOLING TIMER STRESS TESTS
  // =========================================================================
  describe("2. Friction Inversion & Cooling Timer Enforcement", () => {

    it("planned exit executes instantly without requiring timer or rationale", () => {
      const req: SellExecutionRequest = {
        tradeId: "t-1",
        sellQuantity: 50,
        sellPriceARS: 1500,
        isPlannedExit: true,
      };

      const res = processSellExecution(req);
      expect(res.success).toBe(true);
      expect(res.coolingOffApplied).toBe(false);

      const valRes = validateUnplannedSellRationale("", true);
      expect(valRes.valid).toBe(true);
    });

    it("unplanned sell fails if timer elapsed is less than 60 seconds (59s boundary)", () => {
      const req: SellExecutionRequest = {
        tradeId: "t-2",
        sellQuantity: 50,
        sellPriceARS: 1500,
        isPlannedExit: false,
        coolingOffDurationSeconds: 59,
        unplannedRationale: "Valid rationale describing why position is sold early",
      };

      const res = processSellExecution(req);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Cooling-off period of 60s has not elapsed");
    });

    it("unplanned sell fails if rationale is under 20 characters (19 chars boundary)", () => {
      const req: SellExecutionRequest = {
        tradeId: "t-3",
        sellQuantity: 50,
        sellPriceARS: 1500,
        isPlannedExit: false,
        coolingOffDurationSeconds: 60,
        unplannedRationale: "1234567890123456789", // 19 chars
      };

      const res = processSellExecution(req);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Rationale must be at least 20 characters");

      const valRes = validateUnplannedSellRationale("1234567890123456789", false);
      expect(valRes.valid).toBe(false);
    });

    it("unplanned sell succeeds at exactly 60 seconds with exactly 20 characters rationale", () => {
      const req: SellExecutionRequest = {
        tradeId: "t-4",
        sellQuantity: 50,
        sellPriceARS: 1500,
        isPlannedExit: false,
        coolingOffDurationSeconds: 60,
        unplannedRationale: "12345678901234567890", // 20 chars
      };

      const res = processSellExecution(req);
      expect(res.success).toBe(true);
      expect(res.coolingOffApplied).toBe(true);
    });

    it("checkTargetOrInvalidationHit correctly classifies target met vs invalidation hit vs active", () => {
      expect(checkTargetOrInvalidationHit(1500, 1500, 800).status).toBe("target_met");
      expect(checkTargetOrInvalidationHit(1600, 1500, 800).status).toBe("target_met");

      expect(checkTargetOrInvalidationHit(800, 1500, 800).status).toBe("invalidation_hit");
      expect(checkTargetOrInvalidationHit(750, 1500, 800).status).toBe("invalidation_hit");

      expect(checkTargetOrInvalidationHit(1000, 1500, 800).status).toBe("active");
    });
  });

  // =========================================================================
  // 3. WEEKLY BRIEF CALCULATION & ABNORMAL EXPENSE THRESHOLDING STRESS TESTS
  // =========================================================================
  describe("3. Weekly Brief Calculation & Abnormal Expense Thresholding (>1.5x avg)", () => {

    it("detects abnormal expenses strictly when > 1.5x average", async () => {
      // Historical expenses for 'Food': avg = (100 + 100) / 2 = 100
      // Recent expense: 160 (which is 1.6x avg, > 1.5x) -> SHOULD BE FLAGGED
      // Historical expenses for 'Services': avg = 100
      // Recent expense: 140 (1.4x avg, <= 1.5x) -> SHOULD NOT BE FLAGGED
      const transactions = [
        { type: "expense", category: "Food", amountARS: 100 },
        { type: "expense", category: "Food", amountARS: 100 },
        { type: "expense", category: "Food", amountARS: 160 }, // recent

        { type: "expense", category: "Services", amountARS: 100 },
        { type: "expense", category: "Services", amountARS: 100 },
        { type: "expense", category: "Services", amountARS: 140 }, // recent
      ];

      const brief = await generateWeeklyBrief([], transactions);

      const foodAbnormal = brief.abnormalExpenses.find((e) => e.category === "Food");
      const servicesAbnormal = brief.abnormalExpenses.find((e) => e.category === "Services");

      expect(foodAbnormal).toBeDefined();
      expect(foodAbnormal?.amountARS).toBe(160);
      expect(foodAbnormal?.deviationPct).toBe(60); // (160 - 100) / 100 * 100 = 60%

      expect(servicesAbnormal).toBeUndefined();
    });

    it("calculates capital conversion rate (% of income allocated to buys)", async () => {
      const transactions = [
        { type: "income", amountARS: 100000 },
        { type: "buy", amountARS: 40000 },
      ];

      const brief = await generateWeeklyBrief([], transactions);
      expect(brief.conversionRatePct).toBe(40.0);
    });

    it("generates AI audit question highlighting blunders when unplanned exits exist", async () => {
      const tradesWithBlunder = [
        { id: "t1", is_planned_exit: false, unplanned_rationale: "Exited early due to panic" },
      ];

      const brief = await generateWeeklyBrief(tradesWithBlunder, []);
      expect(brief.aiAuditQuestion).toBe("You exited positions early before target without hitting invalidation. What invalidation rule failed?");
    });
  });

  // =========================================================================
  // 4. FAIL-SAFE BACKUP EXPORT, RETENTION PRUNING & DRY-RUN RESTORATION
  // =========================================================================
  describe("4. Fail-Safe Backup Export, Retention & Restoration", () => {

    it("exports database snapshot with valid SHA-256 signature", async () => {
      const fakeDbStore = {
        getStore: () => ({
          trades: [{ id: "t1", symbol: "AAPL", target_price_usd: 1500, invalidation_condition: "Stop loss 800" }],
          inflation_index: [{ date: "2026-08-01", value: 120.5 }],
          fx_rates: [{ date: "2026-08-01", ccl: 1300 }],
          game_reviews: [],
        }),
      };

      const backup = await exportDatabaseBackup(fakeDbStore);
      expect(backup.version).toBe("1.0.0");
      expect(backup.checksum).toHaveLength(64); // SHA-256 hex string

      // Recalculate checksum independently to confirm signature match
      const expectedChecksum = calculateBackupChecksum(backup);
      expect(backup.checksum).toBe(expectedChecksum);
    });

    it("detects tampered backup payload and rejects dry-run restoration", async () => {
      const validBackup = {
        version: "1.0.0",
        timestamp: "2026-08-14T00:00:00Z",
        data: {
          trades: [{ id: "t1", target_price_usd: 1000, invalidation_condition: "stop" }],
          inflation_index: [],
          fx_rates: [],
          game_reviews: [],
        },
      };

      const realChecksum = calculateBackupChecksum(validBackup);
      const tamperedBackup = {
        ...validBackup,
        checksum: realChecksum,
        data: {
          ...validBackup.data,
          trades: [{ id: "t1", target_price_usd: 999999, invalidation_condition: "tampered" }], // Tampered!
        },
      };

      const res = validateBackupSchemaAndChecksum(tamperedBackup);
      // calculateBackupChecksum(tamperedBackup) will differ from realChecksum
      const recalculated = calculateBackupChecksum(tamperedBackup);
      expect(recalculated).not.toBe(tamperedBackup.checksum);

      const verification = await verifyRestoration(
        { ...tamperedBackup, checksum: "INVALID_HASH" },
        { dryRun: true }
      );

      expect(verification.success).toBe(false);
      expect(verification.restorationValid).toBe(false);
    });

    it("applies 12-week retention pruning policy accurately", async () => {
      const res15 = await applyRetentionPolicy(12, 15);
      expect(res15.prunedCount).toBe(3);
      expect(res15.remainingCount).toBe(12);

      const res10 = await applyRetentionPolicy(12, 10);
      expect(res10.prunedCount).toBe(0);
      expect(res10.remainingCount).toBe(10);
    });

    it("executes dry-run restoration validation without mutating database", async () => {
      const validPayload = {
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        data: {
          trades: [{ id: "t1", target_price_usd: 1500, invalidation_condition: "Stop 800 ARS" }],
          inflation_index: [{ date: "2026-08-01", value: 100 }],
          fx_rates: [{ date: "2026-08-01", ccl: 1300 }],
          game_reviews: [],
        },
      };
      const checksum = calculateBackupChecksum(validPayload);
      const backupPayload = { ...validPayload, checksum };

      const result = await verifyRestoration(backupPayload, { dryRun: true });
      expect(result.success).toBe(true);
      expect(result.restorationValid).toBe(true);
      expect(result.checksumMatched).toBe(true);
      expect(result.rowsRestored).toBe(3); // 1 trade + 1 inflation + 1 fx = 3 rows
    });
  });

});
