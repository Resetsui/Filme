import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (!showIOSGuide) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowIOSGuide(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showIOSGuide]);

  // Suppress button automatically once running as an installed standalone app
  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          void install();
        }}
        aria-label="Instalar aplicativo na tela inicial"
        title="Instalar app em tela cheia"
        className="inline-flex h-9 md:h-10 items-center gap-1.5 rounded-lg border border-[#DFCBC1] bg-[#FAF3EE] px-2.5 md:px-3 text-xs font-medium text-[#4C3741] hover:border-[#BE3A5E]/60 hover:text-[#2D1E25] dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-200 dark:hover:border-rose-500/60 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5 text-[#BE3A5E] dark:text-rose-400 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">Instalar app</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Como instalar no iPhone ou iPad"
          title="Instalar app no iPhone"
          className="inline-flex h-9 md:h-10 items-center gap-1.5 rounded-lg border border-[#DFCBC1] bg-[#FAF3EE] px-2.5 md:px-3 text-xs font-medium text-[#4C3741] hover:border-[#BE3A5E]/60 hover:text-[#2D1E25] dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-200 dark:hover:border-rose-500/60 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5 text-[#BE3A5E] dark:text-rose-400 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Instalar app</span>
        </button>

        {showIOSGuide &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="ios-install-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
              onClick={() => setShowIOSGuide(false)}
            >
              <div
                className="w-full max-w-sm rounded-2xl border border-[#DFCBC1] bg-[#FAF3EE] p-5 text-[#2D1E25] shadow-2xl dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 id="ios-install-title" className="font-display text-lg font-semibold">
                    Instalar no iPhone / iPad
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowIOSGuide(false)}
                    aria-label="Fechar instruções de instalação"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6E5660] hover:bg-[#EFE2DA] dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-[#6E5660] dark:text-zinc-400">
                  No iPhone, a Apple não permite instalação automática por popup — basta seguir estes 3 passos rápidos:
                </p>

                <ol className="mt-3 space-y-2.5 text-sm leading-relaxed text-[#4C3741] dark:text-zinc-300">
                  <li className="flex items-start gap-2">
                    <span className="font-mono-num font-semibold text-[#BE3A5E] dark:text-rose-400">1.</span>
                    <span>
                      Toque no botão{' '}
                      <strong className="inline-flex items-center gap-1 font-semibold text-[#2D1E25] dark:text-white">
                        Compartilhar <Share className="inline h-3.5 w-3.5" aria-hidden="true" />
                      </strong>{' '}
                      (na barra inferior do Safari ou no topo direito no Chrome).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono-num font-semibold text-[#BE3A5E] dark:text-rose-400">2.</span>
                    <span>
                      Role o menu e toque em{' '}
                      <strong className="font-semibold text-[#2D1E25] dark:text-white">
                        Adicionar à Tela de Início
                      </strong>
                      .
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono-num font-semibold text-[#BE3A5E] dark:text-rose-400">3.</span>
                    <span>
                      Abra pelo novo ícone na tela inicial para usar em tela cheia, sem a barra do navegador.
                    </span>
                  </li>
                </ol>

                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="mt-5 w-full rounded-xl bg-[#BE3A5E] py-2.5 text-sm font-medium text-white hover:bg-[#A62E4F] dark:bg-rose-600 dark:hover:bg-rose-500 transition-colors"
                >
                  Entendi
                </button>
              </div>
            </div>,
            document.body,
          )}
      </>
    );
  }

  return null;
}
