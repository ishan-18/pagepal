import { describe, expect, it, vi } from 'vitest';
import { createPal, createPalCore, defineCharacter, type PalPluginAPI } from '../src';
import { debugPanel } from '../src/debug';
import { PagePalElement } from '../src/element';
import { deadClicks, forms, requests } from '../src/watchers/index';
import { FakeXHR, flushMicrotasks, installFakeXHR, quiet, stubRect } from './helpers';

const shadow = (el: HTMLElement | null) => el!.shadowRoot!;

describe('createPalCore + watchers', () => {
  it('runs only the watchers it is given', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<form id="f"><input required></form><input id="pw" type="password">';
    const pal = createPalCore({ interactive: false, remember: false, plugins: [forms('#f')] });
    (document.getElementById('pw') as HTMLInputElement).focus(); // no password watcher
    vi.advanceTimersByTime(60_000); // no idle watcher
    expect(pal.mood).toBe('neutral');
    document.querySelector('#f input')!.dispatchEvent(new Event('invalid'));
    expect(pal.mood).toBe('wince');
  });

  it('use() accepts watchers and plugins alike, and removes them', () => {
    const pal = createPalCore({ interactive: false, remember: false });
    document.body.innerHTML = '<form id="f"><input required></form>';
    const off = pal.use(forms('#f'));
    off();
    document.querySelector('input')!.dispatchEvent(new Event('invalid'));
    expect(pal.mood).toBe('neutral');
  });
});

describe('characters', () => {
  it('renders your own SVG character with every built-in face', () => {
    const robot = defineCharacter({
      name: 'robot',
      color: '#5cc8ff',
      body: 'M15 20 H85 V92 H15 Z',
      back: '<rect class="fur antenna" x="47" y="4" width="6" height="16"/>',
    });
    const pal = createPal({ ...quiet, character: robot });
    const root = shadow(pal.element);
    expect(pal.element!.dataset.character).toBe('robot');
    expect(root.querySelector('.antenna')).not.toBeNull();
    expect(root.querySelector('.eyes-confused')).not.toBeNull();
    expect(pal.element!.style.getPropertyValue('--pp-color')).toBe('var(--pagepal-color, #5cc8ff)');
  });
});

describe('color', () => {
  it('explicit color wins; auto picks a colorful theme color and skips white', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#ffffff">';
    expect(createPal({ ...quiet, color: 'auto' }).element!.style.getPropertyValue('--pp-color')).toBe(
      'var(--pagepal-color, #7c5cff)',
    );
    document.head.innerHTML = '<meta name="theme-color" content="#e8590c">';
    expect(createPal({ ...quiet, color: 'auto' }).element!.style.getPropertyValue('--pp-color')).toBe(
      'var(--pagepal-color, #e8590c)',
    );
    expect(createPal({ ...quiet, color: 'teal' }).element!.style.getPropertyValue('--pp-color')).toBe('teal');
    document.head.innerHTML = '';
  });
});

