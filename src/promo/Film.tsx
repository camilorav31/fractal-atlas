import { Chapters } from './acts/Chapters';
import { Dive } from './acts/Dive';
import { Intro } from './acts/Intro';
import { Outro } from './acts/Outro';
import { Palettes } from './acts/Palettes';
import { wipeAt, wipeEdge } from './shots';
import { ACTS, clamp01, ease, hash, progress, STAGE, TOTAL_FRAMES, type Span } from './timeline';

const within = (frame: number, span: Span) => frame >= span.start && frame < span.end;

/** The motion graphics layer: every pixel above the fractal footage, as a pure function of `frame`. */
export function Film({ frame }: { frame: number }) {
  const fade = Math.min(clamp01((frame + 1) / 9), clamp01((TOTAL_FRAMES - 1 - frame) / 14));
  // Film grain re-seated every frame, so it shimmers like film instead of sitting on the picture.
  const grain = { '--grain-x': `${Math.round(hash(frame * 2) * 160)}px`, '--grain-y': `${Math.round(hash(frame * 2 + 1) * 160)}px` };

  return (
    <div className="grain absolute inset-0 overflow-hidden text-fg" style={grain as React.CSSProperties}>
      <Scrim frame={frame} />
      {within(frame, ACTS.intro) && <Intro frame={frame} />}
      {within(frame, ACTS.families) && <Chapters frame={frame} />}
      {within(frame, ACTS.dive) && <Dive frame={frame} />}
      {within(frame, ACTS.palettes) && <Palettes frame={frame} />}
      {within(frame, ACTS.outro) && <Outro frame={frame} />}
      <WipeEdge frame={frame} />
      <CropMarks frame={frame} />
      <ProgressRule frame={frame} />
      <div className="absolute inset-0 bg-black" style={{ opacity: 1 - fade }} />
    </div>
  );
}

/** Keeps type legible over bright escape bands without flattening the picture. */
function Scrim({ frame }: { frame: number }) {
  const opacity = 1 - progress(frame, ACTS.outro.start, ACTS.outro.start + 10);
  return (
    <div
      className="absolute inset-0"
      style={{
        opacity,
        background:
          'linear-gradient(90deg, rgb(5 5 8 / 0.62) 0%, rgb(5 5 8 / 0.34) 30%, transparent 58%), linear-gradient(180deg, rgb(5 5 8 / 0.32), transparent 24%, transparent 74%, rgb(5 5 8 / 0.4))',
      }}
    />
  );
}

/** The gilt blade that carries one shot over the next. */
function WipeEdge({ frame }: { frame: number }) {
  const wipe = wipeAt(frame);
  if (!wipe) return null;
  const { top, bottom } = wipeEdge(wipe.progress);
  const trail = 380;
  return (
    <svg className="absolute inset-0" width={STAGE.width} height={STAGE.height}>
      <defs>
        <linearGradient id="wipe-trail" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#d9bf85" stopOpacity="0" />
          <stop offset="1" stopColor="#d9bf85" stopOpacity="0.26" />
        </linearGradient>
      </defs>
      <polygon points={`${top - trail},0 ${top},0 ${bottom},${STAGE.height} ${bottom - trail},${STAGE.height}`} fill="url(#wipe-trail)" />
      <line x1={top} y1={0} x2={bottom} y2={STAGE.height} stroke="#f3e3b8" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 14px rgb(217 191 133 / 0.95))' }} />
    </svg>
  );
}

const CROP = { inset: 44, length: 30 };

/** Registration marks in the four corners, drawn on at the start. */
function CropMarks({ frame }: { frame: number }) {
  const draw = ease.outExpo(progress(frame, 2, 28));
  const { inset, length } = CROP;
  const far = { x: STAGE.width - inset, y: STAGE.height - inset };
  const corners = [
    `M ${inset} ${inset + length} V ${inset} H ${inset + length}`,
    `M ${far.x - length} ${inset} H ${far.x} V ${inset + length}`,
    `M ${inset} ${far.y - length} V ${far.y} H ${inset + length}`,
    `M ${far.x - length} ${far.y} H ${far.x} V ${far.y - length}`,
  ];
  return (
    <svg className="absolute inset-0" width={STAGE.width} height={STAGE.height} style={{ filter: 'drop-shadow(0 0 4px rgb(0 0 0 / 0.5))' }}>
      {corners.map((d) => (
        <path key={d} d={d} fill="none" stroke="rgb(236 235 230 / 0.5)" strokeWidth="1.5" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - draw} />
      ))}
    </svg>
  );
}

/** The whole film as a single hairline along the bottom edge. */
function ProgressRule({ frame }: { frame: number }) {
  return (
    <div className="absolute inset-x-0 bottom-0 h-[3px] bg-fg/10">
      <div className="h-full bg-gilt" style={{ width: `${(frame / (TOTAL_FRAMES - 1)) * 100}%` }} />
    </div>
  );
}
