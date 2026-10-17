# PLAN — Hero as one "stage" (Pass 2)

Branch: `feat/hero-boundary-fade`. Repo: newsocapis.
Rule: **Do not commit / merge / push without the owner's explicit approval.**
Never touch the pre-existing dirty files `=`, `sebagai`, `reference/` or the deleted design PNGs.

## Goal

Restructure the hero into ONE `.hero-stage` so it matches the Mintlify reference:
the sky spans behind BOTH the copy and the panel, the panel overlaps INTO the sky
(top at ~55–60% of the stage), the sky stays visible at the left/right of the panel,
and the whole thing fades to white with no hard line, merging into the
"One place for everything you share." section. Static design change only — no copy,
JS logic, intro, or animation-behaviour change.

Owner decisions (locked):
1. **Full restructure** as specified (not a minimal patch).
2. **Keep a defined panel top edge** (the reference has one). The no-hard-line check
   is scoped to the sky→white / stage→section transition, NOT the panel's own top edge.

## Reference (static screenshot, not a live page)

The refero style page embeds one image: `058b42f4-…jpg` (1600×1000, "Screenshot of
Mintlify") — identical to `.playwright-mcp/ref-mintlify-hero.jpg`. Measured with PIL:

| Metric | Reference (1600×1000) |
|---|---|
| Panel width | 67.1% (x 263→1336) |
| Sky each side | 16.4% |
| Panel top | y 569 = 56.9% of frame |
| Panel bottom | dissolves, no visible edge |
| Sky at sides (mid panel) | teal/cloud, lum ≈ 140–200 |
| Sky at sides (bottom) | pale warm, lum ≈ 222–233 (never pure white) |
| Full-width hard lines | none |
| Dark halo below panel | none |

Targets for the build: panel width `min(100% - 2*gutter, clamp(640px, 68vw, 1040px))`
(≥1024) → ~67–68% at 1440, ~16% sky each side; panel top 55–60% of stage;
panel→heading gap ≈ 80px.

## Diagnosis of the current state (file:line + value)

Measured live at 1440×900 (layout width 1430):

- `#hero` style.css:1275 — `min-height:100svh`, `margin-bottom:56px`, the teal sky
  gradient is a **background-image on `.hero`** (style.css:1290-1303).
- `.hero-paper` style.css:1395-1462 — `.hero-paper` bottom-anchored fade; its linear
  layer `transparent 52% → #fff 100%` (1410-1415) whitens the full width by y≈875.
- `.hero-stage` (copy) style.css:1468 — `flex:1`, top 104 → bottom 599.
- `.hero-strip` style.css:1861 — 599 → 673.
- `.hero-panel` style.css:1612-1642 — top **673 (74.8%)**, width **1120 (78%)**,
  `margin-bottom:-56px` overhangs into the white `.figure-band`/`#features`.
- `#features` style.css:2213 — `border-top:0`, `padding-top:var(--spacing-24)`.

Root causes:
- **(b) panel reads as a separate white section** — panel top too low (74.8% vs 56.9%)
  and it overhangs into pure-white bands while the paper fade has already whitened the
  full width.
- **(c) panel too wide** — 78% at 1440, 89% at 1024, ~100% at 390 → no side sky.
- **(a) hard line at the sky bottom** — full-width vertical step >8 detected at
  1024 → y=567 (450/507 cols) and 390 → y=367 (165/190 cols): the flat top edge of the
  near-full-width white panel against the sky, with no side sky to break it. Aggravated
  by the gradient's hard dark floor `--hero-sky-floor:#0b4340` (style.css:144,1302) and
  the `.hero::after` bottom scrim (style.css:1374) meeting the paper fade.
- **(d) faint clouds behind the panel bottom** — `.hero-cloud-*` style.css:1318-1356
  span the whole hero and show at the panel's lower flanks.

## New structure

DOM in `index.html` (replace the current hero block, lines ~92–288):

```
<section id="hero" class="hero" data-nav="media" data-no-reveal>
  <div class="hero-stage">                          <!-- NEW: the one stage -->
    <div class="hero-stage__sky" aria-hidden="true"> <!-- ALL sky layers -->
      <div class="hero-sky"> …3 cloud <svg>… </div>  <!-- clouds kept verbatim -->
      <!-- gradient + bloom radials move here (off .hero); scrim via ::after -->
    </div>
    <div class="hero-stage__copy">                   <!-- was .hero-stage -->
      eyebrow · headline · sub · CTAs
      <a class="hero-scrollcue" …>                   <!-- moved in from .hero-strip -->
    </div>
    <div class="hero-panel hero-stage__panel"> …panel content unchanged… </div>
    <div class="hero-stage__paper" aria-hidden="true"></div>
    <div class="hero-grain" aria-hidden="true"></div>
  </div>
</section>
```

Move **Fig. 0** out of the hero into `.figure-band` next to **Fig. 1** (two
`<p class="fig-caption">` notes, no divider).

Layout (desktop ≥1024):
- `.hero-stage`: `position:relative; isolation:isolate; min-height:100svh;
  display:flex; flex-direction:column; align-items:center;
  padding:var(--nav-clearance) 0 clamp(64px,8svh,96px)`; `overflow:visible`.
- `.hero-stage__sky`: `position:absolute; inset:0; z-index:0; pointer-events:none;`
  carries the teal gradient + bloom; `.hero-sky` (clouds, `overflow:hidden`) inside;
  scrim as `.hero-stage__sky::after`. Gradient **retuned**: remove the dark floor,
  keep warm cream low so the sides read coloured.
- `.hero-stage__copy`: `position:relative; z-index:3; flex:1 1 auto;
  max-width:var(--page-max-width); display:flex; flex-direction:column;
  align-items:center; justify-content:center; text-align:center`. Scroll cue last.
- `.hero-panel`: `position:relative; z-index:4; flex:0 0 auto;
  width:min(100% - 2*var(--gutter-inline), clamp(640px, 68vw, 1040px));
  margin-inline:auto`; no overhang, no `border-bottom`, no bottom radius; shadow only
  via a masked `::before`. With copy `flex:1` + bottom padding, panel top ≈ 55–60%.
- `.hero-stage__paper`: `inset:auto 0 0 0; z-index:1`; multi-stop vertical + centre
  ellipse, sides coloured to ~60–70% of panel height, ≥235 by ~85%.
  `rgba(255,255,255,a)` stops only (comment: derived from `--color-paper`).
- `.hero-grain`: unchanged, `z-index:2` (above paper).
- Panel dissolve: `mask-image` linear (opaque 0→~60%, transparent ~98%) intersect a
  thin horizontal side mask; `-webkit-mask-composite:source-in` +
  `mask-composite:intersect`; `:focus-within` drops the mask (as today).
- `#features`: keep `border-top:0`; set `padding-top` so panel→heading ≈ 80px.

Responsive:
- `768–1023`: panel `min(100% - 2*var(--gutter-inline), 88vw)`; narrower ellipse.
- `<768`: panel `100% - 2*var(--gutter-inline)`; vertical-dominated fade.
- 280–3440px: no horizontal overflow.
- Update `@media (max-width:768px)` style.css:2057-2189 and the `max-height` tiers
  style.css:1973-2025 to the new class names; behaviour unchanged.
- `max-height:600px`: stage grows naturally.

Pass-1 code to remove/merge:
- `.hero` sky background-image (1290-1303) → `.hero-stage__sky`.
- `.hero::after` (1362-1375) → `.hero-stage__sky::after`.
- `.hero-paper` (1395-1462) → `.hero-stage__paper` (retuned).
- `.hero-panel` (1612-1642) → new width/mask/shadow; keep `.hero-panel` class (JS).
- Delete `.hero-strip` (1861-1876), `.hero-figcaption` (1878-1881); move caption.
- Update `.hero-stage` rules 1468, 1984, 2018, 2062, 2182 → `.hero-stage__copy`.
- `--hero-panel-overlap` becomes unused → delete or repurpose (no dead CSS).

## JS / animation safety (verified)

- `script.js` targets only `.hero-display` (`.block`/`.spl-char`), `.hero-sub`
  (`.spl-word`), `.hero-panel`, `.hero-paths li` (lines 67-72, 185-220). No reference to
  `.hero-stage`/`.hero-sky`/`.hero-paper`/`.hero-strip` → rename is JS-safe.
- `.hero-panel` class kept so `tl.from('.hero-panel', …)` (script.js:219) is untouched.
- `#hero` keeps `data-nav="media"` + `data-no-reveal`; nav theme and reveal unaffected.
- No `@keyframes` / `animation` declarations change.

## Verification criteria

1. No hard line: for x ∈ {6,12,25,50,75,88,94}%, no vertical luminance step >5 forming a
   horizontal run >120px from stage top to heading (excluding the intentional panel top edge).
2. Side sky: at panel mid-height, x=8% and x=92% ≥20 darker than white (≥1024);
   at 85% panel height sides ≥235 and blend smoothly.
3. Panel overlap: `panel.top` ∈ 50–62% of stage on desktop; ≥35% of panel height above
   the old sky line; width 62–72% at 1440; ≥12% sky each side.
4. Dissolve: row 3px above panel bottom at x=50% ≥238; no bottom edge/radius;
   no dark halo 40px below panel (≥245 centre).
5. Seamless: no hairline/border between stage and heading; panel→heading 80px ±8;
   `#features` bg = stage-bottom white.
6. Similarity: compare to `/tmp/ref-mintlify/` table; fix the largest deltas, ≥2 rounds.
7. Function/animation: panel tabs/links clickable + visible focus; intro identical
   (duration, Skip, events); cloud drift running; reveal; scroll cue; F5 + fast scroll
   not blank; console errors 0; no horizontal overflow 280–3440; CLS <0.02.

## Step order

1. Capture `before` screenshots to `/tmp/shots/hero-stage/` (1440×900, 1366×768,
   1920×1080, 1024×768, 768×1024, 390×844 + 150/200% zoom) and the reference to
   `/tmp/ref-mintlify/`.
2. Rewrite the hero DOM in `index.html`.
3. Rewrite the hero CSS region (style.css:1259-2250) + update media queries.
4. Verify (§criteria), 2 refinement rounds, report. Commit only after approval.