describe('keyboard access', () => {
  it('has a labelled, focusable dismiss button', () => {
    const pal = createPal({ ...quiet, interactive: true, labels: { dismiss: 'Masquer' } });
    const button = shadow(pal.element).querySelector<HTMLButtonElement>('.close')!;
    expect(button.getAttribute('aria-label')).toBe('Masquer');
    expect(button.hasAttribute('tabindex')).toBe(false);
    button.focus();
    button.click();
    expect(pal.hidden).toBe(true);
  });

  it('keyboard: false keeps it out of the tab order', () => {
    const pal = createPal({ ...quiet, interactive: true, keyboard: false });
    expect(shadow(pal.element).querySelector('.close')!.getAttribute('tabindex')).toBe('-1');
    expect(pal.element!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('dead clicks', () => {
  const setup = (html: string) => {
    vi.useFakeTimers();
    document.body.innerHTML = html;
    const pal = createPal({ ...quiet, deadClicks: { timeout: 1000 } });
    const onFrustration = vi.fn();
    pal.on('frustration', onFrustration);
    return { pal, onFrustration };
  };
  const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

  it('is confused when a button does nothing', async () => {
    const { pal, onFrustration } = setup('<button id="b">Pay</button>');
    click(document.getElementById('b')!);
    await vi.advanceTimersByTimeAsync(1000);
    expect(pal.mood).toBe('confused');
    expect(onFrustration).toHaveBeenCalledWith(expect.objectContaining({ kind: 'dead-click', clicks: 1 }));
  });

  it('is fine when the click changes the page', async () => {
    const { pal, onFrustration } = setup('<button id="b">Open</button><div id="panel"></div>');
    const button = document.getElementById('b')!;
    button.addEventListener('click', () => (document.getElementById('panel')!.textContent = 'opened'));
    click(button);
    await vi.advanceTimersByTimeAsync(1000);
    expect(pal.mood).toBe('neutral');
    expect(onFrustration).not.toHaveBeenCalled();
  });

  it('counts a request starting as a response', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button id="b">Load</button>';
    window.fetch = vi.fn(() => new Promise<Response>(() => {}));
    const pal = createPal({ ...quiet, deadClicks: true, requests: { delay: 5000 } });
    const button = document.getElementById('b')!;
    button.addEventListener('click', () => void fetch('/slow'));
    click(button);
    await vi.advanceTimersByTimeAsync(1000);
    expect(pal.mood).toBe('neutral');
  });

  it('a scroll already in flight at click time is not a response; a later one is', async () => {
    const { onFrustration } = setup('<button id="b">Pay</button><button id="top">Back to top</button>');
    click(document.getElementById('b')!);
    document.dispatchEvent(new Event('scroll')); // delivered in the same frame as the click
    await vi.advanceTimersByTimeAsync(1000);
    expect(onFrustration).toHaveBeenCalledOnce();

    click(document.getElementById('top')!);
    await vi.advanceTimersByTimeAsync(200);
    document.dispatchEvent(new Event('scroll')); // caused by the click
    await vi.advanceTimersByTimeAsync(1000);
    expect(onFrustration).toHaveBeenCalledOnce();
  });

  it('ignores form fields, plain text, and [data-pagepal-ignore]', async () => {
    const { onFrustration } = setup(
      '<input id="i"><p id="p">text</p><button id="x" data-pagepal-ignore>Copy</button><div role="button" id="r">Menu</div>',
    );
    for (const id of ['i', 'p', 'x']) click(document.getElementById(id)!);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onFrustration).not.toHaveBeenCalled();
    click(document.getElementById('r')!); // role=button counts
    await vi.advanceTimersByTimeAsync(1000);
    expect(onFrustration).toHaveBeenCalledOnce();
  });

  it('elements styled cursor:pointer count as clickable', async () => {
    const { onFrustration } = setup('<div id="card" style="cursor: pointer"><span id="inner">Card</span></div>');
    click(document.getElementById('inner')!);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onFrustration).toHaveBeenCalledWith(expect.objectContaining({ target: document.getElementById('card') }));
  });

  it('a rage click is not also reported as a dead click', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button id="b">Pay</button>';
    const pal = createPal({ ...quiet, deadClicks: true, frustration: true });
    const kinds: string[] = [];
    pal.on('frustration', (d) => kinds.push(d.kind));
    for (let i = 0; i < 4; i++) click(document.getElementById('b')!);
    await vi.advanceTimersByTimeAsync(1500);
    expect(kinds).toEqual(['rage-click']);
  });
});

describe('avoiding overlaps', () => {
  const setup = (widgetBox: [number, number, number, number]) => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="chat" style="position: fixed"></div>';
    const chat = document.getElementById('chat')!;
    stubRect(chat, ...widgetBox);
    const original = document.elementsFromPoint;
    document.elementsFromPoint = (x: number, y: number) => {
      const r = chat.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom ? [chat] : [];
    };
    const pal = createPal({ ...quiet, avoid: true, size: 72, offset: 20 });
    return { pal, restore: () => (document.elementsFromPoint = original) };
  };

  it('slides up above a chat widget in its corner', () => {
    // jsdom viewport is 1024×768; home spot is left 932..1004, top 676..748.
    const { pal, restore } = setup([940, 680, 60, 60]);
    vi.advanceTimersByTime(200);
    // Moves so its bottom sits 12px above the widget's top (680): 748 → 668, i.e. -80px.
    expect(pal.element!.style.translate).toBe('0px -80px');
    restore();
  });

  it('stays put when nothing is in the way', () => {
    const { pal, restore } = setup([0, 0, 50, 50]);
    vi.advanceTimersByTime(200);
    expect(pal.element!.style.translate).toBe('');
    restore();
  });

  it('slides to the other side while the focused field is underneath', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<input id="search">';
    const input = document.getElementById('search')!;
    stubRect(input, 900, 700, 120, 30);
    const pal = createPal({ ...quiet, avoid: true, size: 72, offset: 20 });
    input.focus();
    expect(pal.element!.style.translate).toBe(`${-(1024 - 72 - 40)}px 0px`);
    input.blur();
    vi.advanceTimersByTime(200);
    expect(pal.element!.style.translate).toBe('');
  });
});

