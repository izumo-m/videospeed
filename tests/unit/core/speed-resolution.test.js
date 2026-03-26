/**
 * Unit tests for the speed resolution state machine (getTargetSpeed).
 *
 * Covers all rows of the truth table from plan.md:
 *   baseline = siteDefaultSpeed ?? 1.0
 *   lastSpeed wins if user has changed it (in-memory, !== 1.0)
 *   rememberSpeed controls cross-session storage persistence only
 */

import { installChromeMock, cleanupChromeMock, resetMockStorage } from '../../helpers/chrome-mock.js';
import { SimpleTestRunner, assert, createMockVideo, createMockDOM } from '../../helpers/test-utils.js';
import { loadCoreModules } from '../../helpers/module-loader.js';

await loadCoreModules();

const runner = new SimpleTestRunner();
let mockDOM;

runner.beforeEach(() => {
  installChromeMock();
  resetMockStorage();
  mockDOM = createMockDOM();
  if (window.VSC?.stateManager) window.VSC.stateManager.controllers.clear();
  if (window.VSC?.siteHandlerManager) window.VSC.siteHandlerManager.initialize(document);
});

runner.afterEach(() => {
  cleanupChromeMock();
  if (window.VSC?.stateManager) window.VSC.stateManager.controllers.clear();
  document.querySelectorAll('video, audio').forEach(el => el.remove());
  if (mockDOM) mockDOM.cleanup();
});

function makeController(config) {
  const eventManager = new window.VSC.EventManager(config, null);
  const actionHandler = new window.VSC.ActionHandler(config, eventManager);
  const video = createMockVideo();
  mockDOM.container.appendChild(video);
  return new window.VSC.VideoController(video, null, config, actionHandler);
}

// --- Truth table row 1: rememberSpeed=OFF, no site rule, lastSpeed=1.0 → 1.0 ---
runner.test('no site rule, rememberSpeed OFF → baseline 1.0', async () => {
  const config = window.VSC.videoSpeedConfig;
  await config.load();
  config.settings.rememberSpeed = false;
  config.settings.lastSpeed = 1.0;
  config.settings.siteDefaultSpeed = undefined;

  const ctrl = makeController(config);
  assert.equal(ctrl.getTargetSpeed(), 1.0, 'should return 1.0 baseline');
});

// --- Truth table row 2: rememberSpeed=OFF, site rule speed=2.0, lastSpeed=1.0 → 2.0 ---
runner.test('site rule speed=2.0, rememberSpeed OFF, lastSpeed default → site baseline 2.0', async () => {
  const config = window.VSC.videoSpeedConfig;
  await config.load();
  config.settings.rememberSpeed = false;
  config.settings.lastSpeed = 1.0;
  config.settings.siteDefaultSpeed = 2.0;

  const ctrl = makeController(config);
  assert.equal(ctrl.getTargetSpeed(), 2.0, 'should return site baseline');
});

// --- Truth table row 3: rememberSpeed=ON, no site rule, lastSpeed=1.5 → 1.5 ---
runner.test('rememberSpeed ON, lastSpeed=1.5, no site rule → 1.5 (global carry)', async () => {
  const config = window.VSC.videoSpeedConfig;
  await config.load();
  config.settings.rememberSpeed = true;
  config.settings.lastSpeed = 1.5;
  config.settings.siteDefaultSpeed = undefined;

  const ctrl = makeController(config);
  assert.equal(ctrl.getTargetSpeed(), 1.5, 'should carry lastSpeed');
});

// --- Truth table row 4: rememberSpeed=ON, no site rule, lastSpeed=1.0 → 1.0 ---
runner.test('rememberSpeed ON, lastSpeed=1.0 (default), no site rule → 1.0', async () => {
  const config = window.VSC.videoSpeedConfig;
  await config.load();
  config.settings.rememberSpeed = true;
  config.settings.lastSpeed = 1.0;
  config.settings.siteDefaultSpeed = undefined;

  const ctrl = makeController(config);
  assert.equal(ctrl.getTargetSpeed(), 1.0, 'should return default baseline');
});

// --- Truth table row 5: rememberSpeed=ON, site=2.0, lastSpeed=1.5 → 1.5 (global carry wins) ---
runner.test('rememberSpeed ON, site=2.0, lastSpeed=1.5 → 1.5 (global carry wins)', async () => {
  const config = window.VSC.videoSpeedConfig;
  await config.load();
  config.settings.rememberSpeed = true;
  config.settings.lastSpeed = 1.5;
  config.settings.siteDefaultSpeed = 2.0;

  const ctrl = makeController(config);
  assert.equal(ctrl.getTargetSpeed(), 1.5, 'lastSpeed overrides site baseline');
});

// --- Truth table row 6: rememberSpeed=ON, site=2.0, lastSpeed=1.0 → 2.0 (baseline fills in) ---
runner.test('rememberSpeed ON, site=2.0, lastSpeed=1.0 (default) → 2.0 (baseline fills in)', async () => {
  const config = window.VSC.videoSpeedConfig;
  await config.load();
  config.settings.rememberSpeed = true;
  config.settings.lastSpeed = 1.0;
  config.settings.siteDefaultSpeed = 2.0;

  const ctrl = makeController(config);
  assert.equal(ctrl.getTargetSpeed(), 2.0, 'site baseline fills in when lastSpeed is default');
});

// --- Session persistence: user changes speed mid-session, getTargetSpeed reflects it ---
runner.test('session: user changes speed to 1.4, getTargetSpeed returns 1.4', async () => {
  const config = window.VSC.videoSpeedConfig;
  await config.load();
  config.settings.rememberSpeed = false;
  config.settings.lastSpeed = 1.0;
  config.settings.siteDefaultSpeed = 2.0;

  const ctrl = makeController(config);
  assert.equal(ctrl.getTargetSpeed(), 2.0, 'initially returns site baseline');

  // Simulate user changing speed (setSpeed updates lastSpeed in-memory)
  config.settings.lastSpeed = 1.4;
  assert.equal(ctrl.getTargetSpeed(), 1.4, 'after user change, lastSpeed wins');
});

// --- Edge: siteDefaultSpeed=null treated same as undefined ---
runner.test('siteDefaultSpeed=null falls back to 1.0 baseline', async () => {
  const config = window.VSC.videoSpeedConfig;
  await config.load();
  config.settings.rememberSpeed = false;
  config.settings.lastSpeed = 1.0;
  config.settings.siteDefaultSpeed = null;

  const ctrl = makeController(config);
  assert.equal(ctrl.getTargetSpeed(), 1.0, 'null site speed = default baseline');
});

export { runner };
