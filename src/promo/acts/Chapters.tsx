import type { ReactNode } from 'react';
import { IFS_PRESETS } from '../../fractals/ifs/presets';
import { normalizedProbabilities } from '../../fractals/ifs/maps';
import { estimateSegments, parseRules } from '../../fractals/lsystem/grammar';
import { LSYSTEM_PRESETS } from '../../fractals/lsystem/presets';
import { complexToScreen } from '../../utils/viewMath';
import { formatComplex } from '../../utils/format';
import { assets } from '../assets';
import {
  CHAPTERS,
  type Chapter,
  ifsPoints,
  juliaConstant,
  L_SYSTEM_GENERATIONS,
  lsystemGeneration,
  mandelbrotZoom,
  MINIMAP,
} from '../shots';
import { ACTS, CHAPTER_COUNT, CHAPTER_FRAMES, clamp01, ease, progress } from '../timeline';
import { drift, formatCount, formatShort, MARGIN } from '../style';
import { Eyebrow, Magnification, Mask, Row } from '../ui';

/** Act II: four chapters of one fractal family each. */
export function Chapters({ frame }: { frame: number }) {
  const elapsed = frame - ACTS.families.start;
  const index = Math.min(CHAPTER_COUNT - 1, Math.max(0, Math.floor(elapsed / CHAPTER_FRAMES)));
  const local = elapsed - index * CHAPTER_FRAMES;
  const chapter = CHAPTERS[index]!;
  // Everything leaves just before the next chapter's wipe has finished arriving.
  const gone = ease.inOut(progress(local, CHAPTER_FRAMES - 9, CHAPTER_FRAMES - 2));

  return (
    <>
      <Placard chapter={chapter} local={local} gone={gone} />
      <Rail index={index} local={local} actElapsed={elapsed} />
      {chapter.id === 'mandelbrot' && <MandelbrotChapter local={local} gone={gone} />}
      {chapter.id === 'julia' && <JuliaChapter local={local} gone={gone} />}
      {chapter.id === 'lsystem' && <LSystemChapter local={local} gone={gone} />}
      {chapter.id === 'ifs' && <IfsChapter local={local} gone={gone} />}
    </>
  );
}

const enter = (local: number, start: number, end: number) => ease.outExpo(progress(local, start, end));

function Placard({ chapter, local, gone }: { chapter: Chapter; local: number; gone: number }) {
  const joiner = chapter.title.endsWith('-') ? '' : ' ';
  return (
    <div className="absolute" style={{ left: MARGIN, top: MARGIN - 8 }}>
      <Eyebrow style={drift(enter(local, 3, 16), gone, 12)}>
        <span className="text-fg/90">Fractal Atlas</span>
        <span className="h-px w-8 bg-fg/35" />
        <span>{chapter.ordinal}</span>
      </Eyebrow>
      <h2 className="hud-shadow mt-6 font-display text-[112px] leading-[0.95] tracking-[-0.01em] text-fg">
        {chapter.stacked ? (
          <>
            <Mask shown={enter(local, 5, 22)} gone={gone}>
              {chapter.title}
            </Mask>
            <Mask shown={enter(local, 9, 26)} gone={gone}>
              <em className="text-fg-muted">{chapter.italic}</em>
            </Mask>
          </>
        ) : (
          <Mask shown={enter(local, 5, 22)} gone={gone}>
            {chapter.title}
            {joiner}
            <em className="text-fg-muted">{chapter.italic}</em>
          </Mask>
        )}
      </h2>
      <p className="hud-shadow mt-5 font-mono text-[26px] text-fg/80" style={drift(enter(local, 10, 24), gone, 10)}>
        {chapter.formula}
      </p>
    </div>
  );
}

