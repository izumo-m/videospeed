# Build & Testing Infrastructure Migration Plan

**Goal:** Modernize videospeed's build and testing infrastructure to use
industry-standard tooling (Vitest, Husky, GitHub Actions) while preserving
every existing test and keeping the extension functional at every step.

**Non-goals:** TypeScript migration, switching from esbuild, rewriting E2E tests.

**End state:** After all phases, this project will have the same infrastructure
quality as any well-maintained open-source Chrome extension — minus TypeScript,
which is a deliberate choice.

**Principles:**
- Every phase is independently mergeable as its own PR
- Both old and new test runners coexist during migration
- Each checkpoint verifies nothing is broken before moving on
- The extension must load and function in Chrome after every commit

---

## Current State

| Area | Current Tooling | Issues |
|---|---|---|
| Test runner | Custom `SimpleTestRunner` class (~50 LOC) | No watch mode, no parallelism, no coverage, no ecosystem |
| Assertions | Custom `assert` object (6 methods) | No snapshot testing, no matchers, limited error messages |
| Test env setup | Manual JSDOM + globals in `run-tests.js` (120 lines) | Fragile, shared global state, test ordering constraints |
| Git hooks | Python `pre-commit` framework (v2.5.0) | Extra runtime dependency, uses Prettier 1.19 (project has 3.x) |
| CI/CD | None | No automated gate on PRs, honor-system testing |
| Linting | ESLint 8 + Prettier 3 | Working fine, low priority to change |
| Node version pinning | None | Contributors can use any Node version, get cryptic failures |
| Dependency updates | None | Deps rot silently, security vulns go unnoticed |
| Editor consistency | None | No `.editorconfig`, inconsistent formatting across editors |
| Security auditing | None | No `npm audit` anywhere in the pipeline |

## Target State

| Area | Target Tooling | Why |
|---|---|---|
| Test runner | Vitest | Watch mode, parallel execution, `vi.fn()` mocks, fake timers, v8 coverage, massive ecosystem |
| Assertions | Vitest `expect()` | Rich matchers, clear diffs, snapshot support if needed later |
| Test env setup | Vitest jsdom environment + setup file | Per-file isolation (fixes test ordering bugs), declarative config |
| Git hooks | Husky + lint-staged | Node-native, no Python dep, uses project-local Prettier 3.x |
| CI/CD | GitHub Actions | Automated lint + build + test + audit gate on every PR |
| Linting | ESLint 8 + Prettier 3 (unchanged) | If it ain't broke, don't fix it |
| Node version | `.nvmrc` + `engines` field | `nvm use` just works, CI and contributors aligned |
| Dependency updates | Dependabot | Auto-PRs for security patches and version bumps |
| Editor consistency | `.editorconfig` | Tabs/spaces/EOL consistent regardless of editor |
| Security auditing | `npm audit` in CI | Known vulns caught before merge |
| Coverage | Vitest v8 coverage with threshold | Coverage can't silently erode over time |

## What We Win

- **Test isolation** — each file gets its own jsdom. The current constraint
  that `injection-bridge.test.js` must run last disappears.
- **Watch mode** — `vitest --watch` re-runs only affected tests on save.
- **Coverage reports** — `vitest --coverage` with v8 provider, zero config.
- **Fake timers** — `vi.useFakeTimers()` replaces `await wait(1100)` hacks.
- **CI gate** — no more shipping broken code because someone forgot to run tests.
- **~500 lines of custom infra deleted** — less code to maintain for a decade.
- **Contributor onboarding** — "we use Vitest" vs "we have a custom thing, read the docs."

## What We Lose

- Nothing functional. The custom runner has zero features Vitest doesn't have.
- The Python pre-commit framework — replaced by Husky, which is better for
  a JavaScript project.

---

## Test File Inventory (31 files)

Every file listed here must pass after migration. This is the acceptance
criteria — no exceptions.

### Unit Tests (22 files)

**Utilities (5 files) — no module-loader dependency:**
- `tests/unit/utils/logger.test.js`
- `tests/unit/utils/blacklist-regex.test.js`
- `tests/unit/utils/event-manager.test.js`
- `tests/unit/utils/event-manager-matching.test.js`
- `tests/unit/utils/recursive-shadow-dom.test.js`