describe('progress', () => {
  it('shows a ring for manual progress', () => {
    const pal = createPal({ ...quiet });
    pal.progress(0.4);
    expect(pal.element!.dataset.progress).toBe('');
    expect(pal.element!.style.getPropertyValue('--pp-progress')).toBe('40.0');
    pal.progress(null);
    expect(pal.element!.dataset.progress).toBeUndefined();
  });

  it('tracks large XHR uploads', () => {
    const restore = installFakeXHR();
    class Upload extends EventTarget {}
    const pal = createPal({ ...quiet, requests: true });
    const xhr = new XMLHttpRequest() as unknown as FakeXHR & { upload: EventTarget };
    Object.defineProperty(xhr, 'upload', { value: new Upload() });
    xhr.open('POST', '/upload');
    (xhr as unknown as XMLHttpRequest).send();
    const progress = (loaded: number) =>
      xhr.upload.dispatchEvent(Object.assign(new Event('progress'), { lengthComputable: true, loaded, total: 1_000_000 }));
    progress(250_000);
    expect(pal.element!.style.getPropertyValue('--pp-progress')).toBe('25.0');
    progress(1_000_000);
    xhr.respond(200);
    expect(pal.element!.dataset.progress).toBeUndefined();
    pal.destroy();
    restore();
  });
});

describe('form progress', () => {
  it('warms up as required fields fill in, winks when complete, emits progress', () => {
    document.body.innerHTML = `
      <form id="f"><input name="a" required><input name="b" required><input name="note"></form>`;
    const pal = createPal({ ...quiet, watch: '#f' });
    const seen: (number | null)[] = [];
    pal.on('formProgress', (d) => seen.push(d.progress));
    const [a, b] = Array.from(document.querySelectorAll<HTMLInputElement>('[required]'));
    a!.value = 'x';
    a!.dispatchEvent(new Event('input', { bubbles: true }));
    expect(pal.element!.style.getPropertyValue('--pp-joy')).toBe('0.50');
    b!.value = 'y';
    b!.dispatchEvent(new Event('input', { bubbles: true }));
    expect(pal.mood).toBe('wink');
    expect(seen).toEqual([0.5, 1]);
  });
});

describe('events for analytics', () => {
  it('formError carries the field and validity reason; formSubmit the outcome', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<form id="f"><input type="email" required></form>';
    const pal = createPal({ ...quiet, watch: '#f' });
    const errors: unknown[] = [];
    const submits: unknown[] = [];
    pal.on('formError', (d) => errors.push({ validity: d.validity, source: d.source }));
    pal.on('formSubmit', (d) => submits.push(d.success));
    const input = document.querySelector('input')!;
    input.dispatchEvent(new Event('invalid'));
    input.value = 'me@example.com';
    document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true }));
    vi.advanceTimersByTime(0);
    expect(errors).toEqual([{ validity: 'valueMissing', source: 'invalid' }]);
    expect(submits).toEqual([true]);
  });

  it('request events describe method, url, status and duration', async () => {
    window.fetch = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    const pal = createPal({ ...quiet, requests: true });
    const seen: unknown[] = [];
    pal.on('request', (d) => seen.push({ kind: d.kind, method: d.method, url: d.url, status: d.status, failed: d.failed }));
    await fetch('/api/items?page=2', { method: 'post' });
    expect(seen).toEqual([{ kind: 'fetch', method: 'POST', url: '/api/items?page=2', status: 503, failed: true }]);
  });
});

