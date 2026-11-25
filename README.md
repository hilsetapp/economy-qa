# Economy QA

**A local-first balance test bench for game teams.** Import economy data, define design checks, run reproducible scenarios, and review exactly what changed.

[Open the web workbench](https://hilsetapp.github.io/economy-qa/) · [CLI usage](#quick-start) · [Model schema](schemas/economy-v1.schema.json)

> Status: early prototype / v0.1. The current prototype delivers the typed model, JSON/CSV import, deterministic simulation, static exchange-cycle check, balance contracts, CLI, a browser workbench, and standalone HTML reports. Direct adapters for specific game formats are not implemented yet.

## Why this shape

A generic visual economy simulator would overlap established products and existing open-source projects. Economy QA takes a narrower direction: turn existing balance data into reviewable checks that can run in a local workflow or CI. It does not claim that this workflow is unique; that hypothesis still needs validation with server maintainers and indie teams.

One core supports two audiences from the start: RP-server economies and indie game progression. Examples are provided for both.

## Quick start

Requires Node.js 20 or newer.

```sh
npm install
npm run check
npm run build
node dist/cli.js validate examples/rp-server.json
node dist/cli.js simulate examples/indie-rpg.json --profile story-player --runs 1000 --seed 42
node dist/cli.js check examples/rp-server.json --runs 1000 --seed 42
node dist/cli.js report examples/indie-rpg.json --runs 1000 --seed 42 --out report.html
node dist/cli.js diff before.json after.json --profile story-player --runs 1000 --seed 42
npm run dev:web
```

Inputs are read locally and never uploaded by the CLI or browser workbench. The web workbench runs up to 20,000 seeded runs per profile in the current browser tab; click **Export HTML report** for a self-contained artifact. `check` returns exit status 1 if static analysis reports an error or a contract fails, making it usable in CI. `diff` uses the same seed and run count for both versions and lists changed input fields and before/after values (ignoring file-path provenance).

## Browser workbench

Run `npm run dev:web` and open the printed local URL. The workbench loads either sample, switches between English and Russian, accepts `.json` models and documented `.csv` imports by file picker or drag-and-drop, exposes a canonical JSON editor, runs every named profile locally, evaluates contracts, and downloads the standalone HTML report. Browser runs are capped at 20,000 per profile to keep the page responsive. No account, backend, or network upload is used by the workbench.

## Model format

JSON Schema: [`schemas/economy-v1.schema.json`](schemas/economy-v1.schema.json). Reference models: [`examples/rp-server.json`](examples/rp-server.json), [`examples/indie-rpg.json`](examples/indie-rpg.json). The CSV importer supports the same primitives in a long-form format; see [`docs/csv-format.md`](docs/csv-format.md) and [`examples/rp-server.csv`](examples/rp-server.csv).

Core entities:

- **Currencies** with starting balances.
- **Activities** with fixed duration, cooldown, costs, rewards, and optional success chance.
- **Exchanges** with one input and one output currency. These are statically analyzed for repeatable profitable cycles; they are not executed by the current simulation.
- **Profiles** with session time, sessions per day, horizon, and explicit activity-selection weights.
- **Contracts** for milestone reach, sink affordability, and final-day balance ranges at a minimum pass rate.

Every input value should be treated as a design assumption. Profile weights are relative selection weights among currently available actions, not player-behavior probabilities. The current simulator does not model inventory caps, action unlocks, player-to-player markets, taxes beyond modeled activities, seasonality, strategy adaptation, or offline play.

## What results mean

Runs are deterministic for identical model data, profile, run count, seed, and software version. The simulator reports p10/median/p90, mean, and min/max end balances, activity frequency, and gross modeled currency source/sink totals.

A balance contract is a test against the supplied model, not a universal definition of balance. The report surfaces assumptions and warnings. Passing checks do not prove an economy is balanced, exploit-free, or representative of real players; no findings do not prove there are no exploits.

The profitable-cycle analyzer inspects repeatable one-currency exchange edges using output/input ratios. It ignores fees, capacity limits, randomness, unlock requirements, and resource availability beyond listed edges. Treat findings as candidates for review, not proof of a live exploit.

## Current limits and next steps

1. Validate the import-and-review workflow with actual RP server configs and indie balance sheets.
2. Add explicit mapping adapters for formats selected by users, preserving file/row/field provenance.
3. Expand simulation semantics only where validated use cases require them, with tests for each assumption.
4. Add richer revision review and CI report artifacts while preserving the current local-only workflow.

Do not claim that a synthetic profile predicts a real player cohort. Keep reports and pull-request checks reproducible and reviewable.

## Development

```sh
npm test
npm run build
```

The core has no runtime package dependencies. Tests use Node's built-in test runner through `tsx`.

## Research context

- [Machinations](https://machinations.io/games) — visual system/economy modeling and scenario exploration.
- [zntznt/simulations](https://github.com/zntznt/simulations) — diff-friendly economy model, simulation tests, CLI, and CI-oriented workflow.
- [samw3/economy](https://github.com/samw3/economy) — RPG economy-as-code and formal checks.
- [vaughnponcee/economy-sim](https://github.com/vaughnponcee/economy-sim) — deterministic Monte Carlo economy analysis.
- [sandeep-alluru/balancelab](https://github.com/sandeep-alluru/balancelab) — graph-based profitable-cycle detection.

## License

MIT. See [`LICENSE`](LICENSE).
