import { Heart, Moon, Sparkles } from 'lucide-react';
import type { AppUniverse } from '../types/movie';

export interface UniverseTransitionState {
  id: number;
  target: AppUniverse;
  originX: number;
  originY: number;
  phase: 'entering' | 'exiting';
  reducedMotion?: boolean;
}

interface UniverseTransitionOverlayProps {
  transition: UniverseTransitionState | null;
}

const SPARKLE_PARTICLES = [
  { x: 12, y: 20, delay: 110, size: 14 },
  { x: 24, y: 70, delay: 170, size: 11 },
  { x: 36, y: 26, delay: 90, size: 16 },
  { x: 46, y: 78, delay: 200, size: 12 },
  { x: 60, y: 22, delay: 130, size: 15 },
  { x: 74, y: 66, delay: 185, size: 13 },
  { x: 86, y: 30, delay: 145, size: 17 },
  { x: 18, y: 46, delay: 220, size: 10 },
  { x: 81, y: 52, delay: 155, size: 11 },
  { x: 52, y: 16, delay: 120, size: 12 },
  { x: 31, y: 83, delay: 210, size: 14 },
  { x: 68, y: 80, delay: 105, size: 13 },
  { x: 15, y: 82, delay: 160, size: 12 },
  { x: 88, y: 76, delay: 190, size: 14 },
];

export function UniverseTransitionOverlay({ transition }: UniverseTransitionOverlayProps) {
  if (!transition) return null;

  const isToMatine = transition.target === 'matine';
  const isExiting = transition.phase === 'exiting';
  const isReduced = Boolean(transition.reducedMotion);

  const diameter =
    typeof window !== 'undefined'
      ? Math.ceil(
          Math.hypot(
            Math.max(transition.originX, window.innerWidth - transition.originX),
            Math.max(transition.originY, window.innerHeight - transition.originY),
          ) * 2.25,
        )
      : 3600;

  return (
    <div
      key={transition.id}
      data-testid="universe-transition-overlay"
      aria-hidden="true"
      className={`universe-transition-overlay pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden transition-opacity duration-[440ms] ease-out ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Expanding circular magical portal wave (100% GPU transform: scale, zero clip-path glitches) */}
      {isReduced ? (
        <div
          className="universe-portal-reduced-in absolute inset-0"
          style={{
            background: isToMatine
              ? 'radial-gradient(circle at 50% 45%, #FFF8F3 0%, #F7DCE3 42%, #F4EAE4 100%)'
              : 'radial-gradient(circle at 50% 45%, #341122 0%, #140B14 45%, #09090B 100%)',
          }}
        />
      ) : (
        <>
          <div
            className="universe-portal-wave absolute rounded-full"
            style={{
              left: `${transition.originX}px`,
              top: `${transition.originY}px`,
              width: `${diameter}px`,
              height: `${diameter}px`,
              background: isToMatine
                ? 'radial-gradient(circle, #FFF9F5 0%, #FADCE5 28%, #F4EAE4 62%, #E8CFC6 100%)'
                : 'radial-gradient(circle, #441228 0%, #1C0C18 32%, #0D0B10 66%, #09090B 100%)',
              boxShadow: isToMatine
                ? '0 0 80px 24px rgba(226, 128, 152, 0.45)'
                : '0 0 80px 24px rgba(225, 29, 72, 0.35)',
            }}
          />

          {/* Shimmering outer portal shockwave ring */}
          <div
            className="universe-portal-ring absolute rounded-full border-2"
            style={{
              left: `${transition.originX}px`,
              top: `${transition.originY}px`,
              width: `${diameter}px`,
              height: `${diameter}px`,
              borderColor: isToMatine ? 'rgba(190, 58, 94, 0.45)' : 'rgba(251, 113, 133, 0.45)',
            }}
          />
        </>
      )}

      {/* Soft celestial ambient halo behind center emblem */}
      <div
        className="absolute h-[440px] w-[440px] rounded-full blur-3xl opacity-85"
        style={{
          background: isToMatine
            ? 'radial-gradient(circle, rgba(226, 128, 152, 0.36) 0%, rgba(246, 206, 178, 0.24) 50%, transparent 75%)'
            : 'radial-gradient(circle, rgba(225, 29, 72, 0.28) 0%, rgba(120, 40, 90, 0.16) 50%, transparent 75%)',
        }}
      />

      {/* Twinkling magical stardust motes */}
      {!isReduced &&
        SPARKLE_PARTICLES.map((p, idx) => (
          <span
            key={idx}
            className={`universe-portal-sparkle absolute ${
              isToMatine ? 'text-[#BE3A5E]/80' : 'text-rose-300/80'
            }`}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              animationDelay: `${p.delay}ms`,
            }}
          >
            <Sparkles style={{ width: p.size, height: p.size }} />
          </span>
        ))}

      {/* Center Magical Crest & Universe Reveal */}
      <div className="universe-portal-crest relative flex flex-col items-center px-6 text-center">
        <div className="relative flex items-center justify-center">
          <span
            className={`universe-portal-orbit absolute h-28 w-28 rounded-full border border-dashed ${
              isToMatine ? 'border-[#BE3A5E]/40' : 'border-rose-400/40'
            }`}
          />
          <div
            className={`flex h-18 w-18 items-center justify-center rounded-2xl border shadow-2xl ${
              isToMatine
                ? 'border-[#E6C5CE] bg-[#FAF3EE]/95 text-[#BE3A5E] shadow-[#BE3A5E]/20'
                : 'border-rose-500/40 bg-[#141418]/95 text-rose-400 shadow-rose-950/70'
            }`}
          >
            {isToMatine ? (
              <Heart className="h-8 w-8 fill-current" />
            ) : (
              <Moon className="h-8 w-8 fill-current" />
            )}
          </div>
        </div>

        <p
          className={`mt-5 font-display text-3xl sm:text-4xl font-semibold tracking-tight ${
            isToMatine ? 'text-[#2D1E25]' : 'text-zinc-50'
          }`}
        >
          {isToMatine ? 'Matinê' : 'Nocturna'}
        </p>
        <p
          className={`mt-1.5 text-xs sm:text-sm font-medium tracking-wide ${
            isToMatine ? 'text-[#6E5660]' : 'text-zinc-400'
          }`}
        >
          {isToMatine ? 'Comédia Romântica & Especiais de Natal' : 'Terror & Thriller'}
        </p>
      </div>
    </div>
  );
}
