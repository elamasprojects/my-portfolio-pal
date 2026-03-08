import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActivePortfolio } from "@/hooks/usePortfolio";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Loader2, Download, RotateCcw, X } from "lucide-react";
import confetti from "canvas-confetti";

// --- CSV Parser ---
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = lines[0].includes(";") ? ";" : ",";

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === delimiter) {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

// --- Column alias map ---
type TargetField = "symbol" | "asset_name" | "trade_type" | "quantity" | "price_per_unit" | "trade_date" | "asset_type" | "notes" | "skip";

const TARGET_FIELDS: { value: TargetField; label: string; required: boolean }[] = [
  { value: "symbol", label: "Symbol / Ticker", required: true },
  { value: "asset_name", label: "Asset Name", required: true },
  { value: "trade_type", label: "Trade Type (Buy/Sell)", required: true },
  { value: "quantity", label: "Quantity / Shares", required: true },
  { value: "price_per_unit", label: "Price per Unit", required: true },
  { value: "trade_date", label: "Trade Date", required: false },
  { value: "asset_type", label: "Asset Type", required: false },
  { value: "notes", label: "Notes", required: false },
  { value: "skip", label: "— Skip Column —", required: false },
];

const ALIASES: Record<string, TargetField> = {
  symbol: "symbol", ticker: "symbol", stock: "symbol", asset: "symbol", coin: "symbol",
  name: "asset_name", asset_name: "asset_name", company: "asset_name",
  type: "trade_type", trade_type: "trade_type", side: "trade_type", action: "trade_type", "buy/sell": "trade_type", direction: "trade_type",
  quantity: "quantity", qty: "quantity", shares: "quantity", units: "quantity", size: "quantity",
  price: "price_per_unit", price_per_unit: "price_per_unit", cost: "price_per_unit", entry: "price_per_unit", unit_price: "price_per_unit",
  date: "trade_date", trade_date: "trade_date", time: "trade_date", timestamp: "trade_date", executed: "trade_date",
  asset_type: "asset_type", category: "asset_type", class: "asset_type", instrument: "asset_type",
  notes: "notes", comment: "notes", memo: "notes",
};

function autoMapHeaders(headers: string[]): Record<number, TargetField> {
  const mapping: Record<number, TargetField> = {};
  const used = new Set<TargetField>();
  headers.forEach((h, i) => {
    const normalized = h.toLowerCase().replace(/[^a-z0-9/]/g, "");
    for (const [alias, target] of Object.entries(ALIASES)) {
      if (normalized === alias.replace(/[^a-z0-9/]/g, "") && !used.has(target)) {
        mapping[i] = target;
        used.add(target);
        break;
      }
    }
    if (!mapping[i]) mapping[i] = "skip";
  });
  return mapping;
}

// --- Validation ---
const VALID_TRADE_TYPES = ["buy", "sell"];
const VALID_ASSET_TYPES = ["stock", "etf", "crypto", "bond", "other"];

interface RowError { row: number; field: string; message: string; }

function validateRows(rows: string[][], mapping: Record<number, TargetField>): { valid: Record<string, string>[]; errors: RowError[] } {
  const valid: Record<string, string>[] = [];
  const errors: RowError[] = [];
  const fieldIndices: Partial<Record<TargetField, number>> = {};
  Object.entries(mapping).forEach(([i, f]) => { if (f !== "skip") fieldIndices[f] = Number(i); });

  rows.forEach((row, ri) => {
    const rowErrors: RowError[] = [];
    const mapped: Record<string, string> = {};

    // Symbol
    const symbolIdx = fieldIndices.symbol;
    const symbol = symbolIdx !== undefined ? row[symbolIdx]?.trim() : "";
    if (!symbol) rowErrors.push({ row: ri, field: "symbol", message: "Symbol is required" });
    mapped.symbol = symbol?.toUpperCase() || "";

    // Asset name
    const nameIdx = fieldIndices.asset_name;
    mapped.asset_name = nameIdx !== undefined ? row[nameIdx]?.trim() || mapped.symbol : mapped.symbol;

    // Trade type
    const ttIdx = fieldIndices.trade_type;
    const rawTT = ttIdx !== undefined ? row[ttIdx]?.trim().toLowerCase() : "buy";
    mapped.trade_type = VALID_TRADE_TYPES.includes(rawTT) ? rawTT : "";
    if (!mapped.trade_type) {
      if (rawTT === "compra" || rawTT === "long") mapped.trade_type = "buy";
      else if (rawTT === "venta" || rawTT === "short") mapped.trade_type = "sell";
      else rowErrors.push({ row: ri, field: "trade_type", message: `Invalid trade type: "${rawTT}"` });
    }

    // Quantity
    const qIdx = fieldIndices.quantity;
    const rawQ = qIdx !== undefined ? row[qIdx]?.trim().replace(/,/g, "") : "";
    const qty = parseFloat(rawQ);
    if (isNaN(qty) || qty <= 0) rowErrors.push({ row: ri, field: "quantity", message: "Quantity must be a positive number" });
    mapped.quantity = String(qty || 0);

    // Price
    const pIdx = fieldIndices.price_per_unit;
    const rawP = pIdx !== undefined ? row[pIdx]?.trim().replace(/[$€,]/g, "") : "";
    const price = parseFloat(rawP);
    if (isNaN(price) || price < 0) rowErrors.push({ row: ri, field: "price_per_unit", message: "Price must be a valid number" });
    mapped.price_per_unit = String(price || 0);

    // Date
    const dIdx = fieldIndices.trade_date;
    if (dIdx !== undefined && row[dIdx]?.trim()) {
      const d = new Date(row[dIdx].trim());
      mapped.trade_date = isNaN(d.getTime()) ? "" : d.toISOString();
      if (!mapped.trade_date) rowErrors.push({ row: ri, field: "trade_date", message: "Invalid date format" });
    } else {
      mapped.trade_date = new Date().toISOString();
    }

    // Asset type
    const atIdx = fieldIndices.asset_type;
    const rawAT = atIdx !== undefined ? row[atIdx]?.trim().toLowerCase() : "stock";
    mapped.asset_type = VALID_ASSET_TYPES.includes(rawAT) ? rawAT : "stock";

    // Notes
    const nIdx = fieldIndices.notes;
    mapped.notes = nIdx !== undefined ? row[nIdx]?.trim() || "" : "";

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      valid.push(mapped);
    }
  });
  return { valid, errors };
}