**Core (9 files) — use `loadCoreModules()` or `loadMinimalModules()`:**
- `tests/unit/core/settings.test.js`
- `tests/unit/core/action-handler.test.js`
- `tests/unit/core/video-controller.test.js`
- `tests/unit/core/icon-integration.test.js`
- `tests/unit/core/keyboard-shortcuts-saving.test.js`
- `tests/unit/core/f-keys.test.js`
- `tests/unit/core/migration.test.js`
- `tests/unit/core/settings-race-condition.test.js`
- `tests/unit/core/controller-css.test.js`

**Observers (2 files) — use `loadObserverModules()`:**
- `tests/unit/observers/mutation-observer.test.js`
- `tests/unit/observers/audio-size-handling.test.js`

**UI (2 files) — use `loadCoreModules()`:**
- `tests/unit/ui/drag-and-reset.test.js`
- `tests/unit/ui/options-recording.test.js`

**Content (4 files) — use `loadInjectModules()`, most complex:**
- `tests/unit/content/inject.test.js`
- `tests/unit/content/hydration-fix.test.js`
- `tests/unit/content/content-entry.test.js`
- `tests/unit/content/injection-bridge.test.js`

### Integration Tests (4 files)
- `tests/integration/module-integration.test.js`
- `tests/integration/ui-to-storage-flow.test.js`
- `tests/integration/state-manager-integration.test.js`
- `tests/integration/blacklist-blocking.test.js`

### E2E Tests (5 files — NOT migrated, kept as-is)
- `tests/e2e/basic.e2e.js`
- `tests/e2e/display-toggle.e2e.js`
- `tests/e2e/youtube.e2e.js`
- `tests/e2e/settings-injection.e2e.js`
- `tests/e2e/icon.e2e.js`

---

## API Migration Reference

The custom `SimpleTestRunner` maps 1:1 to Vitest. No compatibility shim needed
— the rewrite is mechanical.

```
BEFORE (custom)                      AFTER (vitest)
─────────────────────────────────    ─────────────────────────────────
import { SimpleTestRunner, assert }  import { describe, it, expect,
  from '../../helpers/test-utils';     beforeEach, afterEach } from 'vitest';

const runner = new SimpleTestRunner() describe('SuiteName', () => {
runner.beforeEach(() => { ... })       beforeEach(() => { ... });
runner.afterEach(() => { ... })        afterEach(() => { ... });
runner.test('name', () => { ... })     it('name', () => { ... });
export { runner };                   });

assert.equal(a, b)                   expect(a).toBe(b)
assert.true(v)                       expect(v).toBe(true)
assert.false(v)                      expect(v).toBe(false)
assert.exists(v)                     expect(v).toBeDefined()
assert.deepEqual(a, b)               expect(a).toEqual(b)
assert.throws(fn)                    expect(fn).toThrow()
```

Helper functions (`createMockVideo`, `createMockDOM`, `createMockKeyboardEvent`,
`createMockAudio`, `createMockEvent`, `wait`) are preserved as-is — they have
no dependency on the custom runner.

---

## Phase 1: Husky + lint-staged

**Replaces:** Python `pre-commit` framework + stale Prettier 1.19 mirror
**Risk:** Very low — completely independent of tests and build

### Steps

1. Remove `.pre-commit-config.yaml`
2. Install dependencies:
   ```
   npm install --save-dev husky lint-staged
   ```
3. Add to `package.json`:
   ```json
   "lint-staged": {
     "*.js": ["eslint --fix", "prettier --write"],
     "*.{json,md,css,html}": ["prettier --write"]
   }
   ```
4. Add prepare script to `package.json`:
   ```json
   "prepare": "husky"
   ```
5. Run `npx husky init`
6. Create `.husky/pre-commit`:
   ```sh
   npx lint-staged
   ```

### Checkpoint 1
- [ ] `git commit` on a staged `.js` file triggers ESLint + Prettier
- [ ] `git commit` on a staged `.md` file triggers Prettier only
- [ ] `.pre-commit-config.yaml` is deleted
- [ ] `npm run build && npm run test` still passes

**Commit and tag: `infra: replace pre-commit with husky + lint-staged`**

---

## Phase 1.5: Project Hygiene

**Adds:** Node version pinning, editor consistency, contributor guardrails
**Risk:** Very low — config files only, no code changes

### Steps

1. Create `.nvmrc`:
   ```
   20
   ```

