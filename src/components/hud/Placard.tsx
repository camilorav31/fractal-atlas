import { FRACTALS } from '../../fractals/registry';
import { useSceneStore } from '../../store/sceneStore';

/** Museum-label title block, top left. */
export function Placard() {
  const kind = useSceneStore((s) => s.fractal.kind);
  const def = FRACTALS[kind];
  return (
    <div className="hud-shadow pointer-events-none select-none">
      <p className="eyebrow flex items-center gap-2.5 !text-fg-muted">
        <span className="text-fg/85">Fractal Atlas</span>
        <span className="h-px w-5 bg-fg/30" />
        <span>Nº 01</span>
      </p>
      <h1 className="mt-2.5 font-display text-[44px] leading-[0.95] tracking-[-0.01em] text-fg md:text-[56px]">
        {def.title.split(' ')[0]} <em className="text-fg-muted">{def.title.split(' ').slice(1).join(' ')}</em>
      </h1>
      <p className="mt-2 font-mono text-[12px] text-fg/75">{def.formula}</p>
    </div>
  );
}
