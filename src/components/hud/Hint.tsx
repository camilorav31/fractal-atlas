import { useEffect, useState } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { Kbd } from '../controls/Button';
import { cx } from '../controls/cx';

/** First-run gesture hint; fades after the first zoom or pan, or after 7 s. */
export function Hint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hide = () => setVisible(false);
    const timer = window.setTimeout(hide, 7000);
    const unsubscribe = useSceneStore.subscribe((s, prev) => s.view !== prev.view && hide());
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return (
    <div
      className={cx(
        'pointer-events-none flex items-center gap-4 rounded-full border border-line bg-black/35 px-4 py-2 text-[11px] text-fg-muted backdrop-blur-xl',
        'transition-all duration-700 ease-out-expo',
        visible ? 'opacity-100' : 'translate-y-2 opacity-0',
      )}
    >
      <span>Scroll to zoom</span>
      <Dot />
      <span>Drag to pan</span>
      <Dot />
      <span>Double-click to dive</span>
      <Dot />
      <span className="flex items-center gap-1.5">
        <Kbd>H</Kbd> hide UI
      </span>
    </div>
  );
}

const Dot = () => <span className="size-[3px] rounded-full bg-fg-subtle/60" />;
