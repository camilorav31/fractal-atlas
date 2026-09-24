import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { JULIA_C_LIMIT } from '../../fractals/julia';
import type { ComplexView, JuliaParams, SceneSnapshot } from '../../fractals/types';
import { useRenderToDataUrl } from '../../hooks/useThumbnail';
import { defaultSnapshot } from '../../store/defaults';
import { useSceneStore } from '../../store/sceneStore';
import { useUiStore } from '../../store/uiStore';
import { formatComplex } from '../../utils/format';
import { ComplexPlanePicker } from '../controls/ComplexPlanePicker';
import { NumberField } from '../controls/NumberField';
import { Section } from '../controls/Section';
import { Toggle } from '../controls/Toggle';

/** The region of the Mandelbrot set shown in the picker. */
const MAP_VIEW: ComplexView = { centerX: -0.65, centerY: 0, zoomLog: 0.1 };
const MAP_ASPECT = 1.6;
const MAP_HEIGHT = 180;
/** Rendered at 2× so the map stays crisp on Retina displays. */
const MAP_SCALE = 2;
const RENDER_DEBOUNCE_MS = 250;

export function JuliaSection({ params }: { params: JuliaParams }) {
  const setJuliaConstant = useSceneStore((s) => s.setJuliaConstant);
  const orbit = useUiStore((s) => s.juliaOrbit);
  const setOrbit = useUiStore((s) => s.setJuliaOrbit);
  const map = useMandelbrotMap();
  const { cRe, cIm } = params;

  return (
    <Section title="Parameter c">
      <ComplexPlanePicker
        label="Julia constant c on the Mandelbrot set"
        x={cRe}
        y={cIm}
        onChange={(re, im) => setJuliaConstant(clampC(re), clampC(im))}
        view={MAP_VIEW}
        aspect={MAP_ASPECT}
        image={map}
        caption={<>c = {formatComplex(cRe, cIm)}</>}
      />
      <div className="mt-2.5 flex gap-2">
        <NumberField label="Re" value={cRe} min={-JULIA_C_LIMIT} max={JULIA_C_LIMIT} onChange={(re) => setJuliaConstant(re, cIm)} />
        <NumberField label="Im" value={cIm} min={-JULIA_C_LIMIT} max={JULIA_C_LIMIT} onChange={(im) => setJuliaConstant(cRe, im)} />
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-fg-subtle">
        Inside the Mandelbrot set, the Julia set is connected; outside, it shatters into dust. The richest shapes live on
        the boundary.
      </p>
      <div className="mt-2">
        <Toggle label="Orbit c" description="Traces a slow loop — made for recording" checked={orbit} onChange={setOrbit} />
      </div>
    </Section>
  );
}

const clampC = (v: number) => Math.min(JULIA_C_LIMIT, Math.max(-JULIA_C_LIMIT, v));

/** Renders the map with the active palette, re-rendering (debounced) when colours change. */
function useMandelbrotMap(): string | null {
  const color = useSceneStore(useShallow((s) => s.color));
  const render = useRenderToDataUrl();
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const base = defaultSnapshot('mandelbrot');
      const scene: SceneSnapshot = {
        ...base,
        fractal: { kind: 'mandelbrot', params: { maxIterations: 250, autoIterations: false } },
        view: MAP_VIEW,
        color,
      };
      try {
        const url = await render(scene, MAP_HEIGHT * MAP_ASPECT * MAP_SCALE, MAP_HEIGHT * MAP_SCALE, 4);
        if (!cancelled) setImage(url);
      } catch {
        // Renderer not ready yet; the effect re-runs once it is.
      }
    }, RENDER_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [color, render]);

  return image;
}
