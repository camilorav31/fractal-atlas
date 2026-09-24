import { renderIFS } from '../fractals/ifs/chaos';
import { rasterize } from '../fractals/lsystem/rasterize';
import { buildGeometry, type Geometry } from '../fractals/lsystem/turtle';
import type { LSystemParams } from '../fractals/types';
import type { RasterRequest, RasterResponse } from '../render/rasterProtocol';
import { resolveStops } from '../utils/palettes';

/**
 * Off-main-thread raster pipeline, dispatched by fractal kind:
 *
 *   L-system  grammar expansion → turtle geometry (cached) → stroked Path2D batches
 *   IFS       chaos game → density histogram → log tone map → ImageData
 *
 * Either way the result is drawn on an OffscreenCanvas and handed back as a
 * transferred ImageBitmap; the main thread never touches the raw data.
 */

/** Only these fields change the geometry; colour and stroke changes reuse it. */
function geometryKey(p: LSystemParams): string {
  return JSON.stringify([p.axiom, p.rules, p.angle, p.heading, p.iterations, p.jitter, p.seed]);
}

/** Small LRU so switching between a view and its thumbnails doesn't rebuild. */
const cache = new Map<string, Geometry>();
const CACHE_SEGMENT_BUDGET = 3_000_000;

function geometryFor(params: LSystemParams): { geometry: Geometry; rebuilt: boolean } {
  const key = geometryKey(params);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit); // mark as most recently used
    return { geometry: hit, rebuilt: false };
  }
  const geometry = buildGeometry(params);
  cache.set(key, geometry);
  let total = [...cache.values()].reduce((sum, g) => sum + g.count, 0);
  for (const [k, g] of cache) {
    if (total <= CACHE_SEGMENT_BUDGET || cache.size <= 1) break;
    cache.delete(k);
    total -= g.count;
  }
  return { geometry, rebuilt: true };
}

/** The slice of DedicatedWorkerGlobalScope used here (the webworker lib clashes with DOM's). */
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<RasterRequest>) => void) | null;
  postMessage(message: RasterResponse, transfer?: Transferable[]): void;
};

scope.onmessage = (event: MessageEvent<RasterRequest>) => {
  const { id, scene, width, height } = event.data;
  try {
    const started = performance.now();
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2D is not available');
    const stops = resolveStops(scene.color);

    let count: number;
    let truncated = false;
    if (scene.fractal.kind === 'lsystem') {
      const { params } = scene.fractal;
      const { geometry } = geometryFor(params);
      rasterize(ctx, geometry, scene.view, width, height, scene.color, stops, params);
      count = geometry.count;
      truncated = geometry.truncated;
    } else {
      const frame = renderIFS(scene.fractal.params, scene.view, width, height, scene.color, stops);
      ctx.putImageData(new ImageData(frame.pixels as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
      count = frame.points;
    }

    const bitmap = canvas.transferToImageBitmap();
    const response: RasterResponse = { id, ok: true, bitmap, stats: { count, truncated, ms: performance.now() - started } };
    scope.postMessage(response, [bitmap]);
  } catch (error) {
    const response: RasterResponse = { id, ok: false, error: error instanceof Error ? error.message : String(error) };
    scope.postMessage(response);
  }
};
