import { describe, expect, it } from 'vitest';
import type { SceneSnapshot } from '../fractals/types';
import { defaultSnapshot } from '../store/defaults';
import type { RenderEngine } from './engine';
import { ViewportRenderer, type SessionState } from './ViewportRenderer';

type Call = string;

/** A fake engine that records its lifecycle and lets tests decide when prepare() finishes. */
function fakeEngine(name: string, log: Call[]) {
  const pending: (() => void)[] = [];
  const engine: RenderEngine<SceneSnapshot> & { finishPrepare(): void; scenes: SceneSnapshot[] } = {
    scenes: [],
    resume: () => log.push(`${name}.resume`),
    suspend: () => log.push(`${name}.suspend`),
    prepare: (scene) => {
      log.push(`${name}.prepare:${scene.fractal.kind}`);
      return new Promise<void>((resolve) => pending.push(resolve));
    },
    setScene: (scene) => engine.scenes.push(scene),
    resize: () => log.push(`${name}.resize`),
    renderImage: () => Promise.reject(new Error('not used')),
    dispose: () => log.push(`${name}.dispose`),
    finishPrepare: () => pending.shift()?.(),
  };
  return engine;
}

function setup() {
  const log: Call[] = [];
  const sessions: SessionState[] = [];
  const gpu = fakeEngine('gpu', log);
  const raster = fakeEngine('raster', log);
  const created: string[] = [];
  const viewport = new ViewportRenderer(
    {
      escape: () => (created.push('gpu'), gpu),
      raster: () => (created.push('raster'), raster),
    },
    { onStats: () => {}, onSession: (s) => sessions.push(s) },
  );
  return { viewport, gpu, raster, log, sessions, created };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('ViewportRenderer session', () => {
  it('creates engines lazily — only the family in use', async () => {
    const { viewport, created, raster } = setup();
    viewport.setScene(defaultSnapshot('lsystem'));
    raster.finishPrepare();
    await flush();
    expect(created).toEqual(['raster']);
  });

  it('suspends the previous family before resuming the next', async () => {
    const { viewport, gpu, raster, log } = setup();
    viewport.setScene(defaultSnapshot('mandelbrot'));
    gpu.finishPrepare();
    await flush();
    log.length = 0;
    viewport.setScene(defaultSnapshot('lsystem'));
    raster.finishPrepare();
    await flush();
    expect(log.slice(0, 3)).toEqual(['gpu.suspend', 'raster.resume', 'raster.prepare:lsystem']);
  });

  it('reports loading, then ready', async () => {
    const { viewport, gpu, sessions } = setup();
    viewport.setScene(defaultSnapshot('mandelbrot'));
    expect(sessions.at(-1)).toMatchObject({ phase: 'loading', kind: 'mandelbrot', task: 'Compiling shaders' });
    gpu.finishPrepare();
    await flush();
    expect(sessions.at(-1)).toEqual({ phase: 'ready', kind: 'mandelbrot' });
  });

  it('buffers scene updates while preparing and applies only the latest', async () => {
    const { viewport, gpu } = setup();
    const first = defaultSnapshot('mandelbrot');
    viewport.setScene(first);
    const panned = { ...first, view: { ...first.view, centerX: 0.25 } };
    const pannedAgain = { ...first, view: { ...first.view, centerX: 0.5 } };
    viewport.setScene(panned);
    viewport.setScene(pannedAgain);
    expect(gpu.scenes).toEqual([]); // nothing reaches the engine before it's ready
    gpu.finishPrepare();
    await flush();
    expect(gpu.scenes.at(-1)).toBe(pannedAgain);
    expect(gpu.scenes).not.toContain(panned);
  });

  it('discards a switch superseded by a newer one', async () => {
    const { viewport, gpu, raster, sessions } = setup();
    viewport.setScene(defaultSnapshot('mandelbrot')); // starts compiling…
    viewport.setScene(defaultSnapshot('lsystem')); // …but the user moves on
    raster.finishPrepare();
    await flush();
    gpu.finishPrepare(); // the stale compile finishes last
    await flush();
    expect(sessions.at(-1)).toEqual({ phase: 'ready', kind: 'lsystem' });
    expect(sessions.some((s) => s.phase === 'ready' && s.kind === 'mandelbrot')).toBe(false);
  });

  it('switches instantly between warm kinds of the same family', async () => {
    const { viewport, gpu, sessions, log } = setup();
    viewport.setScene(defaultSnapshot('mandelbrot'));
    gpu.finishPrepare();
    await flush();
    viewport.setScene(defaultSnapshot('julia'));
    gpu.finishPrepare();
    await flush();
    viewport.setScene(defaultSnapshot('mandelbrot')); // back to a warm kind
    const before = sessions.length;
    gpu.finishPrepare();
    await flush();
    expect(sessions.slice(before - 1).every((s) => s.phase !== 'loading')).toBe(true);
    expect(log.filter((l) => l === 'gpu.suspend')).toHaveLength(0); // never torn down within the family
  });
});
