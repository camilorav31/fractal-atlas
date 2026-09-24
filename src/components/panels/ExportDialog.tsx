import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useViewport } from '../../app/ViewportContext';
import { FRACTAL_INFO } from '../../fractals/registry';
import { selectSnapshot, useSceneStore } from '../../store/sceneStore';
import { useUiStore } from '../../store/uiStore';
import { downloadCanvas, timestampedName } from '../../utils/download';
import { Button, IconButton } from '../controls/Button';
import { SegmentedControl } from '../controls/SegmentedControl';

type SizeId = 'x2' | 'x4' | '4k' | '8k';
type QualityId = 'draft' | 'fine' | 'ultra';

const SIZES: readonly { value: SizeId; label: string }[] = [
  { value: 'x2', label: 'Screen 2×' },
  { value: 'x4', label: 'Screen 4×' },
  { value: '4k', label: '4K' },
  { value: '8k', label: '8K' },
];

const QUALITIES: readonly { value: QualityId; label: string; samples: number }[] = [
  { value: 'draft', label: 'Draft', samples: 4 },
  { value: 'fine', label: 'Fine', samples: 16 },
  { value: 'ultra', label: 'Ultra', samples: 36 },
];

/** Canvas 2D backing stores top out around 16k per side in most browsers. */
const MAX_EDGE = 16384;

function exportSize(size: SizeId, viewport: { width: number; height: number }) {
  const aspect = viewport.width / viewport.height;
  const dpr = Math.min(window.devicePixelRatio, 2);
  const longEdge = {
    x2: Math.max(viewport.width, viewport.height) * dpr * 2,
    x4: Math.max(viewport.width, viewport.height) * dpr * 4,
    '4k': 3840,
    '8k': 7680,
  }[size];
  const edge = Math.min(MAX_EDGE, Math.round(longEdge));
  return aspect >= 1
    ? { width: edge, height: Math.round(edge / aspect) }
    : { width: Math.round(edge * aspect), height: edge };
}

export function ExportDialog() {
  const open = useUiStore((s) => s.exportOpen);
  const setOpen = useUiStore((s) => s.setExportOpen);
  const notify = useUiStore((s) => s.notify);
  const viewport = useViewport();
  const [size, setSize] = useState<SizeId>('4k');
  const [quality, setQuality] = useState<QualityId>('fine');
  const [progress, setProgress] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Raster fractals are drawn by the worker at the target size: supersampling doesn't apply.
  const raster = useSceneStore((s) => FRACTAL_INFO[s.fractal.kind].family === 'raster');
  const busy = progress !== null;
  const dims = viewport ? exportSize(size, viewport.renderer.viewportSize) : { width: 0, height: 0 };
  const samples = QUALITIES.find((q) => q.value === quality)!.samples;

  const close = () => {
    abortRef.current?.abort();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const render = async () => {
    if (!viewport) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);
    const scene = structuredClone(selectSnapshot(useSceneStore.getState()));
    try {
      const canvas = await viewport.renderer.renderImage(scene, dims.width, dims.height, {
        samples,
        signal: controller.signal,
        onProgress: setProgress,
      });
      await downloadCanvas(canvas, timestampedName(scene.fractal.kind));
      notify(`Exported ${dims.width} × ${dims.height}`);
      setOpen(false);
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(error);
        notify('Export failed — try a smaller size');
      }
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  if (!open) return null;

  const megapixels = (dims.width * dims.height) / 1e6;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={close}>
      <div
        role="dialog"
        aria-modal
        aria-labelledby="export-title"
        onClick={(e) => e.stopPropagation()}
        className="glass animate-rise w-full max-w-[400px] rounded-[20px]"
      >
        <header className="flex items-start justify-between px-6 pt-6">
          <div>
            <p className="eyebrow">Export</p>
            <h2 id="export-title" className="mt-1 font-display text-[30px] leading-none">
              High-resolution still
            </h2>
          </div>
          <IconButton label="Close" onClick={close} className="-mt-1 -mr-2">
            <X size={16} />
          </IconButton>
        </header>

        <div className="space-y-5 px-6 py-6">
          <div>
            <p className="mb-2 text-[12px] text-fg-muted">Size</p>
            <SegmentedControl<SizeId> label="Size" options={SIZES} value={size} onChange={setSize} size="sm" />
          </div>
          {!raster && (
            <div>
              <p className="mb-2 text-[12px] text-fg-muted">Quality</p>
              <SegmentedControl<QualityId> label="Quality" options={QUALITIES} value={quality} onChange={setQuality} size="sm" />
            </div>
          )}
          <dl className="grid grid-cols-3 rounded-[12px] border border-line bg-black/20 font-mono text-[11px] tabular">
            {[
              ['Pixels', `${dims.width}×${dims.height}`],
              ['Megapixels', megapixels.toFixed(1)],
              raster ? ['Renderer', 'Worker'] : ['Samples/px', String(samples)],
            ].map(([k, v]) => (
              <div key={k} className="border-l border-line px-3 py-2.5 first:border-l-0">
                <dt className="text-[9.5px] tracking-[0.14em] text-fg-subtle uppercase">{k}</dt>
                <dd className="mt-1 text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <footer className="border-t border-line p-4">
          {busy ? (
            <div className="flex items-center gap-4 px-2">
              <div className="h-px flex-1 overflow-hidden bg-line-strong">
                <div className="h-full bg-gilt transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
              </div>
              <span className="w-10 text-right font-mono text-[11px] tabular text-fg-muted">
                {Math.round(progress * 100)}%
              </span>
              <Button variant="ghost" onClick={() => abortRef.current?.abort()}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="primary" className="w-full" onClick={render}>
              Render PNG
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
