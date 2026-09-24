#!/usr/bin/env node
/**
 * Renders the README showreel: a 10 s, 1080p30 film made of the app's own
 * renders, with no UI.
 *
 *   npm run showreel                 full render → docs/showreel.mp4 (+ .gif, poster)
 *   npm run showreel -- --preview    a few frames at 480×270, for checking shots
 *   npm run showreel -- --fresh      discard frames from an interrupted run
 *
 * Frames are rendered offline, one by one, through tools/showreel/ in headless
 * Chrome, so every frame gets full supersampling regardless of how long it
 * takes — and the video plays at a perfectly steady 30 fps.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const ROOT = resolve(import.meta.dirname, '..');
const FRAMES_DIR = resolve(ROOT, '.showreel/frames');
const OUT_DIR = resolve(ROOT, 'docs');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const preview = process.argv.includes('--preview');
const FPS = 30;
const WIDTH = preview ? 480 : 1920;
const HEIGHT = preview ? 270 : 1080;
const SAMPLES = preview ? 2 : 6;

// --- Timeline ---------------------------------------------------------------

/** Act I: the repertoire — quick cuts across all four families. */
const SHOTS = [
  { kind: 'mandelbrot', view: { centerX: -0.62, centerY: 0, zoomLog: 0.02 }, color: { palette: 'gilt', density: 1.2 } },
  { curated: 'ifs-fern', view: { zoomLog: -0.07 }, params: { points: 6_000_000 } },
  { curated: 'julia-spirals' },
  { curated: 'lsystem-tree' },
  { curated: 'ifs-maple', params: { points: 6_000_000 } },
  { curated: 'spiral' },
  { curated: 'julia-rabbit' },
  { curated: 'lsystem-snowflake' },
  { curated: 'julia-dendrite' },
];
const SHOT_FRAMES = 14;
const CROSSFADE = 3;
/** Each shot creeps forward so the cuts feel alive rather than like slides. */
const SHOT_DRIFT = 0.09;

/** Act II: one long, slow dive into Seahorse Valley, deep into df64 range. */
const DIVE = {
  kind: 'mandelbrot',
  center: { centerX: -0.7436438870371587, centerY: 0.131825904205312 },
  from: 0.35,
  to: 8.8,
  color: { palette: 'ember', density: 0.62 },
  paletteDrift: 0.28,
};

const TOTAL = FPS * 10;
const MONTAGE = SHOTS.length * SHOT_FRAMES;
const FADE_IN = 6;
const FADE_OUT = 14;

const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
const clamp01 = (t) => Math.min(1, Math.max(0, t));

function shotAt(index, u) {
  return { ...SHOTS[index], zoomDelta: SHOT_DRIFT * u };
}

function diveAt(u) {
  return {
    kind: DIVE.kind,
    view: { ...DIVE.center, zoomLog: DIVE.from + (DIVE.to - DIVE.from) * easeInOutSine(u) },
    color: { ...DIVE.color, offset: (DIVE.paletteDrift * u) % 1 },
  };
}

/** Layers (for crossfades) and global fade for frame `f`. */
function frameSpec(f) {
  const fade = Math.min(clamp01((f + 1) / FADE_IN), clamp01((TOTAL - f) / FADE_OUT));
  const layers = [];
  if (f < MONTAGE) {
    const index = Math.floor(f / SHOT_FRAMES);
    const local = f % SHOT_FRAMES;
    if (index > 0 && local < CROSSFADE) layers.push({ scene: shotAt(index - 1, 1), alpha: 1 });
    const alpha = index > 0 && local < CROSSFADE ? (local + 1) / (CROSSFADE + 1) : 1;
    layers.push({ scene: shotAt(index, local / SHOT_FRAMES), alpha });
  } else {
    const local = f - MONTAGE;
    const span = TOTAL - MONTAGE;
    if (local < CROSSFADE) layers.push({ scene: shotAt(SHOTS.length - 1, 1), alpha: 1 });
    layers.push({ scene: diveAt(local / (span - 1)), alpha: local < CROSSFADE ? (local + 1) / (CROSSFADE + 1) : 1 });
  }
  return { layers, fade };
}

// --- Rendering --------------------------------------------------------------

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${cmd} failed with status ${result.status}`);
}

async function launch(url) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.error('page error:', error.message));
  await page.goto(new URL('tools/showreel/index.html', url).href);
  await page.waitForFunction(() => window.showreel?.ready, { timeout: 30_000 });
  return { browser, page };
}

async function main() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5197, strictPort: false } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  const fresh = process.argv.includes('--fresh') || preview;
  if (fresh) rmSync(FRAMES_DIR, { recursive: true, force: true });
  mkdirSync(FRAMES_DIR, { recursive: true });

  const frames = preview
    ? [...SHOTS.map((_, i) => i * SHOT_FRAMES + 8), MONTAGE + 2, MONTAGE + 90, TOTAL - 20]
    : Array.from({ length: TOTAL }, (_, i) => i);
  const nameOf = (f) => (preview ? `preview-${String(f).padStart(3, '0')}.png` : `${String(f).padStart(4, '0')}.png`);
  // Resumable: frames already on disk are kept, so a crash costs only the frame in flight.
  const todo = frames.filter((f) => fresh || !existsSync(resolve(FRAMES_DIR, nameOf(f))));

  let session = await launch(url);
  console.log(`GPU: ${await session.page.evaluate(() => window.showreel.gpuInfo())}`);
  console.log(`${frames.length - todo.length} frames on disk, ${todo.length} to render`);
  const started = Date.now();
  let retries = 0;

  try {
    for (let n = 0; n < todo.length; ) {
      const f = todo[n];
      const { layers, fade } = frameSpec(f);
      try {
        const dataUrl = await session.page.evaluate(
          (request) => window.showreel.frame(request),
          { layers, fade, width: WIDTH, height: HEIGHT, samples: SAMPLES, vignette: 0.38 },
        );
        writeFileSync(resolve(FRAMES_DIR, nameOf(f)), Buffer.from(dataUrl.split(',')[1], 'base64'));
        n++;
        retries = 0;
        const elapsed = (Date.now() - started) / 1000;
        process.stdout.write(`\r  frame ${n}/${todo.length}  (${elapsed.toFixed(0)} s)   `);
      } catch (error) {
        // A lost GPU context or a crashed renderer: start a fresh browser and retry the frame.
        if (++retries > 3) throw error;
        console.warn(`\n  frame ${f} failed (${error.message.split('\n')[0]}), relaunching…`);
        await session.browser.close().catch(() => {});
        session = await launch(url);
      }
    }
    process.stdout.write('\n');
  } finally {
    await session.browser.close().catch(() => {});
    await server.close();
  }

  if (preview) {
    console.log(`Preview frames in ${FRAMES_DIR}`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const input = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', resolve(FRAMES_DIR, '%04d.png')];
  // Master: H.264. Fractal detail compresses like noise; CRF 25 is visually lossless here at ~20 MB.
  run('ffmpeg', [...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', resolve(OUT_DIR, 'showreel.mp4')]);
  // Inline README preview: GitHub autoplays GIFs but not repository videos. Kept under 10 MB.
  run('ffmpeg', [
    ...input,
    '-vf', 'fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle',
    resolve(OUT_DIR, 'showreel.gif'),
  ]);
  // Poster frame from deep in the dive.
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', resolve(FRAMES_DIR, `${String(TOTAL - 40).padStart(4, '0')}.png`), '-q:v', '4', resolve(OUT_DIR, 'showreel-poster.jpg')]);
  console.log(`Wrote docs/showreel.mp4, docs/showreel.gif, docs/showreel-poster.jpg`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
