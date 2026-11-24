# Architecture notes

## Boundaries

`src/types.ts` is the canonical v1 model. Importers turn input files into this shape and attach source provenance. `validation.ts` checks structure and references before simulation. `simulate.ts` is deterministic and contains no file system or network access. `analyze.ts` runs static checks and evaluates measured contract results. `report.ts` formats plain data as standalone HTML. `cli.ts` owns filesystem access, arguments, and process exit codes.

The pure core is reused by the Vite browser workbench and the CLI, so an economy can be inspected in a browser or checked in a game team's existing repository.

## Current simulation semantics

- A profile's `actionWeights` are relative weights among currently affordable, off-cooldown actions. They are re-sampled after each action; this is a simple scenario policy, not a learned or empirically grounded player model.
- Each session has a fixed minute budget. Activities are only selected if their full duration fits. Unused minutes are discarded.
- Costs are paid when an action is selected. Rewards are granted only if the action's `successChance` roll succeeds.
- The player state carries over between sessions and days. There is no inventory cap, trade between players, unlock graph, persistent random seed across software versions guarantee, or activity priority beyond weights.
- Exchanges are not simulated. The static analyzer checks repeatable single-input/single-output exchange edges for a profitable multiplicative cycle. This is intentionally a candidate-finding heuristic.
- Milestones record the first day end at which the target balance is reached. Affordability contracts pass if the listed action can be afforded at any simulated day-end by the window. Balance-range contracts test balance at exactly the specified day end.

These semantics must be stated in reports and tested before adding features that make them more complex.

## Determinism and comparisons

The runner uses a small seeded PRNG and derives each run seed from the requested seed and run index. Fixed inputs and runtime version produce repeatable results. `diff` ignores source file paths, compares model fields, and runs both revisions with the same seed and run count. It does not claim causal attribution when a model change affects later action choices.

## Provenance

CSV import records source file and one-based record row for each entity. JSON import attaches the source file to each entity unless the model already carries a source reference. Diagnostic output includes the relevant entity's reference when available. Field-level spreadsheet mapping and source-cell references require explicit adapters and are not inferred today.
