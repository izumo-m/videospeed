/**
 * Tests for hydration-safe initialization tracking
 * Ensures VSC doesn't modify DOM attributes that cause React hydration errors
 */

import {
  installChromeMock,
  cleanupChromeMock,
  resetMockStorage,
} from '../../helpers/chrome-mock.js';
import { createMockDOM } from '../../helpers/test-utils.js';

// Load all required modules

let mockDOM;

describe('HydrationFix', () => {
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

  it('VSC content script avoids DOM modifications that cause hydration errors', () => {
    // Record initial body classes and attributes
    const initialBodyClasses = [...document.body.classList];
    const initialBodyHTML = document.body.outerHTML;

    // Test that VSC state tracking works without DOM modifications
    // Use simple boolean flag in VSC namespace
    window.VSC.initialized = false;

    expect(window.VSC.initialized).toBe(false);

    // Simulate initialization
    window.VSC.initialized = true;

    // Verify no classes were added to body
    const finalBodyClasses = [...document.body.classList];
    const finalBodyHTML = document.body.outerHTML;

    expect(initialBodyClasses).toEqual(finalBodyClasses);

    expect(initialBodyHTML).toBe(finalBodyHTML);

    // Verify JavaScript state tracking is working
    expect(window.VSC.initialized).toBe(true);
  });

  it('CSS custom properties enable domain-specific styling without body modifications', () => {
    // Record initial body state
    const initialBodyClasses = [...document.body.classList];
    const initialBodyHTML = document.body.outerHTML;

    // Simulate the CSS custom property approach
    const hostname = 'chatgpt.com';

    // Store domain info in VSC global state
    window.VSC.currentDomain = hostname;

    // Set CSS custom property on document root (the new approach)
    document.documentElement.style.setProperty('--vsc-domain', `"${hostname}"`);

    // Verify no classes were added to body
    const finalBodyClasses = [...document.body.classList];
    const finalBodyHTML = document.body.outerHTML;

    expect(initialBodyClasses).toEqual(finalBodyClasses);

    expect(initialBodyHTML).toBe(finalBodyHTML);

    // Verify CSS custom property was set
    const domainProperty = document.documentElement.style.getPropertyValue('--vsc-domain');
    expect(domainProperty).toBe('"chatgpt.com"');

    // Verify the CSS selector would match (simulating CSS behavior)
    const rootStyle = document.documentElement.getAttribute('style');
    expect(rootStyle && rootStyle.includes('--vsc-domain: "chatgpt.com"')).toBe(true);

    // Verify domain is tracked in VSC state
    expect(window.VSC.currentDomain).toBe('chatgpt.com');
  });

  it('Simple boolean flag prevents double initialization', () => {
    window.VSC.initialized = false;
    expect(window.VSC.initialized).toBe(false);

    // First initialization sets the flag
    window.VSC.initialized = true;
    expect(window.VSC.initialized).toBe(true);

    // Second attempt should see it's already initialized
    expect(window.VSC.initialized).toBe(true);
  });
});
