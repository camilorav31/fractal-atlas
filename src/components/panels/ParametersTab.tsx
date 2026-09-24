import { Crosshair, RotateCcw, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MAX_ITERATIONS, MIN_ITERATIONS } from '../../fractals/iterations';
import { FRACTAL_INFO, FRACTAL_KINDS, bindFractal, isEscapeState } from '../../fractals/registry';
import type { EscapeTimeState, FractalKind } from '../../fractals/types';
import { useFractalNavigation } from '../../hooks/useFractalNavigation';
import { useResetView } from '../../hooks/useResetView';
import { DEFAULT_COLOR } from '../../store/defaults';
import { useSceneStore } from '../../store/sceneStore';
import { ColorPicker } from '../controls/ColorPicker';
import { IconButton } from '../controls/Button';
import { PalettePicker } from '../controls/PalettePicker';
import { Section } from '../controls/Section';
import { SegmentedControl, type SegmentOption } from '../controls/SegmentedControl';
import { Slider } from '../controls/Slider';
import { Toggle } from '../controls/Toggle';
import { IFSSection } from './IFSSection';
import { JuliaSection } from './JuliaSection';
import { LSystemSection } from './LSystemSection';

const SHORT_NAMES: Record<FractalKind, string> = { mandelbrot: 'Mandelbrot', julia: 'Julia', lsystem: 'L-system', ifs: 'IFS' };

const FRACTAL_OPTIONS: SegmentOption<FractalKind>[] = FRACTAL_KINDS.map((kind) => ({ value: kind, label: SHORT_NAMES[kind] }));

const formatInt = (v: number) => Math.round(v).toLocaleString('en-US');

export function ParametersTab() {
  const fractal = useSceneStore((s) => s.fractal);
  const { switchTo } = useFractalNavigation();

  return (
    <>
      <Section title="Fractal">
        <SegmentedControl
          label="Fractal"
          options={FRACTAL_OPTIONS}
          value={fractal.kind}
          onChange={(kind) => kind !== fractal.kind && switchTo(kind)}
        />
      </Section>
      {fractal.kind === 'julia' && <JuliaSection params={fractal.params} />}
      {fractal.kind === 'lsystem' && <LSystemSection params={fractal.params} />}
      {fractal.kind === 'ifs' && <IFSSection params={fractal.params} />}
      {isEscapeState(fractal) && <IterationSection fractal={fractal} />}
      <ColorSection raster={FRACTAL_INFO[fractal.kind].family === 'raster'} />
      <ViewSection />
    </>
  );
}

function IterationSection({ fractal }: { fractal: EscapeTimeState }) {
  const zoomLog = useSceneStore((s) => s.view.zoomLog);
  const setIteration = useSceneStore((s) => s.setIteration);
  const { params } = fractal;
  const effective = bindFractal(fractal).iterations(zoomLog);

  return (
    <Section title="Iteration">
      <Slider
        label="Max iterations"
        value={params.maxIterations}
        min={MIN_ITERATIONS}
        max={MAX_ITERATIONS}
        scale="log"
        step={1}
        defaultValue={400}
        format={formatInt}
        onChange={(maxIterations) => setIteration({ maxIterations })}
      />
      <Toggle
        label="Scale with depth"
        description={params.autoIterations ? `${formatInt(effective)} at this zoom` : 'Fixed budget'}
        checked={params.autoIterations}
        onChange={(autoIterations) => setIteration({ autoIterations })}
      />
    </Section>
  );
}

/** `raster`: L-systems have a background instead of an interior, and no distance-estimate edges. */
function ColorSection({ raster }: { raster: boolean }) {
  const color = useSceneStore(useShallow((s) => s.color));
  const setColor = useSceneStore((s) => s.setColor);

  return (
    <>
      <Section title="Palette">
        <PalettePicker
          value={color.palette}
          customStops={color.customStops}
          onChange={(palette) => setColor({ palette })}
          onCustomStopsChange={(customStops) => setColor({ customStops })}
        />
      </Section>
      <Section
        title="Tone"
        aside={
          <IconButton
            label="Reset tone"
            className="-mr-2 size-6"
            onClick={() =>
              setColor({ density: DEFAULT_COLOR.density, offset: DEFAULT_COLOR.offset, edgeShading: DEFAULT_COLOR.edgeShading })
            }
          >
            <RotateCcw size={12} />
          </IconButton>
        }
      >
        <Slider
          label="Density"
          value={color.density}
          min={0.1}
          max={12}
          scale="log"
          defaultValue={DEFAULT_COLOR.density}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(density) => setColor({ density })}
        />
        <Slider
          label="Phase"
          value={color.offset}
          min={0}
          max={1}
          defaultValue={0}
          format={(v) => `${Math.round(v * 360)}°`}
          onChange={(offset) => setColor({ offset })}
        />
        {!raster && (
          <Slider
            label="Edge definition"
            value={color.edgeShading}
            min={0}
            max={1}
            defaultValue={DEFAULT_COLOR.edgeShading}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(edgeShading) => setColor({ edgeShading })}
          />
        )}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[12px] text-fg-muted">{raster ? 'Background' : 'Interior'}</span>
          <ColorPicker
            label={raster ? 'Background colour' : 'Interior colour'}
            value={color.interior}
            onChange={(interior) => setColor({ interior })}
          />
        </div>
      </Section>
    </>
  );
}

function ViewSection() {
  const kind = useSceneStore((s) => s.fractal.kind);
  const resetView = useResetView();
  const { juliaAtCentre, locateOnMandelbrot } = useFractalNavigation();

  return (
    <Section title="View">
      <div className="space-y-2">
        <ViewAction onClick={resetView} aside={<kbd className="font-mono text-[10px] text-fg-subtle">R</kbd>}>
          {FRACTAL_INFO[kind].family === 'raster' ? 'Fit to view' : 'Reset to full set'}
        </ViewAction>
        {kind === 'mandelbrot' && (
          <ViewAction onClick={juliaAtCentre} aside={<Sparkles size={13} strokeWidth={1.6} />}>
            Julia set for c at centre
          </ViewAction>
        )}
        {kind === 'julia' && (
          <ViewAction onClick={locateOnMandelbrot} aside={<Crosshair size={13} strokeWidth={1.6} />}>
            Locate c on the Mandelbrot set
          </ViewAction>
        )}
      </div>
    </Section>
  );
}

function ViewAction({ onClick, aside, children }: { onClick(): void; aside: ReactNode; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-[10px] border border-line px-3 py-2.5 text-[12px] text-fg-muted transition-colors hover:border-line-strong hover:text-fg [&>svg]:text-fg-subtle"
    >
      {children}
      <span className="text-fg-subtle">{aside}</span>
    </button>
  );
}
