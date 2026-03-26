/**
 * Unit tests for site-pattern.js — matchSiteRule() and isBlacklisted() wrapper
 */

import { SimpleTestRunner, assert } from '../../helpers/test-utils.js';
import { matchSiteRule, isBlacklisted } from '../../../src/utils/site-pattern.js';

const runner = new SimpleTestRunner();

// --- matchSiteRule() ---

runner.test('matchSiteRule returns null for empty rules array', () => {
  assert.equal(matchSiteRule([], 'https://youtube.com'), null);
});

runner.test('matchSiteRule returns null for null/undefined rules', () => {
  assert.equal(matchSiteRule(null, 'https://youtube.com'), null);
  assert.equal(matchSiteRule(undefined, 'https://youtube.com'), null);
});

runner.test('matchSiteRule matches domain pattern', () => {
  const rules = [
    { pattern: 'youtube.com', enabled: true, speed: 2.0 },
  ];
  const match = matchSiteRule(rules, 'https://www.youtube.com/watch?v=123');
  assert.exists(match);
  assert.equal(match.speed, 2.0);
  assert.equal(match.enabled, true);
});

runner.test('matchSiteRule does not match unrelated domain', () => {
  const rules = [
    { pattern: 'youtube.com', enabled: false, speed: null },
  ];
  assert.equal(matchSiteRule(rules, 'https://netflix.com'), null);
});

runner.test('matchSiteRule returns first match (priority)', () => {
  const rules = [
    { pattern: 'youtube.com', enabled: true, speed: 1.5 },
    { pattern: 'youtube.com', enabled: false, speed: 2.0 },
  ];
  const match = matchSiteRule(rules, 'https://youtube.com/');
  assert.equal(match.speed, 1.5);
  assert.equal(match.enabled, true);
});

runner.test('matchSiteRule matches regex pattern with flags', () => {
  const rules = [
    { pattern: '/(.+)youtube\\.com(\\/*)$/gi', enabled: false, speed: null },
  ];
  const match = matchSiteRule(rules, 'https://www.youtube.com/');
  assert.exists(match);
  assert.equal(match.enabled, false);
});

runner.test('matchSiteRule matches regex pattern without flags', () => {
  const rules = [
    { pattern: '/\\.edu$/', enabled: true, speed: 1.25 },
  ];
  const match = matchSiteRule(rules, 'https://mit.edu');
  assert.exists(match);
  assert.equal(match.speed, 1.25);
});

runner.test('matchSiteRule skips invalid regex gracefully', () => {
  const rules = [
    { pattern: '/[unclosed/', enabled: false, speed: null },
    { pattern: 'youtube.com', enabled: true, speed: 2.0 },
  ];
  const match = matchSiteRule(rules, 'https://youtube.com/');
  assert.exists(match);
  assert.equal(match.speed, 2.0);
});

runner.test('matchSiteRule skips empty/null patterns', () => {
  const rules = [
    { pattern: '', enabled: false, speed: null },
    { pattern: null, enabled: false, speed: null },
    { pattern: 'youtube.com', enabled: true, speed: 1.5 },
  ];
  const match = matchSiteRule(rules, 'https://youtube.com/');
  assert.equal(match.speed, 1.5);
});

runner.test('matchSiteRule domain boundary: x.com does not match netflix.com', () => {
  const rules = [
    { pattern: 'x.com', enabled: false, speed: null },
  ];
  assert.equal(matchSiteRule(rules, 'https://netflix.com'), null);
});

runner.test('matchSiteRule preserves all rule fields in result', () => {
  const rules = [
    { pattern: 'example.com', enabled: true, speed: 1.75, extra: 'data' },
  ];
  const match = matchSiteRule(rules, 'https://example.com/page');
  assert.equal(match.pattern, 'example.com');
  assert.equal(match.enabled, true);
  assert.equal(match.speed, 1.75);
  assert.equal(match.extra, 'data');
});

// --- isBlacklisted() backward compat ---

runner.test('isBlacklisted still works with legacy string format', () => {
  assert.true(isBlacklisted('youtube.com\nnetflix.com', 'https://youtube.com/'));
  assert.true(isBlacklisted('youtube.com\nnetflix.com', 'https://netflix.com/'));
  assert.false(isBlacklisted('youtube.com\nnetflix.com', 'https://example.com/'));
});

runner.test('isBlacklisted returns false for empty/null blacklist', () => {
  assert.false(isBlacklisted('', 'https://youtube.com/'));
  assert.false(isBlacklisted(null, 'https://youtube.com/'));
  assert.false(isBlacklisted(undefined, 'https://youtube.com/'));
});

export { runner };
