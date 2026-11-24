import type { Contract, Diagnostic, EconomyModel, RunResult } from "./types.js";

/** Detect a repeatable exchange cycle whose product of output/input rates exceeds one. */
export function findProfitableExchangeCycle(model: EconomyModel): { cycle: string[]; multiplier: number } | undefined {
  const exchanges = (model.exchanges ?? []).filter(e => e.repeatable !== false && e.input.amount > 0 && e.output.amount > 0);
  const ids = model.currencies.map(c => c.id); const dist = Object.fromEntries(ids.map(id => [id, 0]));
  const predecessor = new Map<string, { from: string; exchangeId: string }>(); let updated: string | undefined;
  for (let pass = 0; pass < ids.length; pass++) {
    updated = undefined;
    for (const e of exchanges) {
      const rate = Math.log(e.output.amount / e.input.amount);
      if (dist[e.output.currency]! < dist[e.input.currency]! + rate - 1e-12) {
        dist[e.output.currency] = dist[e.input.currency]! + rate;
        predecessor.set(e.output.currency, { from: e.input.currency, exchangeId: e.id }); updated = e.output.currency;
      }
    }
    if (!updated) return undefined;
  }
  let node = updated!;
  for (let i = 0; i < ids.length; i++) { const prev = predecessor.get(node); if (!prev) return undefined; node = prev.from; }
  const start = node; const cycle: string[] = []; let product = 1; let guard = 0;
  do {
    const prev = predecessor.get(node); if (!prev || guard++ > ids.length + 1) return undefined;
    cycle.push(prev.exchangeId);
    const e = exchanges.find(item => item.id === prev.exchangeId)!; product *= e.output.amount / e.input.amount;
    node = prev.from;
  } while (node !== start);
  return { cycle: cycle.reverse(), multiplier: product };
}

export function staticAnalysis(model: EconomyModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const cycle = findProfitableExchangeCycle(model);
  if (cycle) {
    const first = model.exchanges?.find(e => e.id === cycle.cycle[0]);
    diagnostics.push({ severity: "error", code: "PROFITABLE_EXCHANGE_CYCLE", message: `Repeatable exchanges contain a profitable cycle: ${cycle.cycle.join(" → ")}.`, entity: cycle.cycle.join(","), source: first?.source, evidence: { exchangeIds: cycle.cycle, grossMultiplier: Number(cycle.multiplier.toPrecision(8)), note: "Ignores fees, capacity limits, randomness, unlock conditions, and resource availability beyond the listed exchange edges." } });
  }
  for (const p of model.profiles) {
    const sum = Object.values(p.actionWeights).reduce((a, b) => a + b, 0);
    if (sum > 0) diagnostics.push({ severity: "info", code: "PROFILE_WEIGHTS_NORMALIZED", message: `Profile '${p.id}' weights are selection weights, not probabilities; normalized total is ${sum}.`, entity: p.id, source: p.source });
  }
  return diagnostics;
}

export function evaluateContracts(model: EconomyModel, results: Map<string, RunResult>): { contract: Contract; status: "pass" | "fail"; actual: number; expected: string; evidence: string }[] {
  return (model.contracts ?? []).map(contract => {
    const result = results.get(contract.profileId);
    if (!result) throw new Error(`No simulation result for contract profile '${contract.profileId}'.`);
    let actual = 0; let expected = `>= ${(contract.minPassRate * 100).toFixed(1)}% pass rate`; let evidence = "";
    if (contract.type === "milestone-reach") {
      actual = result.milestoneDays[contract.id]?.passRate ?? 0;
      const median = result.milestoneDays[contract.id]?.median;
      evidence = median === null || median === undefined ? `Target ${contract.target} ${contract.currency} was not reached in any run by day ${contract.withinDays}.` : `Median first-reach day: ${median.toFixed(1)}; window: ${contract.withinDays} days.`;
    } else if (contract.type === "sink-affordability") {
      actual = result.affordabilityRates[contract.id] ?? 0;
      evidence = `Affordability checked at the end of each simulated day through day ${contract.withinDays}.`;
    } else {
      actual = result.rangePassRates[contract.id] ?? 0;
      evidence = `Final-day balance must fall within [${contract.min}, ${contract.max}] ${contract.currency} on day ${contract.withinDays}.`;
    }
    return { contract, status: actual + 1e-12 >= contract.minPassRate ? "pass" : "fail", actual, expected, evidence };
  });
}
