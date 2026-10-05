import { Link2 } from 'lucide-react';
import { PALETTES, resolveStops } from '../../utils/palettes';
import { PALETTE_BEATS, PALETTE_VIEW, paletteBeat } from '../shots';
import { ACTS, ease, lerp, progress } from '../timeline';
import { drift, MARGIN } from '../style';
import { Eyebrow, Mask } from '../ui';

const LENGTH = ACTS.palettes.end - ACTS.palettes.start;
const enter = (local: number, start: number, end: number) => ease.outExpo(progress(local, start, end));

const URL_HOST = 'fractal-atlas.vercel.app/';
const URL_QUERY = `?f=mandelbrot&x=${PALETTE_VIEW.centerX}&y=${PALETTE_VIEW.centerY}&z=2.7&p=`;
const URL_TAIL = '&d=1.4';

/** Act IV: the colour of a view is one parameter in its link. */
export function Palettes({ frame }: { frame: number }) {
  const local = frame - ACTS.palettes.start;
  const gone = ease.inOut(progress(local, LENGTH - 9, LENGTH - 2));
  const { index, mix } = paletteBeat(local);

  return (
    <>
      <div className="absolute" style={{ left: MARGIN, top: MARGIN - 8 }}>
        <Eyebrow style={drift(enter(local, 3, 16), gone, 12)}>
          <span className="text-fg/90">Fractal Atlas</span>
          <span className="h-px w-8 bg-fg/35" />
          <span>Palettes &amp; links</span>
        </Eyebrow>
        <h2 className="hud-shadow mt-6 font-display text-[124px] leading-[0.95] tracking-[-0.01em] text-fg">
          <Mask shown={enter(local, 5, 22)} gone={gone}>
            Every view is
          </Mask>
          <Mask shown={enter(local, 9, 26)} gone={gone}>
            <em className="text-fg-muted">a link</em>
          </Mask>
        </h2>
      </div>

      <PaletteList local={local} gone={gone} index={index} mix={mix} />
      <UrlBar local={local} gone={gone} index={index} />
    </>
  );
}

function PaletteList({ local, gone, index, mix }: { local: number; gone: number; index: number; mix: number }) {
  const activeId = PALETTE_BEATS[index]!.palette;
  const previousId = index > 0 ? PALETTE_BEATS[index - 1]!.palette : null;
  return (
    <div
      className="glass absolute top-1/2 flex w-[470px] flex-col gap-[10px] rounded-[18px] p-5"
      style={{ right: MARGIN, marginTop: -214, ...drift(enter(local, 8, 24), gone, 18) }}
    >
      {PALETTES.map((palette, i) => {
        const active = palette.id === activeId ? mix : palette.id === previousId ? 1 - mix : 0;
        return (
          <div
            key={palette.id}
            className="flex items-center gap-5 rounded-[10px] border px-3 py-[10px]"
            style={{
              borderColor: `rgb(217 191 133 / ${0.7 * active})`,
              background: `rgb(255 255 255 / ${0.07 * active})`,
              ...drift(enter(local, 10 + i * 2, 22 + i * 2), 0, 12),
            }}
          >
            <div
              className="h-[38px] w-[240px] rounded-[6px]"
              style={{ background: `linear-gradient(90deg, ${resolveStops({ palette: palette.id, customStops: [] }).join(', ')})` }}
            />
            <span className="font-mono text-[19px] tracking-[0.14em] uppercase" style={{ color: active > 0.5 ? '#ecebe6' : '#a3a29c' }}>
              {palette.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function UrlBar({ local, gone, index }: { local: number; gone: number; index: number }) {
  const reveal = ease.inOut(progress(local, 4, 17));
  const beat = PALETTE_BEATS[index]!;
  const previous = index > 0 ? PALETTE_BEATS[index - 1]!.palette : null;
  const roll = ease.outExpo(progress(local, beat.start, beat.start + 7));
  // The box eases between the two names' widths so the rest of the address slides rather than jumps.
  const width = previous ? lerp(previous.length, beat.palette.length, roll) : beat.palette.length;

  return (
    <div
      className="glass absolute flex items-center gap-5 rounded-full py-[22px] pr-12 pl-8"
      style={{ left: MARGIN, bottom: MARGIN, opacity: enter(local, 2, 12) * (1 - gone), transform: `translateY(${gone * 18}px)` }}
    >
      <Link2 className="shrink-0 text-gilt" size={30} strokeWidth={1.6} />
      <p className="font-mono text-[24px] whitespace-nowrap text-fg/90" style={{ clipPath: `inset(-10px ${(1 - reveal) * 100}% -10px 0)` }}>
        <span className="text-fg-muted">{URL_HOST}</span>
        {URL_QUERY}
        <span className="relative inline-block h-[1.5em] overflow-hidden align-top text-gilt" style={{ width: `${width}ch` }}>
          {previous && roll < 1 && (
            <span className="absolute top-0 left-0" style={{ transform: `translateY(${-roll * 100}%)` }}>
              {previous}
            </span>
          )}
          <span className="absolute top-0 left-0" style={{ transform: `translateY(${previous ? (1 - roll) * 100 : 0}%)` }}>
            {beat.palette}
          </span>
        </span>
        {URL_TAIL}
      </p>
    </div>
  );
}
