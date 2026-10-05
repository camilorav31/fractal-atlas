import { DEFAULT_ITERATIONS, scaledIterations } from '../../fractals/iterations';
import { needsDoublePrecision, pixelSize } from '../../utils/viewMath';
import { DIVE, diveZoom, handoffZoom } from '../shots';
import { ACTS, clamp01, ease, progress, STAGE } from '../timeline';
import { drift, MARGIN } from '../style';
import { Badge, Eyebrow, Mask, Row } from '../ui';

const LENGTH = ACTS.dive.end - ACTS.dive.start;
const HANDOFF = handoffZoom();
/** First frame at which the zoom crosses into df64 territory. */
const HANDOFF_FRAME = Array.from({ length: LENGTH }, (_, f) => f).find((f) => diveZoom(f) >= HANDOFF) ?? LENGTH;

const GAUGE = { left: 660, bottom: MARGIN, max: 13 };
const GAUGE_WIDTH = STAGE.width - MARGIN - GAUGE.left;
const xOf = (zoomLog: number) => (zoomLog / GAUGE.max) * GAUGE_WIDTH;

const signed = (value: number, digits: number) => `${value < 0 ? '−' : ' '}${Math.abs(value).toFixed(digits)}`;
const enter = (local: number, start: number, end: number) => ease.outExpo(progress(local, start, end));

/** Act III: the zoom, with the instruments the app shows plus the precision handoff made visible. */
export function Dive({ frame }: { frame: number }) {
  const local = frame - ACTS.dive.start;
  const zoom = diveZoom(local);
  const gone = ease.inOut(progress(local, LENGTH - 9, LENGTH - 2));
  const view = { ...DIVE.center, zoomLog: zoom };
  const df64 = needsDoublePrecision(view, STAGE.height);
  const digits = Math.min(16, Math.max(6, Math.ceil(zoom) + 5));

  return (
    <>
      <div className="absolute" style={{ left: MARGIN, top: MARGIN - 8 }}>
        <Eyebrow style={drift(enter(local, 3, 16), gone, 12)}>
          <span className="text-fg/90">Fractal Atlas</span>
          <span className="h-px w-8 bg-fg/35" />
          <span>Deep zoom</span>
        </Eyebrow>
        <h2 className="hud-shadow mt-6 font-display text-[124px] leading-[0.95] tracking-[-0.01em] text-fg">
          <Mask shown={enter(local, 5, 22)} gone={gone}>
            Ten trillion
          </Mask>
          <Mask shown={enter(local, 9, 26)} gone={gone}>
            <em className="text-fg-muted">times closer</em>
          </Mask>
        </h2>
        <p className="hud-shadow mt-5 font-mono text-[26px] text-fg/80" style={drift(enter(local, 14, 28), gone, 10)}>
          Seahorse Valley
        </p>
      </div>

      <div className="absolute flex flex-col items-end" style={{ right: MARGIN, top: MARGIN - 8, ...drift(enter(local, 4, 20), gone, 16) }}>
        <Eyebrow>Magnification</Eyebrow>
        <p className="hud-shadow mt-4 flex items-start font-display text-[200px] leading-[0.9] whitespace-nowrap text-fg">
          <span>×10</span>
          <span className="ml-2 inline-block w-[2.1em] pt-[0.04em] text-left text-[0.5em] leading-none text-gilt">{zoom.toFixed(1)}</span>
        </p>
      </div>

      <dl
        className="glass tabular absolute w-[520px] rounded-[18px] px-9 py-8 font-mono text-[23px] leading-[1.95]"
        style={{ left: MARGIN, bottom: MARGIN, ...drift(enter(local, 8, 22), gone, 18) }}
      >
        <Row label="Re" style={drift(enter(local, 11, 24), 0, 10)}>{signed(DIVE.center.centerX, digits)}</Row>
        <Row label="Im" style={drift(enter(local, 14, 27), 0, 10)}>{signed(DIVE.center.centerY, digits)}</Row>
        <Row label="Pixel" style={drift(enter(local, 17, 30), 0, 10)}>{scientific(pixelSize(zoom, STAGE.height))}</Row>
        <Row label="Iter" style={drift(enter(local, 20, 33), 0, 10)}>
          {scaledIterations(DEFAULT_ITERATIONS, zoom).toLocaleString('en-US')}
        </Row>
        <div className="mt-4 flex items-center gap-4" style={drift(enter(local, 24, 36), 0, 10)}>
          <Badge active={df64}>{df64 ? 'df64' : 'fp32'}</Badge>
          <span className="h-px w-20 bg-fg/60" />
          <span className="text-[19px] text-fg-muted">24 spp</span>
        </div>
      </dl>

      <Gauge local={local} zoom={zoom} gone={gone} />
    </>
  );
}

