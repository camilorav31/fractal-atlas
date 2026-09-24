import { Dices, Sprout } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import {
  MAX_SEGMENTS,
  estimateSegments,
  maxIterationsWithinBudget,
  parseRules,
  validateAxiom,
} from '../../fractals/lsystem/grammar';
import { LSYSTEM_PRESETS, paramsFromPreset } from '../../fractals/lsystem/presets';
import type { LSystemParams } from '../../fractals/types';
import { useSceneStore } from '../../store/sceneStore';
import { useUiStore } from '../../store/uiStore';
import { Button, IconButton } from '../controls/Button';
import { Section } from '../controls/Section';
import { SegmentedControl } from '../controls/SegmentedControl';
import { Slider } from '../controls/Slider';
import { cx } from '../controls/cx';

const COMMIT_DELAY_MS = 280;

export function LSystemSection({ params }: { params: LSystemParams }) {
  const setLSystem = useSceneStore((s) => s.setLSystem);
  const growing = useUiStore((s) => s.lsystemGrowing);
  const setGrowing = useUiStore((s) => s.setLSystemGrowing);

  const parsed = useMemo(() => parseRules(params.rules), [params.rules]);
  const budget = parsed.ok ? maxIterationsWithinBudget(params.axiom, parsed.rules) : 0;
  const segments = parsed.ok ? estimateSegments(params.axiom, parsed.rules, params.iterations) : 0;

  return (
    <>
      <Section title="System">
        <div role="radiogroup" aria-label="L-system preset" className="grid grid-cols-2 gap-1.5">
          {LSYSTEM_PRESETS.map((preset) => {
            const active = params.preset === preset.id;
            return (
              <button
                key={preset.id}
                role="radio"
                aria-checked={active}
                onClick={() => setLSystem(paramsFromPreset(preset, { seed: params.seed, glow: params.glow }))}
                className={cx(
                  'flex items-baseline justify-between rounded-[9px] border px-2.5 py-2 text-left text-[11.5px] transition-colors duration-200',
                  active
                    ? 'border-gilt/50 bg-gilt-soft text-fg'
                    : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
                )}
              >
                <span className="truncate">{preset.name}</span>
                <span className="ml-2 shrink-0 font-mono text-[9.5px] text-fg-subtle">{preset.angle}°</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title="Grammar"
        aside={params.preset === 'custom' && <span className="font-mono text-[9.5px] tracking-[0.14em] text-gilt uppercase">Custom</span>}
      >
        <GrammarEditor params={params} />
      </Section>

      <Section
        title="Growth"
        aside={
          <Button
            variant="ghost"
            className="-mr-2 h-6 px-2 text-[11px]"
            disabled={params.iterations === 0}
            onClick={() => setGrowing(!growing)}
            icon={<Sprout size={12} strokeWidth={1.7} />}
          >
            {growing ? 'Stop' : 'Grow'}
          </Button>
        }
      >
        <Slider
          label="Iterations"
          value={Math.min(params.iterations, budget)}
          min={0}
          max={Math.max(1, budget)}
          step={1}
          format={(v) => String(Math.round(v))}
          onChange={(iterations) => setLSystem({ iterations: Math.round(iterations) })}
          hint={
            segments > MAX_SEGMENTS
              ? `Over the ${formatCount(MAX_SEGMENTS)}-segment budget`
              : `${formatCount(segments)} segments · max ${budget} within budget`
          }
        />
        <Slider
          label="Turn angle"
          value={params.angle}
          min={1}
          max={180}
          step={0.5}
          format={(v) => `${v.toFixed(1)}°`}
          onChange={(angle) => setLSystem({ angle })}
        />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Slider
              label="Organic variance"
              value={params.jitter}
              min={0}
              max={1}
              defaultValue={0}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(jitter) => setLSystem({ jitter })}
            />
          </div>
          <IconButton
            label="New random seed"
            className="mb-0.5 size-7"
            onClick={() => setLSystem({ seed: Math.floor(Math.random() * 2 ** 31) })}
          >
            <Dices size={14} strokeWidth={1.6} />
          </IconButton>
        </div>
      </Section>

      <Section title="Stroke">
        <Slider
          label="Width"
          value={params.lineWidth}
          min={0.2}
          max={8}
          scale="log"
          format={(v) => v.toFixed(2)}
          onChange={(lineWidth) => setLSystem({ lineWidth })}
        />
        <Slider
          label="Branch taper"
          value={params.taper}
          min={0}
          max={1}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(taper) => setLSystem({ taper })}
        />
        <Slider
          label="Glow"
          value={params.glow}
          min={0}
          max={1}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(glow) => setLSystem({ glow })}
        />
        <div className="pt-2">
          <p className="mb-2 text-[12px] text-fg-muted">Colour by</p>
          <SegmentedControl<'path' | 'depth'>
            label="Colour by"
            size="sm"
            options={[
              { value: 'path', label: 'Drawing order' },
              { value: 'depth', label: 'Branch depth' },
            ]}
            value={params.colorBy}
            onChange={(colorBy) => setLSystem({ colorBy })}
          />
        </div>
      </Section>
    </>
  );
}

/**
 * Axiom + rules editor. Edits live in a local draft and are committed to the
 * store only once they parse, after a short pause — so a half-typed rule
 * never reaches the renderer, and the figure updates as soon as it's valid.
 */
function GrammarEditor({ params }: { params: LSystemParams }) {
  const setLSystem = useSceneStore((s) => s.setLSystem);
  const axiomId = useId();
  const rulesId = useId();
  const source = `${params.axiom}\u0000${params.rules}`;
  const [draft, setDraft] = useState({ axiom: params.axiom, rules: params.rules, source });

  // The grammar changed from outside (preset, URL, undo): adopt it.
  if (draft.source !== source) setDraft({ axiom: params.axiom, rules: params.rules, source });

  const axiomError = validateAxiom(draft.axiom);
  const parsed = useMemo(() => parseRules(draft.rules), [draft.rules]);
  const error = axiomError ?? (parsed.ok ? null : parsed.error);
  const changed = draft.axiom !== params.axiom || draft.rules !== params.rules;

  useEffect(() => {
    if (!changed || error || !parsed.ok) return;
    const timer = window.setTimeout(() => {
      const budget = maxIterationsWithinBudget(draft.axiom, parsed.rules);
      setLSystem({
        preset: 'custom',
        axiom: draft.axiom,
        rules: draft.rules,
        iterations: Math.min(params.iterations, budget),
      });
    }, COMMIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [changed, error, parsed, draft.axiom, draft.rules, params.iterations, setLSystem]);

  const field =
    'w-full rounded-[9px] border bg-black/25 px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-fg outline-none transition-colors';

  return (
    <div className="space-y-2.5">
      <div>
        <label htmlFor={axiomId} className="mb-1.5 block text-[11px] text-fg-subtle">
          Axiom <span className="font-mono">ω</span>
        </label>
        <input
          id={axiomId}
          value={draft.axiom}
          spellCheck={false}
          autoCapitalize="off"
          onChange={(e) => setDraft({ ...draft, axiom: e.target.value })}
          className={cx(field, axiomError ? 'border-[#c96a55]/70' : 'border-line-strong focus:border-gilt/50')}
        />
      </div>
      <div>
        <label htmlFor={rulesId} className="mb-1.5 block text-[11px] text-fg-subtle">
          Rules <span className="text-fg-subtle/70">— one per line, e.g. F=F+F--F+F</span>
        </label>
        <textarea
          id={rulesId}
          value={draft.rules}
          rows={Math.min(5, Math.max(2, draft.rules.split('\n').length))}
          spellCheck={false}
          autoCapitalize="off"
          onChange={(e) => setDraft({ ...draft, rules: e.target.value })}
          className={cx(field, 'resize-none', error && !axiomError ? 'border-[#c96a55]/70' : 'border-line-strong focus:border-gilt/50')}
        />
      </div>
      <p className={cx('min-h-4 text-[11px] leading-snug', error ? 'text-[#e0917d]' : 'text-fg-subtle')}>
        {error ?? 'F G A B draw · f moves · + − turn · [ ] branch · | turn around'}
      </p>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
  return String(n);
}