2. Add `engines` field to `package.json`:
   ```json
   "engines": {
     "node": ">=20.0.0"
   }
   ```

3. Create `.editorconfig`:
   ```ini
   root = true

   [*]
   indent_style = space
   indent_size = 2
   end_of_line = lf
   charset = utf-8
   trim_trailing_whitespace = true
   insert_final_newline = true

   [*.md]
   trim_trailing_whitespace = false
   ```

### Checkpoint 1.5
- [ ] `nvm use` in the repo root picks up Node 20
- [ ] `npm install` on Node 18 warns about engine mismatch
- [ ] Editor respects `.editorconfig` settings (VS Code, JetBrains, etc.)
- [ ] `npm run build && npm run test` still passes

**Commit: `infra: add .nvmrc, engines field, and .editorconfig`**

---

## Phase 2: GitHub Actions CI

**Adds:** Automated lint, build, and test gate on every PR
**Risk:** Low — additive only, changes nothing locally
**Why now:** CI protects every subsequent migration step from regressions

### Steps

1. Create `.github/workflows/ci.yml`:
   ```yaml
   name: CI

   on:
     push:
       branches: [master]
     pull_request:
       branches: [master]

   jobs:
     build-and-test:
       name: Lint, Build, Test
       runs-on: ubuntu-latest
       strategy:
         matrix:
           node-version: [20.x, 22.x]

       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: ${{ matrix.node-version }}
             cache: npm

         - run: npm ci
         - run: npm audit --audit-level=high
         - run: npm run lint
         - run: npm run build
         - run: npm run test:unit
         - run: npm run test:integration

         - uses: actions/upload-artifact@v4
           if: always()
           with:
             name: dist-node-${{ matrix.node-version }}
             path: dist/
             retention-days: 7
   ```

2. Create `.github/dependabot.yml`:
   ```yaml
   version: 2
   updates:
     - package-ecosystem: npm
       directory: /
       schedule:
         interval: weekly
       open-pull-requests-limit: 10
       labels:
         - dependencies
     - package-ecosystem: github-actions
       directory: /
       schedule:
         interval: weekly
       labels:
         - ci
   ```

3. E2E tests are intentionally excluded from CI — they require a Chrome binary
   download (~170MB) and are slow. These stay as a manual step.

### Checkpoint 2
- [ ] Push branch, CI runs green on GitHub
- [ ] Both Node 20 and 22 matrix jobs pass
- [ ] `npm audit` step runs (may warn, should not block on low/moderate)
- [ ] `dist/` artifact is uploaded
- [ ] Dependabot creates its first PR within a week
- [ ] Local `npm test` still works unchanged

**Commit and tag: `ci: add GitHub Actions workflow and dependabot config`**

---

## Phase 3: Vitest Scaffolding

**Adds:** Vitest config and setup file, running alongside old runner
**Risk:** Low — no existing tests are modified

### Steps

1. Install Vitest:
   ```
   npm install --save-dev vitest
   ```

2. Create `vitest.config.js`:
   ```js
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     test: {
       environment: 'jsdom',
       globals: true,
       include: ['tests/**/*.vitest.js'],
       setupFiles: ['./tests/helpers/vitest-setup.js'],
       testTimeout: 10000,
       hookTimeout: 10000,
     },
   });
   ```

   The `include` pattern targets `.vitest.js` initially so converted tests
   are picked up without affecting the old runner.

3. Create `tests/helpers/vitest-setup.js`:

   This file replicates the global environment that `run-tests.js` (lines
   28-119) sets up manually. It must provide:

   - `globalThis.chrome` via the existing `chrome-mock.js`
   - Shadow DOM polyfill for JSDOM (attachShadow mock)
   - `globalThis.requestIdleCallback` stub
   - `globalThis.location` override for `http://localhost`

   ```js
   import { installChromeMock, resetMockStorage } from './chrome-mock.js';
   import { beforeEach } from 'vitest';

   // Install chrome API mock
   installChromeMock();

   // Shadow DOM polyfill (JSDOM doesn't support attachShadow)
   // Port logic from run-tests.js lines 82-119
   const origAttachShadow = HTMLElement.prototype.attachShadow;
   if (!origAttachShadow || typeof origAttachShadow !== 'function') {
     // ... (port the full polyfill from run-tests.js)
   }

   // Stub APIs missing from JSDOM
   if (typeof globalThis.requestIdleCallback === 'undefined') {
     globalThis.requestIdleCallback = (cb) => setTimeout(cb, 0);
   }

   // Reset mock storage between tests
   beforeEach(() => {
     resetMockStorage();
   });
   ```

