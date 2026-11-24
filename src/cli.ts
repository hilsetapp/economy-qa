#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { findProfitableExchangeCycle, staticAnalysis, evaluateContracts } from "./analyze.js";
import { loadModel, ModelValidationError } from "./io.js";
import { renderHtmlReport, compareRuns } from "./report.js";
import { simulate } from "./simulate.js";
import { validateModel } from "./validation.js";
import type { EconomyModel, RunResult } from "./types.js";

const VERSION = "0.1.0";
const help = `Economy QA ${VERSION} — local-first game economy balance checks

Usage:
  economy-qa validate <model.json|economy.csv>
  economy-qa simulate <model> --profile <id> [--runs 1000] [--seed 1] [--out result.json]
  economy-qa check <model> [--runs 1000] [--seed 1] [--out report.json]
  economy-qa report <model> [--runs 1000] [--seed 1] --out report.html
  economy-qa diff <before> <after> --profile <id> [--runs 1000] [--seed 1]

Inputs remain on this machine. Simulation results depend on explicit model assumptions;
passing checks are not a balance verdict or a prediction of real players.
`;
type Args = { positional: string[]; flags: Record<string, string | boolean> };
function parseArgs(values: string[]): Args {
  const positional: string[] = []; const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < values.length; i++) {
    const arg = values[i]!;
    if (!arg.startsWith("--")) { positional.push(arg); continue; }
    const name = arg.slice(2); const next = values[i + 1];
    if (next && !next.startsWith("--")) { flags[name] = next; i++; } else flags[name] = true;
  }
  return { positional, flags };
}
const intFlag = (flags: Args["flags"], name: string, fallback: number) => {
  const value = flags[name] === undefined ? fallback : Number(flags[name]);
  if (!Number.isInteger(value)) throw new Error(`--${name} must be an integer.`); return value;
};
function resultsFor(model: EconomyModel, runs: number, seed: number) {
  const results = new Map<string, RunResult>();
  for (const p of model.profiles) results.set(p.id, simulate(model, p.id, { runs, seed }));
  return results;
}
function flatten(value: unknown, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>).filter(([key]) => key !== "source").sort(([a], [b]) => a.localeCompare(b));
    if (!entries.length && prefix) out[prefix] = {};
    for (const [key, child] of entries) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else if (Array.isArray(value)) {
    if (!value.length) out[prefix] = [];
    else value.forEach((child, index) => flatten(child, `${prefix}[${index}]`, out));
  } else if (prefix) out[prefix] = value;
  return out;
}
function changedInputs(before: EconomyModel, after: EconomyModel) {
  const changed: { entityId: string; field: string; before: unknown; after: unknown }[] = [];
  if (before.name !== after.name) changed.push({ entityId: "$model", field: "name", before: before.name, after: after.name });
  for (const key of ["currencies", "activities", "exchanges", "profiles", "contracts"] as const) {
    const a = new Map((before[key] ?? []).map((v: any) => [v.id, v]));
    const b = new Map((after[key] ?? []).map((v: any) => [v.id, v]));
    for (const id of [...new Set([...a.keys(), ...b.keys()])].sort()) {
      const left = flatten(a.get(id)); const right = flatten(b.get(id));
      for (const field of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
        if (JSON.stringify(left[field]) !== JSON.stringify(right[field])) changed.push({ entityId: String(id), field, before: field in left ? left[field] : "<missing>", after: field in right ? right[field] : "<missing>" });
      }
    }
  }
  return changed;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help" || command === "-h") { console.log(help); return; }
  if (command === "--version" || command === "-V") { console.log(VERSION); return; }
  const { positional, flags } = parseArgs(rest);
  if (command === "validate") {
    if (!positional[0]) throw new Error("Usage: economy-qa validate <model.json|economy.csv>");
    const model = await loadModel(positional[0]); const diagnostics = staticAnalysis(model);
    console.log(JSON.stringify({ valid: true, name: model.name, diagnostics }, null, 2));
    if (diagnostics.some(d => d.severity === "error")) process.exitCode = 1;
    return;
  }
  if (command === "simulate") {
    if (!positional[0] || typeof flags.profile !== "string") throw new Error("Usage: economy-qa simulate <model> --profile <id> [--runs N] [--seed N] [--out file]");
    const model = await loadModel(positional[0]); const result = simulate(model, flags.profile, { runs: intFlag(flags, "runs", 1000), seed: intFlag(flags, "seed", 1) });
    const output = JSON.stringify({ model: model.name, assumptions: model.profiles.find(p => p.id === flags.profile), result }, null, 2);
    if (typeof flags.out === "string") await writeFile(resolve(flags.out), output + "\n"); else console.log(output);
    return;
  }
  if (command === "check" || command === "report") {
    if (!positional[0]) throw new Error(`Usage: economy-qa ${command} <model> [--runs N] [--seed N]${command === "report" ? " --out report.html" : ""}`);
    const model = await loadModel(positional[0]); const runs = intFlag(flags, "runs", 1000); const seed = intFlag(flags, "seed", 1);
    const results = resultsFor(model, runs, seed); const diagnostics = staticAnalysis(model); const contractResults = evaluateContracts(model, results);
    if (command === "report") {
      if (typeof flags.out !== "string") throw new Error("report requires --out <file.html>");
      await writeFile(resolve(flags.out), renderHtmlReport(model, results, diagnostics)); console.log(`Wrote ${resolve(flags.out)}`);
    } else {
      const summary = { model: model.name, seed, runs, staticAnalysis: diagnostics, contracts: contractResults.map(c => ({ id: c.contract.id, type: c.contract.type, status: c.status, actualPassRate: c.actual, expected: c.expected, evidence: c.evidence })) };
      const output = JSON.stringify(summary, null, 2);
      if (typeof flags.out === "string") await writeFile(resolve(flags.out), output + "\n"); else console.log(output);
    }
    if (diagnostics.some(d => d.severity === "error") || contractResults.some(c => c.status === "fail")) process.exitCode = 1;
    return;
  }
  if (command === "diff") {
    if (positional.length < 2 || typeof flags.profile !== "string") throw new Error("Usage: economy-qa diff <before> <after> --profile <id> [--runs N] [--seed N]");
    const before = await loadModel(positional[0]!); const after = await loadModel(positional[1]!); const profileId = flags.profile;
    const options = { runs: intFlag(flags, "runs", 1000), seed: intFlag(flags, "seed", 1) };
    const left = simulate(before, profileId, options); const right = simulate(after, profileId, options);
    console.log(JSON.stringify({ before: before.name, after: after.name, profileId, changedInputs: changedInputs(before, after), comparison: compareRuns(left, right), caveat: "Seeded simulations compare modeled outcomes only; they do not establish causality or live player behavior." }, null, 2)); return;
  }
  throw new Error(`Unknown command '${command}'.\n\n${help}`);
}
main().catch(error => {
  if (error instanceof ModelValidationError) console.error(JSON.stringify({ valid: false, diagnostics: error.diagnostics }, null, 2));
  else console.error(`economy-qa: ${(error as Error).message}`);
  process.exitCode = 1;
});
