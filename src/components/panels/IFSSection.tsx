import { Dices, Plus, Scale, X } from 'lucide-react';
import {
  COEFFICIENT_LIMIT,
  MAX_MAPS,
  MIN_MAPS,
  balancedProbabilities,
  contractionFactor,
  mutate,
  normalizedProbabilities,
} from '../../fractals/ifs/maps';
import { IFS_PRESETS, ifsParamsFromPreset } from '../../fractals/ifs/presets';
import type { AffineMap, IFSParams } from '../../fractals/types';
import { useSceneStore } from '../../store/sceneStore';
import { Button, IconButton } from '../controls/Button';
import { NumberField } from '../controls/NumberField';
import { Section } from '../controls/Section';
import { SegmentedControl } from '../controls/SegmentedControl';
import { Slider } from '../controls/Slider';
import { cx } from '../controls/cx';

const SUBSCRIPTS = '₁₂₃₄₅₆₇₈';

export function IFSSection({ params }: { params: IFSParams }) {
  const setIFS = useSceneStore((s) => s.setIFS);
  const setMaps = (maps: AffineMap[]) => setIFS({ maps, preset: 'custom' });

  return (
    <>
      <Section title="Attractor">
        <div role="radiogroup" aria-label="IFS preset" className="grid grid-cols-2 gap-1.5">
          {IFS_PRESETS.map((preset) => {
            const active = params.preset === preset.id;
            return (
              <button
                key={preset.id}
                role="radio"
                aria-checked={active}
                onClick={() => setIFS(ifsParamsFromPreset(preset, params))}
                className={cx(
                  'flex items-baseline justify-between rounded-[9px] border px-2.5 py-2 text-left text-[11.5px] transition-colors duration-200',
                  active ? 'border-gilt/50 bg-gilt-soft text-fg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
                )}
              >
                <span className="truncate">{preset.name}</span>
                <span className="ml-2 shrink-0 font-mono text-[9.5px] text-fg-subtle">{preset.maps.length}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title="Affine maps"
        aside={
          <div className="-mr-2 flex items-center">
            {params.preset === 'custom' && (
              <span className="mr-1 font-mono text-[9.5px] tracking-[0.14em] text-gilt uppercase">Custom</span>
            )}
            <IconButton label="Balance probabilities by area" className="size-6" onClick={() => setMaps(balancedProbabilities(params.maps))}>
              <Scale size={12} strokeWidth={1.7} />
            </IconButton>
            <IconButton label="Mutate coefficients" className="size-6" onClick={() => setMaps(mutate(params.maps, Math.random))}>
              <Dices size={13} strokeWidth={1.6} />
            </IconButton>
          </div>
        }
      >
        <MapsEditor maps={params.maps} onChange={setMaps} />
      </Section>

      <Section title="Exposure">
        <Slider
          label="Points"
          value={params.points}
          min={250_000}
          max={12_000_000}
          scale="log"
          step={50_000}
          format={(v) => `${(v / 1e6).toFixed(v < 1e6 ? 2 : 1)}M`}
          onChange={(points) => setIFS({ points: Math.round(points) })}
          hint="More points, smoother density — at the cost of render time"
        />
        <Slider
          label="Brightness"
          value={params.exposure}
          min={0.2}
          max={4}
          scale="log"
          defaultValue={1.4}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(exposure) => setIFS({ exposure })}
        />
        <Slider
          label="Gamma"
          value={params.gamma}
          min={0.8}
          max={5}
          defaultValue={2.2}
          format={(v) => v.toFixed(2)}
          onChange={(gamma) => setIFS({ gamma })}
        />
        <div className="pt-2">
          <p className="mb-2 text-[12px] text-fg-muted">Colour by</p>
          <SegmentedControl<'map' | 'density'>
            label="Colour by"
            size="sm"
            options={[
              { value: 'map', label: 'Map history' },
              { value: 'density', label: 'Density' },
            ]}
            value={params.colorBy}
            onChange={(colorBy) => setIFS({ colorBy })}
          />
        </div>
      </Section>
    </>
  );
}

/** One card per map: the six coefficients of w(x) = Ax + b, its probability and its contraction factor. */
function MapsEditor({ maps, onChange }: { maps: AffineMap[]; onChange(maps: AffineMap[]): void }) {
  const probabilities = normalizedProbabilities(maps);
  const update = (index: number, patch: Partial<AffineMap>) =>
    onChange(maps.map((m, i) => (i === index ? { ...m, ...patch } : m)));

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed text-fg-subtle">
        wᵢ(x, y) = (a·x + b·y + e, c·x + d·y + f), chosen with probability p. Every map must shrink distances (σ &lt; 1)
        for the attractor to exist.
      </p>
      {maps.map((map, i) => {
        const sigma = contractionFactor(map);
        return (
          <div key={i} className="rounded-[10px] border border-line bg-black/15 p-2">
            <div className="mb-1.5 flex items-center justify-between px-0.5">
              <span className="font-display text-[15px] leading-none">
                w<sub className="font-sans text-[10px]">{SUBSCRIPTS[i]}</sub>
              </span>
              <span className="flex items-center gap-2 font-mono text-[9.5px] tabular">
                <span className="text-fg-subtle">{Math.round(probabilities[i]! * 100)}%</span>
                <span
                  className={sigma >= 1 ? 'text-[#e0917d]' : 'text-fg-subtle'}
                  title={sigma >= 1 ? 'Not a contraction: the attractor may diverge' : 'Contraction factor'}
                >
                  σ {sigma.toFixed(2)}
                </span>
                {maps.length > MIN_MAPS && (
                  <button
                    aria-label={`Remove map ${i + 1}`}
                    onClick={() => onChange(maps.filter((_, j) => j !== i))}
                    className="text-fg-subtle transition-colors hover:text-fg"
                  >
                    <X size={11} />
                  </button>
                )}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(['a', 'b', 'c', 'd', 'e', 'f', 'p'] as const).map((key) => (
                <NumberField
                  key={key}
                  label={key}
                  value={map[key]}
                  digits={3}
                  min={key === 'p' ? 0 : -COEFFICIENT_LIMIT}
                  max={key === 'p' ? 1 : COEFFICIENT_LIMIT}
                  onChange={(value) => update(i, { [key]: value })}
                />
              ))}
            </div>
          </div>
        );
      })}
      {maps.length < MAX_MAPS && (
        <Button
          variant="ghost"
          className="h-8 w-full border border-dashed border-line text-[11px]"
          icon={<Plus size={12} />}
          onClick={() =>
            onChange([...maps, { a: 0.4, b: 0, c: 0, d: 0.4, e: Number((Math.random() * 2 - 1).toFixed(2)), f: Number(Math.random().toFixed(2)), p: 0.1 }])
          }
        >
          Add map
        </Button>
      )}
    </div>
  );
}
