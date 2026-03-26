/**
 * Unit tests for VideoSpeedExtension (inject.js)
 * Testing the fix for video elements without parentElement
 */

import {
  installChromeMock,
  cleanupChromeMock,
  resetMockStorage,
} from '../../helpers/chrome-mock.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockVideo, createMockDOM } from '../../helpers/test-utils.js';
import { loadInjectModules } from '../../helpers/module-loader.js';

// Load all required modules
await loadInjectModules();

let mockDOM;
let extension;

describe('Inject', () => {
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
    if (extension) {
      extension = null;
    }

    // Clean up any remaining video elements
    const videos = document.querySelectorAll('video');
    videos.forEach((video) => {
      if (video.vsc) {
        try {
          video.vsc.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      if (video.parentNode) {
        try {
          video.parentNode.removeChild(video);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });

  /**
   * Create a video element without parentElement but with parentNode
   * This simulates shadow DOM scenarios where parentElement is undefined
   */
  function createVideoWithoutParentElement() {
    const video = createMockVideo();
    const parentNode = document.createElement('div');

    // Simulate shadow DOM scenario where parentElement is undefined
    Object.defineProperty(video, 'parentElement', {
      value: null,
      writable: false,
      configurable: true,
    });

    Object.defineProperty(video, 'parentNode', {
      value: parentNode,
      writable: false,
      configurable: true,
    });

    // Mock isConnected property for validity check
    Object.defineProperty(video, 'isConnected', {
      value: true,
      writable: false,
      configurable: true,
    });

    return { video, parentNode };
  }

  it('onVideoFound should handle video elements without parentElement', async () => {
    // Use the global VSC_controller instance
    extension = window.VSC_controller;

    // Ensure extension is initialized
    if (!extension) {
      expect(false).toBe(true);
      return;
    }

    try {
      // Create a video element without parentElement but with parentNode
      const { video, parentNode } = createVideoWithoutParentElement();

      // Test the onVideoFound method directly - this is the core functionality
      extension.onVideoFound(video, parentNode);

      // Verify that the video controller was attached
      expect(video.vsc).toBeDefined();
      expect(video.vsc instanceof window.VSC.VideoController).toBe(true);

      // Verify that the controller was initialized with the correct parent (parentNode fallback)
      expect(video.vsc.parent).toBe(parentNode);
    } catch (error) {
      console.error('Test error:', error);
      expect(false).toBe(true);
    }
  });

  it('onVideoFound should prefer parentElement when available', async () => {
    // Use the global VSC_controller instance
    extension = window.VSC_controller;

    // Ensure extension is initialized
    if (!extension) {
      expect(false).toBe(true);
      return;
    }

    try {
      // Create a normal video element with both parentElement and parentNode
      const video = createMockVideo();
      const parentElement = document.createElement('div');
      const parentNode = document.createElement('span'); // Different from parentElement

      Object.defineProperty(video, 'parentElement', {
        value: parentElement,
        writable: false,
        configurable: true,
      });

      Object.defineProperty(video, 'parentNode', {
        value: parentNode,
        writable: false,
        configurable: true,
      });

      // Mock isConnected property for validity check
      Object.defineProperty(video, 'isConnected', {
        value: true,
        writable: false,
        configurable: true,
      });

      // Test onVideoFound with parentElement available
      extension.onVideoFound(video, parentNode);

      // Verify that the video controller was attached
      expect(video.vsc).toBeDefined();

      // Verify that the controller was initialized with video.parentElement (not the passed parent)
      // VideoController constructor uses target.parentElement || parent
      expect(video.vsc.parent).toBe(parentElement);
    } catch (error) {
      expect(false).toBe(true);
    }
  });

  it('onVideoFound should handle video with neither parentElement nor parentNode', async () => {
    // Use the global VSC_controller instance
    extension = window.VSC_controller;

    // Verify extension is available
    expect(extension).toBeDefined();

    try {
      // Create a video element with no parent references
      const video = createMockVideo();
      const fallbackParent = document.createElement('div');

      Object.defineProperty(video, 'parentElement', {
        value: null,
        writable: false,
        configurable: true,
      });

      Object.defineProperty(video, 'parentNode', {
        value: null,
        writable: false,
        configurable: true,
      });

      // Mock isConnected property for validity check
      Object.defineProperty(video, 'isConnected', {
        value: true,
        writable: false,
        configurable: true,
      });

      // This should not throw an error even with no parent references
      extension.onVideoFound(video, fallbackParent);

      // Verify basic functionality
      expect(video.vsc).toBeDefined();
      expect(video.vsc.parent).toBe(fallbackParent);
    } catch (error) {
      expect(false).toBe(true);
    }
  });
});
