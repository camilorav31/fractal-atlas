import type { ReactNode } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { useUiStore } from '../../store/uiStore';
import type { ViewportStats } from '../../render/ViewportRenderer';
import { FRACTAL_INFO } from '../../fractals/registry';
import type { FractalKind } from '../../fractals/types';
import { cx } from '../controls/cx';

/** Instrument-style readout, bottom left. Digits are tabular so nothing jitters. */
export function Readout() {
  const view = useSceneStore((s) => s.view);
  const raster = useSceneStore((s) => FRACTAL_INFO[s.fractal.kind].family === 'raster');
  const stats = useUiStore((s) => s.stats);
  const digits = raster ? 4 : Math.min(16, Math.max(6, Math.ceil(view.zoomLog) + 5));
  const kind = useSceneStore((s) => s.fractal.kind);
  const status = describe(stats, kind);

  return (
    <div className="hud-shadow pointer-events-none font-mono text-[11px] tabular select-none">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <Row label={raster ? 'X' : 'Re'} value={formatSigned(view.centerX, digits)} />
        <Row label={raster ? 'Y' : 'Im'} value={formatSigned(view.centerY, digits)} />
        <Row
          label="Zoom"
          value={
            <>
              ×10<sup className="text-[9px]">{view.zoomLog.toFixed(2)}</sup>
            </>
          }
        />
        <Row label={status.metricLabel} value={status.metric} />
      </dl>
      <div className="mt-3 flex items-center gap-2.5">
        <span
          className={cx(
            'rounded-[4px] border px-1.5 py-px text-[9.5px] tracking-[0.12em] uppercase transition-colors duration-500',
            status.highlight ? 'border-gilt/40 text-gilt' : 'border-fg/25 text-fg-muted',
          )}
          title={status.badgeTitle}
        >
          {status.badge}
        </span>
        <span className="relative h-px w-16 overflow-hidden bg-line-strong">
          <span
            className={cx('absolute inset-y-0 left-0 bg-fg/60 transition-[width] duration-200', status.busy && 'animate-pulse')}
            style={{ width: `${status.progress * 100}%` }}
          />
        </span>
        <span className="w-20 text-[10px] text-fg-muted">{status.label}</span>
      </div>
    </div>
  );
}

interface Status {
  metricLabel: string;
  metric: string;
  badge: string;
  badgeTitle: string;
  highlight: boolean;
  progress: number;
  busy: boolean;
  label: string;
}

function describe(stats: ViewportStats | null, kind: FractalKind): Status {
  if (!stats) {
    return { metricLabel: 'Iter', metric: '—', badge: '—', badgeTitle: '', highlight: false, progress: 0, busy: true, label: 'starting' };
  }
  if (stats.family === 'raster') {
    return {
      metricLabel: kind === 'ifs' ? 'Pts' : 'Segs',
      metric: `${formatCount(stats.count)}${stats.truncated ? '+' : ''}`,
      badge: 'worker',
      badgeTitle: 'Geometry and rasterization run in a Web Worker',
      highlight: false,
      progress: stats.rendering ? 0.5 : 1,
      busy: stats.rendering,
      label: stats.rendering ? 'drawing' : `${Math.round(stats.ms)} ms`,
    };
  }
  const interactive = stats.resolutionScale < 1;
  const refining = stats.samples < stats.targetSamples || interactive;
  return {
    metricLabel: 'Iter',
    metric: stats.iterations.toLocaleString('en-US'),
    badge: stats.precision,
    badgeTitle: stats.precision === 'df64' ? 'Emulated double precision' : 'Single precision',
    highlight: stats.precision === 'df64',
    progress: interactive ? 0 : stats.samples / stats.targetSamples,
    busy: false,
    label: refining ? 'refining' : `${stats.samples} spp`,
  };
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-fg/90">{value}</dd>
    </>
  );
}

function formatCount(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n.toLocaleString('en-US');
}

function formatSigned(value: number, digits: number): string {
  const text = Math.abs(value).toFixed(digits);
  return `${value < 0 ? '−' : ' '}${text}`;
}
