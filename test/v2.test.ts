import { describe, expect, it, vi } from 'vitest';
import { blob, cat, createPal, ghost, type Mood, type PalPluginAPI } from '../src';
import { partsFor } from '../src/render/characters';
import { MOODS } from '../src/render/face';
import {
  FakeXHR,
  flushMicrotasks,
  installFakeXHR,
  pointer,
  quiet,
  setVisibility,
  stubRect,
} from './helpers';

const shadow = (el: HTMLElement | null) => el!.shadowRoot!;

describe('characters', () => {
  it.each(['blob', 'cat', 'ghost'] as const)('%s has an element for every part of every mood', (character) => {
    const pal = createPal({ ...quiet, character });
    const root = shadow(pal.element);
    const parts = partsFor({ blob, cat, ghost }[character]);
    for (const mood of MOODS) {
      for (const part of parts[mood]) {
        expect(root.querySelector(`.${part}`), `${character}/${mood}: .${part}`).not.toBeNull();
      }
    }
    expect(pal.element!.dataset.character).toBe(character);
  });

  it('uses a per-character default color unless one is given', () => {
    expect(createPal({ ...quiet, character: 'cat' }).element!.style.getPropertyValue('--pp-color')).toBe('var(--pagepal-color, #ffa94d)');
    expect(
      createPal({ ...quiet, character: 'cat', color: 'teal' }).element!.style.getPropertyValue('--pp-color'),
    ).toBe('teal');
  });

  it('renders custom images, falling back to neutral, without injecting markup', () => {
    const evil = 'x.png"/><script>alert(1)</script>';
    const pal = createPal({ ...quiet, character: { images: { neutral: 'n.png', cheer: evil } } });
    const root = shadow(pal.element);
    expect(root.querySelector('.img-neutral')!.getAttribute('href')).toBe('n.png');
    expect(root.querySelector('.img-cheer')!.getAttribute('href')).toBe(evil);
    expect(root.querySelector('script')).toBeNull();
    // Moods without an image show the neutral one.
    expect(partsFor({ images: { neutral: 'n.png' } }).sad).toContain('img-neutral');
  });

  it('can render inline in a container', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const pal = createPal({ ...quiet, container, position: 'inline' });
    expect(pal.element!.parentElement).toBe(container);
    expect(pal.element!.dataset.corner).toBe('inline');
    expect(pal.element!.style.bottom).toBe('');
  });
});

describe('XMLHttpRequest', () => {
  const request = (method = 'GET', url = '/api') => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.send();
    return FakeXHR.instances[FakeXHR.instances.length - 1]!;
  };

  it('waits while a request is pending', () => {
    vi.useFakeTimers();
    const restore = installFakeXHR();
    const pal = createPal({ ...quiet });
    pal.watchXHR({ delay: 0 });
    const xhr = request();
    vi.advanceTimersByTime(1);
    expect(pal.mood).toBe('waiting');
    xhr.respond(200);
    expect(pal.mood).toBe('neutral');
    pal.destroy();
    restore();
  });

  it('winces on 5xx and network errors, not on aborts or 4xx', () => {
    vi.useFakeTimers();
    const restore = installFakeXHR();
    const pal = createPal({ ...quiet });
    pal.watchXHR();
    request().abort();
    request().respond(404);
    expect(pal.mood).toBe('neutral');
    request().fail();
    vi.advanceTimersByTime(100); // network failures are confirmed after a beat (see: leaving the page)
    expect(pal.mood).toBe('wince');
    pal.destroy();

    const other = createPal({ ...quiet });
    other.watchXHR();
    request().respond(503);
    expect(other.mood).toBe('wince');
    other.destroy();
    restore();
  });

  it('filters by url and method', () => {
    vi.useFakeTimers();
    const restore = installFakeXHR();
    const pal = createPal({ ...quiet });
    pal.watchXHR({ delay: 0, filter: (url, init) => !String(url).includes('beacon') && init?.method !== 'OPTIONS' });
    request('POST', '/beacon');
    request('OPTIONS', '/api');
    vi.advanceTimersByTime(1);
    expect(pal.mood).toBe('neutral');
    pal.destroy();
    restore();
  });

  it('restores the prototype on unwatch', () => {
    const restore = installFakeXHR();
    const { open, send } = FakeXHR.prototype;
    const pal = createPal({ ...quiet });
    const unwatch = pal.watchXHR();
    expect(FakeXHR.prototype.send).not.toBe(send);
    unwatch();
    expect(FakeXHR.prototype.open).toBe(open);
    expect(FakeXHR.prototype.send).toBe(send);
    restore();
  });

  it('watchRequests shares one counter between fetch and XHR', async () => {
    vi.useFakeTimers();
    const restore = installFakeXHR();
    window.fetch = vi.fn().mockResolvedValue(new Response('ok'));
    const pal = createPal({ ...quiet, requests: { delay: 0 } });
    const xhr = request();
    await fetch('/data');
    vi.advanceTimersByTime(1);
    expect(pal.mood).toBe('waiting'); // XHR still pending
    xhr.respond(200);
    expect(pal.mood).toBe('neutral');
    pal.destroy();
    restore();
  });
});

