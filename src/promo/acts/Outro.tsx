import { ArrowUpRight } from 'lucide-react';
import { ACTS, ease, progress } from '../timeline';
import { drift, MARGIN } from '../style';
import { Eyebrow, Hairline, Mask } from '../ui';

const PILL = { width: 600, height: 92 };

/** Act V: the lockup again, with the address. */
export function Outro({ frame }: { frame: number }) {
  const local = frame - ACTS.outro.start;
  const t = (start: number, end: number) => ease.outExpo(progress(local, start, end));
  const draw = ease.inOut(progress(local, 22, 40));
  const radius = PILL.height / 2;

  return (
    <>
      <div className="absolute inset-0 bg-void" style={{ opacity: 0.6 * ease.soft(progress(local, 0, 14)) }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Eyebrow style={drift(t(2, 16), 0, 12)}>
          <span className="text-fg/90">Fractal Atlas</span>
          <span className="h-px w-8 bg-fg/35" />
          <span>Live demo</span>
        </Eyebrow>

        <h2 className="hud-shadow mt-9 font-display text-[236px] leading-[0.92] tracking-[-0.025em] whitespace-nowrap text-fg">
          <Mask shown={t(4, 24)} className="text-center">
            Fractal <em className="text-fg-muted">Atlas</em>
          </Mask>
        </h2>

        <Hairline p={t(16, 30)} width={340} from="center" className="mt-10" />
        <p className="hud-shadow mt-8 font-sans text-[20px] font-medium tracking-[0.34em] text-fg/80 uppercase" style={drift(t(20, 32), 0, 12)}>
          Mandelbrot · Julia · L-systems · IFS
        </p>

        <div className="relative mt-12" style={{ width: PILL.width, height: PILL.height, ...drift(t(22, 34), 0, 16) }}>
          <svg className="absolute inset-0 overflow-visible" width={PILL.width} height={PILL.height}>
            <rect
              x="1"
              y="1"
              width={PILL.width - 2}
              height={PILL.height - 2}
              rx={radius}
              fill="rgb(14 14 18 / 0.7)"
              fillOpacity={draw}
              stroke="#d9bf85"
              strokeWidth="2"
              pathLength="1"
              strokeDasharray="1"
              strokeDashoffset={1 - draw}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center gap-4 font-mono text-[30px] text-fg" style={{ opacity: ease.soft(progress(local, 30, 42)) }}>
            fractal-atlas.vercel.app
            <ArrowUpRight className="text-gilt" size={34} strokeWidth={1.6} />
          </div>
        </div>
      </div>

      <p className="absolute inset-x-0 text-center font-mono text-[19px] tracking-[0.12em] text-fg-muted uppercase" style={{ bottom: MARGIN - 8, ...drift(t(34, 46), 0, 10) }}>
        React · TypeScript · WebGL2 · Web Workers
      </p>
    </>
  );
}
