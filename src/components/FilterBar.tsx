import { Ban, ChevronDown, RotateCcw, Search, SlidersHorizontal, Snowflake, X } from 'lucide-react';
import type {
  AppUniverse,
  AudioFilter,
  DecadeFilter,
  FilterState,
  ObscurityFilter,
  Subgenre,
} from '../types/movie';
import { DEFAULT_FILTERS } from '../utils/movieFilters';

interface FilterBarProps {
  universe: AppUniverse;
  filters: FilterState;
  subgenreOptions: Array<{ value: Subgenre | 'all'; label: string }>;
  onChange: (next: FilterState) => void;
  totalMatching: number;
  contextLabel: string;
  activeAvoidCount: number;
  onOpenAvoidPreferences: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const IMDB_OPTIONS = [
  { value: 0, label: 'Qualquer nota' },
  { value: 6.5, label: 'IMDb 6.5+' },
  { value: 7.0, label: 'IMDb 7.0+' },
  { value: 7.5, label: 'IMDb 7.5+' },
  { value: 8.0, label: 'IMDb 8.0+' },
];

const OBSCURITY_OPTIONS: Array<{ value: ObscurityFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'blockbusters', label: 'Blockbusters' },
  { value: 'deep-cuts', label: 'Lado B & Raros' },
  { value: 'classics', label: 'Clássicos & Cult' },
];

const DECADE_OPTIONS: Array<{ value: DecadeFilter; label: string }> = [
  { value: 'all', label: 'Todas as épocas' },
  { value: 'recent', label: 'Recentes' },
  { value: '2020s', label: '2020s' },
  { value: '2010s', label: '2010s' },
  { value: '2000s', label: '2000s' },
  { value: 'classic', label: 'Antes de 2000' },
];

const AUDIO_OPTIONS: Array<{ value: AudioFilter; label: string }> = [
  { value: 'all', label: 'Dublado e legendado' },
  { value: 'dubbed-or-must-see', label: 'Dublado (ou leg. 7.5+)' },
  { value: 'dubbed-only', label: 'Só dublados (PT-BR)' },
];

