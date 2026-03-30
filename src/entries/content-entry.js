/**
 * Content script entry point - handles Chrome API access and page injection
 * This runs in the content script context with access to chrome.* APIs
 */

import { injectScript, setupMessageBridge } from '../content/injection-bridge.js';
import { isBlacklisted } from '../utils/blacklist.js';
import { matchSiteRule } from '../utils/site-pattern.js';
import { DEFAULT_CONTROLLER_CSS } from '../styles/controller-css-defaults.js';

/**
 * Resolve domain-based CSS selectors at injection time so we never touch <html>.
 * Replaces :root[style*='--vsc-domain: "DOMAIN"'] attribute selectors:
 *   - matching domain → selector stripped (rule applies unconditionally)
 *   - non-matching domain → replaced with [data-vsc-never] (never matches)
 */
function preprocessDomainCSS(cssText, hostname) {
  return cssText.replace(/\[style\*='--vsc-domain:\s*"([^"]+)"'\]/g, (_match, domain) =>
    domain === hostname ? '' : '[data-vsc-never]'
  );
}

async function init() {
  try {
    // Skip about:blank frames — they share the parent window and our injection
    // would either double-inject or break the parent's running instance.
    if (location.href === 'about:blank') {
      return;
    }

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

    // Early exit if site is blacklisted (legacy) or disabled via siteRules
    if (isBlacklisted(settings.blacklist, location.href)) {
      return;
    }
    const siteRule = matchSiteRule(settings.siteRules, location.href);
    if (siteRule && siteRule.enabled === false) {
      return;
    }

    // Read controllerCSS BEFORE deleting from settings (it's excluded from
    // the page context bridge but needed for style injection below).
    const controllerCSS = settings.controllerCSS ?? DEFAULT_CONTROLLER_CSS;

    delete settings.blacklist;
    delete settings.enabled;
    delete settings.controllerCSS;

    // Bridge settings to page context via DOM (only synchronous path between Chrome's isolated worlds)
    // Script elements with type="application/json" are inert, avoiding site interference and CSP issues.
    const settingsElement = document.createElement('script');
    settingsElement.id = 'vsc-settings-data';
    settingsElement.type = 'application/json';
    settingsElement.textContent = JSON.stringify(settings);
    (document.head || document.documentElement).appendChild(settingsElement);

    // Preprocess domain-based CSS rules at injection time instead of setting
    // --vsc-domain on <html>. Avoids mutating <html> style attribute which
    // can trigger framework MutationObservers on some sites.
    const hostname = location.hostname.replace(/^www\./, '');

    // Inject controller CSS BEFORE inject.js — guarantees positioning rules
    // are in the DOM before any controller elements are created.
    // Base rule is in inject.css (manifest CSS, always available).
    // This adds site-specific overrides that layer on top.
    const styleEl = document.createElement('style');
    styleEl.id = 'vsc-controller-css';
    styleEl.textContent = preprocessDomainCSS(controllerCSS, hostname);
    (document.head || document.documentElement).appendChild(styleEl);

    // Inject the bundled page script containing all VSC modules
    await injectScript('inject.js');

    // Set up bi-directional message bridge for popup ↔ page communication
    const bridge = setupMessageBridge();

    // Lifecycle watcher: tear down or reinit when blacklist/enabled changes.
    // The content script is the lifecycle owner — it gates initialization above,
    // and it gates teardown/reinit here, using the same bridge the popup uses for commands.
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace !== 'sync') {
        return;
      }

      // Live-update controller CSS when changed from options page
      if (changes.controllerCSS?.newValue !== undefined) {
        const el = document.getElementById('vsc-controller-css');
        if (el) {
          el.textContent = preprocessDomainCSS(changes.controllerCSS.newValue, hostname);
        }
      }

      const disabled = 'enabled' in changes && changes.enabled.newValue === false;
      const blacklisted =
        'blacklist' in changes && isBlacklisted(changes.blacklist.newValue, location.href);
      const siteRuleDisabled =
        'siteRules' in changes &&
        (() => {
          const rule = matchSiteRule(changes.siteRules.newValue, location.href);
          return rule && rule.enabled === false;
        })();

      if (disabled || blacklisted || siteRuleDisabled) {
        bridge.sendCommand('VSC_TEARDOWN');
        return;
      }

      const reEnabled = 'enabled' in changes && changes.enabled.newValue === true;
      const unblacklisted =
        'blacklist' in changes && !isBlacklisted(changes.blacklist.newValue, location.href);
      const siteRuleReEnabled =
        'siteRules' in changes &&
        (() => {
          const rule = matchSiteRule(changes.siteRules.newValue, location.href);
          return !rule || rule.enabled !== false;
        })();

      if (reEnabled || unblacklisted || siteRuleReEnabled) {
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
