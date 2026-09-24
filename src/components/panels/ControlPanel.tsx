import { EyeOff, ImageDown, Link2 } from 'lucide-react';
import { CONTROL_PANEL_ID } from '../../hooks/useResetView';
import { useUiStore, type PanelTab } from '../../store/uiStore';
import { Button, IconButton } from '../controls/Button';
import { SegmentedControl } from '../controls/SegmentedControl';
import { cx } from '../controls/cx';
import { ParametersTab } from './ParametersTab';
import { PresetsTab } from './PresetsTab';

const TABS = [
  { value: 'parameters', label: 'Parameters' },
  { value: 'presets', label: 'Presets' },
] as const;

export function ControlPanel({ hidden }: { hidden: boolean }) {
  const tab = useUiStore((s) => s.panelTab);
  const setTab = useUiStore((s) => s.setPanelTab);
  const toggleInterface = useUiStore((s) => s.toggleInterface);
  const setExportOpen = useUiStore((s) => s.setExportOpen);
  const notify = useUiStore((s) => s.notify);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify('Link copied — it opens this exact view');
    } catch {
      notify('Could not access the clipboard');
    }
  };

  return (
    <aside
      id={CONTROL_PANEL_ID}
      aria-label="Controls"
      aria-hidden={hidden}
      inert={hidden}
      className={cx(
        'glass fixed z-20 flex flex-col overflow-hidden rounded-[18px]',
        'inset-x-3 bottom-3 max-h-[44dvh] md:inset-x-auto md:top-4 md:right-4 md:bottom-4 md:max-h-none md:w-[328px]',
        'transition-[opacity,translate] duration-500 ease-out-expo',
        hidden ? 'pointer-events-none translate-y-3 opacity-0 md:translate-x-4 md:translate-y-0' : 'opacity-100',
      )}
    >
      <header className="flex items-center gap-2 border-b border-line p-3">
        <div className="flex-1">
          <SegmentedControl label="Panel" size="sm" options={TABS} value={tab} onChange={(t: PanelTab) => setTab(t)} />
        </div>
        <IconButton label="Hide interface (H)" onClick={toggleInterface}>
          <EyeOff size={15} strokeWidth={1.6} />
        </IconButton>
      </header>

      <div className="scrollbar-quiet min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {tab === 'parameters' ? <ParametersTab /> : <PresetsTab />}
      </div>

      <footer className="grid grid-cols-2 gap-2 border-t border-line p-3">
        <Button onClick={copyLink} icon={<Link2 size={14} strokeWidth={1.7} />}>
          Share link
        </Button>
        <Button variant="primary" onClick={() => setExportOpen(true)} icon={<ImageDown size={14} strokeWidth={1.7} />} shortcut="E">
          Export
        </Button>
      </footer>
    </aside>
  );
}
