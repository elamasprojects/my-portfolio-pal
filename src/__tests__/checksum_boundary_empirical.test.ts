import { describe, it, expect } from "vitest";
import {
  calculateBackupChecksum,
  validateBackupSchemaAndChecksum,
  verifyRestoration,
} from "@/lib/backupSystem";

describe("Empirical Boundary Payload Checksum Verification Logic Harness", () => {
  const validBasePayload = {
    id: "b123",
    version: "1.0.0",
    timestamp: "2026-08-14T00:00:00Z",
    data: {
      inflation_index: [{ date: "2026-08-01", value: 125.4 }],
      fx_rates: [{ date: "2026-08-01", rate_ccl: 1300 }],
      trades: [
        {
          id: "t100",
          symbol: "AAPL",
          buy_price_ars: 1500,
          target_price_ars: 2000,
          invalidation_condition: "Price drops below 1400 ARS stop-loss",
        },
      ],
      game_reviews: [],
    },
  };

  it("BP-CS-01: validates correct payload signature when checksum matches dynamically calculated hash", () => {
    const checksum = calculateBackupChecksum(validBasePayload);
    const fullPayload = { ...validBasePayload, checksum };
    const result = validateBackupSchemaAndChecksum(fullPayload);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("BP-CS-02: fails validation when payload checksum field is missing or empty", () => {
    const noChecksum = { ...validBasePayload };
    const resNoChecksum = validateBackupSchemaAndChecksum(noChecksum);
    expect(resNoChecksum.valid).toBe(false);
    expect(resNoChecksum.error).toBe("Missing Checksum Signature");

    const emptyChecksum = { ...validBasePayload, checksum: "" };
    const resEmpty = validateBackupSchemaAndChecksum(emptyChecksum);
    expect(resEmpty.valid).toBe(false);
    expect(resEmpty.error).toBe("Missing Checksum Signature");
  });

  it("BP-CS-03: fails validation when trade data is tampered (target_price_ars altered)", () => {
    const originalChecksum = calculateBackupChecksum(validBasePayload);
    const tamperedTradePayload = {
      ...validBasePayload,
      checksum: originalChecksum,
      data: {
        ...validBasePayload.data,
        trades: [
          {
            ...validBasePayload.data.trades[0],
            target_price_ars: 9999, // TAMPERED!
          },
        ],
      },
    };
    const result = validateBackupSchemaAndChecksum(tamperedTradePayload);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid Checksum Signature: hash mismatch");
  });

  it("BP-CS-04: fails validation when inflation_index array is modified", () => {
    const originalChecksum = calculateBackupChecksum(validBasePayload);
    const tamperedInflationPayload = {
      ...validBasePayload,
      checksum: originalChecksum,
      data: {
        ...validBasePayload.data,
        inflation_index: [{ date: "2026-08-01", value: 999.9 }],
      },
    };
    const result = validateBackupSchemaAndChecksum(tamperedInflationPayload);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid Checksum Signature: hash mismatch");
  });

  it("BP-CS-05: fails validation when timestamp metadata is altered", () => {
    const originalChecksum = calculateBackupChecksum(validBasePayload);
    const tamperedTimePayload = {
      ...validBasePayload,
      timestamp: "2026-08-15T00:00:00Z", // TAMPERED!
      checksum: originalChecksum,
    };
    const result = validateBackupSchemaAndChecksum(tamperedTimePayload);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid Checksum Signature: hash mismatch");
  });

  it("BP-CS-06: dry-run verifyRestoration succeeds with valid payload and fails with tampered payload", async () => {
    const checksum = calculateBackupChecksum(validBasePayload);
    const validFull = { ...validBasePayload, checksum };
    const okRestoration = await verifyRestoration(validFull);
    expect(okRestoration.success).toBe(true);
    expect(okRestoration.restorationValid).toBe(true);
    expect(okRestoration.checksumMatched).toBe(true);
    expect(okRestoration.rowsRestored).toBe(3); // 1 inflation + 1 fx + 1 trade

    const tamperedFull = {
      ...validFull,
      data: { ...validBasePayload.data, game_reviews: [{ id: "gr1" }] },
    };
    const badRestoration = await verifyRestoration(tamperedFull);
    expect(badRestoration.success).toBe(false);
    expect(badRestoration.restorationValid).toBe(false);
    expect(badRestoration.checksumMatched).toBe(false);
    expect(badRestoration.error).toBe("Invalid Checksum Signature: hash mismatch");
  });
});
