/**
 * Unit tests for settings management
 * Using global variables to match browser extension architecture
 */

import {
  installChromeMock,
  cleanupChromeMock,
  resetMockStorage,
} from '../../helpers/chrome-mock.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { wait } from '../../helpers/test-utils.js';
import { loadCoreModules } from '../../helpers/module-loader.js';

// Load all required modules
await loadCoreModules();

describe('Settings', () => {
  beforeEach(() => {
    installChromeMock();
    resetMockStorage();

    // Clear any injected settings for clean tests
    if (window.VSC && window.VSC.StorageManager) {
      window.VSC.StorageManager._injectedSettings = null;
    }
  });

  afterEach(() => {
    cleanupChromeMock();
  });

  it('VideoSpeedConfig should initialize with default settings', () => {
    // Access VideoSpeedConfig from global scope
    const config = window.VSC.videoSpeedConfig;
    expect(config.settings).toBeDefined();
    expect(config.settings.enabled).toBe(true);
    expect(config.settings.lastSpeed).toBe(1.0);
    expect(config.settings.logLevel).toBe(3);
  });

  it('VideoSpeedConfig should load settings from storage', async () => {
    const config = window.VSC.videoSpeedConfig;
    const settings = await config.load();

    expect(settings).toBeDefined();
    expect(settings.enabled).toBe(true);
    expect(settings.lastSpeed).toBe(1.0);
  });

  it('VideoSpeedConfig should save settings to storage', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    await config.save({ lastSpeed: 2.0, enabled: false });

    expect(config.settings.lastSpeed).toBe(2.0);
    expect(config.settings.enabled).toBe(false);
  });

  it('VideoSpeedConfig should handle key bindings', async () => {
    // Create fresh config instance
    const config = new window.VSC.VideoSpeedConfig();

    // Load settings with defaults
    await config.load();

    const fasterValue = config.getKeyBinding('faster');
    expect(fasterValue).toBe(0.1);

    config.setKeyBinding('faster', 0.2);
    const updatedValue = config.getKeyBinding('faster');
    expect(updatedValue).toBe(0.2);
  });

  it('VideoSpeedConfig should have state manager available', () => {
    // Verify state manager is available (media tracking moved there)
    expect(window.VSC.stateManager).toBeDefined();
    expect(typeof window.VSC.stateManager.getAllMediaElements).toBe('function');
    expect(typeof window.VSC.stateManager.registerController).toBe('function');
    expect(typeof window.VSC.stateManager.removeController).toBe('function');
  });

  it('VideoSpeedConfig should handle invalid key binding requests gracefully', () => {
    const config = window.VSC.videoSpeedConfig;

    const result = config.getKeyBinding('nonexistent');
    expect(result).toBe(false);

    // Should not throw
    config.setKeyBinding('nonexistent', 123);
  });

  it('VideoSpeedConfig should debounce lastSpeed saves', async () => {
    const config = new window.VSC.VideoSpeedConfig();
    await config.load();

    let saveCount = 0;
    const originalSet = window.VSC.StorageManager.set;

    window.VSC.StorageManager.set = async () => {
      saveCount++;
    };

    // Multiple rapid speed updates
    await config.save({ lastSpeed: 1.5 });
    await config.save({ lastSpeed: 1.8 });
    await config.save({ lastSpeed: 2.0 });

    // Should not have saved yet
    expect(saveCount).toBe(0);
    expect(config.settings.lastSpeed).toBe(2.0); // In-memory should update immediately

    // Wait for debounce delay
    await wait(1100);

    // Should have saved only once
    expect(saveCount).toBe(1);

    window.VSC.StorageManager.set = originalSet;
  });

  it('VideoSpeedConfig should save non-speed settings immediately', async () => {
    const config = new window.VSC.VideoSpeedConfig();
    await config.load();

    let saveCount = 0;
    const originalSet = window.VSC.StorageManager.set;

    window.VSC.StorageManager.set = async () => {
      saveCount++;
    };

    await config.save({ enabled: false });

    // Should save immediately
    expect(saveCount).toBe(1);

    window.VSC.StorageManager.set = originalSet;
  });

  it('VideoSpeedConfig should reset debounce timer on new speed updates', async () => {
    const config = new window.VSC.VideoSpeedConfig();
    await config.load();

    let saveCount = 0;
    const originalSet = window.VSC.StorageManager.set;

    window.VSC.StorageManager.set = async () => {
      saveCount++;
    };

    // First speed update
    await config.save({ lastSpeed: 1.5 });

    // Wait 500ms, then another update (should reset timer)
    await wait(500);
    await config.save({ lastSpeed: 2.0 });

    // Wait another 500ms (total 1000ms from first, but only 500ms from second)
    await wait(500);
    expect(saveCount).toBe(0); // Should not have saved yet

    // Wait remaining 600ms (total 1100ms from second update)
    await wait(600);
    expect(saveCount).toBe(1); // Should have saved now
    expect(config.settings.lastSpeed).toBe(2.0); // Final value

    window.VSC.StorageManager.set = originalSet;
  });

  it('VideoSpeedConfig should persist only final speed value', async () => {
    const config = new window.VSC.VideoSpeedConfig();
    await config.load();

    let savedValue = null;
    const originalSet = window.VSC.StorageManager.set;

    window.VSC.StorageManager.set = async (settings) => {
      savedValue = settings.lastSpeed;
    };

    // Multiple rapid speed updates
    await config.save({ lastSpeed: 1.2 });
    await config.save({ lastSpeed: 1.7 });
    await config.save({ lastSpeed: 2.3 });

    // Wait for debounce
    await wait(1100);

    // Should have saved only the final value
    expect(savedValue).toBe(2.3);

    window.VSC.StorageManager.set = originalSet;
  });

  it('VideoSpeedConfig should update in-memory settings immediately during debounce', async () => {
    const config = new window.VSC.VideoSpeedConfig();
    await config.load();

    let saveCount = 0;
    const originalSet = window.VSC.StorageManager.set;

    window.VSC.StorageManager.set = async () => {
      saveCount++;
    };

    // Speed update
    await config.save({ lastSpeed: 1.75 });

    // In-memory should update immediately, before storage save
    expect(config.settings.lastSpeed).toBe(1.75);
    expect(saveCount).toBe(0); // Storage not saved yet

    // Wait for debounce
    await wait(1100);
    expect(saveCount).toBe(1); // Now saved to storage

    window.VSC.StorageManager.set = originalSet;
  });
});
