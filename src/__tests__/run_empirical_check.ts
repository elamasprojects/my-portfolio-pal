import {
  calculateBackupChecksum,
  validateBackupSchemaAndChecksum,
  verifyRestoration,
} from "../lib/backupSystem";

async function main() {
  console.log("=== EMPIRICAL VERIFICATION HARNESS START ===");

  const rawPayload = {
    version: "1.0.0",
    timestamp: "2026-08-14T00:00:00Z",
    data: {
      inflation_index: [],
      fx_rates: [],
      trades: [{ id: "t1", invalidation_condition: "stop", target_price_ars: 100 }],
      game_reviews: [],
    },
  };

  const validChecksum = calculateBackupChecksum(rawPayload);
  console.log("Computed SHA-256 Checksum:", validChecksum);
  console.log("Length of Checksum:", validChecksum.length);

  // 1. Valid Payload Verification
  const validPayload = { ...rawPayload, checksum: validChecksum };
  const validResult = validateBackupSchemaAndChecksum(validPayload);
  console.log("Valid Payload Result:", validResult);

  // 2. Tampered Payload (C1-BS-06 test case)
  const tamperedPayload = {
    ...rawPayload,
    checksum: validChecksum, // Stale checksum before data modification
    data: {
      ...rawPayload.data,
      trades: [{ id: "t1", invalidation_condition: "stop", target_price_ars: 999999 }], // TAMPERED
    },
  };

  const tamperedChecksum = calculateBackupChecksum(tamperedPayload);
  console.log("Tampered Payload Computed Checksum:", tamperedChecksum);
  console.log("Checksums match?", validChecksum === tamperedChecksum);

  const tamperedResult = validateBackupSchemaAndChecksum(tamperedPayload);
  console.log("Tampered Payload Validation Result:", tamperedResult);

  // 3. Dry-Run Restoration Verification
  const validRestoration = await verifyRestoration(validPayload);
  console.log("Valid Restoration Result:", validRestoration);

  const tamperedRestoration = await verifyRestoration(tamperedPayload);
  console.log("Tampered Restoration Result:", tamperedRestoration);

  if (
    validResult.valid === true &&
    tamperedResult.valid === false &&
    tamperedResult.error?.includes("Invalid Checksum Signature") &&
    validRestoration.success === true &&
    tamperedRestoration.success === false
  ) {
    console.log("=== EMPIRICAL VERIFICATION VERDICT: PASS ===");
  } else {
    console.log("=== EMPIRICAL VERIFICATION VERDICT: FAIL ===");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error in empirical runner:", err);
  process.exit(1);
});
