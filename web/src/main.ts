import "./style.css";
import harborSample from "../../examples/rp-server.json";
import ashvaleSample from "../../examples/indie-rpg.json";
import { importCsv } from "../../src/csv.js";
import { evaluateContracts, staticAnalysis } from "../../src/analyze.js";
import { renderHtmlReport } from "../../src/report.js";
import { simulate } from "../../src/simulate.js";
import { validateModel } from "../../src/validation.js";
import type { Contract, Diagnostic, EconomyModel, RunResult } from "../../src/types.js";

type Locale = "en" | "ru";
type HTMLInput = HTMLInputElement;
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const dictionaries = {
  en: {
    navWorkbench:"Workbench",navSource:"Source code ↗",localOnly:"Runs in your browser",languageGroup:"Interface language",
    heroEyebrow:"GAME ECONOMY WORKBENCH",heroTitle:"Balance changes<br /><em>should be visible.</em>",heroLead:"Bring in your economy data. Test how different play styles fare. See what changed before it ships.",heroLink:"Test an economy",artTitle:"A clearer balance loop",artNote:"Inputs stay local. Results are reproducible.",
    modelTitle:"Load a balance model",modelDescription:"Start with a sample, or bring a JSON model / mapped CSV.",sampleLabel:"Try an example",sampleRp:"RP server · Harbor RP",sampleIndie:"Indie RPG · Ashvale",dropTitle:"Choose a file or drop it here",dropDescription:"JSON model or Economy QA CSV · read in this tab",downloadModel:"Save JSON",editJson:"Edit model JSON",hideJson:"Hide model JSON",modelV1:"Economy QA model · version 1",validateApply:"Validate & apply",readyToSimulate:"Model ready to simulate.",structureErrors:"Model has structural errors. Fix them before simulating.",staticErrors:"{n} static error(s) need review; simulation can still run.",warningsReview:"Model structure is valid · {n} note(s) to review.",modelValid:"Model structure is valid · ready to simulate.",
    scenarioTitle:"Set up a play session",scenarioDescription:"These are test assumptions, not a forecast of real players.",profileLabel:"PLAYER PROFILE",runsLabel:"SIMULATION RUNS",seedLabel:"SEED",runScenario:"Run scenario",running:"Running…",seedNote:"Same model, profile, and seed produce the same results.",
    resultsEyebrow:"RESULTS & CHECKS",resultsTitle:"What does the model say?",noRunYet:"No simulation run yet",exportReport:"Export report",emptyTitle:"Run a scenario to see the results.",emptyDescription:"Compare ending balances, review your design checks, and keep the seed for the next balance change.",
    distributionLabel:"BALANCE DISTRIBUTION",balanceTitle:"Ending currency balances",currencyColumn:"Currency",medianColumn:"Median",netFlowColumn:"Net flow / run",distributionNote:"Percentiles describe this model's simulated runs, not actual player outcomes.",activityLabel:"ACTIVITY MIX",activityTitle:"Actions per run",activityNote:"Relative weights choose between actions that are currently affordable.",contractsLabel:"DESIGN CHECKS",contractsTitle:"Balance contracts",contractColumn:"Contract",observedColumn:"Observed",requiredColumn:"Required",statusColumn:"Status",evidenceColumn:"Evidence",findingsLabel:"STATIC ANALYSIS",findingsTitle:"Findings to review",findingsNote:"No findings does not mean an economy is balanced or exploit-free. Checks only cover rules in this model.",
    footerNote:"A small tool for careful balance work.",footerSource:"Source code",timeHorizon:"TIME HORIZON",modelSize:"MODEL SIZE",exampleModel:"Example model",csvImport:"CSV import",jsonModel:"JSON model",mins:"min",session:"session",sessions:"sessions/day",days:"days",weights:"Weights",runs:"runs",currency:"currencies",activities:"activities",exchanges:"exchanges",pass:"pass",fail:"fail",noContracts:"No contracts",allPass:"All checks pass",needReview:"Need review",noContractsForProfile:"No contracts for this profile.",noWeightedActions:"No actions are weighted for this profile.",notApplicable:"Not applicable",reachedBy:"Reached by day {day} (median); limit {limit} days.",notReached:"Target was not reached by day {days}.",affordableBy:"Affordable at a day-end within {days} days.",notAffordable:"Not affordable at a day-end within {days} days.",rangeEvidence:"Final balance checked against the configured range on day {day}.",outsideRange:"Final balance falls outside the configured range on day {day}.",loaded:"Loaded {name}",runComplete:"Scenario run complete.",importFailed:"Import failed — check the file format.",invalidFile:"Choose a .json model or mapped .csv file.",invalidJson:"Invalid JSON: {error}",rejectedModel:"Import rejected: fix the model errors and try again.",runsLimit:"Choose 1–20,000 runs for this browser.",seedInteger:"Seed must be a whole number.",downloadFailed:"Could not apply the model JSON.",error:"Error",warning:"Warning",info:"Info",source:"Source",row:"row",diagnosticGeneric:"Review {code} in this model.",diagNoReward:"Activity “{id}” has no reward; it may be an intentional sink.",diagWeights:"Profile “{id}” uses relative action weights (total {sum}), not probabilities.",diagCycle:"Repeatable exchanges contain a profitable cycle: {cycle}.",diagCycleNote:"Check fees, limits, and unlock rules before treating this as an exploit.",
  },
  ru: {
    navWorkbench:"Мастерская",navSource:"Исходный код ↗",localOnly:"Работает в браузере",languageGroup:"Язык интерфейса",
    heroEyebrow:"МАСТЕРСКАЯ ИГРОВОЙ ЭКОНОМИКИ",heroTitle:"Изменения баланса<br /><em>должны быть видны.</em>",heroLead:"Загрузите модель экономики. Проверьте разные стили игры. Посмотрите, что изменилось, до релиза.",heroLink:"Проверить экономику",artTitle:"Понятный цикл баланса",artNote:"Данные остаются локально. Результаты воспроизводимы.",
    modelTitle:"Загрузить модель баланса",modelDescription:"Выберите пример или загрузите JSON-модель / подготовленный CSV.",sampleLabel:"Готовый пример",sampleRp:"RP-сервер · Harbor RP",sampleIndie:"Инди-RPG · Ashvale",dropTitle:"Выберите файл или перетащите его сюда",dropDescription:"JSON-модель или CSV Economy QA · файл читается в этой вкладке",downloadModel:"Сохранить JSON",editJson:"Редактировать JSON-модель",hideJson:"Скрыть редактор JSON",modelV1:"Модель Economy QA · версия 1",validateApply:"Проверить и применить",readyToSimulate:"Модель готова к симуляции.",structureErrors:"В модели есть структурные ошибки. Исправьте их перед запуском.",staticErrors:"Статических ошибок: {n}. Их стоит проверить; симуляцию всё ещё можно запустить.",warningsReview:"Структура модели корректна · замечаний: {n}.",modelValid:"Структура модели корректна · готово к запуску.",
    scenarioTitle:"Настройки игровой сессии",scenarioDescription:"Это тестовые допущения, а не прогноз поведения реальных игроков.",profileLabel:"ПРОФИЛЬ ИГРОКА",runsLabel:"ЧИСЛО ПРОГОНОВ",seedLabel:"SEED",runScenario:"Запустить сценарий",running:"Выполняется…",seedNote:"Одинаковые модель, профиль и seed дают одинаковый результат.",
    resultsEyebrow:"РЕЗУЛЬТАТЫ И ПРОВЕРКИ",resultsTitle:"Что показывает модель?",noRunYet:"Симуляция ещё не запускалась",exportReport:"Скачать отчёт",emptyTitle:"Запустите сценарий, чтобы увидеть результаты.",emptyDescription:"Сравните остатки валют, проверьте критерии дизайна и сохраните seed для следующего изменения баланса.",
    distributionLabel:"РАСПРЕДЕЛЕНИЕ БАЛАНСА",balanceTitle:"Остатки валют",currencyColumn:"Валюта",medianColumn:"Медиана",netFlowColumn:"Чистый поток / прогон",distributionNote:"Перцентили описывают симуляцию этой модели, а не реальные результаты игроков.",activityLabel:"СОСТАВ ДЕЙСТВИЙ",activityTitle:"Действий за прогон",activityNote:"Относительные веса выбирают среди действий, которые игрок может оплатить.",contractsLabel:"КРИТЕРИИ ДИЗАЙНА",contractsTitle:"Проверки баланса",contractColumn:"Проверка",observedColumn:"Результат",requiredColumn:"Требование",statusColumn:"Статус",evidenceColumn:"Пояснение",findingsLabel:"СТАТИЧЕСКИЙ АНАЛИЗ",findingsTitle:"Что стоит проверить",findingsNote:"Отсутствие замечаний не доказывает, что экономика сбалансирована или не содержит эксплойтов. Проверяются только правила этой модели.",
    footerNote:"Инструмент для внимательной настройки баланса.",footerSource:"Исходный код",timeHorizon:"ГОРИЗОНТ СИМУЛЯЦИИ",modelSize:"РАЗМЕР МОДЕЛИ",exampleModel:"Пример модели",csvImport:"Импорт CSV",jsonModel:"JSON-модель",mins:"мин",session:"сессия",sessions:"сессий/день",days:"дней",weights:"Веса",runs:"прогонов",currency:"валюты",activities:"действий",exchanges:"обменов",pass:"пройдены",fail:"не пройдены",noContracts:"Нет проверок",allPass:"Все проверки пройдены",needReview:"Нужно внимание",noContractsForProfile:"Для этого профиля нет проверок.",noWeightedActions:"Для профиля не заданы веса действий.",notApplicable:"Не применяется",reachedBy:"Медиана достижения — день {day}; предел — {limit} дн.",notReached:"Цель не достигнута за {days} дн.",affordableBy:"Покупка доступна на конец дня в течение {days} дн.",notAffordable:"Покупка недоступна на конец дня в течение {days} дн.",rangeEvidence:"Итоговый остаток проверяется по заданному диапазону на {day}-й день.",outsideRange:"Итоговый остаток вне заданного диапазона на {day}-й день.",loaded:"Загружена модель: {name}",runComplete:"Сценарий завершён.",importFailed:"Не удалось загрузить файл. Проверьте его формат.",invalidFile:"Выберите JSON-модель или подготовленный CSV.",invalidJson:"Некорректный JSON: {error}",rejectedModel:"Модель не принята: исправьте ошибки и попробуйте снова.",runsLimit:"Для браузера выберите от 1 до 20 000 прогонов.",seedInteger:"Seed должен быть целым числом.",downloadFailed:"Не удалось применить JSON-модель.",error:"Ошибка",warning:"Предупреждение",info:"Информация",source:"Источник",row:"строка",diagnosticGeneric:"Проверьте в модели правило {code}.",diagNoReward:"У действия «{id}» нет награды; возможно, это намеренный сток.",diagWeights:"У профиля «{id}» заданы относительные веса действий (сумма {sum}), а не вероятности.",diagCycle:"В повторяемых обменах найден прибыльный цикл: {cycle}.",diagCycleNote:"Перед тем как считать это эксплойтом, проверьте комиссии, ограничения и условия открытия.",
  }
} as const;
type TranslationKey = keyof typeof dictionaries.en;
const interpolate = (text: string, values: Record<string, string | number> = {}) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
let locale: Locale = (() => { try { return localStorage.getItem("economy-qa-language") === "ru" ? "ru" : "en"; } catch { return "en"; } })();
const t = (key: TranslationKey, values?: Record<string, string | number>) => interpolate(dictionaries[locale][key], values);
const number = (value: number) => new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", { maximumFractionDigits: 2 }).format(value);

