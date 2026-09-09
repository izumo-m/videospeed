/**
 * Unit tests for FrameHandler.getControllerPosition.
 * Verifies promotion out of Frame's zero-size transformed video layer.
 */

import {
  installChromeMock,
  cleanupChromeMock,
  resetMockStorage,
} from '../../helpers/chrome-mock.js';

function setRect(element, rect) {
  element.getBoundingClientRect = () => ({
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    top: rect.top ?? 0,
    left: rect.left ?? 0,
    right: (rect.left ?? 0) + (rect.width ?? 0),
    bottom: (rect.top ?? 0) + (rect.height ?? 0),
    width: rect.width ?? 0,
    height: rect.height ?? 0,
  });
}

describe('FrameHandler', () => {
  beforeEach(() => {
    installChromeMock();
    resetMockStorage();
    vi.stubGlobal('location', { hostname: 'next.frame.io' });
  });

  afterEach(() => {
    cleanupChromeMock();
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('matches next.frame.io', () => {
    expect(window.VSC.FrameHandler.matches()).toBe(true);
  });

  it('promotes insertion from zero-size transformed video layer to player viewport', () => {
    const viewport = document.createElement('div');
    viewport.style.overflow = 'hidden';

    const transformedLayer = document.createElement('div');
    const video = document.createElement('video');

    document.body.appendChild(viewport);
    viewport.appendChild(transformedLayer);
    transformedLayer.appendChild(video);

    setRect(video, { top: 62, left: 3, width: 1418, height: 798 });
    setRect(transformedLayer, { top: 461, left: 712, width: 0, height: 0 });
    setRect(viewport, { top: 62, left: 3, width: 1418, height: 798 });

    const handler = new window.VSC.FrameHandler();
    const result = handler.getControllerPosition(transformedLayer, video);

    expect(result.insertionPoint).toBe(viewport);
    expect(result.targetParent).toBe(viewport);
    expect(result.insertionMethod).toBe('firstChild');
  });

  it('falls back to original parent when no substantial clipping viewport exists', () => {
    const parent = document.createElement('div');
    const video = document.createElement('video');
    parent.appendChild(video);
    document.body.appendChild(parent);

    setRect(video, { top: 10, left: 20, width: 640, height: 360 });
    setRect(parent, { top: 10, left: 20, width: 0, height: 0 });

    const handler = new window.VSC.FrameHandler();
    const result = handler.getControllerPosition(parent, video);

    expect(result.insertionPoint).toBe(parent);
    expect(result.targetParent).toBe(parent);
  });
});
