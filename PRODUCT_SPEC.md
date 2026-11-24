# Economy QA

Project name: Economy QA.

## Product direction

A local-first balance verification toolkit for game teams. It imports structured economy data, runs explicit checks and reproducible scenarios, and shows which source values caused each result.

This is not a general-purpose diagram editor or an AI that invents prices. The main workflow is:

1. Bring in an existing balance sheet or structured game config.
2. Map it to a documented economy model without re-entering every value.
3. Define balance contracts that express the intended experience.
4. Run static checks and seeded simulations against player-style profiles.
5. Review evidence, compare changes, and run the same checks in CI.

## Audience

One shared model should serve two groups:

- Multiplayer and RP server teams balancing jobs, shops, crafting, rewards, taxes, and currency sinks.
- Indie teams balancing progression, items, upgrades, crafting, and reward loops.

The first examples should include both a small RP-server economy and an indie RPG economy. An engine-specific adapter should only be added after its real config format has been inspected.

## Why this needs a narrower angle

A broad game-economy simulator is already a crowded direction. Machinations offers visual system modeling, scenario comparison, and Monte Carlo forecasting. Open-source projects already cover deterministic simulation, economy-as-code, regression assertions, and formal analysis. The product should therefore focus on bringing existing game data into repeatable, source-linked balance checks, rather than rebuilding a generic node editor.

## Core differentiator to test

**From balance data to reviewable balance tests.** Every warning or metric should point back to the imported file, row, field, and model assumption that produced it. A change to a shop price or reward should be reviewable like a code change, with a before-and-after report that can run locally and in CI.

This is a product hypothesis, not a claim that no competing tool supports it. Validate it with game-server maintainers and indie developers before expanding the model.

## MVP capabilities

### 1. Import and mapping

- Accept JSON and CSV locally in the browser and CLI.
- Preserve source references for each imported value.
- Map source fields to currencies, actions, costs, rewards, recipes, cooldowns, and progression gates.
- Validate missing fields, invalid values, duplicate identifiers, and unsupported constructs before simulation.
- Never upload source files.

### 2. Economy model

The model should support a small, explicit set of primitives first:

- Currencies and starting balances.
- Repeatable activities with duration, cooldown, costs, and rewards.
- Exchanges and crafting recipes with input/output quantities and success chances.
- Sinks such as purchases, taxes, upkeep, and consumables.
- Progression gates and milestones.
- Named player profiles with visible assumptions about session length and action preferences.

Do not imply that these profiles predict actual player behavior. They are scenarios to compare.

### 3. Balance contracts

Allow designers to set checks such as:

- A milestone should be reachable within a chosen time range for a named profile.
- A specified sink should remain affordable after an expected session.
- A currency source or sink should not dominate the modeled flow.
- The model should contain no profitable repeatable conversion cycle within the imported rules.
- A balance change should not move a chosen metric beyond a configured threshold.

Every check must state its assumptions and return evidence. Avoid a single opaque “balance score.”

### 4. Reproducible simulation and comparison

- Seeded runs with identical input and seed return identical results.
- Compare named scenarios and balance revisions side by side.
- Show distributions and ranges, not only averages.
- Report when a result is model-dependent or not covered by the current rules.

### 5. Developer workflow

- CLI commands for validation, simulation, comparison, and contract checks.
- Machine-readable JSON output and a self-contained HTML report.
- A GitHub Action that runs the same checks on a pull request.
- A web workbench for importing data, defining mappings, and viewing results.

## Non-goals for the first release

- Predicting real player behavior from a handful of sliders.
- Automatically “fixing” a game economy without designer review.
- Monetization or pay-to-win scoring.
- Supporting every game engine or config format at launch.
- A large freeform graph editor that duplicates existing system-modeling products.

## Proposed architecture

- A pure TypeScript core with no browser dependencies.
- A versioned JSON schema for imported models and balance contracts.
- Small import adapters that translate source formats into the canonical model while retaining file and field provenance.
- A deterministic simulation runner with explicit policies and seeded randomness.
- A static web workbench and CLI that call the same core functions.
- Golden fixtures and tests for a healthy economy, a broken progression gate, an unbounded exchange loop, and a balance regression.

## First milestone and acceptance criteria

Build the core and CLI before spending time on a polished dashboard.

- Two sample economies, one RP-server style and one indie RPG style.
- Import and validation tests for JSON and CSV.
- Deterministic seeded simulation tests.
- At least one source-linked static check and one progression contract.
- A scenario diff with exact changed inputs and affected outputs.
- A report that clearly separates facts from assumptions.
- English documentation by default and Russian documentation as a translation.

## Research references

- Machinations product overview: https://machinations.io/games
- Existing deterministic open-source simulator: https://github.com/vaughnponcee/economy-sim
- Economy-as-code and design assertions: https://github.com/zntznt/simulations
- Formal economy analysis and simulation: https://github.com/samw3/economy
- Graph-based profitable-cycle detection: https://github.com/sandeep-alluru/balancelab