describe('password fields', () => {
  it('covers its eyes while a password field is focused', async () => {
    document.body.innerHTML = '<input id="user"><input id="pw" type="password">';
    const pal = createPal({ ...quiet, password: true });
    const pw = document.getElementById('pw') as HTMLInputElement;

    pw.focus();
    expect(pal.mood).toBe('shy');

    pw.type = 'text'; // "show password"
    await flushMicrotasks();
    expect(pal.mood).toBe('neutral');
    pw.type = 'password';
    await flushMicrotasks();
    expect(pal.mood).toBe('shy');

    (document.getElementById('user') as HTMLInputElement).focus();
    expect(pal.mood).toBe('neutral');
  });

  it('a wrong-password wince still shows over shy', () => {
    document.body.innerHTML = '<form id="login"><input id="pw" type="password" required></form>';
    const pal = createPal({ ...quiet, password: true, watch: '#login' });
    const pw = document.getElementById('pw') as HTMLInputElement;
    pw.focus();
    pw.dispatchEvent(new Event('invalid'));
    expect(pal.mood).toBe('wince');
  });
});

describe('gaze', () => {
  const tilt = (el: HTMLElement) => parseFloat(el.style.getPropertyValue('--pp-tilt'));

  it('looks at the invalid field, then back', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<form id="f"><input id="a" required><input id="b" required></form>';
    const pal = createPal({ ...quiet, watch: '#f', gaze: { duration: 1000 } });
    stubRect(pal.element!, 500, 500, 72, 72);
    stubRect(document.getElementById('a')!, 0, 500); // to the left
    stubRect(document.getElementById('b')!, 1000, 500); // to the right

    document.getElementById('a')!.dispatchEvent(new Event('invalid'));
    document.getElementById('b')!.dispatchEvent(new Event('invalid')); // same burst: keep looking at the first
    expect(tilt(pal.element!)).toBeLessThan(0);

    vi.advanceTimersByTime(1000);
    expect(tilt(pal.element!)).toBe(0);
  });

  it('can be turned off for forms but still used manually', () => {
    document.body.innerHTML = '<form id="f"><input id="a" required></form>';
    const pal = createPal({ ...quiet, watch: '#f', gaze: false });
    stubRect(pal.element!, 500, 500, 72, 72);
    stubRect(document.getElementById('a')!, 0, 500);
    document.getElementById('a')!.dispatchEvent(new Event('invalid'));
    expect(pal.element!.style.getPropertyValue('--pp-tilt')).toBe('');

    pal.lookAt({ x: 2000, y: 536 });
    expect(tilt(pal.element!)).toBeGreaterThan(0);
    pal.lookAt(null);
    expect(tilt(pal.element!)).toBe(0);
  });
});

