import { useEffect, useState } from 'react';
import { Check, FileUp, ListChecks, X } from 'lucide-react';
import type { Movie, UserMovieEntry } from '../types/movie';
import { parseImportedTitles } from '../utils/movieFilters';

interface BatchSeenModalProps {
  open: boolean;
  importPlaceholder: string;
  movies: Movie[];
  entries: Record<string, UserMovieEntry>;
  customSeenCount: number;
  onClose: () => void;
  onConfirmCatalogIds: (movieIds: string[]) => void;
  onImportExternalList: (titles: string[]) => void;
}

export function BatchSeenModal({
  open,
  importPlaceholder,
  movies,
  entries,
  customSeenCount,
  onClose,
  onConfirmCatalogIds,
  onImportExternalList,
}: BatchSeenModalProps) {
  const candidates = movies.filter(
    (m) =>
      (m.obscurity === 'Clássico' || m.obscurity === 'Cult' || m.obscurity === 'Blockbuster') &&
      entries[m.id]?.status !== 'seen',
  );

  const [tab, setTab] = useState<'classics' | 'import'>('classics');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rawList, setRawList] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedIds([]);
      setRawList('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const parsedExternal = parseImportedTitles(rawList);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    setSelectedIds(candidates.map((m) => m.id));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRawList(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-seen-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D1E25]/45 dark:bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-[#DFCBC1] bg-[#FAF3EE] shadow-2xl overflow-hidden dark:border-zinc-800 dark:bg-[#111115]">
        <div className="flex items-start justify-between gap-4 border-b border-[#E5D3CA] px-6 py-5 dark:border-zinc-800">
          <div>
            <h2
              id="batch-seen-title"
              className="font-display text-2xl font-semibold text-[#2D1E25] dark:text-zinc-50"
            >
              Registrar bagagem de filmes vistos
            </h2>
            <p className="mt-1 text-xs text-[#6E5660] dark:text-zinc-400">
              Quanto mais filmes você registrar, mais preciso o garimpo fica sem jamais repetir o
              que você já assistiu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar registro de bagagem"
            className="rounded-lg p-2 text-[#6E5660] hover:bg-[#EFE2DA] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex border-b border-[#E5D3CA] bg-[#F1E5DE] px-6 pt-3 gap-6 text-xs font-medium dark:border-zinc-800 dark:bg-[#0D0D11]">
          <button
            type="button"
            onClick={() => setTab('classics')}
            className={`relative pb-3 inline-flex items-center gap-2 transition-colors ${
              tab === 'classics'
                ? 'text-[#2D1E25] dark:text-zinc-50'
                : 'text-[#6E5660] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <ListChecks className="h-4 w-4" aria-hidden="true" />
            <span>Clássicos e sucessos ({candidates.length})</span>
            {tab === 'classics' && (
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#BE3A5E] dark:bg-rose-600" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setTab('import')}
            className={`relative pb-3 inline-flex items-center gap-2 transition-colors ${
              tab === 'import'
                ? 'text-[#2D1E25] dark:text-zinc-50'
                : 'text-[#6E5660] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <FileUp className="h-4 w-4" aria-hidden="true" />
            <span>
              Colar lista grande / CSV {customSeenCount > 0 ? `(${customSeenCount} salvos)` : ''}
            </span>
            {tab === 'import' && (
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#BE3A5E] dark:bg-rose-600" />
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'classics' ? (
            candidates.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#6E5660] dark:text-zinc-400">
                Você já marcou todos os clássicos e sucessos do catálogo inicial! Use a aba &ldquo;Colar
                lista grande / CSV&rdquo; para importar seu histórico completo.
              </p>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between text-xs">
                  <span className="font-mono-num text-[#6E5660] dark:text-zinc-400">
                    {selectedIds.length} selecionados de {candidates.length}
                  </span>
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-[#A62E4F] hover:text-[#8E2341] dark:text-rose-400 dark:hover:text-rose-300 font-medium"
                  >
                    Selecionar todos
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {candidates.map((movie) => {
                    const checked = selectedIds.includes(movie.id);
                    return (
                      <button
                        key={movie.id}
                        type="button"
                        aria-pressed={checked}
                        onClick={() => toggle(movie.id)}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                          checked
                            ? 'border-[#BE3A5E] bg-[#F6DCE2] text-[#2D1E25] dark:border-rose-500/70 dark:bg-rose-950/30 dark:text-zinc-50'
                            : 'border-[#E1CEC4] bg-[#F3E8E1] text-[#3E2B33] hover:border-[#CBB0A3] dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-300 dark:hover:border-zinc-600'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{movie.title}</p>
                          <p className="font-mono-num text-[11px] text-[#6E5660] dark:text-zinc-500">
                            {movie.year} · IMDb {movie.imdbRating.toFixed(1)} · {movie.subgenre}
                          </p>
                        </div>
                        <span
                          aria-hidden="true"
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            checked
                              ? 'border-[#BE3A5E] bg-[#BE3A5E] text-white dark:border-rose-600 dark:bg-rose-600'
                              : 'border-[#CBB0A3] bg-[#FAF3EE] dark:border-zinc-700 dark:bg-transparent'
                          }`}
                        >
                          {checked && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="bulk-seen-textarea"
                  className="text-xs font-medium text-[#4C3741] dark:text-zinc-300"
                >
                  Cole seus filmes já assistidos (um por linha) ou carregue CSV do Letterboxd / IMDb
                </label>
                <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[#D4BEB3] bg-[#F1E5DE] px-3 py-1.5 text-xs font-medium text-[#2D1E25] hover:bg-[#E8D8CF] dark:border-zinc-700 dark:bg-[#17171C] dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                  <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Carregar .csv / .txt</span>
                  <input
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>

              <textarea
                id="bulk-seen-textarea"
                rows={9}
                value={rawList}
                onChange={(e) => setRawList(e.target.value)}
                placeholder={importPlaceholder}
                className="w-full rounded-xl border border-[#DEC9BF] bg-[#F5EAE4] p-3.5 font-mono-num text-xs leading-relaxed text-[#2D1E25] placeholder:text-[#8E737D] focus:border-[#BE3A5E]/60 focus:bg-[#FCF8F5] focus:outline-none focus:ring-1 focus:ring-[#BE3A5E] dark:border-zinc-800 dark:bg-[#17171C] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:bg-[#17171C] dark:focus:ring-rose-500"
              />

              <p className="text-xs text-[#6E5660] dark:text-zinc-400">
                <span className="font-mono-num font-semibold text-[#2D1E25] dark:text-zinc-200">
                  {parsedExternal.length}
                </span>{' '}
                {parsedExternal.length === 1 ? 'título detectado' : 'títulos detectados'}. Todos
                serão automaticamente bloqueados no garimpo infinito e na Curadoria IA.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#E5D3CA] px-6 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-lg px-4 py-2 text-sm text-[#6E5660] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Cancelar
          </button>

          {tab === 'classics' ? (
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => {
                onConfirmCatalogIds(selectedIds);
                onClose();
              }}
              className="min-h-[40px] rounded-lg bg-[#BE3A5E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#A62E4F] dark:bg-rose-600 dark:hover:bg-rose-500 disabled:opacity-40 transition-colors"
            >
              Marcar {selectedIds.length > 0 ? `(${selectedIds.length})` : ''} como assistidos
            </button>
          ) : (
            <button
              type="button"
              disabled={parsedExternal.length === 0}
              onClick={() => {
                onImportExternalList(parsedExternal);
                onClose();
              }}
              className="min-h-[40px] rounded-lg bg-[#BE3A5E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#A62E4F] dark:bg-rose-600 dark:hover:bg-rose-500 disabled:opacity-40 transition-colors"
            >
              Adicionar {parsedExternal.length > 0 ? `(${parsedExternal.length})` : ''} à minha
              bagagem
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