4. Add scripts to `package.json`:
   ```json
   "test:vitest": "vitest run",
   "test:vitest:watch": "vitest"
   ```

### Checkpoint 3
- [ ] `npm run test:vitest` runs and reports 0 tests found, 0 failures
- [ ] `npm run test:unit` (old runner) still passes all 22 unit tests
- [ ] `npm run test:integration` (old runner) still passes all 4 integration tests
- [ ] `npm run build` still works

**Commit and tag: `infra: add vitest scaffolding and setup file`**

---

## Phase 4: Migrate Unit Tests to Vitest

This is the largest phase. It is split into 4 batches, each independently
committable. Both runners coexist — converted files use `.vitest.js` extension
and are picked up by Vitest; unconverted files stay as `.test.js` and are
picked up by the old runner.

### Migration recipe (per file)

1. Copy `tests/unit/foo/bar.test.js` to `tests/unit/foo/bar.vitest.js`
2. Rewrite imports: drop `SimpleTestRunner` and `assert`, add Vitest globals
3. Wrap tests in `describe()` block
4. Replace `runner.test()` with `it()`, `runner.beforeEach()` with `beforeEach()`, etc.
5. Replace all `assert.*` calls with `expect().*` equivalents (see reference table above)
6. Keep `loadCoreModules()` / `loadInjectModules()` calls — they work with top-level `await`
7. Remove `export { runner }` — Vitest discovers tests automatically
8. Run `npx vitest run tests/unit/foo/bar.vitest.js` to validate
9. Remove the original `.test.js` file
10. Remove the file from `run-tests.js`'s hardcoded file list

### Batch 4a: Utility tests (5 files)

**Why first:** Simplest tests, no `module-loader.js` dependency, pure logic.

Files:
- `tests/unit/utils/logger.test.js`
- `tests/unit/utils/blacklist-regex.test.js`
- `tests/unit/utils/event-manager.test.js`
- `tests/unit/utils/event-manager-matching.test.js`
- `tests/unit/utils/recursive-shadow-dom.test.js`

### Checkpoint 4a
- [ ] `npx vitest run` passes all 5 converted utility tests
- [ ] `node tests/run-tests.js unit` passes remaining 17 unconverted tests
- [ ] No test is lost — 5 (vitest) + 17 (old) = 22 total

**Commit: `test: migrate utility tests to vitest (5/22)`**

---

### Batch 4b: Core tests (9 files)

**Why second:** Highest coverage area, uses `loadCoreModules()` and
`loadMinimalModules()` — validates that the module-loader works in Vitest's
jsdom environment.

Files:
- `tests/unit/core/settings.test.js`
- `tests/unit/core/action-handler.test.js`
- `tests/unit/core/video-controller.test.js`
- `tests/unit/core/icon-integration.test.js`
- `tests/unit/core/keyboard-shortcuts-saving.test.js`
- `tests/unit/core/f-keys.test.js`
- `tests/unit/core/migration.test.js`
- `tests/unit/core/settings-race-condition.test.js`
- `tests/unit/core/controller-css.test.js`

**Watch out for:**
- `settings.test.js` uses `await wait(1100)` for debounce timing — preserve
  as-is now, optimize with `vi.useFakeTimers()` in a future pass.
- `settings-race-condition.test.js` likely has timing-sensitive assertions.

### Checkpoint 4b
- [ ] `npx vitest run` passes all 14 converted tests (5 util + 9 core)
- [ ] `node tests/run-tests.js unit` passes remaining 8 unconverted tests
- [ ] Total: 14 (vitest) + 8 (old) = 22

**Commit: `test: migrate core tests to vitest (14/22)`**

---

### Batch 4c: Observer and UI tests (4 files)

Files:
- `tests/unit/observers/mutation-observer.test.js`
- `tests/unit/observers/audio-size-handling.test.js`
- `tests/unit/ui/drag-and-reset.test.js`
- `tests/unit/ui/options-recording.test.js`

### Checkpoint 4c
- [ ] `npx vitest run` passes all 18 converted tests
- [ ] `node tests/run-tests.js unit` passes remaining 4 unconverted tests
- [ ] Total: 18 (vitest) + 4 (old) = 22

