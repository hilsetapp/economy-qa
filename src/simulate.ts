import type { Activity, Contract, EconomyModel, PlayerProfile, RunOptions, RunResult } from "./types.js";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b); if (!sorted.length) return 0;
  const at = (sorted.length - 1) * p; const lo = Math.floor(at); const hi = Math.ceil(at);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo);
};
interface InternalRun { balances: Record<string, number>; activityCounts: Record<string, number>; affordable: Record<string, boolean>; firstReachDay: Record<string, number | null>; sources: Record<string, number>; sinks: Record<string, number>; rangePass: Record<string, boolean>; }

function simulateOne(model: EconomyModel, profile: PlayerProfile, seed: number, contracts: Contract[]): InternalRun {
  const random = mulberry32(seed);
  const balances = Object.fromEntries(model.currencies.map(c => [c.id, c.startingBalance ?? 0]));
  const activityCounts = Object.fromEntries(model.activities.map(a => [a.id, 0]));
  const sources: Record<string, number> = {}; const sinks: Record<string, number> = {};
  const affordable: Record<string, boolean> = Object.fromEntries(contracts.filter(c => c.type === "sink-affordability").map(c => [c.id, false]));
  const firstReachDay: Record<string, number | null> = Object.fromEntries(contracts.filter(c => c.type === "milestone-reach").map(c => [c.id, null]));
  const rangePass: Record<string, boolean> = Object.fromEntries(contracts.filter(c => c.type === "balance-range").map(c => [c.id, false]));
  const eligible = model.activities.filter(a => (profile.actionWeights[a.id] ?? 0) > 0);
  const lastUsed = new Map<string, number>();
  let absoluteMinute = 0;
  const sessionsPerDay = profile.sessionsPerDay ?? 1;
  const horizon = Math.max(...contracts.filter(c => c.profileId === profile.id).map(c => c.withinDays), profile.days);
  for (let day = 1; day <= horizon; day++) {
    for (let session = 0; session < sessionsPerDay; session++) {
      let remaining = profile.sessionMinutes;
      let guard = 0;
      while (remaining > 0 && eligible.length && guard++ < 10000) {
        const available = eligible.filter(a => absoluteMinute - (lastUsed.get(a.id) ?? -Infinity) >= (a.cooldownMinutes ?? 0) && (a.costs ?? []).every(c => balances[c.currency]! >= c.amount));
        if (!available.length) break;
        const weightTotal = available.reduce((sum, a) => sum + profile.actionWeights[a.id]!, 0);
        let pick = random() * weightTotal; let action = available[available.length - 1]!;
        for (const candidate of available) { pick -= profile.actionWeights[candidate.id]!; if (pick < 0) { action = candidate; break; } }
        if (action.durationMinutes > remaining) break;
        applyActivity(action, balances, sources, sinks, random);
        remaining -= action.durationMinutes; absoluteMinute += action.durationMinutes; lastUsed.set(action.id, absoluteMinute); activityCounts[action.id] = activityCounts[action.id]! + 1;
      }
      absoluteMinute += remaining;
    }
    for (const contract of contracts) {
      if (contract.profileId !== profile.id || contract.withinDays < day) continue;
      if (contract.type === "sink-affordability") {
        const action = model.activities.find(a => a.id === contract.actionId)!;
        if ((action.costs ?? []).every(c => balances[c.currency]! >= c.amount)) affordable[contract.id] = true;
      } else if (contract.type === "milestone-reach" && firstReachDay[contract.id] === null && balances[contract.currency]! >= contract.target) firstReachDay[contract.id] = day;
      else if (contract.type === "balance-range" && contract.withinDays === day) rangePass[contract.id] = balances[contract.currency]! >= contract.min && balances[contract.currency]! <= contract.max;
    }
  }
  return { balances, activityCounts, affordable, firstReachDay, sources, sinks, rangePass };
}
function applyActivity(a: Activity, balances: Record<string, number>, sources: Record<string, number>, sinks: Record<string, number>, random: () => number) {
  for (const cost of a.costs ?? []) { balances[cost.currency] = balances[cost.currency]! - cost.amount; sinks[cost.currency] = (sinks[cost.currency] ?? 0) + cost.amount; }
  if (random() < (a.successChance ?? 1)) for (const reward of a.rewards ?? []) { balances[reward.currency] = balances[reward.currency]! + reward.amount; sources[reward.currency] = (sources[reward.currency] ?? 0) + reward.amount; }
}

export function simulate(model: EconomyModel, profileId: string, options: RunOptions = { runs: 1000, seed: 1 }): RunResult {
  if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 100_000) throw new Error("runs must be an integer between 1 and 100000.");
  if (!Number.isInteger(options.seed)) throw new Error("seed must be an integer.");
  const profile = model.profiles.find(p => p.id === profileId); if (!profile) throw new Error(`Unknown profile '${profileId}'.`);
  const contracts = (model.contracts ?? []).filter(c => c.profileId === profileId);
  const runs = Array.from({ length: options.runs }, (_, i) => simulateOne(model, profile, (options.seed + Math.imul(i, 0x9E3779B1)) >>> 0, contracts));
  const currencyStats: RunResult["currencyStats"] = {};
  for (const currency of model.currencies) {
    const values = runs.map(r => r.balances[currency.id]!);
    currencyStats[currency.id] = { p10: percentile(values, .1), median: percentile(values, .5), p90: percentile(values, .9), mean: values.reduce((a, b) => a + b, 0) / values.length, min: values.reduce((a, b) => Math.min(a, b), Infinity), max: values.reduce((a, b) => Math.max(a, b), -Infinity) };
  }
  const activityCounts: RunResult["activityCounts"] = {};
  for (const activity of model.activities) { const counts = runs.map(r => r.activityCounts[activity.id]!); activityCounts[activity.id] = { mean: counts.reduce((a, b) => a + b, 0) / runs.length, total: counts.reduce((a, b) => a + b, 0) }; }
  const affordabilityRates: Record<string, number> = {};
  for (const c of contracts.filter(c => c.type === "sink-affordability")) affordabilityRates[c.id] = runs.filter(r => r.affordable[c.id]).length / runs.length;
  const rangePassRates: Record<string, number> = {};
  for (const c of contracts.filter(c => c.type === "balance-range")) rangePassRates[c.id] = runs.filter(r => r.rangePass[c.id]).length / runs.length;
  const milestoneDays: RunResult["milestoneDays"] = {};
  for (const c of contracts.filter(c => c.type === "milestone-reach")) { const reached = runs.map(r => r.firstReachDay[c.id]).filter((d): d is number => d !== null); milestoneDays[c.id] = { median: reached.length ? percentile(reached, .5) : null, passRate: reached.length / runs.length }; }
  const sumBy = (key: "sources" | "sinks") => Object.fromEntries(model.currencies.map(c => [c.id, runs.reduce((sum, r) => sum + (r[key][c.id] ?? 0), 0) / runs.length]));
  return { profileId, runs: options.runs, seed: options.seed, days: profile.days, currencyStats, activityCounts, affordabilityRates, rangePassRates, milestoneDays, sourceTotals: sumBy("sources"), sinkTotals: sumBy("sinks") };
}
