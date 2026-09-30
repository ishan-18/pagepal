import { describeElement } from './analytics/describe';
import type { PalEvents, PalPlugin, PalPluginAPI } from './types';

const MAX_EVENTS = 12;

const STYLES = `
:host { position: fixed; z-index: 2147483001; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.panel { width: 300px; max-height: 60vh; overflow: auto; background: #1d1b26; color: #eeeaf8; border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,.35); padding: 10px 12px; }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-weight: 700; }
.mood { background: #7c5cff; color: #fff; border-radius: 999px; padding: 1px 8px; font-weight: 600; }
h4 { margin: 8px 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #a39fb8; }
table { width: 100%; border-collapse: collapse; }
td { padding: 1px 4px 1px 0; vertical-align: top; }
td.p, td.t { text-align: right; color: #a39fb8; white-space: nowrap; }
tr.win td { color: #b9f6ca; }
ol { margin: 0; padding: 0; list-style: none; }
li { padding: 1px 0; border-top: 1px solid #2c2838; word-break: break-word; }
.empty { color: #6b6780; }
`;

const describeEvent: { [K in keyof PalEvents]: (...args: Parameters<PalEvents[K]>) => string | null } = {
  change: (mood, previous) => `mood ${previous} → ${mood}`,
  frustration: (d) => `${d.kind} ${describeElement(d.target)}`,
  formError: (d) => `form error ${describeElement(d.field)}${d.validity ? ` (${d.validity})` : ''}`,
  formSubmit: (d) => `submit ${describeElement(d.form, false)} ${d.success ? 'ok' : 'invalid'}`,
  formProgress: () => null, // too chatty
  request: (d) => `${d.method} ${d.url} → ${d.status || (d.aborted ? 'aborted' : 'failed')} ${d.duration}ms`,
  connection: (d) => (d.online ? `online (offline ${d.offlineMs ?? 0}ms)` : 'offline'),
  poke: () => 'poked',
  dismiss: () => 'dismissed',
};

/**
 * A floating panel for development: the current mood, every active signal
 * with its priority and time left, and recent events. `pal.use(debugPanel())`.
 */
export function debugPanel({ corner = 'auto' }: { corner?: 'auto' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' } = {}): PalPlugin {
  return (api: PalPluginAPI) => {
    const doc = api.document;
    const host = doc.createElement('pagepal-debug');
    const palCorner = api.element.dataset.corner ?? 'bottom-right';
    const resolved =
      corner !== 'auto' ? corner : palCorner.endsWith('right') ? palCorner.replace('right', 'left') : palCorner.replace('left', 'right');
    const [vertical, horizontal] = (resolved === 'inline' ? 'bottom-left' : resolved).split('-') as [string, string];
    host.style.setProperty(vertical, '12px');
    host.style.setProperty(horizontal, '12px');

    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${STYLES}</style><div class="panel"><header><span>pagepal</span><span class="mood"></span></header><h4>Signals</h4><table></table><h4>Events</h4><ol></ol></div>`;
    const moodEl = root.querySelector('.mood')!;
    const table = root.querySelector('table')!;
    const list = root.querySelector('ol')!;
    const events: string[] = [];

    const cell = (text: string, className?: string) => {
      const td = doc.createElement('td');
      td.textContent = text;
      if (className) td.className = className;
      return td;
    };

    const render = () => {
      moodEl.textContent = api.mood;
      const signals = api.signals();
      table.replaceChildren(
        ...signals.map((signal, index) => {
          const row = doc.createElement('tr');
          if (index === 0) row.className = 'win';
          const left = signal.expiresAt === null ? '∞' : `${Math.max(0, (signal.expiresAt - Date.now()) / 1000).toFixed(1)}s`;
          row.append(cell(signal.key), cell(signal.mood), cell(String(signal.priority), 'p'), cell(left, 't'));
          return row;
        }),
      );
      if (!signals.length) table.replaceChildren(Object.assign(doc.createElement('caption'), { className: 'empty', textContent: 'none (neutral)' }));
      list.replaceChildren(
        ...(events.length ? events : ['no events yet']).map((text) =>
          Object.assign(doc.createElement('li'), { textContent: text, className: events.length ? '' : 'empty' }),
        ),
      );
    };

    const offs = (Object.keys(describeEvent) as (keyof PalEvents)[]).map((name) =>
      api.on(name, ((...args: unknown[]) => {
        const text = (describeEvent[name] as (...a: unknown[]) => string | null)(...args);
        if (text === null) return;
        events.unshift(`${new Date().toLocaleTimeString()} ${text}`);
        events.length = Math.min(events.length, MAX_EVENTS);
        render();
      }) as never),
    );

    doc.body.append(host);
    render();
    const timer = setInterval(render, 250); // countdowns

    return () => {
      clearInterval(timer);
      offs.forEach((off) => off());
      host.remove();
    };
  };
}
