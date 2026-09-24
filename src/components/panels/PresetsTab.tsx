import { Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useViewport } from '../../app/ViewportContext';
import { CURATED } from '../../fractals/curated';
import { FRACTALS } from '../../fractals/registry';
import type { SceneSnapshot } from '../../fractals/types';
import { useThumbnail } from '../../hooks/useThumbnail';
import { usePresetStore } from '../../store/presetStore';
import { selectSnapshot, useSceneStore } from '../../store/sceneStore';
import { useUiStore } from '../../store/uiStore';
import { formatMagnification } from '../../utils/format';
import { Button } from '../controls/Button';
import { Section } from '../controls/Section';

/** Curated thumbnails are rendered once per session on first open. */
const curatedThumbs = new Map<string, string>();

export function PresetsTab() {
  const presets = usePresetStore((s) => s.presets);
  const remove = usePresetStore((s) => s.remove);
  const load = useLoadScene();

  return (
    <>
      <SaveForm />
      <Section title={`Saved · ${presets.length}`}>
        {presets.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-line px-4 py-6 text-center text-[12px] leading-relaxed text-fg-subtle">
            Views you save appear here, stored locally in this browser.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {presets.map((preset) => (
              <li key={preset.id} className="group relative">
                <PresetCard
                  name={preset.name}
                  caption={`${FRACTALS[preset.snapshot.fractal.kind].title.split(' ')[0]} · ${formatMagnification(preset.snapshot.view.zoomLog)} · ${new Date(preset.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  thumbnail={preset.thumbnail}
                  onSelect={() => load(preset.snapshot)}
                />
                <button
                  aria-label={`Delete ${preset.name}`}
                  onClick={() => remove(preset.id)}
                  className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-[7px] bg-black/60 text-fg-muted opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:text-fg focus-visible:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <CuratedSection onSelect={load} />
    </>
  );
}

function SaveForm() {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const add = usePresetStore((s) => s.add);
  const notify = useUiStore((s) => s.notify);
  const thumbnail = useThumbnail();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const snapshot = structuredClone(selectSnapshot(useSceneStore.getState()));
    setSaving(true);
    try {
      add({ name: name.trim() || 'Untitled view', snapshot, thumbnail: await thumbnail(snapshot) });
      setName('');
      notify('View saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Save current view">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this view"
          maxLength={40}
          className="h-9 min-w-0 flex-1 rounded-[10px] border border-line-strong bg-black/25 px-3 text-[12px] text-fg outline-none placeholder:text-fg-subtle focus:border-gilt/50"
        />
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </Section>
  );
}

function CuratedSection({ onSelect }: { onSelect(snapshot: SceneSnapshot): void }) {
  const kind = useSceneStore((s) => s.fractal.kind);
  const views = CURATED[kind];
  const thumbnail = useThumbnail();
  const [thumbs, setThumbs] = useState(() => new Map(curatedThumbs));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const view of views) {
        if (cancelled) return; // switched fractal mid-way; the new effect takes over
        if (curatedThumbs.has(view.id)) continue;
        try {
          curatedThumbs.set(view.id, await thumbnail(view.snapshot));
        } catch {
          return; // renderer not ready yet; the effect re-runs when it is
        }
        if (!cancelled) setThumbs(new Map(curatedThumbs));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [thumbnail, views]);

  return (
    <Section title={`Curated · ${FRACTALS[kind].title.split(' ')[0]}`}>
      <ul className="grid grid-cols-2 gap-3">
        {views.map((view) => (
          <li key={view.id}>
            <PresetCard
              name={view.name}
              caption={formatMagnification(view.snapshot.view.zoomLog)}
              thumbnail={thumbs.get(view.id)}
              onSelect={() => onSelect(view.snapshot)}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function PresetCard({
  name,
  caption,
  thumbnail,
  onSelect,
}: {
  name: string;
  caption: string;
  thumbnail: string | undefined;
  onSelect(): void;
}) {
  return (
    <button onClick={onSelect} className="group/card block w-full text-left">
      <span className="relative block aspect-[16/10] overflow-hidden rounded-[9px] bg-white/[0.03] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="animate-rise size-full object-cover transition-transform duration-700 ease-out-expo group-hover/card:scale-[1.04]"
          />
        ) : (
          <span className="absolute inset-0 animate-pulse bg-white/[0.03]" />
        )}
        <span className="absolute inset-0 rounded-[9px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] transition-shadow group-hover/card:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22)]" />
      </span>
      <span className="mt-2 block truncate text-[12px] text-fg">{name}</span>
      <span className="block font-mono text-[10px] tabular text-fg-subtle">{caption}</span>
    </button>
  );
}

function useLoadScene() {
  const viewport = useViewport();
  const loadSnapshot = useSceneStore((s) => s.loadSnapshot);
  return (snapshot: SceneSnapshot) => {
    viewport?.controller.stop();
    loadSnapshot(snapshot);
  };
}
