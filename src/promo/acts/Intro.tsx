import { ACTS, ease, progress } from '../timeline';
import { drift, MARGIN } from '../style';
import { Badge, Eyebrow, Hairline, Mask, Typed } from '../ui';

const FORMULA = 'zₙ₊₁ = zₙ² + c';
const EXIT = { start: ACTS.intro.end - 10, end: ACTS.intro.end - 1 };

/** Act I: the title lockup, set against the whole Mandelbrot set. */
export function Intro({ frame }: { frame: number }) {
  const t = (start: number, end: number) => ease.outExpo(progress(frame, start, end));
  const gone = ease.inOut(progress(frame, EXIT.start, EXIT.end));

  return (
    <div className="absolute top-1/2 -translate-y-1/2" style={{ left: MARGIN }}>
      <Eyebrow className="mb-9" style={drift(t(4, 20), gone, 14)}>
        <span className="text-fg/90">Nº 00</span>
        <Hairline p={t(4, 24)} width={56} />
        <span>A real-time fractal explorer</span>
      </Eyebrow>

      <h1 className="hud-shadow font-display text-[250px] leading-[0.84] tracking-[-0.025em] text-fg">
        <Mask shown={t(6, 26)} gone={gone}>
          Fractal
        </Mask>
        <Mask shown={t(11, 31)} gone={gone}>
          <em className="text-fg-muted">Atlas</em>
        </Mask>
      </h1>

      <div className="mt-11" style={drift(1, gone, 14)}>
        <Hairline p={t(26, 46)} width={660} />
        <p className="hud-shadow mt-7 font-mono text-[30px] text-fg/85">
          <Typed text={FORMULA} p={progress(frame, 30, 46)} />
        </p>
        <div className="mt-8 flex gap-3" style={drift(t(40, 52), 0, 12)}>
          <Badge>WebGL2</Badge>
          <Badge>Web Workers</Badge>
          <Badge active>×10¹³</Badge>
        </div>
      </div>
    </div>
  );
}
