import {
  validatePreTradeThesis,
  validatePreTradeThesisForm,
} from "../src/components/discipline/PreTradeThesisModal";
import {
  validateUnplannedSellRationale,
  processSellExecution,
  checkTargetOrInvalidationHit,
  SellExecutionRequest,
} from "../src/lib/disciplineFriction";
import { generateWeeklyBrief } from "../src/lib/weeklyBrief";
import {
  exportDatabaseBackup,
  calculateBackupChecksum,
  validateBackupSchemaAndChecksum,
  applyRetentionPolicy,
  verifyRestoration,
} from "../src/lib/backupSystem";

async function main() {
  console.log("=== EMPIRICAL VERIFICATION SUITE — MILESTONE M5 ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      failed++;
    }
  }

  // ---------------------------------------------------------
  // 1. Pre-Trade Thesis Validation & Bypass Prevention
  // ---------------------------------------------------------
  console.log("\n1. Pre-Trade Thesis Validation:");

  const t1 = validatePreTradeThesis(
    { entryThesis: "Short", targetPriceARS: 2000, invalidationCondition: "Valid condition 10 chars" },
    1000
  );
  assert(!t1.valid && t1.errors.includes("Entry thesis must be at least 10 characters long."), "Reject entry thesis < 10 chars");

  const t2 = validatePreTradeThesis(
    { entryThesis: "Valid thesis text 10+ chars", targetPriceARS: 1000, invalidationCondition: "Valid condition 10 chars" },
    1000
  );
  assert(!t2.valid && t2.errors.includes("Target price must be greater than buy price."), "Reject target price <= buy price");

  const t3 = validatePreTradeThesisForm({
    buyPriceARS: 1000,
    targetPriceARS: 1000,
    invalidationPriceARS: 1000,
    entryThesis: "Valid thesis text",
    invalidationCondition: "Valid invalidation text",
  });
  assert(!t3.valid && t3.errors.length === 2, "Form validation rejects target <= buy and invalidation >= buy");

  // ---------------------------------------------------------
  // 2. Friction Inversion & Cooling Timer Enforcement
  // ---------------------------------------------------------
  console.log("\n2. Friction Inversion & Cooling Timer:");

  const plannedReq: SellExecutionRequest = {
    tradeId: "t-1",
    sellQuantity: 50,
    sellPriceARS: 1500,
    isPlannedExit: true,
  };
  const plannedRes = processSellExecution(plannedReq);
  assert(plannedRes.success && !plannedRes.coolingOffApplied, "Planned exit fast-paths instantly (1-click)");

  const unplanned59s: SellExecutionRequest = {
    tradeId: "t-2",
    sellQuantity: 50,
    sellPriceARS: 1500,
    isPlannedExit: false,
    coolingOffDurationSeconds: 59,
    unplannedRationale: "Valid rationale describing why position is sold early",
  };
  const unplanned59sRes = processSellExecution(unplanned59s);
  assert(!unplanned59sRes.success && unplanned59sRes.error?.includes("Cooling-off period of 60s has not elapsed"), "Enforces 60s timer (59s rejected)");

  const unplannedShortRat: SellExecutionRequest = {
    tradeId: "t-3",
    sellQuantity: 50,
    sellPriceARS: 1500,
    isPlannedExit: false,
    coolingOffDurationSeconds: 60,
    unplannedRationale: "Short rationale",
  };
  const unplannedShortRatRes = processSellExecution(unplannedShortRat);
  assert(!unplannedShortRatRes.success && unplannedShortRatRes.error?.includes("at least 20 characters"), "Rejects rationale < 20 chars");

  const unplannedValid: SellExecutionRequest = {
    tradeId: "t-4",
    sellQuantity: 50,
    sellPriceARS: 1500,
    isPlannedExit: false,
    coolingOffDurationSeconds: 60,
    unplannedRationale: "Valid rationale describing early sell",
  };
  const unplannedValidRes = processSellExecution(unplannedValid);
  assert(unplannedValidRes.success && unplannedValidRes.coolingOffApplied, "Unplanned sell succeeds at 60s with >=20 chars rationale");

  const statusCheck = checkTargetOrInvalidationHit(1500, 1500, 800);
  assert(statusCheck.status === "target_met" && statusCheck.isTargetHit, "Target price hit correctly evaluated");

  // ---------------------------------------------------------
  // 3. Weekly Brief & Abnormal Expense Thresholding (>1.5x)
  // ---------------------------------------------------------
  console.log("\n3. Weekly Brief Calculation & Thresholding:");

  const txs = [
    { type: "expense", category: "Food", amountARS: 100 },
    { type: "expense", category: "Food", amountARS: 100 },
    { type: "expense", category: "Food", amountARS: 160 }, // 1.6x avg -> flagged
    { type: "expense", category: "Services", amountARS: 100 },
    { type: "expense", category: "Services", amountARS: 100 },
    { type: "expense", category: "Services", amountARS: 140 }, // 1.4x avg -> not flagged
    { type: "income", amountARS: 100000 },
    { type: "buy", amountARS: 40000 },
  ];

  const brief = await generateWeeklyBrief([], txs);
  const foodFlag = brief.abnormalExpenses.find((e) => e.category === "Food");
  const servicesFlag = brief.abnormalExpenses.find((e) => e.category === "Services");

  assert(foodFlag !== undefined && foodFlag.amountARS === 160, "Abnormal expense > 1.5x flagged correctly");
  assert(servicesFlag === undefined, "Normal expense <= 1.5x ignored correctly");
  assert(brief.conversionRatePct === 40.0, "Capital conversion rate calculated accurately (40.0%)");

  // ---------------------------------------------------------
  // 4. Fail-Safe Backup Export, Retention & Restoration
  // ---------------------------------------------------------
  console.log("\n4. Backup Export, Retention & Restoration Validation:");

  const fakeStore = {
    getStore: () => ({
      trades: [{ id: "t1", target_price_ars: 1500, invalidation_condition: "Stop 800" }],
      inflation_index: [{ date: "2026-08-01", value: 120 }],
      fx_rates: [{ date: "2026-08-01", ccl: 1300 }],
      game_reviews: [],
    }),
  };

  const backup = await exportDatabaseBackup(fakeStore);
  assert(backup.version === "1.0.0" && backup.checksum.length === 64, "Database backup exported with SHA-256 checksum");

  const tampered = { ...backup, checksum: "INVALID_HASH" };
  const tamperedRes = await verifyRestoration(tampered, { dryRun: true });
  assert(!tamperedRes.success && !tamperedRes.restorationValid, "Restoration validator rejects tampered checksum");

  const validRes = await verifyRestoration(backup, { dryRun: true });
  assert(validRes.success && validRes.restorationValid && validRes.checksumMatched, "Restoration validator approves clean dry-run payload");

  const retention = await applyRetentionPolicy(12, 15);
  assert(retention.prunedCount === 3 && retention.remainingCount === 12, "Retention policy prunes 3 oldest backups beyond 12 weeks");

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});
