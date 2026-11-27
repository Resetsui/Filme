import { useEffect, useState } from 'react';
import { Ban, Check, Plus, RotateCcw, X } from 'lucide-react';
import type { AppUniverse, AvoidPreferences } from '../types/movie';
import {
  DEFAULT_AVOID_PREFERENCES,
  countActiveAvoids,
  getPresetsForUniverse,
  sanitizeAvoidPreferences,
} from '../utils/exclusions';

interface AvoidPreferencesModalProps {
  open: boolean;
  universe: AppUniverse;
  universeName: string;
  preferences: AvoidPreferences;
  onChange: (next: AvoidPreferences) => void;
  onClose: () => void;
}

export function AvoidPreferencesModal({
  open,
  universe,
  universeName,
  preferences,
  onChange,
  onClose,
}: AvoidPreferencesModalProps) {
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const presets = getPresetsForUniverse(universe);
  const activeCount = countActiveAvoids(preferences);

  const handleTogglePreset = (presetId: string) => {
    const exists = preferences.presets.includes(presetId);
    const nextPresets = exists
      ? preferences.presets.filter((id) => id !== presetId)
      : [...preferences.presets, presetId];
    onChange(
      sanitizeAvoidPreferences({
        presets: nextPresets,
        customNotes: preferences.customNotes,
      }),
    );
  };

  const handleAddCustomNote = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customInput.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 2) return;
    const next = sanitizeAvoidPreferences({
      presets: preferences.presets,
      customNotes: [...preferences.customNotes, cleaned],
    });
    onChange(next);
    setCustomInput('');
  };

  const handleRemoveCustomNote = (note: string) => {
    onChange(
      sanitizeAvoidPreferences({
        presets: preferences.presets,
        customNotes: preferences.customNotes.filter((item) => item !== note),
      }),
    );
  };

  const customPlaceholder =
    universe === 'matine'
      ? 'Ex: filmes indianos, triângulo amoroso, comédia pastelão...'
      : 'Ex: filmes com palhaços, tubarões, cinema indiano...';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="avoid-preferences-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2D1E25]/45 dark:bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-[#DFCBC1] bg-[#FAF3EE] shadow-2xl overflow-hidden dark:border-zinc-800 dark:bg-[#111115]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E5D3CA] px-6 py-5 dark:border-zinc-800">
          <div>
            <h2
              id="avoid-preferences-title"
              className="font-display text-2xl font-semibold text-[#2D1E25] dark:text-zinc-50"
            >
              O que evitar na curadoria
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#6E5660] dark:text-zinc-400">
              Vale para toda a fila do {universeName} e para todas as indicações da IA (manuais e
              automáticas), em qualquer subgênero.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar preferências de bloqueio"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#6E5660] hover:bg-[#EFE2DA] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto space-y-6 p-6">
          {/* Quick Presets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-[#4C3741] dark:text-zinc-300">
                Bloqueios rápidos
              </h3>
              {activeCount > 0 && (
                <span className="font-mono-num text-xs text-[#A62E4F] dark:text-rose-400">
                  {activeCount} {activeCount === 1 ? 'regra ativa' : 'regras ativas'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {presets.map((preset) => {
                const blocked = preferences.presets.includes(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`avoid-preset-${preset.id}`}
                    aria-pressed={blocked}
                    onClick={() => handleTogglePreset(preset.id)}
                    className={`flex min-h-[56px] items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BE3A5E] dark:focus-visible:ring-rose-500 ${
                      blocked
                        ? 'border-[#BE3A5E] bg-[#F7E0E6] text-[#2D1E25] dark:border-rose-500/70 dark:bg-rose-950/35 dark:text-zinc-50'
                        : 'border-[#E1CEC4] bg-[#F4EAE4]/70 text-[#3E2B33] hover:border-[#CBB0A3] hover:bg-[#EFE2DA] dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-200 dark:hover:border-zinc-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        blocked
                          ? 'border-[#BE3A5E] bg-[#BE3A5E] text-white dark:border-rose-500 dark:bg-rose-600'
                          : 'border-[#CBB0A3] bg-transparent text-transparent dark:border-zinc-700'
                      }`}
                    >
                      <Ban className="h-3 w-3" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold leading-snug">
                        {preset.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-[#6E5660] dark:text-zinc-400">
                        {preset.shortDesc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Natural-Language Custom Rules */}
          <div className="space-y-3 border-t border-[#E5D3CA] pt-5 dark:border-zinc-800">
            <div>
              <label
                htmlFor="custom-avoid-input"
                className="block text-xs font-semibold text-[#4C3741] dark:text-zinc-300"
              >
                Outro tipo ou tema que prefere evitar
              </label>
              <p className="mt-0.5 text-[11px] text-[#6E5660] dark:text-zinc-500">
                Escreva naturalmente. A IA e o filtro passam a respeitar isso nas próximas sugestões.
              </p>
            </div>

            <form onSubmit={handleAddCustomNote} className="flex items-center gap-2">
              <input
                id="custom-avoid-input"
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                maxLength={80}
                placeholder={customPlaceholder}
                className="h-11 flex-1 rounded-xl border border-[#DEC9BF] bg-[#F5EAE4] px-3.5 text-sm text-[#2D1E25] placeholder:text-[#8E737D] focus:border-[#BE3A5E]/60 focus:bg-[#FCF8F5] focus:outline-none focus:ring-1 focus:ring-[#BE3A5E] dark:border-zinc-800 dark:bg-[#17171C] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-rose-500"
              />
              <button
                type="submit"
                disabled={customInput.trim().length < 2 || preferences.customNotes.length >= 20}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[#D4BEB3] bg-[#EFE2DA] px-4 text-xs font-semibold text-[#2D1E25] hover:bg-[#E5D3CA] disabled:opacity-45 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 transition-colors whitespace-nowrap"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Adicionar</span>
              </button>
            </form>

            {preferences.customNotes.length > 0 && (
              <ul className="divide-y divide-[#E5D3CA] rounded-xl border border-[#E1CEC4] bg-[#F4EAE4]/60 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-[#16161B]">
                {preferences.customNotes.map((note) => (
                  <li
                    key={note}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs text-[#2D1E25] dark:text-zinc-200"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Ban
                        className="h-3.5 w-3.5 shrink-0 text-[#A62E4F] dark:text-rose-400"
                        aria-hidden="true"
                      />
                      <span className="truncate">{note}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomNote(note)}
                      aria-label={`Remover regra ${note}`}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#6E5660] hover:bg-[#E5D3CA] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[#E5D3CA] px-6 py-4 dark:border-zinc-800">
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={() => onChange(DEFAULT_AVOID_PREFERENCES)}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[#6E5660] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Limpar bloqueios</span>
            </button>
          ) : (
            <span className="text-xs text-[#7D636D] dark:text-zinc-500">
              Nenhum estilo bloqueado
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[#BE3A5E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#A62E4F] dark:bg-rose-600 dark:hover:bg-rose-500 transition-colors whitespace-nowrap"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            <span>Concluir</span>
          </button>
        </div>
      </div>
    </div>
  );
}
