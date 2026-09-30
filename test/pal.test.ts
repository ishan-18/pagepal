import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPal, type PalOptions } from '../src';
import { flushMicrotasks, installMatchMedia, setOnline } from './helpers';

/** Every automatic watcher off, so each test enables only what it checks. */
const quiet: PalOptions = { scroll: false, network: false, darkMode: false, idle: false };

describe('Pal rendering', () => {
  it('mounts a shadow-DOM host with the current mood', () => {
    const pal = createPal(quiet);
    const host = document.querySelector('pagepal-mascot') as HTMLElement;
    expect(host).toBe(pal.element);
    expect(host.shadowRoot?.querySelector('svg')).not.toBeNull();
    expect(host.dataset.mood).toBe('neutral');
    // Keyboard-dismissable by default, so not aria-hidden; the art itself is.
    expect(host.getAttribute('aria-hidden')).toBeNull();
    expect(host.shadowRoot!.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(host.shadowRoot!.querySelector('.close')!.getAttribute('aria-label')).toBe('Hide mascot');
  });

  it('is fully aria-hidden when not interactive', () => {
    const pal = createPal({ ...quiet, interactive: false });
    expect(pal.element!.getAttribute('aria-hidden')).toBe('true');
    expect(pal.element!.shadowRoot!.querySelector('.close')!.getAttribute('tabindex')).toBe('-1');
  });

  it('applies position, size and color', () => {
    const pal = createPal({ ...quiet, position: 'top-left', size: 50, offset: 8, color: 'hotpink' });
    const host = pal.element!;
    expect(host.style.top).toBe('8px');
    expect(host.style.left).toBe('8px');
    expect(host.style.getPropertyValue('--pp-size')).toBe('50px');
    expect(host.style.getPropertyValue('--pp-color')).toBe('hotpink');
  });

  it('removes itself on destroy', () => {
    const pal = createPal(quiet);
    pal.destroy();
    expect(document.querySelector('pagepal-mascot')).toBeNull();
  });

  it('shows speech bubbles as text, not HTML', () => {
    vi.useFakeTimers();
    const pal = createPal(quiet);
    pal.say('<b>hi</b>', 1000);
    const bubble = pal.element!.shadowRoot!.querySelector('.bubble')!;
    expect(bubble.textContent).toBe('<b>hi</b>');
    expect(bubble.classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(bubble.classList.contains('show')).toBe(false);
  });
});

describe('react() and events', () => {
  it('shows a manual mood and reports changes', () => {
    vi.useFakeTimers();
    const pal = createPal(quiet);
    const onChange = vi.fn();
    pal.on('change', onChange);
    pal.react('cheer', 500);
    expect(pal.element!.dataset.mood).toBe('cheer');
    expect(onChange).toHaveBeenCalledWith('cheer', 'neutral');
    vi.advanceTimersByTime(500);
    expect(pal.mood).toBe('neutral');
  });

  it('uses configured durations for reactions without an explicit duration', () => {
    vi.useFakeTimers();
    const pal = createPal({ ...quiet, durations: { cheer: 300 } });
    pal.react('cheer');
    vi.advanceTimersByTime(300);
    expect(pal.mood).toBe('neutral');
  });

  it('holds a lasting manual mood until cleared', () => {
    vi.useFakeTimers();
    const pal = createPal(quiet);
    pal.react('sad');
    vi.advanceTimersByTime(60_000);
    expect(pal.mood).toBe('sad');
    pal.react(null);
    expect(pal.mood).toBe('neutral');
  });
});

describe('scroll', () => {
  beforeEach(() => {
    window.scrollY = 0;
  });
  const scrollTo = (y: number) => {
    window.scrollY = y;
    document.dispatchEvent(new Event('scroll'));
  };

  it('gets dizzy on sustained fast scrolling', () => {
    vi.useFakeTimers();
    const pal = createPal({ ...quiet, scroll: { threshold: 2 } });
    let y = 0;
    for (let i = 0; i < 10; i++) {
      scrollTo((y += 100)); // 100px per 16ms ≈ 6px/ms
      vi.advanceTimersByTime(16);
    }
    expect(pal.mood).toBe('dizzy');
    vi.advanceTimersByTime(1200);
    expect(pal.mood).toBe('neutral');
  });

  it('handles coarse events (big jumps, uneven gaps)', () => {
    vi.useFakeTimers();
    const pal = createPal({ ...quiet, scroll: true });
    scrollTo(1000);
    vi.advanceTimersByTime(40);
    scrollTo(2000);
    expect(pal.mood).toBe('dizzy');
  });

  it('watches nested scroll containers', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="panel"></div>';
    const panel = document.getElementById('panel')!;
    Object.defineProperty(panel, 'scrollTop', { value: 0, writable: true }); // jsdom pins it to 0
    const pal = createPal({ ...quiet, scroll: true });
    for (let i = 0; i <= 10; i++) {
      panel.scrollTop = i * 120;
      panel.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(16);
    }
    expect(pal.mood).toBe('dizzy');
  });

  it('ignores slow scrolling and single jumps', () => {
    vi.useFakeTimers();
    const pal = createPal({ ...quiet, scroll: { threshold: 2 } });
    let y = 0;
    for (let i = 0; i < 10; i++) {
      scrollTo((y += 10)); // ≈ 0.6px/ms
      vi.advanceTimersByTime(16);
    }
    vi.advanceTimersByTime(500);
    scrollTo(5000); // anchor jump
    expect(pal.mood).toBe('neutral');
  });
});

describe('watch(form)', () => {
  const setup = () => {
    document.body.innerHTML = `
      <form id="signup" novalidate>
        <input name="email" type="email" required>
        <button>Sign up</button>
      </form>
      <form id="other"><input name="x"></form>`;
    return {
      form: document.querySelector<HTMLFormElement>('#signup')!,
      input: document.querySelector<HTMLInputElement>('#signup input')!,
      other: document.querySelector<HTMLFormElement>('#other')!,
    };
  };
  const submit = (form: HTMLFormElement) =>
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

  it('winces on native invalid events', () => {
    const { input } = setup();
    const pal = createPal(quiet);
    pal.watch('form#signup');
    input.dispatchEvent(new Event('invalid', { cancelable: true }));
    expect(pal.mood).toBe('wince');
  });

  it('cheers on a valid submit', () => {
    vi.useFakeTimers();
    const { form, input } = setup();
    const pal = createPal(quiet);
    pal.watch('form#signup');
    input.value = 'me@example.com';
    submit(form);
    vi.advanceTimersByTime(0);
    expect(pal.mood).toBe('cheer');
    vi.advanceTimersByTime(1800);
    expect(pal.mood).toBe('neutral');
  });

  it('winces instead of cheering when a novalidate form has errors', () => {
    vi.useFakeTimers();
    const { form } = setup();
    const pal = createPal(quiet);
    pal.watch('form#signup');
    submit(form);
    vi.advanceTimersByTime(0);
    expect(pal.mood).toBe('wince');
  });

  it('winces when a field becomes aria-invalid (form libraries)', async () => {
    const { input } = setup();
    const pal = createPal(quiet);
    pal.watch(document.querySelector('#signup')!);
    input.setAttribute('aria-invalid', 'true');
    await flushMicrotasks();
    expect(pal.mood).toBe('wince');
  });

  it('ignores forms outside the target and forms added later still work', () => {
    vi.useFakeTimers();
    const { other } = setup();
    const pal = createPal(quiet);
    pal.watch('form#late');
    submit(other);
    vi.advanceTimersByTime(0);
    expect(pal.mood).toBe('neutral');

    document.body.insertAdjacentHTML('beforeend', '<form id="late"></form>');
    submit(document.querySelector<HTMLFormElement>('#late')!);
    vi.advanceTimersByTime(0);
    expect(pal.mood).toBe('cheer');
  });

  it('stops reacting after unwatch', () => {
    const { input } = setup();
    const pal = createPal(quiet);
    const unwatch = pal.watch('#signup');
    unwatch();
    input.dispatchEvent(new Event('invalid'));
    expect(pal.mood).toBe('neutral');
  });
});

describe('watchFetch()', () => {
  const deferred = () => {
    let resolve!: (r: Response) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<Response>((res, rej) => ((resolve = res), (reject = rej)));
    return { promise, resolve, reject };
  };

  it('waits while requests are in flight (after a delay)', async () => {
    vi.useFakeTimers();
    const a = deferred();
    const b = deferred();
    const mock = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    window.fetch = mock;
    const pal = createPal(quiet);
    pal.watchFetch({ delay: 100 });

    const first = fetch('/a');
    const second = fetch('/b');
    vi.advanceTimersByTime(99);
    expect(pal.mood).toBe('neutral');
    vi.advanceTimersByTime(1);
    expect(pal.mood).toBe('waiting');

    a.resolve(new Response('ok'));
    await first;
    expect(pal.mood).toBe('waiting');
    b.resolve(new Response('ok'));
    await second;
    expect(pal.mood).toBe('neutral');
  });

  it('does not flicker for fast requests', async () => {
    vi.useFakeTimers();
    window.fetch = vi.fn().mockResolvedValue(new Response('ok'));
    const pal = createPal(quiet);
    const onChange = vi.fn();
    pal.on('change', onChange);
    pal.watchFetch({ delay: 100 });
    await fetch('/fast');
    vi.advanceTimersByTime(200);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('winces on network errors and 5xx, but not on aborts or 4xx', async () => {
    window.fetch = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    const pal = createPal(quiet);
    pal.watchFetch();

    await expect(fetch('/abort')).rejects.toThrow();
    await fetch('/missing');
    expect(pal.mood).toBe('neutral');
    await fetch('/down');
    expect(pal.mood).toBe('wince');
  });

  it('respects filter and restores fetch on unwatch', async () => {
    vi.useFakeTimers();
    const original = vi.fn(() => new Promise<Response>(() => {}));
    window.fetch = original;
    const pal = createPal(quiet);
    const unwatch = pal.watchFetch({ delay: 0, filter: (input) => !String(input).includes('analytics') });

    void fetch('/analytics');
    vi.advanceTimersByTime(10);
    expect(pal.mood).toBe('neutral');
    expect(original).toHaveBeenCalledTimes(1);

    unwatch();
    expect(window.fetch).toBe(original);
  });
});

describe('network', () => {
  it('is sad offline and cheers when back online', () => {
    vi.useFakeTimers();
    setOnline(true);
    const pal = createPal({ ...quiet, network: true });
    setOnline(false);
    expect(pal.mood).toBe('sad');
    setOnline(true);
    expect(pal.mood).toBe('cheer');
    vi.advanceTimersByTime(1800);
    expect(pal.mood).toBe('neutral');
  });
});

describe('dark mode', () => {
  it('follows prefers-color-scheme', () => {
    const media = installMatchMedia(false);
    const pal = createPal({ ...quiet, darkMode: true });
    expect(pal.mood).toBe('neutral');
    media.setDark(true);
    expect(pal.mood).toBe('sleepy');
    pal.destroy();
    expect(media.listenerCount()).toBe(0);
  });

  it('follows class and data-theme toggles, which beat the OS setting', async () => {
    installMatchMedia(true);
    document.documentElement.setAttribute('data-theme', 'light');
    const pal = createPal({ ...quiet, darkMode: true });
    expect(pal.mood).toBe('neutral');

    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.add('light');
    await flushMicrotasks();
    expect(pal.mood).toBe('neutral');

    document.documentElement.classList.replace('light', 'dark');
    await flushMicrotasks();
    expect(pal.mood).toBe('sleepy');
  });
});

describe('idle', () => {
  it('dozes after the timeout and wakes on activity', () => {
    vi.useFakeTimers();
    const pal = createPal({ ...quiet, idle: { timeout: 1000 } });
    vi.advanceTimersByTime(600);
    document.dispatchEvent(new Event('pointermove'));
    vi.advanceTimersByTime(600);
    expect(pal.mood).toBe('neutral'); // activity pushed the deadline back
    vi.advanceTimersByTime(400);
    expect(pal.mood).toBe('dozing');

    document.dispatchEvent(new Event('keydown'));
    expect(pal.mood).toBe('neutral');
    vi.advanceTimersByTime(1000);
    expect(pal.mood).toBe('dozing');
  });
});

describe('priorities across watchers', () => {
  it('a form error shows over offline, then offline returns', () => {
    vi.useFakeTimers();
    setOnline(true);
    document.body.innerHTML = '<form id="f"><input required></form>';
    const pal = createPal({ ...quiet, network: true });
    pal.watch('#f');
    setOnline(false);
    document.querySelector('input')!.dispatchEvent(new Event('invalid'));
    expect(pal.mood).toBe('wince');
    vi.advanceTimersByTime(1200);
    expect(pal.mood).toBe('sad');
    setOnline(true);
  });
});

describe('destroy', () => {
  it('removes all listeners and restores fetch', () => {
    const original = vi.fn();
    window.fetch = original;
    document.body.innerHTML = '<form id="f"><input></form>';
    const pal = createPal({ idle: { timeout: 10 } });
    pal.watch('#f');
    pal.watchFetch();
    pal.destroy();
    expect(window.fetch).toBe(original);
    document.querySelector('input')!.dispatchEvent(new Event('invalid'));
    expect(pal.mood).toBe('neutral');
    // Calling methods after destroy is harmless.
    expect(() => pal.watch('#f')()).not.toThrow();
  });
});