const SUPERSCRIPT: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

/** 3.1e-13 → "3.1 × 10⁻¹³". */
function scientific(value: number): string {
  const [mantissa = '', exponent = ''] = value.toExponential(1).split('e');
  return `${mantissa} × 10${[...exponent].map((ch) => SUPERSCRIPT[ch] ?? '').join('')}`;
}

/** A log-scale ruler from 10⁰ to 10¹³ with the float32 → df64 handoff marked on it. */
function Gauge({ local, zoom, gone }: { local: number; zoom: number; gone: number }) {
  const draw = ease.outExpo(progress(local, 4, 24));
  const sinceHandoff = local - HANDOFF_FRAME;
  const pulse = clamp01(sinceHandoff / 16);
  const callout = sinceHandoff >= 0 ? enter(sinceHandoff, 0, 8) * (1 - ease.inOut(progress(sinceHandoff, 26, 34))) : 0;
  const past = Math.min(zoom, HANDOFF);

  return (
    <div
      className="absolute"
      style={{ left: GAUGE.left, bottom: GAUGE.bottom, width: GAUGE_WIDTH, height: 150, opacity: clamp01(draw * 2) * (1 - gone) }}
    >
      <Eyebrow className="absolute top-0 left-0 !text-[13px]" style={{ opacity: 0.9 }}>
        <span>float32</span>
      </Eyebrow>
      <Eyebrow className="absolute top-0 !text-[13px] !text-gilt" style={{ left: xOf(HANDOFF) + 12 }}>
        <span>df64 · emulated double precision</span>
      </Eyebrow>

      <div className="absolute inset-x-0 top-[52px] h-[6px] origin-left" style={{ transform: `scaleX(${draw})` }}>
        <div className="absolute inset-0 bg-fg/15" />
        <div className="absolute inset-y-0 left-0 bg-gilt/25" style={{ left: xOf(HANDOFF), width: GAUGE_WIDTH - xOf(HANDOFF) }} />
        <div className="absolute inset-y-0 left-0 bg-fg/85" style={{ width: xOf(past) }} />
        <div className="absolute inset-y-0 bg-gilt" style={{ left: xOf(HANDOFF), width: Math.max(0, xOf(zoom) - xOf(HANDOFF)) }} />
      </div>

      {Array.from({ length: GAUGE.max + 1 }, (_, n) => (
        <div key={n} className="absolute top-[66px] -translate-x-1/2 text-center font-mono text-[14px] text-fg-muted" style={{ left: xOf(n) }}>
          <div className="mx-auto mb-2 h-[7px] w-px bg-fg/40" />
          10<sup className="text-[0.7em]">{n}</sup>
        </div>
      ))}

      <div className="absolute top-[40px] h-[30px] w-px bg-gilt" style={{ left: xOf(HANDOFF) }} />
      {sinceHandoff >= 0 && sinceHandoff < 20 && (
        <div
          className="absolute top-[55px] h-8 w-8 rounded-full border border-gilt"
          style={{ left: xOf(HANDOFF), transform: `translate(-50%, -50%) scale(${1 + pulse * 3.5})`, opacity: 1 - pulse }}
        />
      )}
      <div
        className="absolute top-[104px] -translate-x-1/2 rounded-[5px] border border-gilt/60 bg-void/80 px-3 py-1 font-mono text-[14px] tracking-[0.14em] whitespace-nowrap text-gilt uppercase"
        style={{ left: xOf(HANDOFF), opacity: callout, display: callout > 0 ? undefined : 'none' }}
      >
        Handoff · ×10<sup>{HANDOFF.toFixed(1)}</sup>
      </div>

      <div
        className="absolute top-[55px] h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg shadow-[0_0_0_5px_rgb(217_191_133/0.35)]"
        style={{ left: xOf(zoom), background: zoom >= HANDOFF ? '#d9bf85' : '#ecebe6' }}
      />
    </div>
  );
}