let model: EconomyModel;
let currentFileLabel = "Harbor RP starter";
let modelFormat: "example" | "csv" | "json" = "example";
let modelDiagnostics: Diagnostic[] = [];
let resultByProfile = new Map<string, RunResult>();
let toastTimer = 0;
const sampleModels: Record<string, EconomyModel> = { rp: harborSample as EconomyModel, indie: ashvaleSample as EconomyModel };

function formatLabel(format: typeof modelFormat) { return t(format === "example" ? "exampleModel" : format === "csv" ? "csvImport" : "jsonModel"); }
function escapeHtml(value: unknown) { return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!); }
function toast(message: string) {
  const el = $("#toast"); el.textContent = message; el.classList.add("show");
  window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove("show"), 2600);
}
function setValidation(message: string, state: "ok" | "warn" | "error" = "ok") {
  const icon = $("#validation-icon"); icon.textContent = state === "ok" ? "✓" : state === "warn" ? "!" : "×";
  icon.classList.toggle("bad", state === "error"); $("#validation-message").textContent = message;
}
function diagnosticText(item: Diagnostic) {
  if (item.code === "NO_REWARD") return t("diagNoReward", { id: item.entity ?? "" });
  if (item.code === "PROFILE_WEIGHTS_NORMALIZED") {
    const sum = String(item.evidence?.normalizedTotal ?? item.message.match(/total is ([\d.]+)/)?.[1] ?? "");
    return t("diagWeights", { id: item.entity ?? "", sum });
  }
  if (item.code === "PROFITABLE_EXCHANGE_CYCLE") return t("diagCycle", { cycle: item.evidence?.exchangeIds ? (item.evidence.exchangeIds as string[]).join(" → ") : item.entity ?? "" });
  return locale === "en" ? item.message : t("diagnosticGeneric", { code: item.code });
}
function renderDiagnostics(items: Diagnostic[]) {
  const root = $("#diagnostics");
  if (!items.length) { root.hidden = true; root.innerHTML = ""; return; }
  root.hidden = false;
  root.innerHTML = items.map(item => `<div class="diagnostic ${item.severity}"><code>${escapeHtml(item.code)}</code>${escapeHtml(diagnosticText(item))}${item.source ? `<div class="finding-source">${escapeHtml(t("source"))}: ${escapeHtml(item.source.file)}${item.source.row ? ` · ${escapeHtml(t("row"))} ${item.source.row}` : ""}</div>` : ""}</div>`).join("");
}
function refreshValidation() {
  const check = validateModel(model);
  if (!check.model) {
    modelDiagnostics = check.diagnostics; renderDiagnostics(modelDiagnostics); setValidation(t("structureErrors"), "error"); $("#run-button").setAttribute("disabled", ""); return false;
  }
  model = check.model; modelDiagnostics = [...check.diagnostics, ...staticAnalysis(model)]; renderDiagnostics(modelDiagnostics);
  const errors = modelDiagnostics.filter(item => item.severity === "error").length;
  const warnings = modelDiagnostics.filter(item => item.severity === "warning").length;
  setValidation(errors ? t("staticErrors", { n: errors }) : warnings ? t("warningsReview", { n: warnings }) : t("modelValid"), errors || warnings ? "warn" : "ok");
  $("#run-button").removeAttribute("disabled"); return true;
}
function renderProfiles() {
  const select = $("#profile-select") as HTMLSelectElement; const previous = select.value;
  select.innerHTML = model.profiles.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label)}</option>`).join("");
  if (model.profiles.some(p => p.id === previous)) select.value = previous;
  renderProfileAssumption();
}
function renderProfileAssumption() {
  const profile = model.profiles.find(p => p.id === $<HTMLSelectElement>("#profile-select").value) ?? model.profiles[0];
  if (!profile) return;
  const weights = Object.entries(profile.actionWeights).map(([id, weight]) => `${id} × ${weight}`).join(" · ") || t("noWeightedActions");
  $("#profile-assumption").textContent = `${profile.sessionMinutes} ${t("mins")}/${t("session")} · ${profile.sessionsPerDay ?? 1} ${t("sessions")} · ${profile.days} ${t("days")} · ${t("weights")}: ${weights}`;
  if (resultByProfile.size) renderResults();
}
function loadModel(value: unknown, fileLabel: string, format: typeof modelFormat, notify = true) {
  if (format === "json") attachProvenance(value, fileLabel);
  const checked = validateModel(value);
  if (!checked.model) {
    modelDiagnostics = checked.diagnostics; renderDiagnostics(modelDiagnostics); setValidation(t("rejectedModel"), "error"); $("#run-button").setAttribute("disabled", ""); return false;
  }
  model = checked.model; currentFileLabel = fileLabel; modelFormat = format; resultByProfile = new Map();
  $("#source-name").textContent = model.name; $("#source-kind").textContent = `${currentFileLabel} · ${formatLabel(format)}`;
  $<HTMLTextAreaElement>("#model-json").value = JSON.stringify(model, null, 2); $("#empty-state").hidden = false; $("#result-content").hidden = true;
  $("#result-meta").textContent = t("noRunYet"); $("#download-report").setAttribute("disabled", "");
  renderProfiles(); refreshValidation(); if (notify) toast(t("loaded", { name: model.name })); return true;
}
function attachProvenance(value: unknown, file: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const root = value as Record<string, unknown>;
  for (const key of ["currencies", "activities", "exchanges", "profiles", "contracts"]) if (Array.isArray(root[key])) {
    for (const entity of root[key] as unknown[]) if (entity && typeof entity === "object" && !Array.isArray(entity) && !("source" in entity)) (entity as Record<string, unknown>).source = { file };
  }
}
async function readFile(file: File) {
  try {
    const text = await file.text(); const lower = file.name.toLowerCase();
    if (lower.endsWith(".csv")) loadModel(importCsv(text, file.name), file.name, "csv");
    else if (lower.endsWith(".json") || file.type === "application/json") {
      let parsed: unknown; try { parsed = JSON.parse(text); } catch (error) { throw new Error(t("invalidJson", { error: (error as Error).message })); }
      loadModel(parsed, file.name, "json");
    } else throw new Error(t("invalidFile"));
  } catch (error) { setValidation((error as Error).message, "error"); $("#run-button").setAttribute("disabled", ""); toast(t("importFailed")); }
}
function contractEvidence(contract: Contract, result: RunResult) {
  if (contract.type === "milestone-reach") {
    const data = result.milestoneDays[contract.id];
    return data?.median === null || data?.median === undefined ? t("notReached", { days: contract.withinDays }) : t("reachedBy", { day: number(data.median), limit: contract.withinDays });
  }
  if (contract.type === "sink-affordability") {
    return (result.affordabilityRates[contract.id] ?? 0) > 0 ? t("affordableBy", { days: contract.withinDays }) : t("notAffordable", { days: contract.withinDays });
  }
  return t("rangeEvidence", { day: contract.withinDays });
}
function renderResults() {
  const profileId = $<HTMLSelectElement>("#profile-select").value; const result = resultByProfile.get(profileId); if (!result) return;
  const profile = model.profiles.find(p => p.id === profileId)!;
  const contracts = evaluateContracts(model, resultByProfile).filter(item => item.contract.profileId === profileId);
  const passed = contracts.filter(item => item.status === "pass").length; const failed = contracts.length - passed;
  $("#metric-grid").innerHTML = [
    `<div class="metric-card"><div class="metric-label">${escapeHtml(t("runs"))}</div><div class="metric-value green">${number(result.runs)}</div><div class="metric-sub">Seed ${number(result.seed)} · ${escapeHtml(t("seedNote"))}</div></div>`,
    `<div class="metric-card"><div class="metric-label">${escapeHtml(t("timeHorizon"))}</div><div class="metric-value">${number(profile.days)} <span>${escapeHtml(t("days"))}</span></div><div class="metric-sub">${number(profile.sessionMinutes)} ${escapeHtml(t("mins"))} × ${number(profile.sessionsPerDay ?? 1)} / ${escapeHtml(t("days"))}</div></div>`,
    `<div class="metric-card"><div class="metric-label">${escapeHtml(t("contractsTitle"))}</div><div class="metric-value ${failed ? "" : "green"}">${passed}<span> / ${contracts.length}</span></div><div class="metric-sub">${escapeHtml(contracts.length ? failed ? t("needReview") : t("allPass") : t("noContracts"))}</div></div>`,
    `<div class="metric-card"><div class="metric-label">${escapeHtml(t("modelSize"))}</div><div class="metric-value">${model.currencies.length} <span>${escapeHtml(t("currency"))}</span></div><div class="metric-sub">${model.activities.length} ${escapeHtml(t("activities"))} · ${model.exchanges?.length ?? 0} ${escapeHtml(t("exchanges"))}</div></div>`
  ].join("");
  $("#currency-rows").innerHTML = Object.entries(result.currencyStats).map(([currency, stats]) => {
    const flow = (result.sourceTotals[currency] ?? 0) - (result.sinkTotals[currency] ?? 0);
    return `<tr><td>${escapeHtml(currency)}</td><td>${number(stats.p10)}</td><td>${number(stats.median)}</td><td>${number(stats.p90)}</td><td>${flow >= 0 ? "+" : "−"}${number(Math.abs(flow))}</td></tr>`;
  }).join("");
  const activities = Object.entries(result.activityCounts).sort((a, b) => b[1].mean - a[1].mean); const maxCount = Math.max(1, ...activities.map(([, x]) => x.mean));
  $("#activity-list").innerHTML = activities.map(([id, item]) => `<div class="activity-row"><span class="activity-name">${escapeHtml(model.activities.find(a => a.id === id)?.label ?? id)}</span><span class="activity-count">${number(item.mean)}</span><div class="activity-bar"><i style="width:${Math.max(2, item.mean / maxCount * 100)}%"></i></div></div>`).join("") || `<p class="card-note">${escapeHtml(t("noWeightedActions"))}</p>`;
  $("#contract-rows").innerHTML = contracts.map(item => `<tr><td>${escapeHtml(item.contract.id)}</td><td>${number(item.actual * 100)}%</td><td>≥ ${number(item.contract.minPassRate * 100)}%</td><td><span class="status-pill ${item.status}">${escapeHtml(t(item.status))}</span></td><td>${escapeHtml(contractEvidence(item.contract, result))}</td></tr>`).join("") || `<tr><td colspan="5">${escapeHtml(t("noContractsForProfile"))}</td></tr>`;
  $("#contract-summary").textContent = contracts.length ? `${passed} ${t("pass")} · ${failed} ${t("fail")}` : t("noContracts");
  $("#finding-list").innerHTML = modelDiagnostics.map(item => `<div class="finding-item"><span class="finding-severity ${item.severity}">${escapeHtml(t(item.severity))}</span><div class="finding-copy"><code>${escapeHtml(item.code)}</code> · ${escapeHtml(diagnosticText(item))}${item.source ? `<div class="finding-source">${escapeHtml(item.source.file)}${item.source.row ? ` · ${escapeHtml(t("row"))} ${item.source.row}` : ""}</div>` : ""}</div></div>`).join("") || `<p class="card-note">${escapeHtml(t("modelValid"))}</p>`;
  $("#empty-state").hidden = true; $("#result-content").hidden = false;
  $("#result-meta").textContent = `${number(result.runs)} ${t("runs")} · ${profile.label} · seed ${number(result.seed)}`; $("#download-report").removeAttribute("disabled");
}
function renderLanguage() {
  document.documentElement.lang = locale;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n as TranslationKey; if (dictionaries[locale][key]) el.innerHTML = dictionaries[locale][key];
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach(el => {
    const key = el.dataset.i18nAria as TranslationKey; if (dictionaries[locale][key]) el.setAttribute("aria-label", dictionaries[locale][key]);
  });
  $("#lang-en").setAttribute("aria-pressed", String(locale === "en")); $("#lang-ru").setAttribute("aria-pressed", String(locale === "ru"));
  document.title = locale === "ru" ? "Economy QA — Мастерская игровой экономики" : "Economy QA — Game Economy Workbench";
  const editorOpen = !$("#editor-wrap").hidden; $("#editor-toggle span:first-child").textContent = t(editorOpen ? "hideJson" : "editJson");
  if (model) { $("#source-kind").textContent = `${currentFileLabel} · ${formatLabel(modelFormat)}`; renderProfileAssumption(); renderDiagnostics(modelDiagnostics); if (resultByProfile.size) renderResults(); }
  try { localStorage.setItem("economy-qa-language", locale); } catch { /* language remains active for this tab */ }
}
function setLanguage(next: Locale) { locale = next; renderLanguage(); }
function download(filename: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function runScenario() {
  if (!refreshValidation()) return;
  const runs = Number(($<HTMLInput>("#runs-input")).value); const seed = Number(($<HTMLInput>("#seed-input")).value);
  if (!Number.isInteger(runs) || runs < 1 || runs > 20_000) { toast(t("runsLimit")); return; }
  if (!Number.isInteger(seed)) { toast(t("seedInteger")); return; }
  const button = $("#run-button") as HTMLButtonElement; button.disabled = true; button.querySelector("span:last-child")!.textContent = t("running");
  await new Promise(resolve => window.setTimeout(resolve, 20));
  try {
    const next = new Map<string, RunResult>();
    for (const profile of model.profiles) next.set(profile.id, simulate(model, profile.id, { runs, seed }));
    resultByProfile = next; renderResults(); setValidation(t("modelValid"), "ok"); toast(t("runComplete"));
  } catch (error) { toast(`${locale === "ru" ? "Ошибка симуляции" : "Simulation failed"}: ${(error as Error).message}`); }
  finally { button.disabled = false; button.querySelector("span:last-child")!.textContent = t("runScenario"); }
}

$("#lang-en").addEventListener("click", () => setLanguage("en")); $("#lang-ru").addEventListener("click", () => setLanguage("ru"));
$("#drop-zone").addEventListener("click", () => $("#file-input").click());
$("#file-input").addEventListener("change", event => { const file = (event.target as HTMLInputElement).files?.[0]; if (file) void readFile(file); (event.target as HTMLInputElement).value = ""; });
for (const name of ["dragenter", "dragover"]) $("#drop-zone").addEventListener(name, event => { event.preventDefault(); $("#drop-zone").classList.add("dragover"); });
for (const name of ["dragleave", "drop"]) $("#drop-zone").addEventListener(name, event => { event.preventDefault(); $("#drop-zone").classList.remove("dragover"); });
$("#drop-zone").addEventListener("drop", event => { const file = (event as DragEvent).dataTransfer?.files[0]; if (file) void readFile(file); });
$("#sample-select").addEventListener("change", event => { const key = (event.target as HTMLSelectElement).value; const label = key === "rp" ? "Harbor RP starter" : "Ashvale indie RPG"; loadModel(structuredClone(sampleModels[key]!), label, "example"); });
$("#profile-select").addEventListener("change", renderProfileAssumption); $("#run-button").addEventListener("click", () => void runScenario());
$("#editor-toggle").addEventListener("click", () => { const wrap = $("#editor-wrap"); wrap.hidden = !wrap.hidden; $("#editor-toggle").setAttribute("aria-expanded", String(!wrap.hidden)); $("#editor-toggle span:first-child").textContent = t(wrap.hidden ? "editJson" : "hideJson"); $(".toggle-chevron").textContent = wrap.hidden ? "＋" : "−"; if (!wrap.hidden) $("#model-json").focus(); });
$("#apply-json").addEventListener("click", () => { try { loadModel(JSON.parse($<HTMLTextAreaElement>("#model-json").value), currentFileLabel, "json"); } catch (error) { setValidation(t("invalidJson", { error: (error as Error).message }), "error"); $("#run-button").setAttribute("disabled", ""); toast(t("downloadFailed")); } });
$("#download-model").addEventListener("click", () => download(`${model.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "economy-model"}.json`, JSON.stringify(model, null, 2), "application/json"));
$("#download-report").addEventListener("click", () => { if (resultByProfile.size) download(`${model.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "economy"}-report.html`, renderHtmlReport(model, resultByProfile, modelDiagnostics), "text/html"); });
loadModel(structuredClone(sampleModels.rp), "Harbor RP starter", "example", false); renderLanguage();
