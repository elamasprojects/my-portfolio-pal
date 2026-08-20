import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateWeeklyBrief } from "@/lib/weeklyBrief";
import {
  exportDatabaseBackup,
  applyRetentionPolicy,
  verifyRestoration,
} from "@/lib/backupSystem";
import { setupTestEnvironment, triggerSundayWeeklyBrief } from "@/test/helpers/stateSetup";
import { sampleBackupPayloadFixture, sampleTradeFixtures } from "@/test/fixtures/types";

describe("Tier 1 - Requirement 5 (R5): Weekly Brief Generator & Automated Backup System", () => {
  let env: ReturnType<typeof setupTestEnvironment>;

  beforeEach(() => {
    env = setupTestEnvironment({
      initialData: {
        trades: sampleTradeFixtures,
      },
    });
  });

  afterEach(() => {
    env.cleanup();
  });

  /**
   * T1-R5-01: Sunday Weekly Intelligence Digest Computation
   */
  it("T1-R5-01: generates Sunday intelligence digest computing 7d/MTD returns, alerts, and conversion rate", async () => {
    triggerSundayWeeklyBrief("2026-08-16T09:00:00Z");

    // The conversion rate is measured from recorded income and investment. This assertion used
    // to pass with no transactions at all, because the generator returned a hardcoded 42.5%.
    const transactions = [
      { type: "income", amount: 200000 },
      { type: "investment", amount: 50000 },
    ];

    const brief = await generateWeeklyBrief(sampleTradeFixtures, transactions);

    expect(brief).toBeDefined();
    expect(brief.performance7dPct).toBeDefined();
    expect(brief.performanceMTDPct).toBeDefined();
    expect(brief.conversionRatePct).toBe(25);
    expect(brief.thesisAlerts).toHaveLength(1);
    expect(brief.abnormalExpenses).toBeDefined();
  });

  it("T1-R5-01b: reports zero rather than a placeholder when nothing was recorded", async () => {
    const brief = await generateWeeklyBrief([], []);

    expect(brief.conversionRatePct).toBe(0);
    expect(brief.performance7dPct).toBe(0);
    expect(brief.performanceMTDPct).toBe(0);
    expect(brief.thesisAlerts).toEqual([]);
    expect(brief.abnormalExpenses).toEqual([]);
  });

  /**
   * T1-R5-02: AI-Generated Auditing Question Generation
   */
  it("T1-R5-02: generates custom AI auditing question based on trade discipline flaws", async () => {
    const tradeHistoryWithBlunder = [
      {
        id: "t1",
        is_planned_exit: false,
        unplanned_rationale: "Selling due to panic over market rumor despite no thesis change",
      },
    ];

    const brief = await generateWeeklyBrief(tradeHistoryWithBlunder);

    expect(brief.aiAuditQuestion).toContain("What invalidation rule failed?");
  });

  /**
   * T1-R5-03: Fail-Safe Weekly Backup Database Export
   */
  it("T1-R5-03: exports complete database snapshot to portable JSON payload with SHA-256 hash", async () => {
    const backup = await exportDatabaseBackup(env.mockSupabase);

    expect(backup.version).toBe("1.0.0");
    expect(backup.checksum).toBeDefined();
    expect(backup.timestamp).toBeDefined();
    expect(backup.data.trades).toBeDefined();
    expect(backup.data.inflation_index).toBeDefined();
    expect(backup.data.fx_rates).toBeDefined();
  });

  /**
   * T1-R5-04: 12-Week Retention Pruning Policy Enforcement
   */
  it("T1-R5-04: enforces 12-week retention limit pruning oldest backup archives", async () => {
    // 15 existing weekly backup snapshots
    const retentionResult = await applyRetentionPolicy(12, 15);

    expect(retentionResult.prunedCount).toBe(3); // 15 - 12 = 3 oldest pruned
    expect(retentionResult.remainingCount).toBe(12);
  });

  /**
   * T1-R5-05: Dry-Run Restoration Verification Engine
   */
  it("T1-R5-05: executes non-destructive dry-run restoration verification without mutating database", async () => {
    const verification = await verifyRestoration(sampleBackupPayloadFixture, { dryRun: true });

    expect(verification.success).toBe(true);
    expect(verification.restorationValid).toBe(true);
    expect(verification.checksumMatched).toBe(true);
    expect(verification.rowsRestored).toBeGreaterThan(0);
  });

  /**
   * T1-R5-06: Backup Restoration Schema Integrity Protection
   */
  it("T1-R5-06: rejects corrupted backup payloads or hash mismatches cleanly", async () => {
    const corruptedPayload = {
      version: "1.0.0",
      timestamp: "2026-08-14T00:00:00Z",
      checksum: "INVALID_HASH",
      data: {
        trades: [],
        inflation_index: [],
        fx_rates: [],
      },
    };

    const verification = await verifyRestoration(corruptedPayload, { dryRun: true });

    expect(verification.success).toBe(false);
    expect(verification.restorationValid).toBe(false);
    expect(verification.error).toContain("Checksum");
  });
});