**Commit: `test: migrate observer and UI tests to vitest (18/22)`**

---

### Batch 4d: Content tests (4 files)

**Why last:** Most complex. Uses `loadInjectModules()` which loads the full
module chain plus `src/content/inject.js`. The `injection-bridge.test.js`
currently must run last in the old runner due to permanent window message
listeners — Vitest's per-file isolation should eliminate this constraint.

Files:
- `tests/unit/content/inject.test.js`
- `tests/unit/content/hydration-fix.test.js`
- `tests/unit/content/content-entry.test.js`
- `tests/unit/content/injection-bridge.test.js`

**Watch out for:**
- Verify `injection-bridge.test.js` works without ordering constraints in Vitest
- If `loadInjectModules()` has side effects that leak between files, may need
  `vi.resetModules()` in `beforeEach`

### Checkpoint 4d
- [ ] `npx vitest run` passes all 22 converted unit tests
- [ ] `node tests/run-tests.js unit` has zero files left to run
- [ ] `injection-bridge.test.js` passes without ordering constraint

**Commit: `test: migrate content tests to vitest (22/22 unit tests complete)`**

---

## Phase 5: Migrate Integration Tests to Vitest

Same mechanical process as Phase 4. 4 files.

Files:
- `tests/integration/module-integration.test.js`
- `tests/integration/ui-to-storage-flow.test.js`
- `tests/integration/state-manager-integration.test.js`
- `tests/integration/blacklist-blocking.test.js`

### Checkpoint 5
- [ ] `npx vitest run` passes all 26 tests (22 unit + 4 integration)
- [ ] Old runner `run-tests.js` has no remaining test files

**Commit: `test: migrate integration tests to vitest (26/26 complete)`**

---

## Phase 6: Cleanup

**Remove old infrastructure, finalize Vitest as the sole runner.**

### Steps

1. Delete `tests/run-tests.js`
2. In `tests/helpers/test-utils.js`:
   - Delete `SimpleTestRunner` class (lines 268-319)
   - Delete `assert` object (lines 219-263)
   - Keep all helper functions: `createMockVideo`, `createMockAudio`,
     `createMockDOM`, `wait`, `createMockEvent`, `createMockKeyboardEvent`
3. Rename all `.vitest.js` files back to `.test.js`
4. Update `vitest.config.js` include pattern:
   ```js
   include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js']
   ```
5. Update `package.json` scripts:
   ```json
   "test": "vitest run",
   "test:unit": "vitest run tests/unit/",
   "test:integration": "vitest run tests/integration/",
   "test:e2e": "npm run build && node tests/e2e/run-e2e.js",
   "test:watch": "vitest",
   "test:coverage": "vitest run --coverage"
   ```
6. Remove old scripts: `test:vitest`, `test:vitest:watch`
7. Update `.eslintrc.json` test overrides: replace `jest: true` env with
   vitest globals (or add `eslint-plugin-vitest` if desired)
8. Add coverage config to `vitest.config.js`:
   ```js
   coverage: {
     provider: 'v8',
     reporter: ['text', 'json', 'html'],
     exclude: ['node_modules/', 'dist/', 'tests/', 'scripts/', '*.config.*'],
     thresholds: {
       statements: 60,
       branches: 60,
       functions: 60,
       lines: 60,
     },
   },
   ```
   Set thresholds to whatever the current coverage actually is (round down to
   nearest 5). This creates a ratchet — coverage can go up but never down.
   Tighten thresholds over time as coverage improves.
9. Add `coverage/` to `.gitignore`

### Checkpoint 6
- [ ] `npm test` runs Vitest, all 26 tests pass
- [ ] `npm run test:unit` runs only unit tests (22 pass)
- [ ] `npm run test:integration` runs only integration tests (4 pass)
- [ ] `npm run test:e2e` still works (Puppeteer, unchanged)
- [ ] `npm run test:watch` starts Vitest in watch mode
- [ ] `tests/run-tests.js` no longer exists
- [ ] No references to `SimpleTestRunner` or custom `assert` remain in test files
- [ ] `npm run build && npm run zip` produces a working extension

**Commit: `infra: remove custom test runner, finalize vitest migration`**

---

## Phase 7: Update CI for Vitest

### Steps