describe('frustration', () => {
  const click = (x: number, y: number, target: Element = document.body) =>
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));

  it('looks concerned on rage clicks and emits an event', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button id="broken">Pay</button>';
    const button = document.getElementById('broken')!;
    const pal = createPal({ ...quiet, frustration: true });
    const onFrustration = vi.fn();
    pal.on('frustration', onFrustration);

    for (let i = 0; i < 4; i++) {
      click(100 + i * 3, 100, button);
      vi.advanceTimersByTime(150);
    }
    expect(pal.mood).toBe('concerned');
    expect(onFrustration).toHaveBeenCalledWith(expect.objectContaining({ kind: 'rage-click', target: button, clicks: 4 }));
  });

  it('ignores triple clicks, slow clicks and scattered clicks', () => {
    vi.useFakeTimers();
    const pal = createPal({ ...quiet, frustration: true });
    for (let i = 0; i < 3; i++) click(100, 100); // triple-click to select text
    vi.advanceTimersByTime(2000);
    for (let i = 0; i < 4; i++) {
      click(100, 100);
      vi.advanceTimersByTime(600); // too slow
    }
    for (let i = 0; i < 4; i++) click(100 + i * 100, 100); // far apart
    expect(pal.mood).toBe('neutral');
  });

  it('ignores clicks on the pal itself', () => {
    const pal = createPal({ ...quiet, frustration: true });
    for (let i = 0; i < 6; i++) click(10, 10, pal.element!);
    expect(pal.mood).toBe('neutral');
  });
});

describe('page errors', () => {
  it('is off by default', () => {
    const pal = createPal({ ...quiet });
    window.dispatchEvent(new Event('error'));
    expect(pal.mood).toBe('neutral');
  });

  it('winces on uncaught errors and unhandled rejections when enabled', () => {
    vi.useFakeTimers();
    const pal = createPal({ ...quiet, errors: true });
    window.dispatchEvent(new Event('error'));
    expect(pal.mood).toBe('wince');
    vi.advanceTimersByTime(1200);
    window.dispatchEvent(new Event('unhandledrejection'));
    expect(pal.mood).toBe('wince');
  });
});

describe('delight', () => {
  it('winks on copy', () => {
    const pal = createPal({ ...quiet, copy: true });
    document.dispatchEvent(new Event('copy'));
    expect(pal.mood).toBe('wink');
  });

  it('cheers when the user comes back after a while', () => {
    vi.useFakeTimers();
    const pal = createPal({ ...quiet, welcomeBack: { after: 10_000 } });
    setVisibility('hidden');
    vi.advanceTimersByTime(3000);
    setVisibility('visible');
    expect(pal.mood).toBe('neutral'); // too short

    setVisibility('hidden');
    vi.advanceTimersByTime(10_000);
    setVisibility('visible');
    expect(pal.mood).toBe('cheer');
  });

  it('wakes from dozing when the tab becomes visible', () => {
    vi.useFakeTimers();
    const pal = createPal({ ...quiet, idle: { timeout: 1000 } });
    vi.advanceTimersByTime(1000);
    expect(pal.mood).toBe('dozing');
    setVisibility('visible');
    expect(pal.mood).toBe('neutral');
  });
});

