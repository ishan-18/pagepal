import { describe, expect, it, vi } from 'vitest';
import { MoodEngine } from '../src/engine';

describe('MoodEngine', () => {
  it('starts neutral', () => {
    expect(new MoodEngine(() => {}).mood).toBe('neutral');
  });

  it('shows the highest-priority active signal', () => {
    const engine = new MoodEngine(() => {});
    engine.set('scheme', 'sleepy');
    engine.set('network', 'sad');
    engine.set('fetch', 'waiting');
    expect(engine.mood).toBe('sad');
    engine.clear('network');
    expect(engine.mood).toBe('waiting');
    engine.clear('fetch');
    expect(engine.mood).toBe('sleepy');
  });

  it('expires timed signals and falls back', () => {
    vi.useFakeTimers();
    const engine = new MoodEngine(() => {});
    engine.set('network', 'sad');
    engine.set('form', 'cheer', 1000);
    expect(engine.mood).toBe('cheer');
    vi.advanceTimersByTime(999);
    expect(engine.mood).toBe('cheer');
    vi.advanceTimersByTime(1);
    expect(engine.mood).toBe('sad');
  });

  it('replaces a key and restarts its timer', () => {
    vi.useFakeTimers();
    const engine = new MoodEngine(() => {});
    engine.set('form', 'wince', 1000);
    vi.advanceTimersByTime(800);
    engine.set('form', 'cheer', 1000);
    vi.advanceTimersByTime(800);
    expect(engine.mood).toBe('cheer');
    vi.advanceTimersByTime(200);
    expect(engine.mood).toBe('neutral');
  });

  it('breaks ties in favor of the newest signal', () => {
    const engine = new MoodEngine(() => {});
    engine.set('a', 'cheer');
    engine.set('b', 'cheer');
    engine.set('a', 'cheer');
    engine.clear('b');
    expect(engine.mood).toBe('cheer');
  });

  it('notifies only on actual changes', () => {
    const onChange = vi.fn();
    const engine = new MoodEngine(onChange);
    engine.set('a', 'waiting');
    engine.set('b', 'waiting');
    engine.set('c', 'sleepy');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('waiting', 'neutral');
  });

  it('accepts custom priorities', () => {
    const engine = new MoodEngine(() => {}, { sleepy: 100 });
    engine.set('scheme', 'sleepy');
    engine.set('network', 'sad');
    expect(engine.mood).toBe('sleepy');
  });

  it('dispose cancels pending timers', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const engine = new MoodEngine(onChange);
    engine.set('form', 'cheer', 500);
    engine.dispose();
    vi.advanceTimersByTime(1000);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
