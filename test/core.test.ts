import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateModel } from "../src/validation.js";
import { simulate } from "../src/simulate.js";
import { findProfitableExchangeCycle, staticAnalysis, evaluateContracts } from "../src/analyze.js";
import { importCsv, parseCsv } from "../src/csv.js";
import type { EconomyModel } from "../src/types.js";

const fixture = async (name: string) => JSON.parse(await readFile(new URL(`../examples/${name}`, import.meta.url), "utf8")) as EconomyModel;

test("both audience examples validate and carry separate workflows", async () => {
  for (const name of ["rp-server.json", "indie-rpg.json"]) {
    const result = validateModel(await fixture(name));
    assert.ok(result.model, `${name}: ${JSON.stringify(result.diagnostics)}`);
  }
});

test("validation catches globally duplicate IDs and invalid references", async () => {
  const model = await fixture("rp-server.json");
  model.activities[0]!.id = model.currencies[0]!.id;
  model.profiles[0]!.actionWeights.not_a_real_activity = 1;
  const result = validateModel(model);
  assert.equal(result.model, undefined);
  assert.ok(result.diagnostics.some(d => d.code === "DUPLICATE_ID"));
  assert.ok(result.diagnostics.some(d => d.code === "UNKNOWN_ACTIVITY"));
});

test("seeded simulation is repeatable and different seeds can produce different outcomes", async () => {
  const model = await fixture("indie-rpg.json");
  const a = simulate(model, "story-player", { runs: 500, seed: 77 });
  const b = simulate(model, "story-player", { runs: 500, seed: 77 });
  const c = simulate(model, "story-player", { runs: 500, seed: 78 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.currencyStats, c.currencyStats);
  assert.ok(a.currencyStats.gold!.p10 <= a.currencyStats.gold!.median);
  assert.ok(a.currencyStats.gold!.median <= a.currencyStats.gold!.p90);
});

test("contracts return measured pass rates with repeatable results", async () => {
  const model = await fixture("rp-server.json");
  const result = simulate(model, "casual", { runs: 400, seed: 3 });
  const regular = simulate(model, "regular", { runs: 400, seed: 3 });
  const evaluation = evaluateContracts(model, new Map([["casual", result], ["regular", regular]]));
  const rent = evaluation.find(c => c.contract.id === "casual-rent-affordable")!;
  assert.ok(rent.actual >= 0 && rent.actual <= 1);
  assert.ok(["pass", "fail"].includes(rent.status));
  assert.equal(result.rangePassRates["casual-currency-window"] !== undefined, true);
});

test("static analyzer detects a profitable repeatable exchange cycle", async () => {
  const model = await fixture("profitable-cycle.json");
  const cycle = findProfitableExchangeCycle(model);
  assert.ok(cycle);
  assert.ok(cycle.multiplier > 1);
  assert.ok(cycle.cycle.includes("shards-to-dust"));
  assert.ok(staticAnalysis(model).some(d => d.code === "PROFITABLE_EXCHANGE_CYCLE" && d.severity === "error"));
});

test("non-repeatable exchanges are excluded from the cycle warning", async () => {
  const model = await fixture("profitable-cycle.json");
  model.exchanges![1]!.repeatable = false;
  assert.equal(findProfitableExchangeCycle(model), undefined);
});

test("CSV parser handles quoted commas, escaped quotes, and CRLF", () => {
  assert.deepEqual(parseCsv('name,note\r\n"Ash, Vale","said ""hi"""\r\n'), [["name", "note"], ["Ash, Vale", 'said "hi"']]);
});

test("CSV importer retains source row and validates its contract model", () => {
  const text = [
    "kind,id,label,startingBalance,durationMinutes,costs,rewards,sessionMinutes,days,actionWeights,type,profileId,actionId,withinDays,minPassRate",
    "meta,name,Test economy",
    "currency,gold,Gold,0",
    "activity,job,Work,,10,,gold:5",
    "profile,casual,Casual,,,,,30,2,job:1",
    "contract,sink-check,Can pay,,,,,,,,sink-affordability,casual,job,2,0.5"
  ].join("\n");
  const model = importCsv(text, "economy.csv");
  const checked = validateModel(model);
  assert.ok(checked.model, JSON.stringify(checked.diagnostics));
  assert.equal(model.activities[0]!.source?.row, 4);
  assert.equal(model.contracts?.[0]?.source?.row, 6);
});


test("malformed untrusted structures return diagnostics instead of throwing", () => {
  const result = validateModel({ schemaVersion: 1, name: "bad", currencies: [{ id: "gold", label: 7 }], activities: [{ id: "work", label: "Work", durationMinutes: 1, costs: {} }], profiles: [{ id: "p", label: "P", sessionMinutes: 10, days: 1, actionWeights: null }], contracts: [] });
  assert.equal(result.model, undefined);
  assert.ok(result.diagnostics.some(d => d.code === "MISSING_LABEL"));
  assert.ok(result.diagnostics.some(d => d.code === "INVALID_AMOUNTS"));
  assert.ok(result.diagnostics.some(d => d.code === "INVALID_ACTION_WEIGHTS"));
});
