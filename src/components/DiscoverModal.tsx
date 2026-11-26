import { useEffect, useState } from 'react';
import { Loader2, Snowflake, Sparkles, X } from 'lucide-react';
import type { UniverseConfig } from '../config/universes';
import type {
  AudioFilter,
  DecadeFilter,
  FilterState,
  ObscurityFilter,
  Subgenre,
} from '../types/movie';

interface DiscoverModalProps {
  open: boolean;
  universeConfig: UniverseConfig;
  initialFilters: FilterState;
  tasteSummary: {
    seenCount: number;
    likedCount: number;
    dislikedCount: number;
    likedExamples: string[];
    dislikedExamples: string[];
  };
  isLoading: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (params: {
    subgenre: Subgenre | 'all';
    minImdb: number;
    obscurity: ObscurityFilter;
    decade: DecadeFilter;
    audio: AudioFilter;
    mood: string;
  }) => void;
}

const CHRISTMAS_MOOD_PROMPT =
  'Comédia romântica natalina aconchegante com neve, clima de fim de ano e química encantadora';

export function DiscoverModal({
  open,
  universeConfig,
  initialFilters,
  tasteSummary,
  isLoading,
  errorMessage,
  onClose,
  onSubmit,
}: DiscoverModalProps) {
  const [subgenre, setSubgenre] = useState<Subgenre | 'all'>(initialFilters.subgenre);
  const [minImdb, setMinImdb] = useState<number>(Math.max(6.5, initialFilters.minImdb));
  const [obscurity, setObscurity] = useState<ObscurityFilter>(initialFilters.obscurity);
  const [decade, setDecade] = useState<DecadeFilter>(initialFilters.decade);
  const [audio, setAudio] = useState<AudioFilter>(initialFilters.audio);
  const [mood, setMood] = useState('');

  useEffect(() => {
    if (open) {
      setSubgenre(initialFilters.subgenre);
      setMinImdb(initialFilters.minImdb > 0 ? initialFilters.minImdb : 6.5);
      setDecade(initialFilters.decade);
      setAudio(initialFilters.audio);
      setObscurity(initialFilters.obscurity);
      setMood('');
    }
  }, [open, initialFilters, universeConfig.id]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, isLoading, onClose]);

  if (!open) return null;

  const isChristmasMode = universeConfig.id === 'matine' && subgenre === 'Natal & Fim de Ano';

  const handleToggleChristmasMode = () => {
    if (isChristmasMode) {
      setSubgenre('all');
      if (mood === CHRISTMAS_MOOD_PROMPT) setMood('');
    } else {
      setSubgenre('Natal & Fim de Ano');
      setMinImdb(6.0);
      setMood(CHRISTMAS_MOOD_PROMPT);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ subgenre, minImdb, obscurity, decade, audio, mood: mood.trim() });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discover-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D1E25]/45 dark:bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-[#DFCBC1] bg-[#FAF3EE] shadow-2xl overflow-hidden dark:border-zinc-800 dark:bg-[#111115]">
        <div className="flex items-start justify-between gap-4 border-b border-[#E5D3CA] px-6 py-5 dark:border-zinc-800">
          <div>
            <h2
              id="discover-modal-title"
              className="font-display text-2xl font-semibold text-[#2D1E25] dark:text-zinc-50"
            >
              Curadoria IA sob medida
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#6E5660] dark:text-zinc-400">
              {universeConfig.discoverSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Fechar curadoria IA"
            className="rounded-lg p-2 text-[#6E5660] hover:bg-[#EFE2DA] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto space-y-5 p-6">
          {/* Live Taste Profile Context */}
          <div className="rounded-xl border border-[#E3CFC6] bg-[#F1E5DE] px-4 py-3 text-xs text-[#5C454F] space-y-1 dark:border-zinc-800/90 dark:bg-[#0B0B0E] dark:text-zinc-400">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-[#2D1E25] dark:text-zinc-200">
                Memória ativa ({universeConfig.name}):
              </span>
              <span className="font-mono-num">{tasteSummary.seenCount} vistos excluídos</span>
              <span aria-hidden="true" className="text-[#C7B0A6] dark:text-zinc-600">·</span>
              <span className="font-mono-num text-[#1F5E48] dark:text-emerald-400/90">
                {tasteSummary.likedCount} curtidos
              </span>
              <span aria-hidden="true" className="text-[#C7B0A6] dark:text-zinc-600">·</span>
              <span className="font-mono-num text-[#9A581B] dark:text-amber-400/90">
                {tasteSummary.dislikedCount} não curtidos
              </span>
            </div>
            {tasteSummary.likedExamples.length > 0 && (
              <p className="truncate text-[#6E5660] dark:text-zinc-500">
                Puxando referência de: {tasteSummary.likedExamples.slice(0, 3).join(', ')}
              </p>
            )}
            {tasteSummary.dislikedExamples.length > 0 && (
              <p className="truncate text-[#6E5660] dark:text-zinc-500">
                Evitando pegada de: {tasteSummary.dislikedExamples.slice(0, 3).join(', ')}
              </p>
            )}
          </div>

          {/* Personalized Matinê Christmas Rom-Com Quick Toggle */}
          {universeConfig.id === 'matine' && (
            <button
              type="button"
              data-testid="matine-christmas-preset"
              aria-pressed={isChristmasMode}
              onClick={handleToggleChristmasMode}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                isChristmasMode
                  ? 'border-[#246B52] bg-[#246B52] text-white'
                  : 'border-[#B6D4C4] bg-[#DFECE5] text-[#1F5E48] hover:bg-[#D2E4DA]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isChristmasMode ? 'bg-white/15 text-white' : 'bg-[#FAF3EE]/80 text-[#1F5E48]'
                  }`}
                >
                  <Snowflake className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">Especial Comédia Romântica de Natal</p>
                  <p
                    className={`text-[11px] leading-snug ${
                      isChristmasMode ? 'text-[#E1F2EB]' : 'text-[#2D6E57]'
                    }`}
                  >
                    Garimpa só romances natalinos aconchegantes com neve, luzes e clima de fim de ano
                  </p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                  isChristmasMode ? 'bg-white text-[#1F5E48]' : 'bg-[#FAF3EE] text-[#1F5E48]'
                }`}
              >
                {isChristmasMode ? 'Ativo' : 'Ativar'}
              </span>
            </button>
          )}

          {/* Mood / Prompt Input */}
          <div className="space-y-2">
            <label
              htmlFor="ai-mood-input"
              className="block text-xs font-medium text-[#4C3741] dark:text-zinc-300"
            >
              Que clima você quer hoje? (opcional)
            </label>
            <textarea
              id="ai-mood-input"
              rows={2}
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              maxLength={240}
              placeholder={universeConfig.moodPlaceholder}
              className="w-full rounded-xl border border-[#DEC9BF] bg-[#F5EAE4] px-3.5 py-2.5 text-sm text-[#2D1E25] placeholder:text-[#8E737D] focus:border-[#BE3A5E]/60 focus:bg-[#FCF8F5] focus:outline-none focus:ring-1 focus:ring-[#BE3A5E] dark:border-zinc-800 dark:bg-[#17171C] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:bg-[#17171C] dark:focus:ring-rose-500"
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {universeConfig.moodPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMood(preset)}
                  className="rounded-md border border-[#E1CEC4] bg-[#F2E6DF] px-2.5 py-1.5 text-[11px] text-[#5C454F] hover:border-[#CBB0A3] hover:bg-[#EAD9D1] hover:text-[#2D1E25] dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100 transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="ai-subgenre"
                className="block text-xs font-medium text-[#4C3741] dark:text-zinc-300"
              >
                Subgênero
              </label>
              <select
                id="ai-subgenre"
                value={subgenre}
                onChange={(e) => setSubgenre(e.target.value as Subgenre | 'all')}
                className="h-10 w-full rounded-lg border border-[#DEC9BF] bg-[#F5EAE4] px-3 text-sm text-[#2D1E25] focus:border-[#BE3A5E]/60 focus:outline-none focus:ring-1 focus:ring-[#BE3A5E] dark:border-zinc-800 dark:bg-[#17171C] dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-rose-500"
              >
                {universeConfig.subgenreOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="ai-audio"
                className="block text-xs font-medium text-[#4C3741] dark:text-zinc-300"
              >
                Dublagem / Áudio
              </label>
              <select
                id="ai-audio"
                value={audio}
                onChange={(e) => setAudio(e.target.value as AudioFilter)}
                className="h-10 w-full rounded-lg border border-[#DEC9BF] bg-[#F5EAE4] px-3 text-sm text-[#2D1E25] focus:border-[#BE3A5E]/60 focus:outline-none focus:ring-1 focus:ring-[#BE3A5E] dark:border-zinc-800 dark:bg-[#17171C] dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-rose-500"
              >
                <option value="all">Dublado e legendado</option>
                <option value="dubbed-or-must-see">Dublado (ou legendado 7.5+)</option>
                <option value="dubbed-only">Só dublados (PT-BR)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="ai-obscurity"
                className="block text-xs font-medium text-[#4C3741] dark:text-zinc-300"
              >
                Nível de raridade
              </label>
              <select
                id="ai-obscurity"
                value={obscurity}
                onChange={(e) => setObscurity(e.target.value as ObscurityFilter)}
                className="h-10 w-full rounded-lg border border-[#DEC9BF] bg-[#F5EAE4] px-3 text-sm text-[#2D1E25] focus:border-[#BE3A5E]/60 focus:outline-none focus:ring-1 focus:ring-[#BE3A5E] dark:border-zinc-800 dark:bg-[#17171C] dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-rose-500"
              >
                <option value="all">Todos (Sucessos + Raros)</option>
                <option value="blockbusters">Blockbusters & Alto Orçamento</option>
                <option value="deep-cuts">Lado B & Raridades</option>
                <option value="classics">Clássicos & Cult</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="ai-imdb"
                className="block text-xs font-medium text-[#4C3741] dark:text-zinc-300"
              >
                Nota mínima IMDb
              </label>
              <select
                id="ai-imdb"
                value={minImdb}
                onChange={(e) => setMinImdb(Number(e.target.value))}
                className="h-10 w-full rounded-lg border border-[#DEC9BF] bg-[#F5EAE4] px-3 text-sm text-[#2D1E25] focus:border-[#BE3A5E]/60 focus:outline-none focus:ring-1 focus:ring-[#BE3A5E] dark:border-zinc-800 dark:bg-[#17171C] dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-rose-500"
              >
                <option value={6.0}>IMDb 6.0+</option>
                <option value={6.5}>IMDb 6.5+</option>
                <option value={6.8}>IMDb 6.8+</option>
                <option value={7.0}>IMDb 7.0+</option>
                <option value={7.5}>IMDb 7.5+</option>
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="ai-decade"
                className="block text-xs font-medium text-[#4C3741] dark:text-zinc-300"
              >
                Época
              </label>
              <select
                id="ai-decade"
                value={decade}
                onChange={(e) => setDecade(e.target.value as DecadeFilter)}
                className="h-10 w-full rounded-lg border border-[#DEC9BF] bg-[#F5EAE4] px-3 text-sm text-[#2D1E25] focus:border-[#BE3A5E]/60 focus:outline-none focus:ring-1 focus:ring-[#BE3A5E] dark:border-zinc-800 dark:bg-[#17171C] dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-rose-500"
              >
                <option value="all">Todas as épocas</option>
                <option value="recent">Recentes (Lançamentos atuais — busca web ao vivo)</option>
                <option value="2020s">2020s</option>
                <option value="2010s">2010s</option>
                <option value="2000s">2000s</option>
                <option value="classic">Antes de 2000</option>
              </select>
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-[#E1A8B6] bg-[#F6DCE2] px-4 py-3 text-xs text-[#7D1E39] dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200"
            >
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-[#E5D3CA] pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="min-h-[42px] rounded-lg px-4 py-2 text-sm font-medium text-[#6E5660] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#BE3A5E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#A62E4F] dark:bg-rose-600 dark:hover:bg-rose-500 disabled:opacity-60 transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Garimpando filmes...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>Garimpar 10 filmes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
