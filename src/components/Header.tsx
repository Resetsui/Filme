import { useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  Cloud,
  Compass,
  Heart,
  Link2,
  LogOut,
  Moon,
  SlidersHorizontal,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { UNIVERSE_CONFIGS } from '../config/universes';
import type { AppTab, AppUniverse } from '../types/movie';
import { PWAInstallButton } from './PWAInstallButton';

export interface AuthUserInfo {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface HeaderProps {
  universe: AppUniverse;
  onSwitchUniverse: (next: AppUniverse, origin?: { x: number; y: number }) => void;
  onCopyUniverseLink: (target: AppUniverse) => void;
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onOpenDiscover: () => void;
  counts: {
    unwatched: number;
    watchlist: number;
    seen: number;
  };
  user: AuthUserInfo | null;
  syncStatus: 'local' | 'syncing' | 'synced';
  onSignIn: () => void;
  onSignOut: () => void;
  mobileFilterCount: number;
  mobileFiltersOpen: boolean;
  onToggleMobileFilters: () => void;
}

export function Header({
  universe,
  onSwitchUniverse,
  onCopyUniverseLink,
  activeTab,
  onSelectTab,
  onOpenDiscover,
  counts,
  user,
  syncStatus,
  onSignIn,
  onSignOut,
  mobileFilterCount,
  mobileFiltersOpen,
  onToggleMobileFilters,
}: HeaderProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const activeConfig = UNIVERSE_CONFIGS[universe];
  const nextUniverse: AppUniverse = universe === 'nocturna' ? 'matine' : 'nocturna';

  const navItems: Array<{ id: AppTab; label: string; count: number }> = [
    { id: 'discover', label: 'Descobrir', count: counts.unwatched },
    { id: 'watchlist', label: 'Quero ver', count: counts.watchlist },
    { id: 'seen', label: 'Já assisti', count: counts.seen },
  ];

  const userInitial = (user?.displayName || user?.email || 'U').trim().charAt(0).toUpperCase();

  const handleUniverseToggleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAccountMenuOpen(false);
    const rect = event.currentTarget.getBoundingClientRect();
    onSwitchUniverse(nextUniverse, {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    });
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[#DFCBC1] bg-[#F0E3DC]/92 dark:border-zinc-800/80 dark:bg-[#09090B]/92 backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex h-14 md:h-16 max-w-7xl items-center justify-between gap-4 md:gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Top-Left Direct Universe Icon Toggle (Heart <-> Moon) + Brand Wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              data-testid="universe-toggle-button"
              onClick={handleUniverseToggleClick}
              aria-label={
                universe === 'nocturna'
                  ? 'Ir para o Matinê (Comédia Romântica e Especiais de Natal)'
                  : 'Voltar para o Nocturna (Terror e Thriller)'
              }
              title={
                universe === 'nocturna'
                  ? 'Abrir Matinê · Comédia Romântica'
                  : 'Voltar ao Nocturna · Terror & Thriller'
              }
              className={`group inline-flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl border transition-all duration-200 active:scale-95 shrink-0 focus-visible:outline-none focus-visible:ring-2 ${
                universe === 'nocturna'
                  ? 'border-zinc-800 bg-[#141418] text-rose-400 hover:border-rose-500/60 hover:bg-rose-950/40 hover:text-rose-300 focus-visible:ring-rose-500'
                  : 'border-[#DFC6CE] bg-[#FAF3EE] text-[#5B4354] hover:border-[#2D1E25]/40 hover:bg-[#2D1E25] hover:text-[#FAF3EE] focus-visible:ring-[#BE3A5E]'
              }`}
            >
              {universe === 'nocturna' ? (
                <Heart
                  className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 group-hover:fill-rose-400/25"
                  aria-hidden="true"
                />
              ) : (
                <Moon
                  className="h-4 w-4 transition-transform duration-200 group-hover:-rotate-12"
                  aria-hidden="true"
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('discover')}
              className="font-display text-lg md:text-xl font-semibold tracking-tight text-[#2D1E25] hover:text-[#A62E4F] dark:text-zinc-50 dark:hover:text-rose-400 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BE3A5E] dark:focus-visible:ring-rose-500 rounded-sm"
            >
              {activeConfig.name}
            </button>
          </div>

          {/* Zone 2: Clean single-line text navigation links (Desktop) */}
          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-8 text-sm font-medium"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative py-5 transition-colors whitespace-nowrap shrink-0 flex items-baseline gap-2 focus-visible:outline-none focus-visible:text-[#2D1E25] dark:focus-visible:text-white ${
                    isActive
                      ? 'text-[#2D1E25] dark:text-zinc-50'
                      : 'text-[#6E5660] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:text-zinc-100'
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`font-mono-num text-xs ${
                      isActive
                        ? 'text-[#A62E4F] dark:text-rose-400'
                        : 'text-[#8E737D] dark:text-zinc-500'
                    }`}
                  >
                    {item.count}
                  </span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-[2px] bg-[#BE3A5E] dark:bg-rose-600"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Compact Actions (Mobile Filter Toggle + Cloud Sync Account + Curadoria IA) */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Mobile-only on-demand Filter button */}
            <button
              type="button"
              onClick={onToggleMobileFilters}
              aria-expanded={mobileFiltersOpen}
              aria-label="Abrir filtros do catálogo"
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 md:hidden ${
                mobileFiltersOpen || mobileFilterCount > 0
                  ? 'border-[#BE3A5E]/60 bg-[#F6DCE2] text-[#8E2341] dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200'
                  : 'border-[#DFCBC1] bg-[#FAF3EE] text-[#4C3741] hover:text-[#2D1E25] dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-300 dark:hover:text-zinc-100'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Filtros</span>
              {mobileFilterCount > 0 && (
                <span className="font-mono-num text-[11px] text-[#A62E4F] dark:text-rose-300">
                  ({mobileFilterCount})
                </span>
              )}
            </button>

            {/* In-App PWA Install Button (hidden automatically once installed in standalone mode) */}
            <PWAInstallButton />

            {/* Cloud Sync Account Control */}
            <div className="relative">
              {user ? (
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                  aria-expanded={accountMenuOpen}
                  aria-label="Conta sincronizada na nuvem"
                  className="inline-flex h-9 md:h-10 items-center gap-2 rounded-lg border border-[#DFCBC1] bg-[#FAF3EE] px-2.5 md:px-3 text-xs font-medium text-[#4C3741] hover:border-[#CBB0A3] hover:text-[#2D1E25] dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DFECE5] text-[11px] font-semibold text-[#1F5E48] dark:bg-emerald-500/20 dark:text-emerald-300">
                    {userInitial}
                  </span>
                  <span className="hidden sm:inline">
                    {syncStatus === 'syncing' ? 'Sincronizando...' : 'Sincronizado'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSignIn}
                  aria-label="Entrar com Google para sincronizar entre PC e celular"
                  className="inline-flex h-9 md:h-10 items-center gap-1.5 rounded-lg border border-[#DFCBC1] bg-[#FAF3EE] px-2.5 md:px-3 text-xs font-medium text-[#4C3741] hover:border-[#CBB0A3] hover:text-[#2D1E25] dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <Cloud className="h-3.5 w-3.5 text-[#7A616B] dark:text-zinc-400 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">Sincronizar</span>
                </button>
              )}

              {accountMenuOpen && user && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setAccountMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-[#DFCBC1] bg-[#FAF3EE] p-3.5 shadow-2xl dark:border-zinc-800 dark:bg-[#141418]"
                  >
                    <div className="flex items-start gap-2.5 border-b border-[#E6D5CC] pb-3 dark:border-zinc-800/80">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFE2DA] text-xs font-semibold text-[#2D1E25] dark:bg-zinc-800 dark:text-zinc-100">
                        <UserIcon className="h-4 w-4 text-[#1F5E48] dark:text-emerald-400" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#2D1E25] dark:text-zinc-100">
                          {user.displayName || 'Conta Google'}
                        </p>
                        {user.email && (
                          <p className="truncate text-[11px] text-[#6E5660] dark:text-zinc-400">
                            {user.email}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-[#1F5E48] dark:text-emerald-400">
                          {activeConfig.name} sincronizado na nuvem
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onCopyUniverseLink('matine');
                      }}
                      className="mt-2.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#4C3741] hover:bg-[#EFE2DA] hover:text-[#2D1E25] dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
                    >
                      <Link2 className="h-3.5 w-3.5 text-[#BE3A5E] dark:text-rose-400" aria-hidden="true" />
                      Copiar link direto do Matinê
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onSignOut();
                      }}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#4C3741] hover:bg-[#EFE2DA] hover:text-[#2D1E25] dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5 text-[#7A616B] dark:text-zinc-400" aria-hidden="true" />
                      Sair da conta
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Primary CTA: Curadoria IA */}
            <button
              type="button"
              onClick={onOpenDiscover}
              aria-label="Abrir Curadoria IA"
              className="inline-flex h-9 md:h-10 items-center gap-1.5 md:gap-2 rounded-lg bg-[#BE3A5E] px-3 md:px-4 text-xs md:text-sm font-medium text-white hover:bg-[#A62E4F] dark:bg-rose-600 dark:hover:bg-rose-500 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BE3A5E] dark:focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F0E3DC] dark:focus-visible:ring-offset-[#09090B]"
            >
              <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Curadoria IA</span>
              <span className="sm:hidden">IA</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar — compact height (56px) respecting <=15% sticky cap */}
      <nav
        aria-label="Navegação móvel"
        className="fixed bottom-0 left-0 right-0 z-30 grid min-h-[3.5rem] grid-cols-3 border-t border-[#DFCBC1] bg-[#F0E3DC]/95 pb-[env(safe-area-inset-bottom)] dark:border-zinc-800/90 dark:bg-[#09090B]/95 backdrop-blur-md md:hidden transition-colors duration-200"
      >
        <button
          type="button"
          onClick={() => onSelectTab('discover')}
          aria-current={activeTab === 'discover' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
            activeTab === 'discover'
              ? 'text-[#A62E4F] dark:text-rose-500'
              : 'text-[#6E5660] dark:text-zinc-400'
          }`}
        >
          <Compass className="h-5 w-5" aria-hidden="true" />
          <span className="whitespace-nowrap">Descobrir</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('watchlist')}
          aria-current={activeTab === 'watchlist' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
            activeTab === 'watchlist'
              ? 'text-[#A62E4F] dark:text-rose-500'
              : 'text-[#6E5660] dark:text-zinc-400'
          }`}
        >
          <Bookmark className="h-5 w-5" aria-hidden="true" />
          <span className="whitespace-nowrap">Quero ver ({counts.watchlist})</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('seen')}
          aria-current={activeTab === 'seen' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
            activeTab === 'seen'
              ? 'text-[#A62E4F] dark:text-rose-500'
              : 'text-[#6E5660] dark:text-zinc-400'
          }`}
        >
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          <span className="whitespace-nowrap">Já assisti ({counts.seen})</span>
        </button>
      </nav>
    </>
  );
}
