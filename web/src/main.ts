import "./style.css";
import harborSample from "../../examples/rp-server.json";
import ashvaleSample from "../../examples/indie-rpg.json";
import { importCsv } from "../../src/csv.js";
import { evaluateContracts, staticAnalysis } from "../../src/analyze.js";
import { renderHtmlReport } from "../../src/report.js";
import { simulate } from "../../src/simulate.js";
import { validateModel } from "../../src/validation.js";
import type { Diagnostic, EconomyModel, RunResult } from "../../src/types.js";

type HTMLInput = HTMLInputElement;
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const number = (value: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);

let model: EconomyModel;
let currentFileLabel = "Harbor RP starter";
let importedFormat = "Example · JSON model";
let modelDiagnostics: Diagnostic[] = [];
let resultByProfile = new Map<string, RunResult>();
let toastTimer = 0;

const sampleModels: Record<string, EconomyModel> = {
  rp: harborSample as EconomyModel,
  indie: ashvaleSample as EconomyModel
};

function attachProvenance(value: unknown, file: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const root = value as Record<string, unknown>;
  for (const key of ["currencies", "activities", "exchanges", "profiles", "contracts"]) {
    if (Array.isArray(root[key])) for (const entity of root[key] as unknown[]) {
      if (entity && typeof entity === "object" && !Array.isArray(entity) && !("source" in entity)) (entity as Record<string, unknown>).source = { file };
    }
  }
}
function toast(message: string) {
  const el = $("#toast"); el.textContent = message; el.classList.add("show");
  window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove("show"), 2500);
}
function setValidation(message: string, state: "ok" | "warn" | "error" = "ok") {
  const icon = $("#validation-icon"); icon.textContent = state === "ok" ? "✓" : state === "warn" ? "!" : "×";
  icon.classList.toggle("bad", state === "error");
  $("#validation-message").textContent = message;
}
function renderDiagnostics(items: Diagnostic[]) {
  const root = $("#diagnostics");
  if (!items.length) { root.hidden = true; root.innerHTML = ""; return; }
  root.hidden = false;
  root.innerHTML = items.map(item => `<div class="diagnostic ${item.severity}"><code>${escapeHtml(item.code)}</code>${escapeHtml(item.message)}${item.source ? `<div class="finding-source">${escapeHtml(item.source.file)}${item.source.row ? ` · row ${item.source.row}` : ""}${item.source.field ? ` · ${escapeHtml(item.source.field)}` : ""}</div>` : ""}</div>`).join("");
}
function refreshValidation() {
  const check = validateModel(model);
  if (!check.model) {
    modelDiagnostics = check.diagnostics; renderDiagnostics(modelDiagnostics); setValidation("Model has structural errors. Fix them before simulating.", "error");
    $("#run-button").setAttribute("disabled", ""); return false;
  }
  model = check.model;
  const staticFindings = staticAnalysis(model);
  modelDiagnostics = [...check.diagnostics, ...staticFindings];
  renderDiagnostics(modelDiagnostics);
  const errors = modelDiagnostics.filter(item => item.severity === "error").length;
  const warnings = modelDiagnostics.filter(item => item.severity === "warning").length;
  setValidation(errors ? `${errors} static error(s) need review; simulation can still run.` : warnings ? `Model structure is valid · ${warnings} warning(s) to review.` : "Model structure is valid · ready to simulate.", errors || warnings ? "warn" : "ok");
  $("#run-button").removeAttribute("disabled");
  return true;
}
function renderProfiles() {
  const select = $("#profile-select") as HTMLSelectElement;
  const previous = select.value;
  select.innerHTML = model.profiles.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label)} · ${escapeHtml(p.id)}</option>`).join("");
  if (model.profiles.some(p => p.id === previous)) select.value = previous;
  renderProfileAssumption();
}
function renderProfileAssumption() {
  const profile = model.profiles.find(p => p.id === $<HTMLSelectElement>("#profile-select").value) ?? model.profiles[0];
  if (!profile) return;
  const weights = Object.entries(profile.actionWeights).map(([id, weight]) => `${id} × ${weight}`).join(" · ") || "no weighted actions";
  $("#profile-assumption").textContent = `${profile.sessionMinutes} min/session · ${profile.sessionsPerDay ?? 1} session(s)/day · ${profile.days}-day horizon · action weights: ${weights}`;
  if (resultByProfile.size) renderResults();
}
function loadModel(value: unknown, fileLabel: string, format: string) {
  if (format === "JSON model") attachProvenance(value, fileLabel);
  const checked = validateModel(value);
  if (!checked.model) {
    modelDiagnostics = checked.diagnostics; renderDiagnostics(modelDiagnostics);
    setValidation("Import rejected: fix structural errors and try again.", "error");
    $("#run-button").setAttribute("disabled", ""); return false;
  }
  model = checked.model; currentFileLabel = fileLabel; importedFormat = format; resultByProfile = new Map();
  $("#source-name").textContent = model.name; $("#source-kind").textContent = `${fileLabel} · ${format}`;
  $<HTMLTextAreaElement>("#model-json").value = JSON.stringify(model, null, 2);
  $("#empty-state").hidden = false; $("#result-content").hidden = true; $("#result-meta").textContent = "No simulation run yet";
  $("#download-report").setAttribute("disabled", "");
  renderProfiles(); refreshValidation(); toast(`Loaded ${model.name}`); return true;
}
async function readFile(file: File) {
  try {
    const text = await file.text(); const lower = file.name.toLowerCase();
    if (lower.endsWith(".csv")) loadModel(importCsv(text, file.name), file.name, "CSV import");
    else if (lower.endsWith(".json") || file.type === "application/json") {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch (error) { throw new Error(`Invalid JSON: ${(error as Error).message}`); }
      loadModel(parsed, file.name, "JSON model");
    } else throw new Error("Choose a .json model or mapped .csv file.");
  } catch (error) {
    setValidation((error as Error).message, "error"); $("#run-button").setAttribute("disabled", ""); toast("Import failed — check the format and try again.");
  }
}
function renderResults() {
  const profileId = $<HTMLSelectElement>("#profile-select").value;
  const result = resultByProfile.get(profileId);
  if (!result) return;
  const profile = model.profiles.find(p => p.id === profileId)!;
  const contracts = evaluateContracts(model, resultByProfile).filter(item => item.contract.profileId === profileId);
  const passed = contracts.filter(item => item.status === "pass").length;
  const failed = contracts.length - passed;
  $("#metric-grid").innerHTML = [
    `<div class="metric-card"><div class="metric-label">SEEDED RUNS</div><div class="metric-value green">${number(result.runs)}</div><div class="metric-sub">Seed ${result.seed} · deterministic</div></div>`,
    `<div class="metric-card"><div class="metric-label">TIME HORIZON</div><div class="metric-value">${number(profile.days)}<span style="font-size:12px;color:#96a399"> days</span></div><div class="metric-sub">${number(profile.sessionMinutes)} min × ${number(profile.sessionsPerDay ?? 1)} / day</div></div>`,
    `<div class="metric-card"><div class="metric-label">CONTRACTS PASSED</div><div class="metric-value ${failed ? "" : "green"}">${passed}<span style="font-size:13px;color:#829087"> / ${contracts.length}</span></div><div class="metric-sub">${failed ? `${failed} need review` : "all modeled checks pass"}</div></div>`,
    `<div class="metric-card"><div class="metric-label">MODEL SURFACE</div><div class="metric-value">${model.currencies.length}<span style="font-size:12px;color:#96a399"> currencies</span></div><div class="metric-sub">${model.activities.length} activities · ${model.exchanges?.length ?? 0} exchanges</div></div>`
  ].join("");
  $("#currency-rows").innerHTML = Object.entries(result.currencyStats).map(([currency, stats]) => {
    const flow = (result.sourceTotals[currency] ?? 0) - (result.sinkTotals[currency] ?? 0);
    return `<tr><td>${escapeHtml(currency)}</td><td>${number(stats.p10)}</td><td>${number(stats.median)}</td><td>${number(stats.p90)}</td><td>${flow >= 0 ? "+" : "−"}${number(Math.abs(flow))}</td></tr>`;
  }).join("");
  const activities = Object.entries(result.activityCounts).sort((a, b) => b[1].mean - a[1].mean);
  const maxCount = Math.max(1, ...activities.map(([, item]) => item.mean));
  $("#activity-list").innerHTML = activities.map(([id, item]) => `<div class="activity-row"><span class="activity-name">${escapeHtml(model.activities.find(a => a.id === id)?.label ?? id)}</span><span class="activity-count">${number(item.mean)}</span><div class="activity-bar"><i style="width:${Math.max(2, item.mean / maxCount * 100)}%"></i></div></div>`).join("") || `<p class="card-note">No activities are weighted for this profile.</p>`;
  $("#contract-rows").innerHTML = contracts.map(item => `<tr><td>${escapeHtml(item.contract.id)}</td><td>${number(item.actual * 100)}%</td><td>${escapeHtml(item.expected.replace(/^>= /, "≥ "))}</td><td><span class="status-pill ${item.status}">${item.status.toUpperCase()}</span></td><td>${escapeHtml(item.evidence)}</td></tr>`).join("") || `<tr><td colspan="5">No balance contracts for this profile.</td></tr>`;
  $("#contract-summary").textContent = contracts.length ? `${passed} PASS · ${failed} FAIL` : "NO CONTRACTS";
  const findings = modelDiagnostics;
  $("#finding-list").innerHTML = findings.map(item => `<div class="finding-item"><span class="finding-severity ${item.severity}">${escapeHtml(item.severity)}</span><div class="finding-copy"><code>${escapeHtml(item.code)}</code> · ${escapeHtml(item.message)}${item.source ? `<div class="finding-source">${escapeHtml(item.source.file)}${item.source.row ? ` · row ${item.source.row}` : ""}</div>` : ""}</div></div>`).join("") || `<div class="finding-item"><span class="finding-severity">INFO</span><div class="finding-copy">No static findings for this model. Absence of findings is not a safety or balance verdict.</div></div>`;
  $("#empty-state").hidden = true; $("#result-content").hidden = false;
  $("#result-meta").textContent = `${result.runs.toLocaleString()} runs · ${profile.label} · seed ${result.seed}`;
  $("#download-report").removeAttribute("disabled");
}
function download(filename: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type })); const link = document.createElement("a");
  link.href = url; link.download = filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function runScenario() {
  if (!refreshValidation()) return;
  const runs = Number(($<HTMLInput>("#runs-input")).value); const seed = Number(($<HTMLInput>("#seed-input")).value);
  if (!Number.isInteger(runs) || runs < 1 || runs > 20_000) { toast("Choose 1–20,000 runs for the browser workbench."); return; }
  if (!Number.isInteger(seed)) { toast("Seed must be an integer."); return; }
  const button = $("#run-button") as HTMLButtonElement; button.disabled = true; button.textContent = "Running…";
  await new Promise(resolve => window.setTimeout(resolve, 20));
  try {
    const next = new Map<string, RunResult>();
    for (const profile of model.profiles) next.set(profile.id, simulate(model, profile.id, { runs, seed }));
    resultByProfile = next; renderResults(); setValidation(`Ran ${number(runs)} seeded simulations for ${model.profiles.length} profile(s).`, "ok");
    toast("Scenario run complete — results are ready to review.");
  } catch (error) { toast(`Simulation failed: ${(error as Error).message}`); }
  finally { button.disabled = false; button.innerHTML = "<span>▶</span> Run scenario"; }
}
function chooseFile() { $("#file-input").click(); }

$("#import-trigger").addEventListener("click", chooseFile);
$("#drop-zone").addEventListener("click", event => { if ((event.target as HTMLElement).closest("button")) return; chooseFile(); });
$("#drop-zone").addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseFile(); } });
$("#file-input").addEventListener("change", event => { const file = (event.target as HTMLInputElement).files?.[0]; if (file) void readFile(file); (event.target as HTMLInputElement).value = ""; });
for (const name of ["dragenter", "dragover"]) $("#drop-zone").addEventListener(name, event => { event.preventDefault(); $("#drop-zone").classList.add("dragover"); });
for (const name of ["dragleave", "drop"]) $("#drop-zone").addEventListener(name, event => { event.preventDefault(); $("#drop-zone").classList.remove("dragover"); });
$("#drop-zone").addEventListener("drop", event => { const file = (event as DragEvent).dataTransfer?.files[0]; if (file) void readFile(file); });
$("#sample-select").addEventListener("change", event => { const key = (event.target as HTMLSelectElement).value; const label = key === "rp" ? "Harbor RP starter" : "Ashvale indie RPG"; loadModel(structuredClone(sampleModels[key]!), label, "Example · JSON model"); });
$("#profile-select").addEventListener("change", renderProfileAssumption);
$("#run-button").addEventListener("click", () => void runScenario());
$("#editor-toggle").addEventListener("click", () => { const wrap = $("#editor-wrap"); wrap.hidden = !wrap.hidden; $("#editor-toggle").innerHTML = wrap.hidden ? "Edit model JSON <span>⌄</span>" : "Hide model editor <span>⌃</span>"; if (!wrap.hidden) $("#model-json").focus(); });
$("#apply-json").addEventListener("click", () => {
  try { const parsed = JSON.parse($<HTMLTextAreaElement>("#model-json").value); loadModel(parsed, currentFileLabel, "JSON model"); }
  catch (error) { setValidation(`Invalid JSON: ${(error as Error).message}`, "error"); $("#run-button").setAttribute("disabled", ""); toast("Could not apply the model JSON."); }
});
$("#download-model").addEventListener("click", () => download(`${model.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "economy-model"}.json`, JSON.stringify(model, null, 2), "application/json"));
$("#download-report").addEventListener("click", () => {
  if (!resultByProfile.size) return;
  const html = renderHtmlReport(model, resultByProfile, modelDiagnostics);
  download(`${model.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "economy"}-report.html`, html, "text/html");
});

loadModel(structuredClone(sampleModels.rp), "Harbor RP starter", "Example · JSON model");
