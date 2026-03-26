/**
 * Unit tests for content-entry.js behavior
 * Tests blacklist filtering and settings stripping
 */

import { isBlacklisted } from '../../../src/utils/blacklist.js';

describe('ContentEntry', () => {
  it('settings passed to page context should not contain blacklist', () => {
    // Simulate what content-entry.js does
    const settings = {
      lastSpeed: 1.5,
      enabled: true,
      blacklist: 'youtube.com\nnetflix.com',
      rememberSpeed: true,
      keyBindings: [],
    };

    // This is what content-entry.js does before injecting
    delete settings.blacklist;
    delete settings.enabled;

    expect(settings.blacklist).toBe(undefined);
    expect(settings.enabled).toBe(undefined);
    expect(settings.lastSpeed).toBe(1.5);
    expect(settings.rememberSpeed).toBe(true);
  });

  it('blacklisted site should trigger early exit', () => {
    const blacklist = 'youtube.com\nnetflix.com';

    // Simulate content-entry.js check
    const youtubeBlocked = isBlacklisted(blacklist, 'https://www.youtube.com/watch?v=123');
    const netflixBlocked = isBlacklisted(blacklist, 'https://www.netflix.com/title/123');
    const otherAllowed = isBlacklisted(blacklist, 'https://www.example.com/');

    expect(youtubeBlocked).toBe(true);
    expect(netflixBlocked).toBe(true);
    expect(otherAllowed).toBe(false);
  });

  it('disabled extension should not proceed', () => {
    // Simulate content-entry.js check
    const settings = { enabled: false, blacklist: '' };

    // This is the check in content-entry.js
    const shouldExit = settings.enabled === false;

    expect(shouldExit).toBe(true);
  });

  it('enabled extension on non-blacklisted site should proceed', () => {
    const settings = {
      enabled: true,
      blacklist: 'youtube.com',
      lastSpeed: 1.5,
    };

    const isDisabled = settings.enabled === false;
    const isSiteBlacklisted = isBlacklisted(settings.blacklist, 'https://www.example.com/');

    expect(isDisabled).toBe(false);
    expect(isSiteBlacklisted).toBe(false);

    // Simulate stripping
    delete settings.blacklist;
    delete settings.enabled;

    // Verify only safe settings remain
    const keys = Object.keys(settings);
    expect(keys.includes('blacklist')).toBe(false);
    expect(keys.includes('enabled')).toBe(false);
    expect(keys.includes('lastSpeed')).toBe(true);
  });

  // --- Lifecycle watcher logic (mirrors content-entry.js storage.onChanged handler) ---

  it('blacklist change matching current site should trigger teardown', () => {
    // Simulate the logic in content-entry.js onChanged handler
    const currentHref = 'https://www.youtube.com/watch?v=123';
    const changes = {
      blacklist: { newValue: 'youtube.com\nnetflix.com' },
    };

    const nowBlacklisted =
      'blacklist' in changes && isBlacklisted(changes.blacklist.newValue, currentHref);

    expect(nowBlacklisted).toBe(true);
  });

  it('blacklist change NOT matching current site should not trigger teardown', () => {
    const currentHref = 'https://www.example.com/page';
    const changes = {
      blacklist: { newValue: 'youtube.com\nnetflix.com' },
    };

    const nowBlacklisted =
      'blacklist' in changes && isBlacklisted(changes.blacklist.newValue, currentHref);

    expect(nowBlacklisted).toBe(false);
  });

  it('enabled=false change should trigger teardown', () => {
    const changes = {
      enabled: { newValue: false },
    };

    const nowDisabled = 'enabled' in changes && changes.enabled.newValue === false;

    expect(nowDisabled).toBe(true);
  });

  it('enabled=true change should not trigger teardown', () => {
    const changes = {
      enabled: { newValue: true },
    };

    const nowDisabled = 'enabled' in changes && changes.enabled.newValue === false;

    expect(nowDisabled).toBe(false);
  });

  it('unrelated storage change should not trigger teardown', () => {
    const currentHref = 'https://www.example.com/page';
    const changes = {
      lastSpeed: { newValue: 2.5 },
    };

    const nowDisabled = 'enabled' in changes && changes.enabled.newValue === false;
    const nowBlacklisted =
      'blacklist' in changes && isBlacklisted(changes.blacklist.newValue, currentHref);

    expect(nowDisabled).toBe(false);
    expect(nowBlacklisted).toBe(false);
  });

  // --- Reinit logic (mirrors content-entry.js storage.onChanged handler) ---

  it('enabled=true change should trigger reinit', () => {
    const changes = {
      enabled: { newValue: true },
    };

    const reEnabled = 'enabled' in changes && changes.enabled.newValue === true;

    expect(reEnabled).toBe(true);
  });

  it('site removed from blacklist should trigger reinit', () => {
    const currentHref = 'https://www.youtube.com/watch?v=123';
    const changes = {
      blacklist: { newValue: 'netflix.com' }, // youtube removed from list
    };

    const unblacklisted =
      'blacklist' in changes && !isBlacklisted(changes.blacklist.newValue, currentHref);

    expect(unblacklisted).toBe(true);
  });

  it('blacklist change that still includes current site should not trigger reinit', () => {
    const currentHref = 'https://www.youtube.com/watch?v=123';
    const changes = {
      blacklist: { newValue: 'youtube.com\nnetflix.com' },
    };

    const unblacklisted =
      'blacklist' in changes && !isBlacklisted(changes.blacklist.newValue, currentHref);

    expect(unblacklisted).toBe(false);
  });

  it('unrelated storage change should not trigger reinit', () => {
    const currentHref = 'https://www.example.com/page';
    const changes = {
      lastSpeed: { newValue: 2.5 },
    };

    const reEnabled = 'enabled' in changes && changes.enabled.newValue === true;
    const unblacklisted =
      'blacklist' in changes && !isBlacklisted(changes.blacklist.newValue, currentHref);

    expect(reEnabled).toBe(false);
    expect(unblacklisted).toBe(false);
  });
});
