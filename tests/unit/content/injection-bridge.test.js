/**
 * Unit tests for injection-bridge.js
 * Focused on the context invalidation fix and core message forwarding
 */

import {
  installChromeMock,
  cleanupChromeMock,
  resetMockStorage,
} from '../../helpers/chrome-mock.js';
import { setupMessageBridge } from '../../../src/content/injection-bridge.js';

let bridge;

describe('InjectionBridge', () => {
  beforeEach(() => {
    installChromeMock();
    resetMockStorage();
    chrome.runtime.sendMessage = () => {};
  });

  afterEach(() => {
    if (bridge) {
      bridge.cleanup();
    }
    bridge = null;
    cleanupChromeMock();
  });

  /**
   * Dispatch a MessageEvent as if from the page context (injected script).
   * JSDOM doesn't support `source` in MessageEvent constructor, so we set it manually.
   */
  function postPageMessage(action, data) {
    const event = new MessageEvent('message', {
      data: { source: 'vsc-page', action, data },
    });
    Object.defineProperty(event, 'source', { value: window });
    window.dispatchEvent(event);
  }

  // --- Core forwarding ---

  it('storage-update forwards to chrome.storage.sync.set', () => {
    let setData = null;
    chrome.storage.sync.set = (data) => {
      setData = data;
    };

    bridge = setupMessageBridge();
    postPageMessage('storage-update', { lastSpeed: 2.5 });

    expect(setData).toBeDefined();
    expect(setData.lastSpeed).toBe(2.5);
  });

  it('runtime-message filters out VSC_STATE_UPDATE', () => {
    let sendCalled = false;
    chrome.runtime.sendMessage = () => {
      sendCalled = true;
    };

    bridge = setupMessageBridge();
    postPageMessage('runtime-message', { type: 'VSC_STATE_UPDATE' });

    expect(sendCalled).toBe(false);
  });

  // --- Context invalidation (the actual fix) ---

  it('Extension context invalidated removes the message listener', () => {
    chrome.storage.sync.set = () => {
      throw new Error('Extension context invalidated');
    };

    bridge = setupMessageBridge();

    // First message triggers invalidation — listener should self-remove
    postPageMessage('storage-update', { lastSpeed: 2.0 });

    // Replace with a tracking mock — if listener was removed, this won't fire
    let calledAfter = false;
    chrome.storage.sync.set = () => {
      calledAfter = true;
    };

    postPageMessage('storage-update', { lastSpeed: 3.0 });

    expect(calledAfter).toBe(false);
  });

  it('non-invalidation errors keep the listener alive', () => {
    let callCount = 0;
    chrome.storage.sync.set = () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
      }
    };

    bridge = setupMessageBridge();

    postPageMessage('storage-update', { lastSpeed: 2.0 });
    postPageMessage('storage-update', { lastSpeed: 3.0 });

    expect(callCount).toBe(2);
  });

  // --- sendCommand API ---

  it('sendCommand dispatches VSC_MESSAGE CustomEvent to page context', () => {
    bridge = setupMessageBridge();

    let received = null;
    window.addEventListener(
      'VSC_MESSAGE',
      (event) => {
        received = event.detail;
      },
      { once: true }
    );

    bridge.sendCommand('VSC_TEARDOWN');

    expect(received).toBeDefined();
    expect(received.type).toBe('VSC_TEARDOWN');
  });

  it('sendCommand includes payload when provided', () => {
    bridge = setupMessageBridge();

    let received = null;
    window.addEventListener(
      'VSC_MESSAGE',
      (event) => {
        received = event.detail;
      },
      { once: true }
    );

    bridge.sendCommand('VSC_SET_SPEED', { speed: 2.0 });

    expect(received).toBeDefined();
    expect(received.payload.speed).toBe(2.0);
  });
});
