# Newsocapis — Mintlify (light) redesign handoff

## Scope & rule

The whole site was re-skinned to `DESIGN.md` ("Mintlify — Style Reference", light).
**Only design changed.** All animation behavior is preserved exactly:

- Same 7 `@keyframes` (`nav-panel-in`, `sky-drift`, `hero-scrollcue`, `en-lift`, `en-rise`, `en-settle`, `pl-char`) — byte-identical names/sets (verified: `/tmp/anim/anim-before.json` vs `anim-after.json` match).
- No `animation` declarations changed, `script.js` untouched.
- `docClasses` baseline `js js-runtime gsap-entrance is-entered` unchanged; intro + reveal + magnetic + proximity + scrollcue + preloader timing/order/events unchanged.
- One transition **added**: `.nav { transition: background-color var(--dur) var(--ease-signature) }` — it re-creates the original smooth glass theme-swap, now fading the flat white bar. This is the only intentional transition inventory delta.

## Files changed

- `style.css` — tokens re-mapped, base typography, nav de-glassed (appended block `14. MINTLIFY NAV` shadowing the old glass rules; nothing deleted), buttons/pills/eyebrow/statements/tiles/scroll-progress re-keyed. Clarity reverted to the photo as a CSS `background-image` (`assets/atmos-1600.jpg`, `cover`/`center`); the old teal→mint inline SVG gradient is hidden via `.atmospheric-media { display:none }` (markup kept, easiest to re-enable).
- `index.html` — `theme-color` → `#ffffff`, favicon mint, removed Instrument Serif (Inter only), Clarity `<img>` → hand-made inline SVG (`id="atmos-sky"`/`atmos-sun"`), same classes (`atmospheric-media`).
- `HANDOFF.md` — this file. (New.)

Not touched: `script.js`, `assets/*` (see below), pre-existing working-tree changes (`DESIGN.md` modified, `design/*.png` deleted — not mine).

## Token map (old → new)

| Old | New | Where |
|---|---|---|
| `--color-parchment` / paper surfaces | `#ffffff` | canvas/bar/panels |
| `--color-linen` / mist | `#f2f2f2` | hairline surfaces, preloader track |
| `--color-ink`/graphite/twilight | `#08090a` / `#000000` | primary text, filled CTA |
| `--color-ash` | `#5c5c5c` | secondary text |
| `--color-fog` | `#dddddd` | scrollbar thumb, hairline |
| `--color-cerulean`/signal-blue → `--color-mint-green` | `#0c8c5e` | sole accent |
| Instrument Serif / `--font-ppmondwest` / `--font-af` | Inter | all |
| type scale | 13/16/20/24/40/48/57, `display 57/1.1/-1.14` | headings/captions |
| radii | nav 0, cards 16px, buttons 4px, large surfaces 24px | all components |
| shadows | DESIGN `lab()` whisper (`--shadow-subtle`) + 1px hairline | all |
| section gap | `clamp(64px, 7vw, 96px)` | sections |

## Behavior notes

- **Nav desktop**: transparent over dark hero, full-width flat white bar over content, no bottom border/blur/specular rim. Links Inter 14/500, active = mint pill wash + mint label (per DESIGN.md §nav, "switches text to Mint Green"). CTA is the one filled Ink button.
- **Nav mobile (≤1023px)**: closed = full-width bar; open = white dropdown surface (`0 0 16px 16px`, Mist hairline, whisper shadow), black links, mint active pill 4px. Overrides live at the end of the appended block because the two legacy mobile force-blocks (>10 declarations) set `--m-*` tokens on `.nav-menu-panel`, which resolves before `.nav-inner`.
- **Nav centring/responsive (post-fix)**: `.nav-inner` is explicitly `width:100%` + `max-width:var(--page-max-width)` + `margin-inline:auto` — optically centred at every width (L/R gutter gaps measured equal on 1440/1180/1024/900/834/768/390). One symmetric `padding:12px var(--gutter-inline)` pads both ends at all widths (was a fixed 6px on desktop vs the 16–40px clamp on mobile → the bar looked off-axis while resizing through tablet). `white-space:nowrap` on `.brand-name`/`.nav-link`/`.nav-contact` prevents tablet re-wrap; burger stays ≤1023px, desktop row ≥1024. No negative margins; no horizontal overflow.
- **Nav over the hero (post-fix)**: `data-theme='media'` now paints a translucent dark blur (`rgba(9,18,18,.42)` + `blur(16px)` + hairline) on `.nav-inner` so hero text/panel can never read through the bar while scrolling; light stays flat white. `script.js` re-runs `themeFromPoint()` on `fonts.ready` and `scrollend` so a refresh/scroll-up can't strand a white full-width bar over the dark hero, and `.nav-active:not(.is-shown)` is `visibility:hidden` so an unmeasured indicator can't paint a stray box. `position:fixed; z-index:50` unchanged.
- **Hero**: eyebrow is plain uppercase white 13px/+0.05em with the one Mint dot (DESIGN forbids Mint on hero *text*); dark teal→mint gradient + inline SVG clouds replace the retired photos; headline 57/600/-1.14; "Open the tools" = Ink filled 4px; ghost = white hairline 4px.
- **Clarity**: background is now the photo `assets/atmos-1600.jpg` via CSS (`cover`/`center`) on `.atmospheric`, replacing the old teal gradient; the inline SVG (`atmos-sky`/`atmos-sun`) is still in the DOM but `display:none`. `assets/atmos-2000.jpg` remains on disk (usable for a 2x srcset if ever needed).
- **Mint Green text on white is 4.26:1** (spec color); DESIGN.md explicitly prescribes mint for active text/brand links/eyebrow dots, so this is accepted over WCAG AA 4.5 for text. All other text passes (ink/white 19.9:1, ash/white 6.7:1, ash/mist 6.0:1).

## Verification (this session)

- 0 console errors / page errors on clean load; fonts `loaded`.
- CLS 0.00022 (target < 0.02). No horizontal overflow at 280–3440px (scrollWidth ≤ innerWidth; only SVG children inside `overflow:hidden` ancestors are wide — clipped, invisible).
- Preloader runs (present in `is-loading` state, removed after intro), `docClasses` match baseline.
- Keyframes set identical to pre-change baseline.
- Nav styles verified by computed style at 1440 (both themes) and 390 (closed + open drawer).

## Caveats

- The Playwright profile **caches `style.css`/`index.html`** — re-verify with a cache-buster (`?cb=`) injection, never plain `reload`.
- Model/manual review is code-based + screenshots (`.playwright-mcp/after-1440-full.png`, `after-390-full.png`); visual parity against `/tmp/ref-mintlify/ref-mintlify-1440-full.png` needs a human eye.
- True mobile emulation (touch, DPR) isn't available in this harness; 390×844 viewport checks were used.