1. Update `.github/workflows/ci.yml` to use new test commands:
   ```yaml
   - run: npm test            # now runs vitest
   ```
   Remove the separate `test:unit` and `test:integration` steps since
   `npm test` now runs both via Vitest.

2. Optionally add a coverage step:
   ```yaml
   - run: npm run test:coverage
   - uses: actions/upload-artifact@v4
     with:
       name: coverage-node-${{ matrix.node-version }}
       path: coverage/
   ```

### Checkpoint 7
- [ ] CI passes with Vitest on both Node 20 and 22
- [ ] Coverage artifact is uploaded (if added)

**Commit: `ci: update workflow to use vitest`**

---

## Decisions NOT Made (Intentionally Deferred)

These are things a 10-year maintainer might want eventually, but they are
out of scope for this migration to keep it focused and safe:

| Topic | Why Deferred |
|---|---|
| **TypeScript** | Large migration, orthogonal to test infra. Do it when the codebase demands it, not before. |
| **Vite replacing esbuild** | esbuild is simple and fast for this project. Vite adds complexity (HMR, dev server) that a browser extension doesn't need. |
| **E2E migration to Vitest** | Puppeteer E2E tests are fundamentally different from jsdom unit tests. The existing `run-e2e.js` works. Don't fix what isn't broken. |
| **Pre-push hook** | Without TypeScript there's no typecheck to run. CI is the real gate. Revisit when TS is added. |
| **ESLint 9 flat config** | ESLint 8 works, migration is nontrivial, and the ecosystem is still settling. |
| **`vi.useFakeTimers()`** | Some tests use `await wait(1100)` for debounce testing. Converting to fake timers is a nice optimization but not required for the migration. Do it as a follow-up. |
| **Snapshot testing** | Available via Vitest but not needed today. Add when there's a real use case. |

---

## Execution Order Summary

| # | Phase | Commit Message | Depends On |
|---|---|---|---|
| 1 | Husky + lint-staged | `infra: replace pre-commit with husky + lint-staged` | — |
| 1.5 | Project hygiene | `infra: add .nvmrc, engines field, and .editorconfig` | — |
| 2 | GitHub Actions CI + Dependabot | `ci: add GitHub Actions workflow and dependabot config` | — |
| 3 | Vitest scaffolding | `infra: add vitest scaffolding and setup file` | — |
| 4a | Migrate utility tests | `test: migrate utility tests to vitest (5/22)` | 3 |
| 4b | Migrate core tests | `test: migrate core tests to vitest (14/22)` | 4a |
| 4c | Migrate observer/UI tests | `test: migrate observer and UI tests to vitest (18/22)` | 4b |
| 4d | Migrate content tests | `test: migrate content tests to vitest (22/22)` | 4c |
| 5 | Migrate integration tests | `test: migrate integration tests to vitest (26/26)` | 4d |
| 6 | Remove old test infra | `infra: remove custom test runner, finalize vitest migration` | 5 |
| 7 | Update CI for Vitest | `ci: update workflow to use vitest` | 6 |

Phases 1, 1.5, 2, and 3 are independent and can be done in parallel or any order.
Phases 4a through 7 are sequential.

---

## Risk Mitigation

**If a converted test fails in Vitest but passed in the old runner:**
1. Check global state — Vitest isolates per-file, the old runner shared globals
2. Check `window.VSC` — module-loader side effects may need `beforeAll` instead of top-level
3. Check chrome mock — `vitest-setup.js` might need adjustments vs `run-tests.js` setup
4. Run the old version side-by-side: the `.test.js` original is still there until cleanup

**If module-loader breaks in Vitest's jsdom:**
- Vitest's jsdom might differ from the manually-created JSDOM in `run-tests.js`
- Fix in `vitest-setup.js` by matching the exact JSDOM config (url, pretendToBeVisual, etc.)
- Worst case: override Vitest's jsdom with a custom environment

**Rollback plan:**
- Every phase is a separate commit. `git revert` any phase independently.
- Old runner is not deleted until Phase 6. Until then, `npm run test:unit` (old)
  and `npm run test:vitest` (new) both work.

---

## Definition of Done: End State

After all phases are complete, the project should have every item checked.
This is what "standard, production-grade Chrome extension infrastructure"
looks like for a JavaScript (non-TypeScript) project.

