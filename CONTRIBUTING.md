# Contributing

Thanks for helping make balance tests more reviewable. The project is an early prototype; please open an issue before adding a large model primitive or engine-specific adapter.

## Development setup

- Node.js 20+
- `npm install`
- `npm run check`

## Change expectations

1. State which balance-workflow problem the change addresses and which audience it serves.
2. Add or update a fixture for RP-server or indie-game usage.
3. Add tests for the behavior and for invalid/unsupported input.
4. Keep the simulation deterministic for a fixed seed and make assumptions visible in docs and reports.
5. Preserve local-first behavior: no source balance files should be uploaded.
6. Avoid implying that the tool predicts real player behavior or proves an economy is safe/balanced.
7. Update the JSON Schema and CSV format documentation when changing the canonical model.

## Pull requests

The CI workflow builds the TypeScript package, runs tests, and evaluates the two example economies. Please include a concise before/after explanation for behavior changes.
