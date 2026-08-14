import type {
  RealReturnColumns,
  CalculateRealReturnParams,
  RealReturnOptions,
} from "@/types/realReturns";
import { getCERIndexForDate, getFxRatesForDate } from "@/lib/apiIngestion";

/**
 * Pure mathematical core function for 3-column real returns calculation.
 * Completely deterministic, zero side-effects.
 *
 * @param amountARS Face monetary value in ARS.
 * @param ipcStart IPC inflation index value at start date.
 * @param ipcEnd IPC inflation index value at end date.
 * @param cclRate Contado con Liqui exchange rate (ARS per USD) at evaluation date.
 * @param deflateDirection 'to_end_date' (default: historical cost to end purchasing power)
 *                         or 'to_start_date' (end value to start purchasing power).
 */
export function calculateRealReturnsCore(
  amountARS: number,
  ipcStart: number,
  ipcEnd: number,
  cclRate: number,
  deflateDirection: "to_end_date" | "to_start_date" = "to_end_date"
): RealReturnColumns {
  // Edge Case 1: Zero amount -> All columns zero
  if (amountARS === 0) {
    return { nominalARS: 0, realVsIPC: 0, usdVsCCL: 0 };
  }

  // Column 1: Nominal ARS
  const nominalARS = amountARS;

  // Column 2: Real vs IPC (Deflated ARS)
  let realVsIPC = amountARS;
  if (ipcStart > 0 && ipcEnd > 0) {
    if (deflateDirection === "to_end_date") {
      realVsIPC = amountARS * (ipcEnd / ipcStart);
    } else {
      realVsIPC = amountARS * (ipcStart / ipcEnd);
    }
  }

  // Column 3: USD vs CCL (Real USD purchasing power)
  let usdVsCCL = 0;
  if (cclRate > 0) {
    usdVsCCL = amountARS / cclRate;
  }

  return {
    nominalARS: Math.round(nominalARS * 100) / 100,
    realVsIPC: Math.round(realVsIPC * 100) / 100,
    usdVsCCL: Math.round(usdVsCCL * 100) / 100,
  };
}

/**
 * Resolves the IPC index value for a date string using CER daily interpolation.
 */
export async function getIPCIndex(dateStr: string): Promise<number> {
  return getCERIndexForDate(dateStr);
}

/**
 * Resolves the CCL FX rate for a date string with weekend fallback.
 */
export async function getCCLRate(dateStr: string): Promise<number> {
  const fxRecord = await getFxRatesForDate(dateStr);
  return fxRecord.ccl_rate;
}

/**
 * Asynchronous entry point for computing 3-column real returns for a single amount/date interval.
 * Option parameters allow injecting mock/pre-fetched rates for deterministic testing.
 */
export async function calculateRealReturns(
  params: CalculateRealReturnParams,
  options?: RealReturnOptions
): Promise<RealReturnColumns> {
  const { amountARS, startDate, endDate } = params;

  if (amountARS === 0) {
    return { nominalARS: 0, realVsIPC: 0, usdVsCCL: 0 };
  }

  // Resolve rates with optional override support
  const ipcStart = options?.ipcStart ?? (await getIPCIndex(startDate));
  const ipcEnd =
    options?.ipcEnd ??
    (startDate === endDate ? ipcStart : await getIPCIndex(endDate));
  const cclRate = options?.cclRate ?? (await getCCLRate(endDate));

  return calculateRealReturnsCore(
    amountARS,
    ipcStart,
    ipcEnd,
    cclRate,
    options?.deflateDirection ?? "to_end_date"
  );
}

/**
 * Batch computing 3-column real returns for multiple cashflows / positions.
 */
export async function calculateRealReturnsBatch(
  items: CalculateRealReturnParams[],
  options?: RealReturnOptions
): Promise<RealReturnColumns[]> {
  return Promise.all(items.map((item) => calculateRealReturns(item, options)));
}
