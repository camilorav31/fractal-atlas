import { useSceneStore } from '../../store/sceneStore';
import { useUiStore } from '../../store/uiStore';
import { cx } from '../controls/cx';

/** Instrument-style coordinates, bottom left. Digits are tabular so nothing jitters. */
export function Readout() {
  const view = useSceneStore((s) => s.view);
  const stats = useUiStore((s) => s.stats);
  const digits = Math.min(16, Math.max(6, Math.ceil(view.zoomLog) + 5));
  const refining = stats ? stats.samples < stats.targetSamples || stats.resolutionScale < 1 : true;
  const progress = stats ? (stats.resolutionScale < 1 ? 0 : stats.samples / stats.targetSamples) : 0;

  return (
    <div className="hud-shadow pointer-events-none font-mono text-[11px] tabular select-none">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <Row label="Re" value={formatSigned(view.centerX, digits)} />
        <Row label="Im" value={formatSigned(view.centerY, digits)} />
        <Row
          label="Zoom"
          value={
            <>
              ×10<sup className="text-[9px]">{view.zoomLog.toFixed(2)}</sup>
            </>
          }
        />
        <Row label="Iter" value={stats ? stats.iterations.toLocaleString('en-US') : '—'} />
      </dl>
      <div className="mt-3 flex items-center gap-2.5">
        <span
          className={cx(
            'rounded-[4px] border px-1.5 py-px text-[9.5px] tracking-[0.12em] uppercase transition-colors duration-500',
            stats?.precision === 'df64' ? 'border-gilt/40 text-gilt' : 'border-fg/25 text-fg-muted',
          )}
          title={stats?.precision === 'df64' ? 'Emulated double precision' : 'Single precision'}
        >
          {stats?.precision ?? 'fp32'}
        </span>
        <span className="relative h-px w-16 overflow-hidden bg-line-strong">
          <span
            className="absolute inset-y-0 left-0 bg-fg/60 transition-[width] duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </span>
        <span className="w-16 text-[10px] text-fg-muted">{refining ? 'refining' : `${stats?.samples ?? 0} spp`}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-fg/90">{value}</dd>
    </>
  );
}

function formatSigned(value: number, digits: number): string {
  const text = Math.abs(value).toFixed(digits);
  return `${value < 0 ? '−' : ' '}${text}`;
}
