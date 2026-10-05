#!/usr/bin/env node
/**
 * Renders the 15 s promo film: the app's own fractal renders under a layer of
 * motion graphics (src/promo), 1080p30.
 *
 *   npm run promo                       full render → docs/promo.mp4 (+ .gif, poster)
 *   npm run promo -- --preview          stills of key frames at half size → .promo/preview/
 *   npm run promo -- --frames 10,80,200 stills of specific frames (implies --preview)
 *   npm run promo -- --fresh            discard frames from an interrupted run
 *
 * Every frame is a pure function of its number, rendered offline in headless
 * Chrome and screenshotted, so the film plays at a perfectly steady 30 fps
 * however long a frame takes to compute.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const ROOT = resolve(import.meta.dirname, '..');
const WORK_DIR = resolve(ROOT, '.promo');
const OUT_DIR = resolve(ROOT, 'docs');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const { values: flags } = parseArgs({
  options: {
    preview: { type: 'boolean', default: false },
    fresh: { type: 'boolean', default: false },
    frames: { type: 'string' },
    scale: { type: 'string' },
  },
});

const FPS = 30;
const TOTAL_FRAMES = 450;
const DESIGN = { width: 1920, height: 1080 };
/** Key frames, one or two per beat, for judging the design without a full render. */
const PREVIEW_FRAMES = [18, 52, 80, 120, 158, 200, 240, 280, 310, 322, 352, 385, 410, 440];

const preview = flags.preview || flags.frames !== undefined;
const scale = Number(flags.scale ?? (preview ? 0.5 : 1));
const samples = preview ? 3 : 6;
const framesDir = resolve(WORK_DIR, preview ? 'preview' : 'frames');
const size = { width: Math.round(DESIGN.width * scale), height: Math.round(DESIGN.height * scale) };

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
  await page.setViewport({ ...DESIGN, deviceScaleFactor: scale });
  page.on('pageerror', (error) => console.error('page error:', error.message));
  page.on('console', (message) => message.type() === 'error' && console.error('console:', message.text()));
  await page.goto(new URL('tools/promo/index.html', url).href);
  await page.waitForFunction(() => window.promo?.ready, { timeout: 60_000 });
  return { browser, page };
}

/** Renders `todo` frames to `framesDir` in headless Chrome, relaunching it if the GPU context is lost. */
async function renderFrames(todo, total, nameOf) {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5198, strictPort: false } });
  await server.listen();
  const url = server.resolvedUrls.local[0];

  let session = await launch(url);
  console.log(`GPU: ${await session.page.evaluate(() => window.promo.gpuInfo())}`);
  console.log(`${total - todo.length} frames on disk, ${todo.length} to render (${size.width}×${size.height})`);
  const started = Date.now();
  let retries = 0;

  try {
    for (let n = 0; n < todo.length; ) {
      const f = todo[n];
      try {
        await session.page.evaluate((request) => window.promo.frame(request), { frame: f, ...size, samples });
        const png = await session.page.screenshot({ type: 'png', clip: { x: 0, y: 0, ...DESIGN } });
        writeFileSync(resolve(framesDir, nameOf(f)), png);
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
}

async function main() {
  if (flags.fresh || preview) rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });

  const frames = flags.frames
    ? flags.frames.split(',').map(Number)
    : preview
      ? PREVIEW_FRAMES
      : Array.from({ length: TOTAL_FRAMES }, (_, i) => i);
  const nameOf = (f) => `${String(f).padStart(4, '0')}.png`;
  // Resumable: frames already on disk are kept, so a crash costs only the frame in flight.
  const todo = frames.filter((f) => !existsSync(resolve(framesDir, nameOf(f))));
  if (todo.length > 0) await renderFrames(todo, frames.length, nameOf);

  if (preview) {
    console.log(`Preview frames in ${framesDir}`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const input = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', resolve(framesDir, '%04d.png')];
  // H.264 with explicit Rec. 709 tags so players don't guess the colour matrix on dark gradients.
  // Film grain and fractal detail both compress like noise: CRF 22 stays clean at ~24 MB, CRF 17 would be 46 MB.
  run('ffmpeg', [
    ...input,
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart',
    resolve(OUT_DIR, 'promo.mp4'),
  ]);
  // Inline README preview: GitHub autoplays GIFs but not repository videos. The grain is smoothed first
  // (it would otherwise dominate the palette and the file size) and error diffusion keeps gradients free of banding.
  run('ffmpeg', [
    ...input,
    '-vf', 'fps=10,scale=600:-1:flags=lanczos,hqdn3d=3:3:5:5,split[a][b];[a]palettegen=max_colors=112:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle',
    resolve(OUT_DIR, 'promo.gif'),
  ]);
  // Poster: the deep-zoom beat, where the instruments are fully drawn.
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', resolve(framesDir, nameOf(300)), '-q:v', '3', resolve(OUT_DIR, 'promo-poster.jpg')]);
  console.log('Wrote docs/promo.mp4, docs/promo.gif and docs/promo-poster.jpg');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
