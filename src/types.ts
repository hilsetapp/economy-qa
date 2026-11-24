export type Amount = { currency: string; amount: number };
export type SourceRef = { file: string; row?: number; field?: string };

export interface Currency {
  id: string;
  label: string;
  startingBalance?: number;
  source?: SourceRef;
}

export interface Activity {
  id: string;
  label: string;
  durationMinutes: number;
  cooldownMinutes?: number;
  costs?: Amount[];
  rewards?: Amount[];
  successChance?: number;
  source?: SourceRef;
}

export interface Exchange {
  id: string;
  label: string;
  input: Amount;
  output: Amount;
  repeatable?: boolean;
  source?: SourceRef;
}

export interface PlayerProfile {
  id: string;
  label: string;
  sessionMinutes: number;
  days: number;
  sessionsPerDay?: number;
  actionWeights: Record<string, number>;
  source?: SourceRef;
}

export type Contract =
  | { id: string; type: "milestone-reach"; profileId: string; currency: string; target: number; withinDays: number; minPassRate: number; source?: SourceRef }
  | { id: string; type: "sink-affordability"; profileId: string; actionId: string; withinDays: number; minPassRate: number; source?: SourceRef }
  | { id: string; type: "balance-range"; profileId: string; currency: string; withinDays: number; min: number; max: number; minPassRate: number; source?: SourceRef };

export interface EconomyModel {
  schemaVersion: 1;
  name: string;
  currencies: Currency[];
  activities: Activity[];
  exchanges?: Exchange[];
  profiles: PlayerProfile[];
  contracts?: Contract[];
}

export interface Diagnostic {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  entity?: string;
  source?: SourceRef;
  evidence?: Record<string, unknown>;
}

export interface RunOptions { runs: number; seed: number; }
export interface RunResult {
  profileId: string;
  runs: number;
  seed: number;
  days: number;
  currencyStats: Record<string, { p10: number; median: number; p90: number; mean: number; min: number; max: number }>;
  activityCounts: Record<string, { mean: number; total: number }>;
  affordabilityRates: Record<string, number>;
  rangePassRates: Record<string, number>;
  milestoneDays: Record<string, { median: number | null; passRate: number }>;
  sourceTotals: Record<string, number>;
  sinkTotals: Record<string, number>;
}

export interface ContractResult {
  contractId: string;
  type: Contract["type"];
  status: "pass" | "fail";
  actual: number;
  expected: string;
  evidence: string;
}
