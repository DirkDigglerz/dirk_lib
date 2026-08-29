/**
 * Photograph a running web UI on a real transparent background.
 *
 *   node scripts/shots.mjs --url=http://localhost:3000 \
 *     --clip='[data-panel]' \
 *     main= display='?section=display' items='?section=items#bottom'
 *
 * Each target is `name=query`. The name may nest with a `/`. A `#bottom` or
 * `#400` after the query scrolls inside the UI before capturing.
 *
 *   --url=    where the dev server is           (default http://localhost:3000)
 *   --clip=   selector to crop to; omit for the whole page
 *   --out=    output folder                     (default shots)
 *   --size=   viewport, WxH                     (default 900x1600)
 *
 * A UI sized in `vh` renders at a size decided by the viewport HEIGHT, which is
 * why the default window is tall and narrow rather than a monitor shape.
 *
 * Needs: pnpm add -D playwright   &&   npx playwright install chromium
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = flag('url', 'http://localhost:3000');
const CLIP = flag('clip', '');
const OUT = path.resolve(flag('out', 'shots'));
const [W, H] = flag('size', '900x1600').split('x').map(Number);

const targets = args
  .filter((a) => !a.startsWith('--'))
  .map((a) => {
    const eq = a.indexOf('=');
    const name = eq === -1 ? a : a.slice(0, eq);
    const [query, scroll] = (eq === -1 ? '' : a.slice(eq + 1)).split('#');
    return { name, query, scroll };
  });

if (!targets.length) {
  console.log('nothing to shoot. try:  node scripts/shots.mjs main= about=?p=about');
  process.exit(0);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,          // retina, so a site can render it at half size
});

let warnings = 0;
const sizes = new Map();

for (const { name, query, scroll } of targets) {
  const url = BASE + (query.startsWith('?') || query === '' ? query : `?${query}`);
  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait for the thing itself rather than sleeping a fixed amount, which is
  // either too short on a cold start or wasted on every shot after it.
  if (CLIP) await page.waitForSelector(CLIP, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1000);   // let spring animations settle

  // ── the trap: something on the page is still painting ──────────────────────
  // omitBackground only skips the default white base. Any element painting a
  // background is captured as normal, so the shot comes out opaque and looks
  // right until someone notices square corners where the alpha should be.
  const opaque = await page.evaluate((clip) => {
    const target = clip ? document.querySelector(clip) : document.body;
    if (!target) return null;
    const solid = (c) => c && c !== 'transparent' && !/rgba\(.*,\s*0\s*\)$/.test(c);

    // Only ANCESTORS can paint behind the crop, so walk up from it rather than
    // over the whole document. A sibling elsewhere on the page is irrelevant —
    // it is not inside the cropped region.
    for (let el = target.parentElement; el; el = el.parentElement) {
      const s = getComputedStyle(el);
      if (solid(s.backgroundColor) || s.backgroundImage !== 'none') {
        return el.className || el.tagName;
      }
    }
    return null;
  }, CLIP);

  if (opaque) {
    console.log(`  ! ${name}: something is painting behind it — "${String(opaque).slice(0, 60)}"`);
    console.log(`    add:  html[data-shot] .that { background: none !important }`);
    warnings += 1;
  }

  // ── scroll inside the UI, not the page ─────────────────────────────────────
  if (scroll) {
    const moved = await page.evaluate(({ clip, where }) => {
      const root = (clip && document.querySelector(clip)) || document.body;
      // A container scrolls only if it BOTH overflows AND is allowed to.
      // Without the overflow check the tallest CLIPPED container wins, and
      // setting scrollTop on it silently does nothing.
      let best = null;
      let most = 40;
      root.querySelectorAll('*').forEach((el) => {
        const over = el.scrollHeight - el.clientHeight;
        if (over <= most) return;
        const oy = getComputedStyle(el).overflowY;
        if (oy !== 'auto' && oy !== 'scroll') return;
        best = el; most = over;
      });
      if (!best) return 'nothing scrollable here';
      best.scrollTop = where === 'bottom' ? best.scrollHeight : Number(where) || 0;
      return best.scrollTop > 0 ? `ok ${Math.round(best.scrollTop)}px` : 'scroller refused to move';
    }, { clip: CLIP, where: scroll });

    if (!String(moved).startsWith('ok')) {
      console.log(`  ! ${name}: ${moved} — saving the unscrolled screen`);
      warnings += 1;
    }
    await page.waitForTimeout(600);   // settle; let lazy images decode
  }

  const file = path.join(OUT, `${name}.png`);
  await mkdir(path.dirname(file), { recursive: true });

  // omitBackground is what makes the alpha: whatever the UI does not cover
  // comes out genuinely transparent — no keying, so rounded corners, shadows
  // and glass all survive intact.
  const el = CLIP ? await page.$(CLIP) : null;
  const buf = el
    ? await el.screenshot({ path: file, omitBackground: true })
    : await page.screenshot({ path: file, omitBackground: true });

  // Byte-identical shots mean either an alias (only shoot one) or a query that
  // silently did nothing (a real bug, and invisible without this).
  const twin = sizes.get(buf.length);
  if (twin) console.log(`  ! ${name} is identical to ${twin} — alias, or the query did nothing`);
  else sizes.set(buf.length, name);

  console.log(`  ${name.padEnd(24)} ${path.relative(process.cwd(), file)}`);
}

await browser.close();
console.log(`\n${targets.length} shot${targets.length === 1 ? '' : 's'} in ${path.relative(process.cwd(), OUT)}/`);
if (warnings) console.log(`${warnings} warning${warnings === 1 ? '' : 's'} above — open the PNGs and look before using them.`);
