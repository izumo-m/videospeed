/**
 * Integration tests for full UI to storage flow
 * Tests the complete path from user interactions to storage persistence
 */

import { installChromeMock, cleanupChromeMock, resetMockStorage } from '../helpers/chrome-mock.js';
import { createMockVideo, createMockDOM } from '../helpers/test-utils.js';
import { loadCoreModules } from '../helpers/module-loader.js';

// Load all required modules
await loadCoreModules();

let mockDOM;

describe('UIToStorageFlow', () => {
  beforeEach(() => {
    installChromeMock();
    resetMockStorage();
    mockDOM = createMockDOM();

    // Initialize site handler manager for tests
    if (window.VSC && window.VSC.siteHandlerManager) {
      window.VSC.siteHandlerManager.initialize(document);
    }
  });

  afterEach(() => {
    cleanupChromeMock();
    if (mockDOM) {
      mockDOM.cleanup();
    }
  });

  it('Full flow: keyboard shortcut → adjustSpeed → storage → UI update', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();
    config.settings.rememberSpeed = true; // Global mode

    const eventManager = new window.VSC.EventManager(config, null);
    const actionHandler = new window.VSC.ActionHandler(config, eventManager);

    // Create video with controller
    const mockVideo = createMockVideo({ playbackRate: 1.0 });
    mockDOM.container.appendChild(mockVideo);
    const controller = new window.VSC.VideoController(mockVideo, null, config, actionHandler);

    // Track storage saves
    const savedData = [];
    const originalSave = config.save;
    config.save = async function (data) {
      savedData.push({ ...data });
      return originalSave.call(this, data);
    };

    // Simulate keyboard shortcut for "faster" (D key)
    actionHandler.runAction('faster', 0.1);

    // Verify complete flow
    expect(mockVideo.playbackRate).toBe(1.1); // Video speed changed
    expect(controller.speedIndicator.textContent).toBe('1.10'); // UI updated
    expect(config.settings.lastSpeed).toBe(1.1); // Config updated
    expect(savedData.length >= 1).toBe(true); // Storage called at least once
    const lastSave = savedData[savedData.length - 1];
    expect(lastSave.lastSpeed).toBe(1.1); // Correct data saved
  });

  it('Full flow: popup button → adjustSpeed → storage (non-persistent mode)', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();
    config.settings.rememberSpeed = false; // Non-persistent mode

    const eventManager = new window.VSC.EventManager(config, null);
    const actionHandler = new window.VSC.ActionHandler(config, eventManager);

    // Create video with specific source
    const mockVideo = createMockVideo({
      currentSrc: 'https://example.com/test-video.mp4',
      playbackRate: 1.0,
    });
    mockDOM.container.appendChild(mockVideo);
    const controller = new window.VSC.VideoController(mockVideo, null, config, actionHandler);

    // Track storage saves
    const savedData = [];
    const originalSave = config.save;
    config.save = async function (data) {
      savedData.push({ ...data });
      return originalSave.call(this, data);
    };

    // Simulate popup preset button (1.5x speed)
    actionHandler.runAction('SET_SPEED', 1.5);

    // Verify complete flow for non-persistent mode
    expect(mockVideo.playbackRate).toBe(1.5); // Video speed changed
    expect(controller.speedIndicator.textContent).toBe('1.50'); // UI updated
    // With rememberSpeed = false, no storage saves should occur
    expect(savedData.length).toBe(0); // No storage saves in non-persistent mode
  });

  it('Full flow: external change → force mode → restore → storage', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();
    config.settings.rememberSpeed = true;
    config.settings.lastSpeed = 2.0;

    const eventManager = new window.VSC.EventManager(config, null);
    const actionHandler = new window.VSC.ActionHandler(config, eventManager);

    // Create video
    const mockVideo = createMockVideo({ playbackRate: 1.0 });
    mockDOM.container.appendChild(mockVideo);
    const controller = new window.VSC.VideoController(mockVideo, null, config, actionHandler);

    // Track storage saves
    const savedData = [];
    const originalSave = config.save;
    config.save = async function (data) {
      savedData.push({ ...data });
      return originalSave.call(this, data);
    };

    // Simulate external change (e.g., from site's native controls)
    actionHandler.adjustSpeed(mockVideo, 3.0, { source: 'external' });

    // Verify force mode blocked external change and restored preference
    expect(mockVideo.playbackRate).toBe(2.0); // Blocked external change, restored to preference
    expect(controller.speedIndicator.textContent).toBe('2.00'); // UI shows restored speed
    expect(config.settings.lastSpeed).toBe(2.0); // Config unchanged
    expect(savedData.length).toBe(1); // Storage called to save restoration
    expect(savedData[0].lastSpeed).toBe(2.0); // Saved restored speed
  });

  it('Full flow: mouse wheel → relative change → storage → UI', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const eventManager = new window.VSC.EventManager(config, null);
    const actionHandler = new window.VSC.ActionHandler(config, eventManager);

    // Create video
    const mockVideo = createMockVideo({ playbackRate: 1.5 });
    mockDOM.container.appendChild(mockVideo);
    const controller = new window.VSC.VideoController(mockVideo, null, config, actionHandler);

    // Track storage saves
    const savedData = [];
    const originalSave = config.save;
    config.save = async function (data) {
      savedData.push({ ...data });
      return originalSave.call(this, data);
    };

    // Simulate mouse wheel scroll (relative change)
    actionHandler.adjustSpeed(mockVideo, 0.1, { relative: true });

    // Verify relative change flow
    expect(mockVideo.playbackRate).toBe(1.6); // 1.5 + 0.1
    expect(controller.speedIndicator.textContent).toBe('1.60'); // UI updated
    expect(config.settings.lastSpeed).toBe(1.6); // Config updated
    expect(savedData.length).toBe(1); // Storage called
    expect(savedData[0].lastSpeed).toBe(1.6); // Correct relative result saved
  });

  it('Full flow: multiple videos → different speeds → correct storage behavior', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();
    config.settings.rememberSpeed = false; // Non-persistent mode

    const eventManager = new window.VSC.EventManager(config, null);
    const actionHandler = new window.VSC.ActionHandler(config, eventManager);

    // Create multiple videos
    const video1 = createMockVideo({ currentSrc: 'https://site1.com/video1.mp4' });
    const video2 = createMockVideo({ currentSrc: 'https://site2.com/video2.mp4' });

    mockDOM.container.appendChild(video1);
    mockDOM.container.appendChild(video2);

    const controller1 = new window.VSC.VideoController(video1, null, config, actionHandler);
    const controller2 = new window.VSC.VideoController(video2, null, config, actionHandler);

    // Track storage saves
    const savedData = [];
    const originalSave = config.save;
    config.save = async function (data) {
      savedData.push({ ...data });
      return originalSave.call(this, data);
    };

    // Change speeds on different videos
    actionHandler.adjustSpeed(video1, 1.25);
    actionHandler.adjustSpeed(video2, 1.75);

    // Verify each video has correct state
    expect(video1.playbackRate).toBe(1.25);
    expect(video2.playbackRate).toBe(1.75);
    expect(controller1.speedIndicator.textContent).toBe('1.25');
    expect(controller2.speedIndicator.textContent).toBe('1.75');

    // With non-persistent mode, no storage saves should occur
    expect(savedData.length).toBe(0); // No saves with rememberSpeed = false
  });

  it('Full flow: speed limits enforcement → clamping → correct storage', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const eventManager = new window.VSC.EventManager(config, null);
    const actionHandler = new window.VSC.ActionHandler(config, eventManager);

    const mockVideo = createMockVideo({ playbackRate: 1.0 });
    mockDOM.container.appendChild(mockVideo);
    const controller = new window.VSC.VideoController(mockVideo, null, config, actionHandler);

    // Track storage saves
    const savedData = [];
    const originalSave = config.save;
    config.save = async function (data) {
      savedData.push({ ...data });
      return originalSave.call(this, data);
    };

    // Try to set speed above maximum
    actionHandler.adjustSpeed(mockVideo, 25.0);

    // Verify clamping and correct storage
    expect(mockVideo.playbackRate).toBe(16.0); // Clamped to max
    expect(controller.speedIndicator.textContent).toBe('16.00'); // UI shows clamped
    expect(config.settings.lastSpeed).toBe(16.0); // Config has clamped value
    expect(savedData.length).toBe(1); // Storage called
    expect(savedData[0].lastSpeed).toBe(16.0); // Clamped value saved, not original

    // Try to set speed below minimum
    actionHandler.adjustSpeed(mockVideo, 0.01);

    // Verify minimum clamping
    expect(mockVideo.playbackRate).toBe(0.07); // Clamped to min
    expect(controller.speedIndicator.textContent).toBe('0.07'); // UI shows clamped
    expect(savedData[1].lastSpeed).toBe(0.07); // Clamped value saved
  });
});
