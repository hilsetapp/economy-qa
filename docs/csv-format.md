# CSV import format (v1)

CSV is long-form: one entity per row. The importer requires the columns `kind`, `id`, and `label`; other columns are interpreted only for the corresponding row kind. Empty fields are allowed. Quoted commas and escaped quotes are supported.

| kind | Required fields | Optional / kind-specific columns |
|---|---|---|
| `meta` | `id=name`, `label` | — |
| `currency` | `id`, `label` | `startingBalance` |
| `activity` | `id`, `label`, `durationMinutes` | `cooldownMinutes`, `costs`, `rewards`, `successChance` |
| `exchange` | `id`, `label`, `costs`, `rewards` | `repeatable` (`false` excludes it from repeatable-cycle analysis) |
| `profile` | `id`, `label`, `sessionMinutes`, `days`, `actionWeights` | `sessionsPerDay` (default 1) |
| `contract` | `id`, `type`, `profileId`, `withinDays`, `minPassRate` | type-specific fields below |

Amounts use `currency:amount`; multiple values use semicolons, for example `gold:5;ore:2`. Exchange rows require exactly one input in `costs` and one output in `rewards`. Profile action weights use `activity:weight;activity:weight`.

Contract type-specific fields:

- `milestone-reach`: `currency`, `target`
- `sink-affordability`: `actionId`
- `balance-range`: `currency`, `min`, `max`

The parser records a `source.file` and one-based CSV row on imported entities. It does not guess mappings from arbitrary spreadsheets; reshape the data or build an explicit adapter rather than silently relying on heuristics.
