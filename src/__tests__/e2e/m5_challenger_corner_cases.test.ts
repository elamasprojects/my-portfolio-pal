import { describe, it, expect } from "vitest";
import {
  calculateBackupChecksum,
  validateBackupSchemaAndChecksum,
  verifyRestoration,
  BackupPayload,
} from "@/lib/backupSystem";
import {
  validateUnplannedSellRationale,
  processSellExecution,
  checkTargetOrInvalidationHit,
} from "@/lib/disciplineFriction";
import { generateWeeklyBrief } from "@/lib/weeklyBrief";

describe("M5 Challenger Corner-Case & Boundary Stress Test Suite", () => {
  // ==========================================================================
  // GROUP 1: backupSystem.ts dry-run restoration validator
  // ==========================================================================
  describe("Group 1: backupSystem.ts Dry-Run Restoration Validator Stress Tests", () => {
    it("C1-BS-01: rejects null, undefined, primitives, and empty object payloads", async () => {
      const nullRes = await verifyRestoration(null as any);
      expect(nullRes.success).toBe(false);
      expect(nullRes.restorationValid).toBe(false);
      expect(nullRes.error).toContain("Corrupted backup payload");

      const emptyRes = await verifyRestoration({} as any);
      expect(emptyRes.success).toBe(false);
      expect(emptyRes.restorationValid).toBe(false);

      const invalidSchemaRes = validateBackupSchemaAndChecksum({ version: "1.0.0" });
      expect(invalidSchemaRes.valid).toBe(false);
      expect(invalidSchemaRes.error).toContain("missing mandatory metadata fields");
    });

    it("C1-BS-02: rejects unsupported schema versions (e.g. 0.9.0, 2.0.0)", () => {
      const payloadV09 = {
        version: "0.9.0",
        timestamp: "2026-08-14T00:00:00Z",
        checksum: "valid-checksum",
        data: { inflation_index: [], fx_rates: [], trades: [], game_reviews: [] },
      };
      const resV09 = validateBackupSchemaAndChecksum(payloadV09);
      expect(resV09.valid).toBe(false);
      expect(resV09.error).toContain("unsupported version 0.9.0");

      const payloadV20 = { ...payloadV09, version: "2.0.0" };
      const resV20 = validateBackupSchemaAndChecksum(payloadV20);
      expect(resV20.valid).toBe(false);
      expect(resV20.error).toContain("unsupported version 2.0.0");
    });

    it("C1-BS-03: rejects non-array or missing table data structures", () => {
      const payloadBadTables = {
        version: "1.0.0",
        timestamp: "2026-08-14T00:00:00Z",
        checksum: "valid-checksum",
        data: {
          inflation_index: [],
          fx_rates: "not-an-array",
          trades: [],
        },
      };
      const res = validateBackupSchemaAndChecksum(payloadBadTables);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("missing table data arrays");
    });

    it("C1-BS-04: rejects trades table missing mandatory schema columns", () => {
      const payloadMissingCol = {
        version: "1.0.0",
        timestamp: "2026-08-14T00:00:00Z",
        checksum: "valid-checksum",
        data: {
          inflation_index: [],
          fx_rates: [],
          trades: [
            {
              id: "t1",
              symbol: "AAPL",
              // missing invalidation_condition and target_price_usd
            },
          ],
        },
      };
      const res = validateBackupSchemaAndChecksum(payloadMissingCol);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("missing mandatory column invalidation_condition");
    });

    it("C1-BS-05: verifies SHA-256 checksum calculation consistency", () => {
      const rawPayload = {
        version: "1.0.0",
        timestamp: "2026-08-14T00:00:00Z",
        data: { inflation_index: [], fx_rates: [], trades: [], game_reviews: [] },
      };
      const hash1 = calculateBackupChecksum(rawPayload);
      const hash2 = calculateBackupChecksum(rawPayload);
      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);

      // Mutate data
      const mutatedPayload = {
        ...rawPayload,
        data: { ...rawPayload.data, trades: [{ id: "t1", invalidation_condition: "stop", target_price_usd: 100 }] },
      };
      const hashMutated = calculateBackupChecksum(mutatedPayload);
      expect(hashMutated).not.toBe(hash1);
    });

    it("C1-BS-06: stress tests checksum mismatch detection and exposes validation flaw", async () => {
      const rawPayload = {
        version: "1.0.0",
        timestamp: "2026-08-14T00:00:00Z",
        data: {
          inflation_index: [],
          fx_rates: [],
          trades: [{ id: "t1", invalidation_condition: "stop", target_price_usd: 100 }],
          game_reviews: [],
        },
      };

      // 1. Literal bad checksum strings (hardcoded checks in validateBackupSchemaAndChecksum)
      const payloadBadStr = { ...rawPayload, checksum: "bad-tampered-checksum-1234567890abcdef" };
      const resBadStr = await verifyRestoration(payloadBadStr);
      expect(resBadStr.success).toBe(false);
      expect(resBadStr.restorationValid).toBe(false);

      const payloadInvalidHash = { ...rawPayload, checksum: "INVALID_HASH" };
      const resInvalidHash = await verifyRestoration(payloadInvalidHash);
      expect(resInvalidHash.success).toBe(false);

      // 2. Tampered payload checksum mismatch vulnerability test
      const originalHash = calculateBackupChecksum(rawPayload);
      const tamperedPayload = {
        ...rawPayload,
        checksum: originalHash, // original hash before tampering data
        data: {
          ...rawPayload.data,
          trades: [{ id: "t1", invalidation_condition: "stop", target_price_usd: 999999 }], // TAMPERED!
        },
      };
      
      const computedHashForTampered = calculateBackupChecksum(tamperedPayload);
      expect(computedHashForTampered).not.toBe(originalHash);

      const schemaCheck = validateBackupSchemaAndChecksum(tamperedPayload);
      expect(schemaCheck.valid).toBe(false);
      expect(schemaCheck.error).toContain("Invalid Checksum Signature");
    });
  });

  // ==========================================================================
  // GROUP 2: disciplineFriction.ts edge-case inputs
  // ==========================================================================
  describe("Group 2: disciplineFriction.ts Edge-Case Inputs Stress Tests", () => {
    it("C2-DF-01: tests whitespace-only and padded rationales for unplanned sells", () => {
      // 25 spaces string (raw length = 25, trimmed length = 0)
      const spaces25 = "                         ";
      expect(spaces25.length).toBe(25);
      const resSpaces = validateUnplannedSellRationale(spaces25, false);
      expect(resSpaces.valid).toBe(false);
      expect(resSpaces.error).toContain("at least 20 characters");

      // Tabs and newlines (raw length > 20, trimmed length = 0)
      const tabsNewlines = "\t\n   \n\t       \n\t  ";
      const resTabs = validateUnplannedSellRationale(tabsNewlines, false);
      expect(resTabs.valid).toBe(false);

      // Padded rationale: raw length = 21 ("   short rationale   "), trimmed length = 15 (< 20)
      const paddedShort = "   short rationale   ";
      const resPadded = validateUnplannedSellRationale(paddedShort, false);
      expect(resPadded.valid).toBe(false);

      // Exactly 20 trimmed characters with padding
      const paddedValid = "   12345678901234567890   "; // trimmed length = 20
      const resPaddedValid = validateUnplannedSellRationale(paddedValid, false);
      expect(resPaddedValid.valid).toBe(true);
    });

    it("C2-DF-02: tests planned exit bypass for rationale validation", () => {
      // Empty rationale for planned exit
      const resPlanned = validateUnplannedSellRationale("", true);
      expect(resPlanned.valid).toBe(true);

      const procPlanned = processSellExecution({
        tradeId: "t1",
        sellQuantity: 10,
        sellPriceARS: 100,
        isPlannedExit: true,
      });
      expect(procPlanned.success).toBe(true);
      expect(procPlanned.coolingOffApplied).toBe(false);
    });

    it("C2-DF-03: tests cooling-off timer boundary (59s vs 60s)", () => {
      const validRationale = "Selling position due to sudden market news rationale text";

      // 59 seconds elapsed -> fail
      const proc59 = processSellExecution({
        tradeId: "t1",
        sellQuantity: 10,
        sellPriceARS: 100,
        isPlannedExit: false,
        unplannedRationale: validRationale,
        coolingOffDurationSeconds: 59,
      });
      expect(proc59.success).toBe(false);
      expect(proc59.error).toContain("60s has not elapsed");

      // 60 seconds elapsed -> pass
      const proc60 = processSellExecution({
        tradeId: "t1",
        sellQuantity: 10,
        sellPriceARS: 100,
        isPlannedExit: false,
        unplannedRationale: validRationale,
        coolingOffDurationSeconds: 60,
      });
      expect(proc60.success).toBe(true);
    });

    it("C2-DF-04: tests target price boundary matching (exact, slightly below, slightly above)", () => {
      const target = 100;
      const invalidation = 50;

      // Exact target hit (100)
      const exactTarget = checkTargetOrInvalidationHit(100, target, invalidation);
      expect(exactTarget.isTargetHit).toBe(true);
      expect(exactTarget.status).toBe("target_met");

      // Above target (100.001)
      const aboveTarget = checkTargetOrInvalidationHit(100.001, target, invalidation);
      expect(aboveTarget.isTargetHit).toBe(true);
      expect(aboveTarget.status).toBe("target_met");

      // Just below target (99.999)
      const belowTarget = checkTargetOrInvalidationHit(99.999, target, invalidation);
      expect(belowTarget.isTargetHit).toBe(false);
      expect(belowTarget.status).toBe("active");
    });

    it("C2-DF-05: tests invalidation price boundary matching (exact, slightly above, slightly below)", () => {
      const target = 100;
      const invalidation = 50;

      // Exact invalidation hit (50)
      const exactInv = checkTargetOrInvalidationHit(50, target, invalidation);
      expect(exactInv.isInvalidationHit).toBe(true);
      expect(exactInv.status).toBe("invalidation_hit");

      // Below invalidation (49.999)
      const belowInv = checkTargetOrInvalidationHit(49.999, target, invalidation);
      expect(belowInv.isInvalidationHit).toBe(true);
      expect(belowInv.status).toBe("invalidation_hit");

      // Just above invalidation (50.001)
      const aboveInv = checkTargetOrInvalidationHit(50.001, target, invalidation);
      expect(aboveInv.isInvalidationHit).toBe(false);
      expect(aboveInv.status).toBe("active");
    });

    it("C2-DF-06: tests zero and negative target / invalidation prices", () => {
      // Zero target price
      const zeroTarget = checkTargetOrInvalidationHit(100, 0, 50);
      expect(zeroTarget.isTargetHit).toBe(false);
      expect(zeroTarget.status).toBe("active");

      // Negative target price
      const negTarget = checkTargetOrInvalidationHit(100, -10, 50);
      expect(negTarget.isTargetHit).toBe(false);
      expect(negTarget.status).toBe("active");

      // Zero invalidation price
      const zeroInv = checkTargetOrInvalidationHit(10, 100, 0);
      expect(zeroInv.isInvalidationHit).toBe(false);
      expect(zeroInv.status).toBe("active");

      // Negative invalidation price
      const negInv = checkTargetOrInvalidationHit(10, 100, -50);
      expect(negInv.isInvalidationHit).toBe(false);
      expect(negInv.status).toBe("active");

      // Zero current price with positive invalidation threshold (0 <= 50 triggers invalidation_hit)
      const zeroCurrent = checkTargetOrInvalidationHit(0, 100, 50);
      expect(zeroCurrent.isTargetHit).toBe(false);
      expect(zeroCurrent.isInvalidationHit).toBe(true);
      expect(zeroCurrent.status).toBe("invalidation_hit");
    });
  });

  // ==========================================================================
  // GROUP 3: weeklyBrief.ts thesis proximity alerts near 5% boundaries
  // ==========================================================================
  describe("Group 3: weeklyBrief.ts Thesis Proximity Alerts Boundary Tests", () => {
    it("C3-WB-01: evaluates thesis proximity near 5% boundary of target price", async () => {
      // Target price = 100 ARS. 5% boundary threshold = 100 * 0.95 = 95 ARS.

      // 1. Current price = 95.0 ARS (Exact 5% boundary threshold)
      const briefExact5 = await generateWeeklyBrief(
        [
          {
            symbol: "MELI",
            target_price_usd: 100,
            buy_price_ars: 80,
            sell_price_ars: 95,
          },
        ],
        [],
        { MELI: 95.0 }
      );
      const nearAlertExact = briefExact5.thesisAlerts.find((a) => a.symbol === "MELI");
      expect(nearAlertExact).toBeDefined();
      expect(nearAlertExact?.type).toBe("near_target");
      expect(nearAlertExact?.message).toContain("within 5% of target price");

      // 2. Current price = 96.0 ARS (Within 5%, higher than 95)
      const brief96 = await generateWeeklyBrief(
        [
          {
            symbol: "MELI",
            target_price_usd: 100,
            buy_price_ars: 80,
          },
        ],
        [],
        { MELI: 96.0 }
      );
      const nearAlert96 = brief96.thesisAlerts.find((a) => a.symbol === "MELI");
      expect(nearAlert96?.type).toBe("near_target");

      // 3. Current price = 94.99 ARS (Just outside 5% threshold: 94.99 < 95.0)
      const brief9499 = await generateWeeklyBrief(
        [
          {
            symbol: "MELI",
            target_price_usd: 100,
            buy_price_ars: 80,
          },
        ],
        [],
        { MELI: 94.99 }
      );
      const nearAlert9499 = brief9499.thesisAlerts.find((a) => a.symbol === "MELI" && a.type === "near_target");
      expect(nearAlert9499).toBeUndefined();

      // 4. Current price = 100.0 ARS (Target met)
      const brief100 = await generateWeeklyBrief(
        [
          {
            symbol: "MELI",
            target_price_usd: 100,
            buy_price_ars: 80,
          },
        ],
        [],
        { MELI: 100.0 }
      );
      const metAlert = brief100.thesisAlerts.find((a) => a.symbol === "MELI");
      expect(metAlert?.type).toBe("target_met");
    });

    it("C3-WB-02: handles zero or negative target prices in weekly brief proximity check", async () => {
      const briefZeroTarget = await generateWeeklyBrief(
        [
          {
            symbol: "GGAL",
            target_price_usd: 0,
            buy_price_ars: 100,
          },
        ],
        [],
        { GGAL: 50 }
      );
      const ggalAlert = briefZeroTarget.thesisAlerts.find((a) => a.symbol === "GGAL");
      expect(ggalAlert).toBeUndefined();
    });

    it("C3-WB-03: handles invalidation hit alerts in weekly brief", async () => {
      const briefInvHit = await generateWeeklyBrief(
        [
          {
            symbol: "YPF",
            target_price_usd: 200,
            invalidation_price_usd: 100,
            invalidation_condition: "Break of 100 support level",
            buy_price_ars: 150,
          },
        ],
        [],
        { YPF: 95 } // 95 <= 100
      );
      const ypfAlert = briefInvHit.thesisAlerts.find((a) => a.symbol === "YPF");
      expect(ypfAlert).toBeDefined();
      expect(ypfAlert?.type).toBe("invalidation_hit");
      expect(ypfAlert?.message).toContain("Break of 100 support level");
    });

    it("C3-WB-04: tests multiple assets with mixed target_met, near_target, invalidation_hit, and active status", async () => {
      const briefMixed = await generateWeeklyBrief(
        [
          { symbol: "AAPL", target_price_usd: 100, invalidation_price_usd: 50 },
          { symbol: "MSFT", target_price_usd: 200, invalidation_price_usd: 100 },
          { symbol: "NVDA", target_price_usd: 500, invalidation_price_usd: 300 },
          { symbol: "TSLA", target_price_usd: 300, invalidation_price_usd: 150 },
        ],
        [],
        {
          AAPL: 105, // target_met
          MSFT: 192, // near_target (192 >= 190)
          NVDA: 280, // invalidation_hit (280 <= 300)
          TSLA: 200, // active (between 150 and 285)
        }
      );

      expect(briefMixed.thesisAlerts).toHaveLength(3);
      expect(briefMixed.thesisAlerts.find((a) => a.symbol === "AAPL")?.type).toBe("target_met");
      expect(briefMixed.thesisAlerts.find((a) => a.symbol === "MSFT")?.type).toBe("near_target");
      expect(briefMixed.thesisAlerts.find((a) => a.symbol === "NVDA")?.type).toBe("invalidation_hit");
      expect(briefMixed.thesisAlerts.find((a) => a.symbol === "TSLA")).toBeUndefined();
    });
  });
});
