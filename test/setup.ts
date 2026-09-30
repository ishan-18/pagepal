import { afterEach, vi } from 'vitest';
import { installMatchMedia } from './helpers';

installMatchMedia(false);

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
  installMatchMedia(false);
});