describe('plugin API additions', () => {
  it('exposes mood, element, signals() and progress()', () => {
    const pal = createPal({ ...quiet });
    let api!: PalPluginAPI;
    const remove = pal.use((a) => void (api = a));
    api.signal('x', 'sad', 5000);
    expect(api.mood).toBe('sad');
    expect(api.element).toBe(pal.element);
    expect(api.signals()[0]).toMatchObject({ mood: 'sad', priority: 70 });
    api.progress(0.5);
    expect(pal.element!.dataset.progress).toBe('');
    remove();
    expect(pal.element!.dataset.progress).toBeUndefined();
    expect(pal.mood).toBe('neutral');
  });
});

describe('debug panel', () => {
  it('lists signals and events, and cleans up', () => {
    const pal = createPal({ ...quiet });
    const remove = pal.use(debugPanel());
    pal.signal('upload', 'waiting');
    pal.react('cheer', 1000);
    const panel = document.querySelector('pagepal-debug')!.shadowRoot!;
    expect(panel.querySelector('.mood')!.textContent).toBe('cheer');
    expect(panel.querySelector('table')!.textContent).toContain('user:upload');
    expect(panel.querySelector('ol')!.textContent).toContain('mood waiting → cheer');
    remove();
    expect(document.querySelector('pagepal-debug')).toBeNull();
  });
});

describe('<page-pal>', () => {
  it('creates a pal from attributes and removes it when detached', async () => {
    expect(customElements.get('page-pal')).toBe(PagePalElement);
    document.body.innerHTML = '<form id="f"><input required></form>';
    const el = document.createElement('page-pal') as PagePalElement;
    el.setAttribute('character', 'cat');
    el.setAttribute('watch', '#f');
    el.setAttribute('idle', 'false');
    el.setAttribute('remember', 'false');
    document.body.append(el);
    expect(el.pal!.element!.dataset.character).toBe('cat');
    document.querySelector('input')!.dispatchEvent(new Event('invalid'));
    expect(el.pal!.mood).toBe('wince');

    el.setAttribute('character', 'ghost'); // recreated
    expect(document.querySelectorAll('pagepal-mascot')).toHaveLength(1);
    expect(el.pal!.element!.dataset.character).toBe('ghost');

    el.remove();
    await flushMicrotasks();
    expect(document.querySelector('pagepal-mascot')).toBeNull();
  });

  it('renders inside itself with position="inline"', () => {
    const el = document.createElement('page-pal') as PagePalElement;
    el.setAttribute('position', 'inline');
    el.setAttribute('remember', 'false');
    document.body.append(el);
    expect(el.pal!.element!.parentElement).toBe(el);
  });
});

describe('watchers from pagepal/watchers', () => {
  it('requests({ kinds }) and deadClicks() work with the core', async () => {
    vi.useFakeTimers();
    const restore = installFakeXHR();
    window.fetch = vi.fn(() => new Promise<Response>(() => {}));
    const pal = createPalCore({ interactive: false, remember: false, plugins: [requests({ kinds: ['xhr'], delay: 0 }), deadClicks()] });
    void fetch('/ignored'); // fetch not watched
    vi.advanceTimersByTime(1);
    expect(pal.mood).toBe('neutral');
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/x');
    xhr.send();
    vi.advanceTimersByTime(1);
    expect(pal.mood).toBe('waiting');
    pal.destroy();
    restore();
  });
});
