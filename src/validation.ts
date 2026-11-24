import type { Contract, Diagnostic, EconomyModel } from "./types.js";

const ID = /^[a-zA-Z][a-zA-Z0-9._-]*$/;
const finiteNonNegative = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

export function validateModel(value: unknown): { model?: EconomyModel; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { diagnostics: [{ severity: "error", code: "MODEL_NOT_OBJECT", message: "Model root must be a JSON object." }] };
  }
  const m = value as Partial<EconomyModel>;
  if (m.schemaVersion !== 1) diagnostics.push({ severity: "error", code: "UNSUPPORTED_SCHEMA", message: "schemaVersion must be 1." });
  if (typeof m.name !== "string" || !m.name.trim()) diagnostics.push({ severity: "error", code: "MISSING_NAME", message: "Model name is required." });
  for (const key of ["currencies", "activities", "profiles"] as const) {
    if (!Array.isArray(m[key])) diagnostics.push({ severity: "error", code: "MISSING_COLLECTION", message: `${key} must be an array.` });
  }
  if (diagnostics.some(d => d.severity === "error")) return { diagnostics };
  if (m.exchanges !== undefined && !Array.isArray(m.exchanges)) diagnostics.push({ severity: "error", code: "INVALID_COLLECTION", message: "exchanges must be an array when provided." });
  if (m.contracts !== undefined && !Array.isArray(m.contracts)) diagnostics.push({ severity: "error", code: "INVALID_COLLECTION", message: "contracts must be an array when provided." });
  if (diagnostics.some(d => d.severity === "error")) return { diagnostics };
  const currencies = m.currencies!; const activities = m.activities!; const profiles = m.profiles!;
  const ids = new Map<string, string>();
  const addId = (id: unknown, kind: string, entity: { source?: any }) => {
    if (typeof id !== "string" || !ID.test(id)) diagnostics.push({ severity: "error", code: "INVALID_ID", message: `Invalid ${kind} id: ${String(id)}. Use a letter followed by letters, digits, dot, underscore, or hyphen.`, entity: String(id), source: entity.source });
    else if (ids.has(id)) diagnostics.push({ severity: "error", code: "DUPLICATE_ID", message: `ID '${id}' is already used by ${ids.get(id)}. IDs are globally unique.`, entity: id, source: entity.source });
    else ids.set(id, kind);
  };
  currencies.forEach((c, i) => {
    if (!c || typeof c !== "object") { diagnostics.push({ severity: "error", code: "INVALID_CURRENCY", message: `currencies[${i}] must be an object.` }); return; }
    addId(c.id, "currency", c);
    if (typeof c.label !== "string" || !c.label.trim()) diagnostics.push({ severity: "error", code: "MISSING_LABEL", message: `Currency '${c.id}' needs a non-empty label.`, entity: String(c.id), source: c.source });
    if (c.startingBalance !== undefined && !finiteNonNegative(c.startingBalance)) diagnostics.push({ severity: "error", code: "INVALID_STARTING_BALANCE", message: "startingBalance must be a finite non-negative number.", entity: c.id, source: c.source });
  });
  const currencyIds = new Set(currencies.map(c => c?.id));
  const checkAmounts = (items: unknown, entityId: string, source?: any) => {
    if (items === undefined) return;
    if (!Array.isArray(items)) { diagnostics.push({ severity: "error", code: "INVALID_AMOUNTS", message: `Costs and rewards for '${entityId}' must be arrays.`, entity: entityId, source }); return; }
    const seen = new Set<string>();
    for (const item of items) {
      if (!item || typeof item !== "object") { diagnostics.push({ severity: "error", code: "INVALID_AMOUNT", message: `Amounts in '${entityId}' must be objects.`, entity: entityId, source }); continue; }
      if (!currencyIds.has(item.currency)) diagnostics.push({ severity: "error", code: "UNKNOWN_CURRENCY", message: `Unknown currency '${item?.currency}' in '${entityId}'.`, entity: entityId, source });
      if (!finiteNonNegative(item?.amount) || item.amount === 0) diagnostics.push({ severity: "error", code: "INVALID_AMOUNT", message: `Amounts in '${entityId}' must be finite and greater than zero.`, entity: entityId, source });
      if (seen.has(item.currency)) diagnostics.push({ severity: "error", code: "DUPLICATE_AMOUNT_CURRENCY", message: `Currency '${item.currency}' appears more than once in '${entityId}'.`, entity: entityId, source });
      seen.add(item?.currency);
    }
  };
  activities.forEach((a, i) => {
    if (!a || typeof a !== "object") { diagnostics.push({ severity: "error", code: "INVALID_ACTIVITY", message: `activities[${i}] must be an object.` }); return; }
    addId(a.id, "activity", a);
    if (typeof a.label !== "string" || !a.label.trim()) diagnostics.push({ severity: "error", code: "MISSING_LABEL", message: `Activity '${a.id}' needs a non-empty label.`, entity: String(a.id), source: a.source });
    if (!finiteNonNegative(a.durationMinutes) || a.durationMinutes === 0) diagnostics.push({ severity: "error", code: "INVALID_DURATION", message: "durationMinutes must be greater than zero.", entity: a.id, source: a.source });
    if (a.cooldownMinutes !== undefined && !finiteNonNegative(a.cooldownMinutes)) diagnostics.push({ severity: "error", code: "INVALID_COOLDOWN", message: "cooldownMinutes must be non-negative.", entity: a.id, source: a.source });
    if (a.successChance !== undefined && (typeof a.successChance !== "number" || a.successChance < 0 || a.successChance > 1)) diagnostics.push({ severity: "error", code: "INVALID_SUCCESS_CHANCE", message: "successChance must be between 0 and 1.", entity: a.id, source: a.source });
    checkAmounts(a.costs, a.id, a.source); checkAmounts(a.rewards, a.id, a.source);
    if (!(a.rewards?.length)) diagnostics.push({ severity: "warning", code: "NO_REWARD", message: `Activity '${a.id}' has no rewards; it may only be a sink or consume time.`, entity: a.id, source: a.source });
  });
  (m.exchanges ?? []).forEach((x, i) => {
    if (!x || typeof x !== "object") { diagnostics.push({ severity: "error", code: "INVALID_EXCHANGE", message: `exchanges[${i}] must be an object.` }); return; }
    addId(x.id, "exchange", x);
    if (typeof x.label !== "string" || !x.label.trim()) diagnostics.push({ severity: "error", code: "MISSING_LABEL", message: `Exchange '${x.id}' needs a non-empty label.`, entity: String(x.id), source: x.source });
    checkAmounts(x.input === undefined || x.output === undefined ? [] : [x.input, x.output], x.id, x.source);
    if (x.input === undefined || x.output === undefined) diagnostics.push({ severity: "error", code: "INVALID_EXCHANGE", message: `Exchange '${x.id}' needs input and output amounts.`, entity: String(x.id), source: x.source });
  });
  profiles.forEach((p, i) => {
    if (!p || typeof p !== "object") { diagnostics.push({ severity: "error", code: "INVALID_PROFILE", message: `profiles[${i}] must be an object.` }); return; }
    addId(p.id, "profile", p);
    if (typeof p.label !== "string" || !p.label.trim()) diagnostics.push({ severity: "error", code: "MISSING_LABEL", message: `Profile '${p.id}' needs a non-empty label.`, entity: String(p.id), source: p.source });
    if (!finiteNonNegative(p.sessionMinutes) || p.sessionMinutes === 0 || !Number.isInteger(p.sessionMinutes)) diagnostics.push({ severity: "error", code: "INVALID_SESSION", message: "sessionMinutes must be a positive integer.", entity: p.id, source: p.source });
    if (!finiteNonNegative(p.days) || p.days === 0 || !Number.isInteger(p.days)) diagnostics.push({ severity: "error", code: "INVALID_DAYS", message: "days must be a positive integer.", entity: p.id, source: p.source });
    if (p.sessionsPerDay !== undefined && (!Number.isInteger(p.sessionsPerDay) || p.sessionsPerDay <= 0)) diagnostics.push({ severity: "error", code: "INVALID_SESSIONS_PER_DAY", message: "sessionsPerDay must be a positive integer.", entity: p.id, source: p.source });
    if (!p.actionWeights || typeof p.actionWeights !== "object" || Array.isArray(p.actionWeights)) diagnostics.push({ severity: "error", code: "INVALID_ACTION_WEIGHTS", message: `Profile '${p.id}' actionWeights must be an object.`, entity: String(p.id), source: p.source });
    const validWeights = p.actionWeights && typeof p.actionWeights === "object" && !Array.isArray(p.actionWeights) ? p.actionWeights : {};
    const weightSum = Object.values(validWeights).reduce((sum: number, weight: unknown) => sum + (typeof weight === "number" ? weight : 0), 0);
    if (!Number.isFinite(weightSum)) diagnostics.push({ severity: "error", code: "ACTION_WEIGHT_SUM_OVERFLOW", message: `Profile '${p.id}' action weights sum to a non-finite value.`, entity: String(p.id), source: p.source });
    for (const [activityId, weight] of Object.entries(validWeights)) {
      if (!activities.some(a => a && typeof a === "object" && a.id === activityId)) diagnostics.push({ severity: "error", code: "UNKNOWN_ACTIVITY", message: `Profile '${p.id}' references unknown activity '${activityId}'.`, entity: p.id, source: p.source });
      if (!finiteNonNegative(weight) || weight === 0) diagnostics.push({ severity: "error", code: "INVALID_ACTION_WEIGHT", message: `Weight for '${activityId}' must be greater than zero.`, entity: p.id, source: p.source });
    }
    if (p.actionWeights && typeof p.actionWeights === "object" && !Array.isArray(p.actionWeights) && !Object.keys(p.actionWeights).length) diagnostics.push({ severity: "warning", code: "NO_ACTION_WEIGHTS", message: `Profile '${p.id}' has no activity preferences and will make no progress.`, entity: String(p.id), source: p.source });
  });
  const profileIds = new Set(profiles.map(p => p && typeof p === "object" ? p.id : undefined));
  const activityIds = new Set(activities.map(a => a && typeof a === "object" ? a.id : undefined));
  (m.contracts ?? []).forEach((c: Contract, i) => {
    if (!c || typeof c !== "object") { diagnostics.push({ severity: "error", code: "INVALID_CONTRACT", message: `contracts[${i}] must be an object.` }); return; }
    const rawContract = c as unknown as { id: string; type: string; source?: any };
    addId(c.id, "contract", c);
    if (!profileIds.has(c.profileId)) diagnostics.push({ severity: "error", code: "UNKNOWN_PROFILE", message: `Contract '${c.id}' references unknown profile '${c.profileId}'.`, entity: c.id, source: c.source });
    if (!Number.isInteger(c.withinDays) || c.withinDays < 1 || c.withinDays > (profiles.find(p => p && typeof p === "object" && p.id === c.profileId)?.days ?? 0)) diagnostics.push({ severity: "error", code: "INVALID_CONTRACT_WINDOW", message: `Contract '${c.id}' withinDays must be between 1 and the profile horizon.`, entity: c.id, source: c.source });
    if (typeof c.minPassRate !== "number" || c.minPassRate < 0 || c.minPassRate > 1) diagnostics.push({ severity: "error", code: "INVALID_PASS_RATE", message: `Contract '${c.id}' minPassRate must be between 0 and 1.`, entity: c.id, source: c.source });
    if (c.type === "milestone-reach" || c.type === "balance-range") {
      if (!currencyIds.has(c.currency)) diagnostics.push({ severity: "error", code: "UNKNOWN_CURRENCY", message: `Contract '${c.id}' references unknown currency '${c.currency}'.`, entity: c.id, source: c.source });
      if (c.type === "milestone-reach" && (!finiteNonNegative(c.target))) diagnostics.push({ severity: "error", code: "INVALID_CONTRACT_TARGET", message: `Contract '${c.id}' target must be non-negative.`, entity: c.id, source: c.source });
      if (c.type === "balance-range" && (!finiteNonNegative(c.min) || !finiteNonNegative(c.max) || c.min > c.max)) diagnostics.push({ severity: "error", code: "INVALID_CONTRACT_RANGE", message: `Contract '${c.id}' requires 0 <= min <= max.`, entity: c.id, source: c.source });
    } else if (c.type === "sink-affordability") {
      if (!activityIds.has(c.actionId)) diagnostics.push({ severity: "error", code: "UNKNOWN_ACTIVITY", message: `Contract '${c.id}' references unknown activity '${c.actionId}'.`, entity: c.id, source: c.source });
      else if (!(activities.find(a => a && typeof a === "object" && a.id === c.actionId)?.costs?.length)) diagnostics.push({ severity: "warning", code: "ACTION_HAS_NO_COST", message: `Sink affordability contract '${c.id}' checks an activity with no costs.`, entity: c.id, source: c.source });
    } else diagnostics.push({ severity: "error", code: "UNKNOWN_CONTRACT_TYPE", message: `Contract '${rawContract.id}' has unsupported type '${rawContract.type}'.`, entity: rawContract.id, source: rawContract.source });
  });
  const model = diagnostics.some(d => d.severity === "error") ? undefined : m as EconomyModel;
  return { model, diagnostics };
}
