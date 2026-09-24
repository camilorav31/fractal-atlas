import { FRACTALS } from '../../fractals/registry';
import { useSceneStore } from '../../store/sceneStore';
import { formatComplex } from '../../utils/format';

/** Museum-label title block, top left. */
export function Placard() {
  const kind = useSceneStore((s) => s.fractal.kind);
  const juliaC = useSceneStore((s) => (s.fractal.kind === 'julia' ? formatComplex(s.fractal.params.cRe, s.fractal.params.cIm) : null));
  const def = FRACTALS[kind];
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
      <p className="mt-2 font-mono text-[12px] text-fg/75">
        {def.formula}
        {juliaC && (
          <>
            <span className="mx-2.5 text-fg/35">·</span>c = {juliaC}
          </>
        )}
      </p>
    </div>
  );
}