// --- Template CSV ---
const TEMPLATE_CSV = `Symbol,Asset Name,Trade Type,Quantity,Price,Date,Asset Type,Notes
AAPL,Apple Inc,buy,10,150.50,2024-01-15,stock,First purchase
MSFT,Microsoft Corp,buy,5,380.25,2024-02-01,stock,
BTC,Bitcoin,buy,0.5,42000,2024-03-10,crypto,DCA
TSLA,Tesla Inc,sell,3,245.00,2024-04-05,stock,Taking profits`;

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "trade_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// --- Component ---
const ImportTrades = () => {
  const { user } = useAuth();
  const { data: portfolio } = useDefaultPortfolio();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, TargetField>>({});
  const [validRows, setValidRows] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [done, setDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a .csv file");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      if (h.length === 0) {
        toast.error("Could not parse CSV — file appears empty");
        return;
      }
      setHeaders(h);
      setRows(r);
      setMapping(autoMapHeaders(h));
      setStep(2);
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const updateMapping = (colIdx: number, target: TargetField) => {
    setMapping((prev) => ({ ...prev, [colIdx]: target }));
  };

  const runValidation = () => {
    const { valid, errors: errs } = validateRows(rows, mapping);
    setValidRows(valid);
    setErrors(errs);
    setStep(3);
  };

  const doImport = async () => {
    if (!user || !portfolio) return;
    setImporting(true);
    let inserted = 0;
    const chunkSize = 50;

    try {
      for (let i = 0; i < validRows.length; i += chunkSize) {
        const chunk = validRows.slice(i, i + chunkSize).map((r) => ({
          user_id: user.id,
          portfolio_id: portfolio.id,
          symbol: r.symbol,
          asset_name: r.asset_name,
          trade_type: r.trade_type as "buy" | "sell",
          quantity: parseFloat(r.quantity),
          price_per_unit: parseFloat(r.price_per_unit),
          total_amount: parseFloat(r.quantity) * parseFloat(r.price_per_unit),
          trade_date: r.trade_date,
          asset_type: r.asset_type as "stock" | "etf" | "crypto" | "bond" | "other",
          notes: r.notes || null,
        }));
        const { error } = await supabase.from("trades").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }

      setImportedCount(inserted);
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["trades"] });

      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.5 } }), 300);
    } catch (err: any) {
      toast.error("Import failed: " + (err.message || "Unknown error"));
    } finally {
      setImporting(false);
    }
  };

  const resetAll = () => {
    setStep(1);
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setValidRows([]);
    setErrors([]);
    setImportedCount(0);
    setDone(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const requiredMapped = (["symbol", "quantity", "price_per_unit"] as TargetField[]).every(
    (f) => Object.values(mapping).includes(f)
  );

  const errorRowIndices = new Set(errors.map((e) => e.row));

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          Import Trades
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV exported from Excel or Google Sheets
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { n: 1, label: "Upload" },
          { n: 2, label: "Map & Review" },
          { n: 3, label: done ? "Done!" : "Confirm" },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 transition-colors ${
                step >= s.n
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {done && s.n === 3 ? <CheckCircle2 className="h-4 w-4" /> : s.n}
            </div>
            <span className={`text-sm font-medium hidden sm:inline ${step >= s.n ? "text-foreground" : "text-muted-foreground"}`}>
              {s.label}
            </span>
            {i < 2 && <div className={`flex-1 h-0.5 ${step > s.n ? "bg-primary" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card>
          <CardContent className="pt-6">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground mb-1">
                Drag & drop your CSV file here
              </p>
              <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
              <Badge variant="outline" className="text-xs">.csv files only</Badge>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={onFileChange}
                className="hidden"
              />
            </div>

            <Separator className="my-6" />

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Not sure about the format?
              </p>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" />
                Download Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Map & Review */}
      {step === 2 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Map Columns — {fileName}</span>
              <Badge variant="secondary">{rows.length} rows detected</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mapping selects */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {headers.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-28 truncate shrink-0" title={h}>
                    {h}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <Select value={mapping[i] || "skip"} onValueChange={(v) => updateMapping(i, v as TargetField)}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value} className="text-xs">
                          {f.label} {f.required && "•"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {!requiredMapped && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Map at least: Symbol, Quantity, and Price per Unit
              </div>
            )}

            {/* Preview table */}
            <p className="text-xs text-muted-foreground mb-2">Preview (first 5 rows):</p>
            <div className="rounded-lg border overflow-hidden mb-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map((h, i) => (
                      <TableHead key={i} className="text-xs px-2 py-1">
                        <span className="block text-muted-foreground">{h}</span>
                        <span className="block text-primary text-[10px]">
                          {mapping[i] === "skip" ? "—" : TARGET_FIELDS.find((f) => f.value === mapping[i])?.label}
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 5).map((row, ri) => (
                    <TableRow key={ri}>
                      {row.map((cell, ci) => (
                        <TableCell key={ci} className="text-xs px-2 py-1.5 font-mono">
                          {cell || <span className="text-muted-foreground italic">empty</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={resetAll}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={runValidation} disabled={!requiredMapped}>
                Validate & Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm / Done */}
      {step === 3 && !done && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Review Import</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold text-gain">{validRows.length}</p>
                <p className="text-sm text-muted-foreground">Valid trades</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold text-loss">{errors.length > 0 ? new Set(errors.map((e) => e.row)).size : 0}</p>
                <p className="text-sm text-muted-foreground">Rows with errors (skipped)</p>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-medium text-foreground mb-2">Errors found:</p>
                <div className="max-h-40 overflow-y-auto rounded-lg border p-3 space-y-1">
                  {errors.slice(0, 20).map((e, i) => (
                    <p key={i} className="text-xs text-destructive">
                      Row {e.row + 1}: {e.field} — {e.message}
                    </p>
                  ))}
                  {errors.length > 20 && (
                    <p className="text-xs text-muted-foreground">...and {errors.length - 20} more</p>
                  )}
                </div>
              </div>
            )}

            {validRows.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground mb-2">Preview of valid trades:</p>
                <div className="rounded-lg border overflow-hidden mb-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs px-2">Symbol</TableHead>
                        <TableHead className="text-xs px-2">Type</TableHead>
                        <TableHead className="text-xs px-2">Qty</TableHead>
                        <TableHead className="text-xs px-2">Price</TableHead>
                        <TableHead className="text-xs px-2">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validRows.slice(0, 8).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs px-2 font-mono font-semibold">{r.symbol}</TableCell>
                          <TableCell className="text-xs px-2">
                            <Badge variant={r.trade_type === "buy" ? "default" : "destructive"} className="text-[10px]">
                              {r.trade_type.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs px-2 font-mono">{parseFloat(r.quantity).toFixed(2)}</TableCell>
                          <TableCell className="text-xs px-2 font-mono">${parseFloat(r.price_per_unit).toFixed(2)}</TableCell>
                          <TableCell className="text-xs px-2 font-mono">
                            ${(parseFloat(r.quantity) * parseFloat(r.price_per_unit)).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {validRows.length > 8 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      ...and {validRows.length - 8} more trades
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={doImport} disabled={validRows.length === 0 || importing}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" /> Importing...
                  </>
                ) : (
                  <>
                    Import {validRows.length} Trades <CheckCircle2 className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Done */}
      {step === 3 && done && (
        <Card className="border-gain/30">
          <CardContent className="pt-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gain/10 mb-4">
              <CheckCircle2 className="h-8 w-8 text-gain" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Import Complete!</h2>
            <p className="text-muted-foreground mb-6">
              Successfully imported <span className="font-semibold text-gain">{importedCount}</span> trades into your portfolio.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={resetAll}>
                <RotateCcw className="h-4 w-4 mr-1" /> Import More
              </Button>
              <Button onClick={() => window.location.href = "/trades"}>
                View Trade Log <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportTrades;
