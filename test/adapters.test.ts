import { act, createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, type ShallowRef } from 'vue';
import type { Pal } from '../src';
import { PagePal, PagePalProvider, usePagePal, usePal } from '../src/react';
import { PagePal as VuePagePal, usePal as useVuePal } from '../src/vue';
import { quiet } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hosts = () => document.querySelectorAll('pagepal-mascot');

describe('pagepal/react', () => {
  const mount = (element: Parameters<ReturnType<typeof createRoot>['render']>[0]) => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(element));
    return root;
  };

  it('usePal mounts one pal (even in StrictMode) and removes it on unmount', () => {
    let pal: Pal | null = null;
    function App() {
      pal = usePal({ ...quiet, character: 'cat' });
      return null;
    }
    const root = mount(createElement(StrictMode, null, createElement(App)));
    expect(hosts()).toHaveLength(1);
    expect(pal!.element!.dataset.character).toBe('cat');
    act(() => root.unmount());
    expect(hosts()).toHaveLength(0);
  });

  it('<PagePal> applies watch options', () => {
    document.body.innerHTML = '<form id="f"><input required></form>';
    const root = mount(createElement(PagePal, { ...quiet, watch: '#f' }));
    document.querySelector('input')!.dispatchEvent(new Event('invalid'));
    expect((hosts()[0] as HTMLElement).dataset.mood).toBe('wince');
    act(() => root.unmount());
  });

  it('PagePalProvider shares the pal with descendants', () => {
    let fromContext: Pal | null = null;
    function Child() {
      fromContext = usePagePal();
      return null;
    }
    const root = mount(createElement(PagePalProvider, quiet, createElement(Child)));
    expect(fromContext).not.toBeNull();
    expect(fromContext!.element).toBe(hosts()[0]);
    act(() => root.unmount());
  });
});

describe('pagepal/vue', () => {
  it('usePal creates the pal on mount and destroys it on unmount', () => {
    let pal!: ShallowRef<Pal | null>;
    const app = createApp(
      defineComponent({
        setup() {
          pal = useVuePal({ ...quiet, character: 'ghost' });
          return () => h('div');
        },
      }),
    );
    app.mount(document.createElement('div'));
    expect(pal.value!.element!.dataset.character).toBe('ghost');
    app.unmount();
    expect(pal.value).toBeNull();
    expect(hosts()).toHaveLength(0);
  });

  it('<PagePal> accepts watch and options props', () => {
    document.body.innerHTML = '<form id="f"><input required></form>';
    const app = createApp({ render: () => h(VuePagePal, { watch: '#f', options: quiet }) });
    app.mount(document.createElement('div'));
    document.querySelector('input')!.dispatchEvent(new Event('invalid'));
    expect((hosts()[0] as HTMLElement).dataset.mood).toBe('wince');
    app.unmount();
  });
});
