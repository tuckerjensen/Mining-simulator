# Mine Haulage Simulator — 2.1.0-preview.1

Desktop-first structured scenario editor for the existing V2 discrete-event haulage model. This is an **unvalidated planning prototype**, not production-ready software. No merge or deployment is part of this feature branch.

Open `index.html` directly, or serve this directory with any static web server. No application build or runtime dependencies are needed. Choose a preset, edit the tables, then select **Simulate**. Reports retain the network, production, flows, resources, fleet, shifts, material audit and mass accounting. **Fleet sweep** compares proportional mixes with 12 common-seed replications per point.

The editor supports loading units, truck types, destinations, independent loaded and empty routes, material rules, closure schedules and sweep settings. Tables scroll horizontally on smaller displays. Mobile Lite is a future interface, not delivered here.

- Times are minutes except scenario/shift duration in hours. Payload/inventory/maximums are metric tons; rates are t/h; fleet costs are USD/h.
- CV is standard deviation divided by mean. Availability and target share are fractions from 0 to 1. Blank inventory and maximum tons mean unlimited. Blank MTBF/MTTR disables that failure approximation.
- IDs must be unique per resource category. Renames update references. Deleting resources leaves missing references visible; repair or remove those rows before running.
- Dynamic dispatch chooses feasible routes using queue/travel estimates and soft material priorities. Fixed dispatch requires each truck type's source/destination to identify a loaded route. Initial destination is optional; a blank starts the truck at a source without initial empty travel.
- Empty routes are independent destination-to-source links. Missing links make that repositioning infeasible, potentially stranding trucks. Do not assume loaded links imply return links.
- Closures identify a source, destination, truck type, or ALL_TRUCKS. For ALL_TRUCKS the ID is ignored (enter `*`). Start/end are elapsed minutes from scenario start. Closures delay service starts; they do not suspend work already started.
- Export creates a validated JSON scenario. Import accepts V2 and V3 JSON, validates before replacing your current work, and runs it. Save exports before closing/reloading; there is no automatic persistence or undo. Results remain from the last run until Simulate is selected.

## Versioning

Application: `2.1.0-preview.1` (compatible editor features added to V2). Engine: `2.0.0-unvalidated` (existing calculation behavior). Scenario schema: `3` (saved-file contract, independent of the application version). Stable source filenames remain unchanged.

## Shared contract

`scenario.js` is the UI-independent shared schema V3 contract: field descriptors, migration and validation. `editor.js` consumes those descriptors; a future Mobile Lite interface should consume the same contract and use the same JSON documents rather than introducing a second engine model.

V3 adds `schemaVersion: 3` while keeping V2 field names (`sources`, `trucks`, `destinations`, `routes`, `emptyRoutes`, `materialRules`, `windows`, `fleetSweep`). Missing legacy empty routes migrate from `routes[].empty` only when `emptyRoutes` is absent. Explicit empty arrays remain empty. Explicit zero values survive migration. Unsupported versions are rejected. Unknown fields are retained through import/export, including legacy `routes[].empty`; the V2 engine uses only `emptyRoutes` for empty travel. Omitted inventory/maximums remain omitted in exported JSON. No Infinity values are serialized.

`engine.js` preserves the V2 event engine. `legacy.js` retains presets, seeded randomness, reports and sweep code. The sweep now uses largest-remainder allocation to avoid negative counts when rounding three or more truck types. `index.html` is the static entry point; raw JSON is no longer a user editing surface.

## Validation and testing

Use Node.js 18+ and run `node tests/scenario.cjs` (or `npm test`). Frozen `tests/v2-results.json` captures all five original V2 preset results at seed 42; tests check full-output parity, deterministic replay, mass identity, round trips, migration and invalid scenarios. These are software regression checks, not empirical model validation.

For browser checks, install development dependencies (`npm install`), install Chromium (`npx playwright install chromium`), then run `npm run test:browser`. Alternatively set `BROWSER_CHANNEL=msedge` to use installed Edge. `tests/browser.cjs` starts a temporary local server and checks every preset, editing/running, ID references, schedule rows, export/import, rejected-import preservation, fleet sweep, narrow layout and browser errors.

## Known unvalidated engine limitations

No field validation/calibration against production records has been performed. Preserving V2 outputs does not establish physical accuracy.

- No shared-road congestion, overtaking/traffic rules, physical hopper buffers, detailed maintenance/fuel/crew cycles, or grade-dependent travel physics.
- Availability stretches expected loading time or triggers sampled truck delays; MTBF/MTTR are simplified approximations, not a validated reliability model. Service times use clipped normal sampling.
- Destination throughput uses service-start spacing; it is not a proven strict cap on completed tonnage over every rolling interval. Different payloads and service times can distort short-interval rates.
- Closures affect starts only; work and travel can overlap closures. The engine searches at most ten chained closure windows, so more complex overlapping schedules are not reliable.
- Target shares and minimum throughput are soft priorities, not guaranteed allocations. Inventory and maximum flow tons reserve whole truck payloads; residual material smaller than a load stays unserved.
- Trucks with no feasible dispatch stop rather than retrying later. A missing empty link or route can strand a fleet. No optimizer proves global feasibility or optimality.
- Queue/service counters can include work planned beyond the horizon. The mass balance identity is derived from loaded and dumped totals, not an independent conservation validation. A finite event limit guards runaway runs; large scenarios and sweeps run synchronously and may block the page.
- Fleet costs include truck hourly costs only. Sweep results are sensitivity estimates with finite replications, not confidence intervals or optimal fleet recommendations.

Validate travel/service distributions, closures, capacities, allocation behavior and outputs against site records before operational decisions.

Every input includes a visible column description and an accessible description linked to its control. Expand each section's Input dictionary for required/optional status and numeric bounds. Explanations live in the shared input-help.js module, including units, blank behavior, fractions versus percentages, independent loaded/empty links, soft material priorities, and simplified availability/closure/capacity behavior.

