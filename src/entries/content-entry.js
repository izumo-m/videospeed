/**
 * Content script entry point - handles Chrome API access and page injection
 * This runs in the content script context with access to chrome.* APIs
 */

import { injectScript, setupMessageBridge } from '../content/injection-bridge.js';
import { matchSiteRule, isBlacklisted } from '../utils/site-pattern.js';
import { DEFAULT_CONTROLLER_CSS } from '../styles/controller-css-defaults.js';

async function init() {
  try {
    // Guard against double-injection. Chrome can re-run content scripts on
    // extension update, service worker restart, or in about:blank frames that
    // share the parent window. Re-injecting would overwrite all window.VSC.*
    // singletons and silently break the running instance.
    if (document.getElementById('vsc-settings-data')) {
      return;
    }

    const settings = await chrome.storage.sync.get(null);

    // Early exit if extension is disabled
    if (settings.enabled === false) {
      return;
    }

    // Check siteRules first (new structured format), fall back to legacy blacklist
    const href = location.href;
    let siteDisabled = false;

    if (settings.siteRules) {
      const match = matchSiteRule(settings.siteRules, href);
      if (match && !match.enabled) {
        siteDisabled = true;
      } else if (match?.speed != null) {
        // Inject matched site speed into settings bridge
        settings.siteDefaultSpeed = match.speed;
      }
    } else if (isBlacklisted(settings.blacklist, href)) {
      siteDisabled = true;
    }

    if (siteDisabled) return;

    // Clean up keys not needed in page context
    delete settings.siteRules;
    delete settings.blacklist;
    delete settings.enabled;

    // Store controllerCSS before deleting from bridge payload
    const controllerCSS = settings.controllerCSS ?? DEFAULT_CONTROLLER_CSS;
    delete settings.controllerCSS;

    // Bridge settings to page context via DOM (only synchronous path between Chrome's isolated worlds)
    // Script elements with type="application/json" are inert, avoiding site interference and CSP issues
    const settingsElement = document.createElement('script');
    settingsElement.id = 'vsc-settings-data';
    settingsElement.type = 'application/json';
    settingsElement.textContent = JSON.stringify(settings);
    (document.head || document.documentElement).appendChild(settingsElement);

    // Set --vsc-domain for CSS domain-based rules (before CSS injection)
    const hostname = location.hostname.replace(/^www\./, '');
    document.documentElement.style.setProperty('--vsc-domain', `"${hostname}"`);

    // Inject controller CSS BEFORE inject.js — guarantees positioning rules
    // are in the DOM before any controller elements are created.
    // Base rule is in inject.css (manifest CSS, always available).
    // This adds site-specific overrides that layer on top.
    const styleEl = document.createElement('style');
    styleEl.id = 'vsc-controller-css';
    styleEl.textContent = controllerCSS;
    (document.head || document.documentElement).appendChild(styleEl);

    // Inject the bundled page script containing all VSC modules
    await injectScript('inject.js');

    // Set up bi-directional message bridge for popup ↔ page communication
    const bridge = setupMessageBridge();

    // Track whether this site is currently active (for teardown/reinit decisions)
    let isActive = true;

    // Lifecycle watcher: tear down or reinit when siteRules/enabled changes.
    // The content script is the lifecycle owner — it gates initialization above,
    // and it gates teardown/reinit here, using the same bridge the popup uses for commands.
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace !== 'sync') return;

      // Live-update controller CSS when changed from options page
      if (changes.controllerCSS?.newValue !== undefined) {
        const el = document.getElementById('vsc-controller-css');
        if (el) el.textContent = changes.controllerCSS.newValue;
      }

      // Check extension-level disable
      const disabled = 'enabled' in changes && changes.enabled.newValue === false;
      const reEnabled = 'enabled' in changes && changes.enabled.newValue === true;

      // Check siteRules changes (new format) or legacy blacklist changes
      let nowDisabledBySite = false;
      let nowEnabledBySite = false;

      if ('siteRules' in changes) {
        const newRules = changes.siteRules.newValue ?? [];
        const match = matchSiteRule(newRules, href);
        const siteOff = match && !match.enabled;
        nowDisabledBySite = siteOff && isActive;
        nowEnabledBySite = !siteOff && !isActive;
      } else if ('blacklist' in changes) {
        // Legacy fallback
        const bl = isBlacklisted(changes.blacklist.newValue, href);
        nowDisabledBySite = bl && isActive;
        nowEnabledBySite = !bl && !isActive;
      }

      if (disabled || nowDisabledBySite) {
        isActive = false;
        bridge.sendCommand('VSC_TEARDOWN');
        return;
      }

      if (reEnabled || nowEnabledBySite) {
        isActive = true;
        bridge.sendCommand('VSC_REINIT');
      }
    });

  } catch (error) {
    console.error('[VSC] Failed to initialize:', error);
  }
}

// Initialize on DOM ready or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