export function FilterBar({
  universe,
  filters,
  subgenreOptions,
  onChange,
  totalMatching,
  contextLabel,
  activeAvoidCount,
  onOpenAvoidPreferences,
  mobileOpen,
  onCloseMobile,
}: FilterBarProps) {
  const hasActiveFilters =
    filters.subgenre !== 'all' ||
    filters.minImdb > 0 ||
    filters.obscurity !== 'all' ||
    filters.decade !== 'all' ||
    filters.audio !== 'all' ||
    filters.search.trim().length > 0;

  return (
    <section
      aria-label="Filtros do catálogo"
      className={`${
        mobileOpen ? 'block' : 'hidden'
      } md:block border-b border-[#DFCBC1] bg-[#ECE0D8] dark:border-zinc-800/70 dark:bg-[#0D0D10] transition-colors duration-200`}
    >
      <div className="mx-auto max-w-7xl px-4 py-3 md:py-2.5 sm:px-6 lg:px-8 space-y-2.5">
        {/* Mobile sheet header when opened */}
        <div className="flex items-center justify-between gap-3 md:hidden">
          <span className="text-xs font-medium text-[#2D1E25] dark:text-zinc-200">
            Filtros ·{' '}
            <span className="font-mono-num text-[#6E5660] dark:text-zinc-400">
              {totalMatching} {totalMatching === 1 ? 'filme' : 'filmes'}
            </span>
          </span>
          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => onChange(DEFAULT_FILTERS)}
                className="text-xs font-medium text-[#A62E4F] hover:text-[#8E2341] dark:text-rose-400 dark:hover:text-rose-300 whitespace-nowrap"
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Fechar filtros"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#DEC9BF] bg-[#FAF3EE] px-2.5 text-xs font-medium text-[#2D1E25] dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Fechar
            </button>
          </div>
        </div>

        {/* Row 1: Search + Depth + IMDb + Decade + Audio + Avoid + Count */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search input */}
          <div className="relative w-full md:w-44 lg:w-48 shrink-0">
            <label htmlFor="movie-search" className="sr-only">
              Buscar por título, diretor ou país
            </label>
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#846B75] dark:text-zinc-500"
              aria-hidden="true"
            />
            <input
              id="movie-search"
              type="text"
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              placeholder="Título, diretor ou país..."
              className="h-9 w-full rounded-lg border border-[#DEC9BF] bg-[#FAF3EE] pl-8 pr-7 text-xs text-[#2D1E25] placeholder:text-[#8E737D] focus:border-[#BE3A5E]/60 focus:bg-[#FCF8F5] focus:outline-none focus:ring-1 focus:ring-[#BE3A5E] dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:bg-[#141418] dark:focus:ring-rose-500"
            />
            {filters.search && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => onChange({ ...filters, search: '' })}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#6E5660] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Obscurity / Depth Segmented Control */}
          <div
            role="group"
            aria-label="Profundidade do catálogo"
            className="grid grid-cols-2 w-full md:w-auto md:flex md:items-center gap-0.5 md:gap-0 rounded-lg border border-[#DEC9BF] bg-[#E3D3CB] p-0.5 shrink-0 dark:border-zinc-800 dark:bg-[#141418]"
          >
            {OBSCURITY_OPTIONS.map((option) => {
              const active = filters.obscurity === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ ...filters, obscurity: option.value })}
                  className={`min-h-[32px] md:min-h-[30px] rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 text-center ${
                    active
                      ? 'bg-[#2D1E25] text-[#FAF3EE] shadow-xs dark:bg-zinc-100 dark:text-zinc-950'
                      : 'text-[#5C454F] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:text-zinc-100'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {/* IMDb Rating Select */}
          <div className="relative flex items-center shrink-0">
            <label htmlFor="imdb-filter" className="sr-only">
              Nota mínima do IMDb
            </label>
            <select
              id="imdb-filter"
              value={filters.minImdb}
              onChange={(e) => onChange({ ...filters, minImdb: Number(e.target.value) })}
              className="h-9 appearance-none rounded-lg border border-[#DEC9BF] bg-[#FAF3EE] pl-2.5 pr-7 text-xs font-medium text-[#2D1E25] focus:border-[#BE3A5E]/60 focus:outline-none focus:ring-1 focus:ring-[#BE3A5E] dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-200 dark:focus:border-zinc-600 dark:focus:ring-rose-500"
            >
              {IMDB_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-[#6E5660] dark:text-zinc-400"
              aria-hidden="true"
            />
          </div>

          {/* Decade Select */}
          <div className="relative flex items-center shrink-0">
            <label htmlFor="decade-filter" className="sr-only">
              Década de lançamento
            </label>
            <select
              id="decade-filter"
              value={filters.decade}
              onChange={(e) =>
                onChange({ ...filters, decade: e.target.value as DecadeFilter })
              }
              className="h-9 appearance-none rounded-lg border border-[#DEC9BF] bg-[#FAF3EE] pl-2.5 pr-7 text-xs font-medium text-[#2D1E25] focus:border-[#BE3A5E]/60 focus:outline-none focus:ring-1 focus:ring-[#BE3A5E] dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-200 dark:focus:border-zinc-600 dark:focus:ring-rose-500"
            >
              {DECADE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-[#6E5660] dark:text-zinc-400"
              aria-hidden="true"
            />
          </div>

          {/* Audio / Dubbing Select */}
          <div className="relative flex items-center shrink-0">
            <label htmlFor="audio-filter" className="sr-only">
              Preferência de dublagem
            </label>
            <select
              id="audio-filter"
              value={filters.audio}
              onChange={(e) =>
                onChange({ ...filters, audio: e.target.value as AudioFilter })
              }
              className="h-9 appearance-none rounded-lg border border-[#DEC9BF] bg-[#FAF3EE] pl-2.5 pr-7 text-xs font-medium text-[#2D1E25] focus:border-[#BE3A5E]/60 focus:outline-none focus:ring-1 focus:ring-[#BE3A5E] dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-200 dark:focus:border-zinc-600 dark:focus:ring-rose-500"
            >
              {AUDIO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-[#6E5660] dark:text-zinc-400"
              aria-hidden="true"
            />
          </div>

          {/* Natural Curated Exclusions ("Evitar") Trigger */}
          <button
            type="button"
            data-testid="open-avoid-preferences-btn"
            onClick={() => {
              onCloseMobile();
              onOpenAvoidPreferences();
            }}
            aria-label={
              activeAvoidCount > 0
                ? `O que evitar na curadoria (${activeAvoidCount} ativos)`
                : 'Definir o que evitar na curadoria'
            }
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeAvoidCount > 0
                ? 'border-[#BE3A5E]/60 bg-[#F7E0E6] text-[#8E2341] hover:bg-[#F3D2DC] dark:border-rose-500/50 dark:bg-rose-950/35 dark:text-rose-200 dark:hover:bg-rose-950/55'
                : 'border-[#DEC9BF] bg-[#FAF3EE] text-[#4C3741] hover:border-[#CBB0A3] hover:text-[#2D1E25] dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100'
            }`}
          >
            <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{activeAvoidCount > 0 ? `Evitar (${activeAvoidCount})` : 'Evitar'}</span>
          </button>
        </div>

        {/* Row 2: Subgenre horizontal interactive strip + Desktop match count */}
        <div className="flex items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Filtrar por subgênero"
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
          >
            <SlidersHorizontal
              className="mr-1 hidden h-3.5 w-3.5 shrink-0 text-[#846B75] dark:text-zinc-500 md:block"
              aria-hidden="true"
            />
          {subgenreOptions.map((option) => {
            const active = filters.subgenre === option.value;
            const isChristmas = universe === 'matine' && option.value === 'Natal & Fim de Ano';

            if (isChristmas) {
              return (
                <button
                  key={option.value}
                  type="button"
                  data-testid="filter-christmas-romcom"
                  aria-pressed={active}
                  onClick={() =>
                    onChange({
                      ...filters,
                      subgenre: active ? 'all' : 'Natal & Fim de Ano',
                    })
                  }
                  className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-[#246B52] bg-[#246B52] text-white shadow-xs'
                      : 'border-[#B6D4C4] bg-[#DFECE5] text-[#1F5E48] hover:bg-[#D1E5DA]'
                  }`}
                >
                  <Snowflake className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Especial Natal</span>
                </button>
              );
            }

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...filters, subgenre: option.value })}
                className={`min-h-[32px] rounded-md px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#BE3A5E] text-white dark:bg-rose-600'
                    : 'bg-[#FAF3EE] text-[#5C454F] hover:bg-[#F3DFDE] hover:text-[#2D1E25] dark:bg-[#141418] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                }`}
              >
                {option.label}
              </button>
            );
          })}
          </div>

          {/* Match count + clear (Desktop) */}
          <div className="hidden md:flex items-center gap-2.5 text-xs text-[#6E5660] dark:text-zinc-400 shrink-0">
            <span className="font-mono-num whitespace-nowrap">
              {totalMatching} {totalMatching === 1 ? 'filme' : 'filmes'} · {contextLabel}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => onChange(DEFAULT_FILTERS)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#A62E4F] hover:text-[#8E2341] dark:text-rose-400 dark:hover:text-rose-300 transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
