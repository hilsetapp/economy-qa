import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { importCsv } from "./csv.js";
import { validateModel } from "./validation.js";
import type { EconomyModel } from "./types.js";

export async function loadModel(path: string): Promise<EconomyModel> {
  const text = await readFile(path, "utf8");
  let value: unknown;
  if (extname(path).toLowerCase() === ".csv") value = importCsv(text, path);
  else {
    try { value = JSON.parse(text); } catch (error) { throw new Error(`Could not parse JSON in ${path}: ${(error as Error).message}`); }
    attachJsonProvenance(value, path);
  }
  const result = validateModel(value);
  if (!result.model) throw new ModelValidationError(result.diagnostics);
  return result.model;
}
function attachJsonProvenance(value: unknown, file: string) {
  if (!value || typeof value !== "object") return;
  const obj = value as any;
  for (const key of ["currencies", "activities", "exchanges", "profiles", "contracts"]) {
    if (Array.isArray(obj[key])) for (const entity of obj[key]) if (entity && typeof entity === "object" && !entity.source) entity.source = { file };
  }
}
export class ModelValidationError extends Error {
  constructor(readonly diagnostics: ReturnType<typeof validateModel>["diagnostics"]) { super("Input model validation failed."); this.name = "ModelValidationError"; }
}
