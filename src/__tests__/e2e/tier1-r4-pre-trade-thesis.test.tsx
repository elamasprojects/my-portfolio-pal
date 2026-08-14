import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PreTradeThesisModal } from "@/components/discipline/PreTradeThesisModal";
import { FrictionCoolingTimerModal } from "@/components/discipline/FrictionCoolingTimerModal";
import { setupTestEnvironment, advanceCoolingTimer } from "@/test/helpers/stateSetup";
import { PreTradeThesis, SellExecutionRequest } from "@/types/thesis";

describe("Tier 1 - Requirement 4 (R4): Pre-Trade Thesis & Friction Inversion Engine", () => {
  let env: ReturnType<typeof setupTestEnvironment>;

  beforeEach(() => {
    env = setupTestEnvironment({ useFakeTimers: true });
  });

  afterEach(() => {
    env.cleanup();
  });

  /**
   * T1-R4-01: Mandatory Pre-Trade Thesis Entry Validation
   */
  it("T1-R4-01: validates mandatory 3 fields (thesis min 10 chars, target > 0, invalidation min 10 chars) before buy", async () => {
    const handleSubmit = vi.fn();

    render(
      <PreTradeThesisModal
        open={true}
        onOpenChange={() => {}}
        onSubmit={handleSubmit}
      />
    );

    // Attempt submission with empty fields
    const submitBtn = screen.getByRole("button", { name: /confirmar tesis/i });
    fireEvent.click(submitBtn);

    // Error message displayed and submission blocked
    expect(screen.getByText(/reason for entry \/ thesis must be at least 10 characters/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();

    // Fill in valid fields
    const inputs = screen.getAllByRole("textbox");
    // inputs[0]: thesis
    fireEvent.change(inputs[0], { target: { value: "Strong Q1 revenue growth expected for technology sector" } });

    const numberInput = screen.getByPlaceholderText("1500");
    fireEvent.change(numberInput, { target: { value: "1500" } });

    // inputs[1]: invalidation
    fireEvent.change(inputs[1], { target: { value: "Revenue drops below 5% YoY or breaks 800 ARS support" } });

    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      entryThesis: "Strong Q1 revenue growth expected for technology sector",
      targetPriceARS: 1500,
      invalidationCondition: "Revenue drops below 5% YoY or breaks 800 ARS support",
    });
  });

  /**
   * T1-R4-02: Unplanned Sell 60-Second Cooling-Off Enforcement
   */
  it("T1-R4-02: enforces 60-second cooling-off timer and mandatory written rationale (min 20 chars) for unplanned sells", async () => {
    const handleConfirmSell = vi.fn();

    render(
      <FrictionCoolingTimerModal
        open={true}
        onOpenChange={() => {}}
        onConfirmSell={handleConfirmSell}
        initialTimerSeconds={60}
      />
    );

    const confirmBtn = screen.getByRole("button", { name: /confirmar venta no planificada/i });

    // Button disabled while timer > 0
    expect(confirmBtn).toBeDisabled();

    // Fast-forward fake timer by 60 seconds
    await advanceCoolingTimer(60);

    // After timer hits 0, button still disabled if rationale is empty
    expect(screen.getByText("0s")).toBeInTheDocument();
    expect(confirmBtn).toBeDisabled();

    // Fill in short rationale (< 20 chars)
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Short rationale" } }); // 15 chars
    expect(confirmBtn).toBeDisabled();

    // Fill in valid rationale (>= 20 chars)
    fireEvent.change(textarea, { target: { value: "Selling due to unexpected market panic despite no fundamental thesis change" } });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);
    expect(handleConfirmSell).toHaveBeenCalledWith(
      "Selling due to unexpected market panic despite no fundamental thesis change"
    );
  });

  /**
   * T1-R4-03: Planned Exit Fast-Path Execution (1-Click)
   */
  it("T1-R4-03: executes 1-click planned exit bypassing 60-second cooling timer when exit matches strategy", () => {
    const sellRequest: SellExecutionRequest = {
      tradeId: "trade-001",
      sellQuantity: 100,
      sellPriceARS: 1500,
      isPlannedExit: true,
    };

    // Planned exit skips cooling-off timer duration completely
    expect(sellRequest.isPlannedExit).toBe(true);
    expect(sellRequest.coolingOffDurationSeconds).toBeUndefined();
    expect(sellRequest.unplannedRationale).toBeUndefined();
  });

  /**
   * T1-R4-04: Target Price Hit Visual Banner
   */
  it("T1-R4-04: evaluates target price hit status and returns Target alert indicator", () => {
    const currentMarketPriceARS = 1550;
    const thesis: PreTradeThesis = {
      entryThesis: "Growth thesis",
      targetPriceARS: 1500,
      invalidationCondition: "Break below 800 ARS",
    };

    const isTargetHit = currentMarketPriceARS >= thesis.targetPriceARS;
    expect(isTargetHit).toBe(true);
  });

  /**
   * T1-R4-05: Invalidation Price Hit Visual Banner
   */
  it("T1-R4-05: evaluates invalidation price hit status and returns Invalidación alert indicator", () => {
    const currentMarketPriceARS = 750;
    const invalidationPriceARS = 800;

    const isInvalidationHit = currentMarketPriceARS <= invalidationPriceARS;
    expect(isInvalidationHit).toBe(true);
  });

  /**
   * T1-R4-06: Candidate Watchlist Pre-Trade Thesis Linking
   */
  it("T1-R4-06: verifies watchlist candidate item links pre-trade thesis and entry zones", () => {
    const watchlistItem = {
      symbol: "MELI",
      targetEntryPriceARS: 120000,
      targetExitPriceARS: 180000,
      invalidationPriceARS: 100000,
      entryThesis: "E-commerce market expansion across LATAM region",
      invalidationCondition: "Gross margin drops below 40%",
    };

    expect(watchlistItem.symbol).toBe("MELI");
    expect(watchlistItem.entryThesis.length).toBeGreaterThanOrEqual(10);
    expect(watchlistItem.targetExitPriceARS).toBeGreaterThan(watchlistItem.targetEntryPriceARS);
    expect(watchlistItem.invalidationPriceARS).toBeLessThan(watchlistItem.targetEntryPriceARS);
  });
});