/** "02 / 04" and four bars; the current bar fills as the chapter plays. */
function Rail({ index, local, actElapsed }: { index: number; local: number; actElapsed: number }) {
  const visible = enter(actElapsed, 4, 20) * (1 - ease.inOut(progress(actElapsed, CHAPTER_COUNT * CHAPTER_FRAMES - 10, CHAPTER_COUNT * CHAPTER_FRAMES - 2)));
  return (
    <div className="absolute flex flex-col items-end" style={{ right: MARGIN, top: MARGIN, opacity: visible }}>
      <Eyebrow>
        <span className="text-fg/90">{String(index + 1).padStart(2, '0')}</span>
        <span>/ {String(CHAPTER_COUNT).padStart(2, '0')}</span>
      </Eyebrow>
      <div className="mt-5 flex gap-3">
        {CHAPTERS.map((chapter, i) => {
          const fill = i < index ? 1 : i === index ? progress(local, 0, CHAPTER_FRAMES) : 0;
          return (
            <div key={chapter.id} className="relative h-[3px] w-[76px] overflow-hidden bg-fg/20">
              <div className="absolute inset-y-0 left-0 bg-gilt" style={{ width: `${fill * 100}%` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Cards --------------------------------------------------------------------

/** Frosted spec sheet, bottom left. */
function SpecCard({ local, gone, rows }: { local: number; gone: number; rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl
      className="glass tabular absolute min-w-[600px] rounded-[18px] px-9 py-8 font-mono text-[23px] leading-[1.95]"
      style={{ left: MARGIN, bottom: MARGIN, ...drift(enter(local, 8, 22), gone, 18) }}
    >
      {rows.map((row, i) => (
        <Row key={row.label} label={row.label} style={drift(enter(local, 11 + i * 3, 24 + i * 3), 0, 10)}>
          {row.value}
        </Row>
      ))}
    </dl>
  );
}

/** Frosted card, bottom right, for each chapter's figure. */
function FigureCard({ local, gone, title, aside, children }: { local: number; gone: number; title: string; aside: string; children: ReactNode }) {
  return (
    <div
      className="glass absolute w-[600px] rounded-[18px] p-5"
      style={{ right: MARGIN, bottom: MARGIN, ...drift(enter(local, 10, 24), gone, 18) }}
    >
      <Eyebrow className="mb-4 px-1 !text-[13px]">
        <span className="text-fg/85">{title}</span>
        <span className="h-px flex-1 bg-fg/15" />
        <span>{aside}</span>
      </Eyebrow>
      {children}
    </div>
  );
}

// --- Chapters -----------------------------------------------------------------

/** A square reticle closing in on the point the shot is diving toward. */
function MandelbrotChapter({ local, gone }: { local: number; gone: number }) {
  const closing = ease.outExpo(progress(local, 2, 34));
  const half = 250 - 120 * closing;
  const arm = 34;
  const opacity = enter(local, 4, 14) * (1 - gone);
  const corner = (sx: number, sy: number) => `M ${sx * (half - arm)} ${sy * half} H ${sx * half} V ${sy * (half - arm)}`;
  return (
    <>
      <svg
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible"
        width="2"
        height="2"
        style={{ opacity, filter: 'drop-shadow(0 0 6px rgb(0 0 0 / 0.6))' }}
      >
        {([-1, 1] as const).flatMap((sx) => ([-1, 1] as const).map((sy) => <path key={`${sx}${sy}`} d={corner(sx, sy)} fill="none" stroke="rgb(236 235 230 / 0.85)" strokeWidth="2" />))}
        <path d="M -9 0 H 9 M 0 -9 V 9" stroke="#d9bf85" strokeWidth="2" />
      </svg>
      <SpecCard
        local={local}
        gone={gone}
        rows={[
          { label: 'ENGINE', value: 'WebGL2 fragment shader' },
          { label: 'PRECISION', value: 'float32 → emulated double' },
          { label: 'SAMPLING', value: '24× progressive' },
          { label: 'ZOOM', value: <Magnification zoomLog={mandelbrotZoom(local)} /> },
        ]}
      />
    </>
  );
}

function JuliaChapter({ local, gone }: { local: number; gone: number }) {
  const { re, im } = juliaConstant(local);
  const { width, height, scene } = MINIMAP;
  const at = (x: number, y: number) => complexToScreen(scene.view, x, y, width, height);
  const trail = Array.from({ length: Math.max(1, Math.floor(local) + 1) }, (_, f) => juliaConstant(f)).map((c) => at(c.re, c.im));
  const head = at(re, im);
  const points = trail.map((p) => `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(' ');

  return (
    <>
      <SpecCard
        local={local}
        gone={gone}
        rows={[
          { label: 'ENGINE', value: 'WebGL2 fragment shader' },
          { label: 'PICKER', value: 'c on a Mandelbrot map' },
          { label: 'CONSTANT', value: formatComplex(re, im) },
        ]}
      />
      <FigureCard local={local} gone={gone} title="c-plane" aside="live pick">
        <div className="relative overflow-hidden rounded-[10px]" style={{ width, height }}>
          <img src={assets.minimap} width={width} height={height} alt="" />
          <svg className="absolute inset-0" width={width} height={height}>
            <polyline points={points} fill="none" stroke="#d9bf85" strokeOpacity="0.8" strokeWidth="2" strokeLinejoin="round" />
            <path d={`M ${head.sx} 0 V ${height} M 0 ${head.sy} H ${width}`} stroke="rgb(236 235 230 / 0.35)" strokeWidth="1" />
            <circle cx={head.sx} cy={head.sy} r="14" fill="none" stroke="#d9bf85" strokeOpacity="0.55" />
            <circle cx={head.sx} cy={head.sy} r="5" fill="#d9bf85" />
          </svg>
        </div>
      </FigureCard>
    </>
  );
}

const TREE = LSYSTEM_PRESETS.find((preset) => preset.id === 'tree')!;
const TREE_RULES = parseRules(TREE.rules);

function LSystemChapter({ local, gone }: { local: number; gone: number }) {
  const generation = lsystemGeneration(local);
  const segments = TREE_RULES.ok ? estimateSegments(TREE.axiom, TREE_RULES.rules, generation) : 0;
  const { from, to } = L_SYSTEM_GENERATIONS;

  return (
    <>
      <SpecCard
        local={local}
        gone={gone}
        rows={[
          { label: 'ENGINE', value: 'Web Worker · OffscreenCanvas' },
          { label: 'GENERATION', value: `n = ${generation}` },
          { label: 'SEGMENTS', value: formatShort(segments) },
        ]}
      />
      <FigureCard local={local} gone={gone} title="Grammar" aside={`${TREE.angle}°`}>
        <pre className="hud-shadow px-1 font-mono text-[25px] leading-[1.75] text-fg/90">
          <span className="text-fg-muted">ω  </span>
          {TREE.axiom}
          {'\n'}
          {TREE.rules.split('\n').map((rule) => {
            const [symbol, body] = rule.split('=');
            return (
              <span key={rule} className="block">
                <span className="text-gilt">{symbol}</span> <span className="text-fg-muted">→</span> {body?.replaceAll('-', '−')}
              </span>
            );
          })}
        </pre>
        <div className="mt-5 flex gap-2 px-1">
          {Array.from({ length: to - from + 1 }, (_, i) => (
            <div key={i} className="h-[3px] flex-1 transition-none" style={{ background: from + i <= generation ? '#d9bf85' : 'rgb(255 255 255 / 0.16)' }} />
          ))}
        </div>
      </FigureCard>
    </>
  );
}

const FERN = IFS_PRESETS.find((preset) => preset.id === 'fern')!;
const FERN_P = normalizedProbabilities(FERN.maps);

function IfsChapter({ local, gone }: { local: number; gone: number }) {
  const points = ifsPoints(local);
  return (
    <>
      <SpecCard
        local={local}
        gone={gone}
        rows={[
          { label: 'ENGINE', value: 'Web Worker · chaos game' },
          { label: 'MAPS', value: `${FERN.maps.length} affine contractions` },
          { label: 'POINTS', value: formatCount(points) },
        ]}
      />
      <FigureCard local={local} gone={gone} title="Map probabilities" aside="p">
        <div className="flex flex-col gap-[14px] px-1 py-1 font-mono text-[22px] tabular">
          {FERN_P.map((p, i) => {
            const fill = ease.outExpo(progress(local, 14 + i * 3, 30 + i * 3));
            return (
              <div key={i} className="grid grid-cols-[48px_1fr_72px] items-center gap-4">
                <span className="text-fg-muted">w<sub className="text-[0.65em]">{i + 1}</sub></span>
                <div className="h-[6px] bg-fg/12">
                  <div className="h-full bg-gilt" style={{ width: `${clamp01(p) * fill * 100}%` }} />
                </div>
                <span className="text-right text-fg/90">{p.toFixed(2).replace(/^0/, '')}</span>
              </div>
            );
          })}
        </div>
      </FigureCard>
    </>
  );
}
