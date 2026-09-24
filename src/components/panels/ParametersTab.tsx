import { RotateCcw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { MAX_ITERATIONS, MIN_ITERATIONS, mandelbrotIterations } from '../../fractals/mandelbrot';
import { UPCOMING } from '../../fractals/registry';
import { DEFAULT_COLOR } from '../../store/defaults';
import { useSceneStore } from '../../store/sceneStore';
import { useResetView } from '../../hooks/useResetView';
import { ColorPicker } from '../controls/ColorPicker';
import { IconButton } from '../controls/Button';
import { PalettePicker } from '../controls/PalettePicker';
import { Section } from '../controls/Section';
import { SegmentedControl } from '../controls/SegmentedControl';
import { Slider } from '../controls/Slider';
import { Toggle } from '../controls/Toggle';

const FRACTAL_OPTIONS = [
  { value: 'mandelbrot', label: 'Mandelbrot' },
  ...UPCOMING.map((u) => ({ value: u.id, label: u.title, disabled: true, note: 'Soon' })),
] as const;

const formatInt = (v: number) => Math.round(v).toLocaleString('en-US');

export function ParametersTab() {
  return (
    <>
      <Section title="Fractal">
        <SegmentedControl label="Fractal" options={FRACTAL_OPTIONS} value="mandelbrot" onChange={() => {}} />
      </Section>
      <IterationSection />
      <ColorSection />
    </>
  );
}

function IterationSection() {
  const params = useSceneStore((s) => s.fractal.params);
  const zoomLog = useSceneStore((s) => s.view.zoomLog);
  const setMandelbrot = useSceneStore((s) => s.setMandelbrot);
  const effective = mandelbrotIterations(params, zoomLog);

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
        onChange={(maxIterations) => setMandelbrot({ maxIterations })}
      />
      <Toggle
        label="Scale with depth"
        description={params.autoIterations ? `${formatInt(effective)} at this zoom` : 'Fixed budget'}
        checked={params.autoIterations}
        onChange={(autoIterations) => setMandelbrot({ autoIterations })}
      />
    </Section>
  );
}

function ColorSection() {
  const color = useSceneStore(useShallow((s) => s.color));
  const setColor = useSceneStore((s) => s.setColor);
  const resetView = useResetView();

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
        <Slider
          label="Edge definition"
          value={color.edgeShading}
          min={0}
          max={1}
          defaultValue={DEFAULT_COLOR.edgeShading}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(edgeShading) => setColor({ edgeShading })}
        />
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[12px] text-fg-muted">Interior</span>
          <ColorPicker label="Interior colour" value={color.interior} onChange={(interior) => setColor({ interior })} />
        </div>
      </Section>
      <Section title="View">
        <button
          onClick={resetView}
          className="flex w-full items-center justify-between rounded-[10px] border border-line px-3 py-2.5 text-[12px] text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
        >
          Reset to full set
          <kbd className="font-mono text-[10px] text-fg-subtle">R</kbd>
        </button>
      </Section>
    </>
  );
}