describe('interaction', () => {
  const interactive = { ...quiet, interactive: true, remember: true, size: 72 };

  it('winks when poked and briefly reveals the close button', () => {
    vi.useFakeTimers();
    const pal = createPal(interactive);
    const onPoke = vi.fn();
    pal.on('poke', onPoke);
    pointer(pal.element!, 'pointerdown', 10, 10);
    pointer(pal.element!, 'pointerup', 11, 10);
    expect(pal.mood).toBe('wink');
    expect(onPoke).toHaveBeenCalledOnce();
    expect(pal.element!.dataset.showClose).toBe('');
    vi.advanceTimersByTime(3000);
    expect(pal.element!.dataset.showClose).toBeUndefined();
  });

  it('drags without poking, clamps to the viewport and remembers the spot', () => {
    const pal = createPal(interactive);
    const host = pal.element!;
    stubRect(host, 900, 600, 72, 72);
    pointer(host, 'pointerdown', 930, 630);
    pointer(host, 'pointermove', 800, 500);
    expect(host.dataset.dragging).toBe('');
    pointer(host, 'pointermove', -500, 400); // off the left edge
    pointer(host, 'pointerup', -500, 400);

    expect(pal.mood).toBe('neutral');
    expect(host.style.left).toBe('0px');
    expect(host.style.top).toBe('370px');
    expect(host.style.right).toBe('auto');
    expect(JSON.parse(localStorage.getItem('pagepal')!).position).toEqual({ left: 0, top: 370 });

    pal.destroy();
    const again = createPal(interactive);
    expect(again.element!.style.top).toBe('370px');
  });

  it('dismisses via the close button, remembers it, and show() brings it back', () => {
    const pal = createPal(interactive);
    const onDismiss = vi.fn();
    pal.on('dismiss', onDismiss);
    shadow(pal.element).querySelector<HTMLButtonElement>('.close')!.click();
    expect(pal.hidden).toBe(true);
    expect(onDismiss).toHaveBeenCalledOnce();
    pal.destroy();

    const again = createPal(interactive);
    expect(again.hidden).toBe(true);
    again.show();
    expect(again.hidden).toBe(false);
    again.destroy();
    expect(createPal(interactive).hidden).toBe(false);
  });

  it('remember: false stores nothing; hide() is not remembered', () => {
    const pal = createPal({ ...interactive, remember: false });
    pal.dismiss();
    expect(localStorage.getItem('pagepal')).toBeNull();
    const other = createPal({ ...interactive, storageKey: 'other' });
    other.hide();
    expect(localStorage.getItem('other')).toBeNull();
  });

  it('survives storage that throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => createPal(interactive).dismiss()).not.toThrow();
    spy.mockRestore();
  });

  it('interactive: false is click-through', () => {
    const pal = createPal({ ...quiet });
    expect(pal.element!.dataset.interactive).toBeUndefined();
    pointer(pal.element!, 'pointerdown');
    pointer(pal.element!, 'pointerup');
    expect(pal.mood).toBe('neutral');
  });
});

describe('plugins and signals', () => {
  it('lets plugins raise namespaced signals and cleans up after them', () => {
    const cleanup = vi.fn();
    const pal = createPal({ ...quiet });
    let api!: PalPluginAPI;
    const remove = pal.use((a) => {
      api = a;
      return cleanup;
    });

    api.signal('upload', 'waiting');
    pal.signal('upload', 'sad'); // user signal with the same name is independent
    expect(pal.mood).toBe('sad');
    pal.clearSignal('upload');
    expect(pal.mood).toBe('waiting');

    const onChange = vi.fn();
    api.on('change', onChange);
    remove();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(pal.mood).toBe('neutral');
    pal.react('cheer');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('runs plugin cleanup on destroy', () => {
    const cleanup = vi.fn();
    const pal = createPal({ ...quiet });
    pal.use(() => cleanup);
    pal.destroy();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('react(mood, Infinity) holds any mood', () => {
    vi.useFakeTimers();
    const pal = createPal({ ...quiet });
    pal.react('cheer', Infinity);
    vi.advanceTimersByTime(60_000);
    expect(pal.mood).toBe('cheer');
  });
});

describe('priorities of new moods', () => {
  const order: Mood[] = ['cheer', 'wink', 'wince', 'dizzy', 'concerned', 'confused', 'sad', 'shy', 'waiting', 'dozing', 'sleepy'];
  it('ranks them in the documented order', () => {
    const pal = createPal({ ...quiet });
    [...order].reverse().forEach((mood) => pal.signal(mood, mood));
    for (const mood of order) {
      expect(pal.mood).toBe(mood);
      pal.clearSignal(mood);
    }
    expect(pal.mood).toBe('neutral');
  });
});
