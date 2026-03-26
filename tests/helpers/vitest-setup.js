/**
 * Vitest setup file — replicates the global environment that run-tests.js
 * sets up manually (chrome mock, shadow DOM polyfill, missing browser APIs).
 *
 * Vitest's jsdom environment provides window, document, HTMLElement, etc.
 * automatically — we only need to add what jsdom doesn't have.
 */

import { beforeEach } from 'vitest';
import { installChromeMock, resetMockStorage } from './chrome-mock.js';

// Install Chrome extension API mock
installChromeMock();

// Stub APIs missing from jsdom
if (typeof globalThis.requestIdleCallback === 'undefined') {
  globalThis.requestIdleCallback = (fn) => setTimeout(fn, 0);
}

// Enhanced shadow DOM support for jsdom
// jsdom doesn't support attachShadow — we mock it with a div-based approach
// Ported from run-tests.js lines 82-119
if (!HTMLElement.prototype._originalAttachShadow) {
  const orig = HTMLElement.prototype.attachShadow;
  const needsPolyfill = (() => {
    try {
      const el = document.createElement('div');
      const sr = orig?.call(el, { mode: 'open' });
      return !sr;
    } catch {
      return true;
    }
  })();

  if (needsPolyfill) {
    HTMLElement.prototype.attachShadow = function (options) {
      const shadowRoot = document.createElement('div');
      shadowRoot.mode = options.mode || 'open';
      shadowRoot.host = this;

      // Override innerHTML to handle template parsing
      let shadowHTML = '';
      Object.defineProperty(shadowRoot, 'innerHTML', {
        get: () => shadowHTML,
        set: (value) => {
          shadowHTML = value;

          // Parse the shadow DOM template and create actual elements
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = value.replace(/@import[^;]+;/g, ''); // Remove CSS imports

          // Move children from temp div to shadow root
          while (tempDiv.firstChild) {
            shadowRoot.appendChild(tempDiv.firstChild);
          }
        },
      });

      this.shadowRoot = shadowRoot;
      return shadowRoot;
    };
  }
}

// Reset mock storage between tests for isolation
beforeEach(() => {
  resetMockStorage();
});
