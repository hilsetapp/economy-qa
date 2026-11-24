import type { Activity, Currency, EconomyModel, Exchange } from "./types.js";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell.length === 0) quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(v => v.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  row.push(cell); if (row.some(v => v.trim() !== "")) rows.push(row);
  return rows;
}

const num = (value: string | undefined, fallback?: number): number | undefined => {
  if (value === undefined || value.trim() === "") return fallback;
  const result = Number(value); if (!Number.isFinite(result)) throw new Error(`Expected a number, got '${value}'.`); return result;
};
const splitAmounts = (value: string | undefined): { currency: string; amount: number }[] => {
  if (!value?.trim()) return [];
  return value.split(";").map(part => {
    const [currency, raw, extra] = part.split(":");
    if (!currency || raw === undefined || extra !== undefined) throw new Error(`Bad amount '${part}'. Use currency:amount;currency:amount.`);
    const amount = Number(raw); if (!Number.isFinite(amount)) throw new Error(`Bad amount '${part}'.`);
    return { currency, amount };
  });
};

/** Import the documented long-form economy.csv format, preserving one-based CSV row provenance. */
export function importCsv(text: string, file = "<csv>"): EconomyModel {
  const rows = parseCsv(text); if (rows.length < 2) throw new Error("CSV requires a header and at least one data row.");
  const headers = rows[0]!.map(h => h.trim());
  if (new Set(headers).size !== headers.length) throw new Error("CSV has duplicate column names.");
  const required = ["kind", "id", "label"];
  for (const name of required) if (!headers.includes(name)) throw new Error(`CSV is missing required '${name}' column.`);
  const records = rows.slice(1).map((cells, index) => {
    if (cells.length > headers.length) throw new Error(`CSV row ${index + 2} has more values than the header.`);
    const row = Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()]));
    row.sourceRow = String(index + 2); return row;
  });
  const currencies: Currency[] = []; const activities: Activity[] = []; const exchanges: Exchange[] = [];
  let name = "Imported economy"; const profileRows: typeof records = []; const contractRows: typeof records = [];
  for (const r of records) {
    const source = { file, row: Number(r.sourceRow) };
    switch (r.kind) {
      case "meta": if (r.id === "name") name = r.label ?? ""; else throw new Error(`Row ${r.sourceRow}: unsupported meta id '${r.id}'.`); break;
      case "currency": currencies.push({ id: r.id!, label: r.label!, startingBalance: num(r.startingBalance, 0), source }); break;
      case "activity": activities.push({ id: r.id!, label: r.label!, durationMinutes: num(r.durationMinutes) ?? NaN, cooldownMinutes: num(r.cooldownMinutes), costs: splitAmounts(r.costs), rewards: splitAmounts(r.rewards), successChance: num(r.successChance), source }); break;
      case "exchange": {
        const inputs = splitAmounts(r.costs); const outputs = splitAmounts(r.rewards);
        if (inputs.length !== 1 || outputs.length !== 1) throw new Error(`Row ${r.sourceRow}: exchange requires exactly one input and one output amount.`);
        exchanges.push({ id: r.id!, label: r.label!, input: inputs[0]!, output: outputs[0]!, repeatable: r.repeatable !== "false", source }); break;
      }
      case "profile": profileRows.push(r); break;
      case "contract": contractRows.push(r); break;
      default: throw new Error(`Row ${r.sourceRow}: kind must be meta, currency, activity, exchange, profile, or contract.`);
    }
  }
  const profiles = profileRows.map(r => ({
    id: r.id!, label: r.label!, sessionMinutes: num(r.sessionMinutes) ?? NaN, days: num(r.days) ?? NaN,
    sessionsPerDay: num(r.sessionsPerDay, 1), actionWeights: Object.fromEntries((r.actionWeights ?? "").split(";").filter(Boolean).map(part => {
      const [id, weight, extra] = part.split(":"); if (!id || weight === undefined || extra !== undefined) throw new Error(`Row ${r.sourceRow}: bad actionWeights; use activity:weight;activity:weight.`);
      const parsed = Number(weight); if (!Number.isFinite(parsed)) throw new Error(`Row ${r.sourceRow}: bad action weight '${weight}'.`); return [id, parsed];
    })), source: { file, row: Number(r.sourceRow) }
  }));
  const contracts = contractRows.map(r => {
    const common = { id: r.id!, profileId: r.profileId!, withinDays: num(r.withinDays) ?? NaN, minPassRate: num(r.minPassRate) ?? NaN, source: { file, row: Number(r.sourceRow) } };
    if (r.type === "milestone-reach") return { ...common, type: "milestone-reach" as const, currency: r.currency!, target: num(r.target) ?? NaN };
    if (r.type === "sink-affordability") return { ...common, type: "sink-affordability" as const, actionId: r.actionId! };
    if (r.type === "balance-range") return { ...common, type: "balance-range" as const, currency: r.currency!, min: num(r.min) ?? NaN, max: num(r.max) ?? NaN };
    throw new Error(`Row ${r.sourceRow}: unsupported contract type '${r.type}'.`);
  });
  return { schemaVersion: 1, name, currencies, activities, exchanges, profiles, contracts };
}
