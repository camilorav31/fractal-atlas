import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import '../styles/index.css';
import { gpuInfo } from '../showreel/scenes';
import { assets } from './assets';
import { Backdrop, type RenderSize } from './backdrop';
import { Film } from './Film';
import { MINIMAP } from './shots';
import { STAGE } from './timeline';

/**
 * Promo capture harness, driven frame by frame from Node (scripts/promo.mjs):
 * `frame()` draws the fractal footage and the motion graphics for one frame
 * number, then Node screenshots the page. Nothing here runs in real time.
 */

const FONTS = ['italic 100px "Instrument Serif"', '100px "Instrument Serif"', '500 20px Inter', '400 20px "JetBrains Mono"'];
const GLYPHS = 'Nº zₙ₊₁ = zₙ² + c → ⋃ wᵢ(A) ×10⁻¹² · −+0123456789 ωXF[]÷';

const stage = document.createElement('div');
stage.style.cssText = `position:relative;width:${STAGE.width}px;height:${STAGE.height}px;overflow:hidden;background:#000`;
const canvas = document.createElement('canvas');
canvas.style.cssText = `position:absolute;inset:0;width:${STAGE.width}px;height:${STAGE.height}px`;
const overlay = document.createElement('div');
overlay.style.cssText = 'position:absolute;inset:0';
stage.append(canvas, overlay);
document.body.append(stage);

const backdrop = new Backdrop(canvas);
const root = createRoot(overlay);

/** Resolves once the browser has painted what React just committed. */
async function painted(): Promise<void> {
  await document.fonts.ready;
  await Promise.all([...overlay.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined)));
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

async function frame(request: { frame: number } & RenderSize): Promise<void> {
  await backdrop.draw(request.frame, request);
  flushSync(() => root.render(<Film frame={request.frame} />));
  await painted();
}

async function prepare(): Promise<void> {
  await Promise.all(FONTS.map((font) => document.fonts.load(font, GLYPHS)));
  const map = await backdrop.scenes.render(MINIMAP.scene, MINIMAP.width * 2, MINIMAP.height * 2, 8);
  assets.minimap = map.toDataURL('image/png');
  Object.assign(window, { promo: { frame, gpuInfo, ready: true } });
}

void prepare();
