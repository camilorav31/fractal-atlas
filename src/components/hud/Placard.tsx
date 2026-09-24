import { FRACTAL_INFO } from '../../fractals/registry';
import { useSceneStore } from '../../store/sceneStore';
import { formatComplex } from '../../utils/format';

const MAX_RULE_CHARS = 34;

/** Museum-label title block, top left. */
export function Placard() {
  const kind = useSceneStore((s) => s.fractal.kind);
  const detail = useSceneStore((s) => {
    const { fractal } = s;
    if (fractal.kind === 'julia') return `c = ${formatComplex(fractal.params.cRe, fractal.params.cIm)}`;
    if (fractal.kind === 'lsystem') return grammarSummary(fractal.params.axiom, fractal.params.rules);
    return null;
  });
  const def = FRACTAL_INFO[kind];
  const [first, ...rest] = def.title.split(' ');

  return (
    <div className="hud-shadow pointer-events-none select-none">
      <p className="eyebrow flex items-center gap-2.5 !text-fg-muted">
        <span className="text-fg/85">Fractal Atlas</span>
        <span className="h-px w-5 bg-fg/30" />
        <span>{def.ordinal}</span>
      </p>
      {/* Keyed so the title re-enters when the fractal changes. */}
      <h1
        key={kind}
        className="animate-rise mt-2.5 font-display text-[44px] leading-[0.95] tracking-[-0.01em] text-fg md:text-[56px]"
      >
        {first} <em className="text-fg-muted">{rest.join(' ')}</em>
      </h1>
      <p className="mt-2 max-w-[80vw] truncate font-mono text-[12px] text-fg/75">
        {kind === 'lsystem' ? detail : def.formula}
        {kind === 'julia' && detail && (
          <>
            <span className="mx-2.5 text-fg/35">·</span>
            {detail}
          </>
        )}
      </p>
    </div>
  );
}

/** "ω = X · X → F+[[X]−X]−F[−FX]+X" — axiom plus the first rule, typographically. */
function grammarSummary(axiom: string, rules: string): string {
  const pretty = (word: string) => word.replace(/-/g, '−');
  const [firstRule = ''] = rules.split(/[\n;]/).filter((l) => l.trim());
  const [symbol, body = ''] = firstRule.split(/=|→|->/);
  const clipped = body.length > MAX_RULE_CHARS ? `${body.slice(0, MAX_RULE_CHARS)}…` : body;
  return `ω = ${pretty(axiom)}   ·   ${symbol?.trim()} → ${pretty(clipped.trim())}`;
}
