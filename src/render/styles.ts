import type { Mood } from '../types';

const visibility = (parts: Record<Mood, string[]>) =>
  (Object.entries(parts) as [Mood, string[]][])
    .flatMap(([mood, names]) => names.map((name) => `:host([data-mood="${mood}"]) .${name}`))
    .join(',');

export const buildStyles = (parts: Record<Mood, string[]>) => /* css */ `
:host {
  position: fixed;
  width: var(--pp-size);
  height: var(--pp-size);
  pointer-events: none;
  display: block;
  contain: layout style;
  --pp-stroke: color-mix(in srgb, var(--pp-color), #000 22%);
  transition: translate .35s ease;
}
:host([hidden]) { display: none !important; }
:host([data-corner="inline"]) { position: relative; display: inline-block; vertical-align: middle; }
@media print { :host { display: none !important; } }

:host([data-interactive]) { pointer-events: auto; cursor: grab; touch-action: none; -webkit-user-select: none; user-select: none; }
:host([data-dragging]) { cursor: grabbing; }
:host([data-dragging]) .pal { scale: 1.08; filter: drop-shadow(0 6px 10px rgba(0,0,0,.25)); }

.pal { width: 100%; height: 100%; overflow: visible; display: block; transition: scale .15s ease; }
/* Animate around each element's own center; elements positioned by an SVG transform attribute keep SVG semantics. */
.pal *:not([transform]) { transform-box: fill-box; transform-origin: center; }
.body, .fur, .paw ellipse { fill: var(--pp-color); stroke: var(--pp-stroke); stroke-width: 2; }
.paw path { fill: none; stroke: var(--pp-stroke); stroke-width: 1.4; stroke-linecap: round; }
.tail-outline { stroke: var(--pp-stroke); }
.tail-fill { stroke: var(--pp-color); }

.gaze { rotate: var(--pp-tilt, 0deg); transform-origin: 50% 90%; transition: rotate .35s ease; }
.face { translate: var(--pp-gx, 0px) var(--pp-gy, 0px); transition: translate .35s ease; }
.figure { transform-origin: 50% 100%; animation: breathe 3.2s ease-in-out infinite; }
:host([data-motion="hover"]) .figure { animation: hover 3s ease-in-out infinite; }
.sprout, .tail { transform-origin: 50% 100%; animation: sway 2.4s ease-in-out infinite; }
.ear-r { transform-origin: 50% 100%; animation: twitch 5s ease-in-out infinite; }

.part { display: none; }
${visibility(parts)} { display: inline; }

.bubble {
  position: absolute;
  max-width: 220px;
  width: max-content;
  padding: 8px 12px;
  border-radius: 14px;
  background: #fff;
  color: #2b2340;
  font: 500 13px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
  box-shadow: 0 4px 18px rgba(0,0,0,.18);
  opacity: 0;
  transform: translateY(6px) scale(.96);
  transition: opacity .18s ease, transform .18s ease;
  pointer-events: none;
}
.bubble.show { opacity: 1; transform: none; }
:host([data-corner^="bottom"]) .bubble, :host([data-corner="inline"]) .bubble { bottom: calc(100% + 10px); }
:host([data-corner^="top"]) .bubble { top: calc(100% + 10px); }
:host([data-corner$="right"]) .bubble { right: 0; }
:host([data-corner$="left"]) .bubble, :host([data-corner="inline"]) .bubble { left: 0; }

.close {
  position: absolute; top: -6px; right: -6px;
  width: 22px; height: 22px; padding: 0; border: 2px solid #fff; border-radius: 50%;
  display: grid; place-items: center;
  background: #2b2340; color: #fff; cursor: pointer;
  opacity: 0; pointer-events: none; transition: opacity .15s ease;
}
.close svg { width: 8px; height: 8px; }
:host([data-interactive]:hover) .close, :host([data-interactive][data-show-close]) .close, .close:focus-visible { opacity: 1; pointer-events: auto; }
.close:focus-visible { outline: none; box-shadow: 0 0 0 3px #fff, 0 0 0 5px #2b2340; }

/* Form progress (--pp-joy 0..1) warms the cheeks. */
.cheek { opacity: calc(.45 + var(--pp-joy, 0) * .45); transform: scale(calc(1 + var(--pp-joy, 0) * .3)); transition: opacity .4s ease, transform .4s ease; }

/* Progress ring (--pp-progress 0..100). */
.ring { display: none; }
:host([data-progress]) .ring { display: inline; }
.ring-track { fill: none; stroke: rgba(0,0,0,.08); stroke-width: 4; }
.ring-bar { fill: none; stroke: var(--pp-stroke); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 100; stroke-dashoffset: calc(100 - var(--pp-progress, 0)); transition: stroke-dashoffset .25s ease; }

/* ---- neutral ---- */
.eyes-open { animation: blink 4.5s infinite; }

/* ---- dizzy ---- */
:host([data-mood="dizzy"]) .figure { animation: wobble .7s ease-in-out infinite; }
.spin { animation: spin 1s linear infinite; }
/* Resting spots for reduced motion; the orbit animation overrides them. */
.star.s1 { transform: translate(-20px, 3px); } .star.s2 { transform: translate(20px, 3px); } .star.s3 { transform: translate(0, -6px) scale(.8); }
.star { animation: orbit 1.2s linear infinite; }
.star.s2 { animation-delay: -.4s; } .star.s3 { animation-delay: -.8s; }

/* ---- wince ---- */
:host([data-mood="wince"]) .figure { animation: shake .32s ease-in-out 3, squash .96s ease-out; }
.fx-sweat { animation: drip 1s ease-in infinite; }

/* ---- cheer ---- */
:host([data-mood="cheer"]) .figure { animation: jump .55s cubic-bezier(.3,.7,.4,1) 3; }
.fx-confetti > * { animation: pop .9s ease-out infinite; }
.fx-confetti .c2 { animation-delay: .1s; } .fx-confetti .c3 { animation-delay: .2s; }
.fx-confetti .c4 { animation-delay: .3s; } .fx-confetti .c5 { animation-delay: .15s; }

/* ---- waiting ---- */
.eyes-look { animation: look 2.2s ease-in-out infinite; }
.fx-dots > * { animation: dot 1.2s ease-in-out infinite; }
.fx-dots .d2 { animation-delay: .15s; } .fx-dots .d3 { animation-delay: .3s; }

/* ---- sad ---- */
:host([data-mood="sad"]) .figure { animation: breathe 5s ease-in-out infinite; filter: saturate(.45); }
:host([data-mood="sad"]) .sprout, :host([data-mood="sad"]) .tail { animation: none; transform: rotate(-25deg); }
.fx-tear { animation: tear 1.8s ease-in infinite; }

/* ---- sleepy ---- */
:host([data-mood="sleepy"]) .figure { animation: sway 4s ease-in-out infinite; filter: brightness(.9); }
.yawn { animation: yawn 4s ease-in-out infinite; }
.fx-moon { animation: float 3s ease-in-out infinite; }

/* ---- dozing ---- */
:host([data-mood="dozing"]) .figure { animation: breathe 4s ease-in-out infinite; rotate: 6deg; }
.fx-zzz > * { opacity: 0; animation: zzz 3s ease-out infinite; }
.fx-zzz .z2 { animation-delay: 1s; } .fx-zzz .z3 { animation-delay: 2s; }

/* ---- shy ---- */
.paw-r { animation: peek 3.4s ease-in-out infinite; }
:host([data-mood="shy"]) .figure { animation: breathe 2.2s ease-in-out infinite; }

/* ---- concerned ---- */
:host([data-mood="concerned"]) .figure { animation: flinch .5s ease-out, shiver .12s linear .5s 6; }

/* ---- confused ---- */
:host([data-mood="confused"]) .figure { animation: ponder 1.8s ease-in-out infinite; }
.fx-question { animation: bob 1.2s ease-in-out infinite; }

/* ---- wink ---- */
:host([data-mood="wink"]) .figure { animation: bob .45s ease-out 2; }
.fx-sparkle path { animation: twinkle .9s ease-in-out infinite; }
.fx-sparkle .sp2 { animation-delay: .3s; }

@keyframes breathe { 50% { transform: scale(1.02, .98); } }
@keyframes hover { 50% { transform: translateY(-5%); } }
@keyframes sway { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
@keyframes twitch { 0%, 90%, 100% { transform: rotate(0); } 93% { transform: rotate(12deg); } 96% { transform: rotate(-4deg); } }
@keyframes blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(.1); } }
@keyframes spin { to { transform: rotate(360deg); } }
/* Elliptical orbit around the head; stars grow in front and shrink behind. */
@keyframes orbit {
  0%, 100% { transform: translate(26px, 0) scale(1); }
  12.5% { transform: translate(18.4px, 5px) scale(1.15); }
  25% { transform: translate(0, 7px) scale(1.25); }
  37.5% { transform: translate(-18.4px, 5px) scale(1.15); }
  50% { transform: translate(-26px, 0) scale(1); }
  62.5% { transform: translate(-18.4px, -5px) scale(.85); }
  75% { transform: translate(0, -7px) scale(.75); }
  87.5% { transform: translate(18.4px, -5px) scale(.85); }
}
@keyframes wobble { 0%, 100% { transform: rotate(-9deg); } 50% { transform: rotate(9deg); } }
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5%); } 75% { transform: translateX(5%); } }
@keyframes squash { 0% { scale: 1.08 .9; } 100% { scale: 1 1; } }
@keyframes drip { 0% { transform: translateY(-2px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(8px); opacity: 0; } }
@keyframes jump { 0%, 100% { transform: translateY(0) scale(1); } 15% { transform: scale(1.08, .9); } 50% { transform: translateY(-22%) scale(.96, 1.05); } }
@keyframes pop { 0% { transform: translateY(8px) scale(.4); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(-10px) rotate(160deg); opacity: 0; } }
@keyframes look { 0%, 100% { transform: translateX(-3px); } 50% { transform: translateX(3px); } }
@keyframes dot { 0%, 60%, 100% { transform: translateY(0); opacity: .35; } 30% { transform: translateY(-4px); opacity: 1; } }
@keyframes tear { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(18px); opacity: 0; } }
@keyframes yawn { 0%, 70%, 100% { transform: scale(.6); } 80%, 90% { transform: scale(1.25); } }
@keyframes float { 50% { transform: translateY(-2px) rotate(-6deg); } }
@keyframes zzz { 0% { transform: translate(0, 4px) scale(.6); opacity: 0; } 25% { opacity: 1; } 100% { transform: translate(6px, -12px) scale(1.1); opacity: 0; } }
@keyframes peek { 0%, 65%, 100% { transform: translateY(0); } 75%, 88% { transform: translateY(8px); } }
@keyframes flinch { 0% { transform: translateY(0); } 30% { transform: translateY(4%) scale(1.04, .94); } 100% { transform: none; } }
@keyframes shiver { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(1.5%); } }
@keyframes ponder { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(-3deg) translateY(-2%); } }
@keyframes bob { 50% { transform: translateY(-8%) rotate(-5deg); } }
@keyframes twinkle { 0%, 100% { transform: scale(.4); opacity: .4; } 50% { transform: scale(1.1); opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
  .fx-zzz > * { opacity: 1; }
}
`;
