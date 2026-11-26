import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-16 left-4 z-40 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-[#1A1614]/95 px-3 py-1.5 text-xs font-medium text-amber-200 shadow-lg backdrop-blur-md md:bottom-4"
    >
      <WifiOff className="h-3.5 w-3.5 text-amber-400 shrink-0" aria-hidden="true" />
      <span>Modo offline — exibindo sua lista salva</span>
    </div>
  );
}