### Testing
- [ ] `npm test` runs Vitest, all 26 unit + integration tests pass
- [ ] `npm run test:watch` starts Vitest in watch mode, re-runs on save
- [ ] `npm run test:coverage` generates v8 coverage report
- [ ] Coverage thresholds enforced — can't silently erode
- [ ] E2E tests still work via `npm run test:e2e` (Puppeteer, unchanged)
- [ ] Each test file runs in its own isolated jsdom — no ordering constraints

### CI/CD
- [ ] Every push to `master` and every PR runs: audit, lint, build, test
- [ ] CI tests on Node 20 and 22 (matrix)
- [ ] `dist/` uploaded as build artifact on every CI run
- [ ] `npm audit --audit-level=high` catches known vulnerabilities before merge
- [ ] Dependabot sends weekly PRs for npm and GitHub Actions updates
- [ ] Branch protection on `master` requires CI to pass (repo setting)

### Git Hooks
- [ ] Pre-commit runs ESLint --fix + Prettier on staged files (Husky + lint-staged)
- [ ] No Python runtime required — pure Node.js toolchain
- [ ] Uses project-local Prettier 3.x (not a stale mirror)

### Project Hygiene
- [ ] `.nvmrc` pins Node 20 — `nvm use` just works
- [ ] `engines` field in `package.json` warns on wrong Node version
- [ ] `.editorconfig` ensures consistent indentation/EOL across editors
- [ ] `.gitignore` covers `dist/`, `node_modules/`, `coverage/`, OS files

### Linting & Formatting
- [ ] ESLint with security rules (no-eval, no-implied-eval, no-new-func)
- [ ] Prettier enforced via pre-commit hook and CI
- [ ] Consistent single quotes, semicolons, 2-space indentation

### Build
- [ ] esbuild bundles 5 entry points to `dist/` (IIFE, chrome114 target)
- [ ] `npm run dev` for watch mode during development
- [ ] `npm run zip` packages extension for Chrome Web Store

### What the Repo Tree Looks Like

```
videospeed/
├── .editorconfig              # editor consistency
├── .eslintrc.json             # linting rules
├── .github/
│   ├── dependabot.yml         # automated dependency updates
│   └── workflows/
│       └── ci.yml             # lint → audit → build → test
├── .gitignore
├── .husky/
│   └── pre-commit             # lint-staged hook
├── .nvmrc                     # node version pinning
├── manifest.json              # Chrome Extension MV3
├── package.json               # scripts, engines, lint-staged config
├── vitest.config.js           # test configuration
├── scripts/
│   └── build.mjs              # esbuild bundler
├── src/                       # extension source code
│   └── ...
├── tests/
│   ├── helpers/
│   │   ├── chrome-mock.js     # Chrome API mock (preserved)
│   │   ├── module-loader.js   # side-effect module loader (preserved)
│   │   ├── test-utils.js      # helper functions only (runner/assert removed)
│   │   └── vitest-setup.js    # global test environment setup
│   ├── unit/                  # 22 vitest test files
│   ├── integration/           # 4 vitest test files
│   └── e2e/                   # 5 puppeteer test files (unchanged)
└── dist/                      # build output (gitignored)
```

### What's NOT in the End State (and Why)

| Absent | Reason |
|---|---|
| TypeScript | Deliberate. JS is appropriate for this project's complexity. Add when the codebase demands it. |
| Vite / Webpack | esbuild is simpler and faster. No complex UI to justify Vite's dev server or HMR. |
| React / framework | Vanilla HTML UI is the right choice for a lightweight extension. |
| Playwright | Puppeteer E2E already works. Switching is lateral, not upward. |
| Semantic release | Overkill for manual Chrome Web Store uploads. |
| ESLint 9 flat config | ESLint 8 works. Migrate when ESLint 8 reaches EOL, not before. |
| Monorepo / workspaces | Single extension, no shared packages. |
| Biome | ESLint + Prettier already covers this. Switching is lateral. |
| Pre-push hook | Without TypeScript there's no typecheck to gate on. CI is the real gate. |
| Snapshot testing | Available via Vitest but no use case today. Add when needed. |

This end state is **standard for a well-maintained JavaScript Chrome extension**.
It matches or exceeds what you'd find in Dark Reader, uBlock Origin, and similar
projects — the only thing those have that we don't is TypeScript, which is a
conscious choice, not a gap.
