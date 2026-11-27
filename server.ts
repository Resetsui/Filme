import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { runWithModelFallback } from './src/utils/aiRetry.ts';
import {
  buildAvoidPromptDirectives,
  isExplorationAngleCompatible,
  isMovieBlockedByPreferences,
  sanitizeAvoidPreferences,
} from './src/utils/exclusions.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const ALLOWED_IMAGE_HOSTS = new Set([
  'is1-ssl.mzstatic.com',
  'is2-ssl.mzstatic.com',
  'is3-ssl.mzstatic.com',
  'is4-ssl.mzstatic.com',
  'is5-ssl.mzstatic.com',
  'upload.wikimedia.org',
  'm.media-amazon.com',
  'image.tmdb.org',
]);

interface PosterCacheEntry {
  remoteUrl: string | null;
  source: string;
  fetchedAt: number;
}

const posterCache = new Map<string, PosterCacheEntry>();
const POSTER_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function isSafeAllowedImageUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_IMAGE_HOSTS.has(host)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeTitleForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 4500,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'NocturnaCinemaCatalog/1.0 (https://localhost)',
        ...(options.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function stripEditionSuffix(raw: string): string {
  return raw
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*\[[^\]]*\]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDirectorTokens(director?: string): string[] {
  if (!director) return [];
  const norm = normalizeTitleForMatch(director);
  if (!norm) return [];
  const parts = norm.split(' ').filter((token) => token.length >= 3);
  if (parts.length === 0) return [];
  const last = parts[parts.length - 1];
  const longTokens = parts.filter((token) => token.length >= 4);
  return Array.from(new Set([last, ...longTokens]));
}

function doesDirectorMatch(artistName: string | undefined, directorTokens: string[]): boolean {
  if (!artistName || directorTokens.length === 0) return false;
  const artistNorm = normalizeTitleForMatch(artistName);
  if (!artistNorm) return false;
  const artistWords = new Set(artistNorm.split(' '));
  return directorTokens.some((token) => artistWords.has(token) || (token.length >= 5 && artistNorm.includes(token)));
}

function scoreTitleMatch(rawTrackName: string, targetNorm: string): number {
  const cleanedTrack = stripEditionSuffix(rawTrackName);
  const itemNorm = normalizeTitleForMatch(cleanedTrack);
  const fullItemNorm = normalizeTitleForMatch(rawTrackName);

  if (!itemNorm || !targetNorm) return -20;
  if (itemNorm === targetNorm || fullItemNorm === targetNorm) return 14;

  // Reject partial matches for short titles ("It", "Us", "REC", "Cure", "Raw") to prevent unrelated hits
  if (targetNorm.length <= 5) {
    if (cleanedTrack.includes(':')) {
      const beforeColon = normalizeTitleForMatch(cleanedTrack.split(':')[0]);
      if (beforeColon === targetNorm) return 11;
    }
    return -10;
  }

  // Allow exact subtitle extensions like "Title: Subtitle" or "Title - Subtitle"
  if (cleanedTrack.includes(':') || cleanedTrack.includes(' - ')) {
    const basePart = normalizeTitleForMatch(cleanedTrack.split(/:|\s-\s/)[0]);
    if (basePart === targetNorm) return 11;
  }

  // Strip leading English/Portuguese articles for multi-word title comparison
  const stripArticle = (s: string) => s.replace(/^(the|a|an|o|os|as|um|uma)\s+/, '');
  const itemNoArt = stripArticle(itemNorm);
  const targetNoArt = stripArticle(targetNorm);
  if (targetNoArt.length >= 5 && itemNoArt === targetNoArt) return 12;

  // Strict high-overlap word matching for longer titles (>= 2 words)
  const targetWords = targetNoArt.split(' ').filter((w) => w.length >= 2);
  const itemWords = itemNoArt.split(' ').filter((w) => w.length >= 2);
  if (targetWords.length >= 2 && itemWords.length >= 2) {
    const itemSet = new Set(itemWords);
    const targetSet = new Set(targetWords);
    const matchedTarget = targetWords.filter((w) => itemSet.has(w)).length;
    const matchedItem = itemWords.filter((w) => targetSet.has(w)).length;
    const recall = matchedTarget / targetWords.length;
    const precision = matchedItem / itemWords.length;
    if (recall >= 0.85 && precision >= 0.75) {
      return 9;
    }
  }

  return -10;
}

let itunesBlockedUntil = 0;

async function queryImdbSuggestion(
  searchTerm: string,
  targetNorm: string,
  year?: number,
): Promise<{ url: string; score: number } | null> {
  const cleanedTerm = searchTerm.replace(/\s+/g, ' ').trim();
  if (!cleanedTerm) return null;

  const endpoint = `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(cleanedTerm)}.json`;
  const res = await fetchWithTimeout(
    endpoint,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    },
    4500,
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    d?: Array<{
      id?: string;
      l?: string;
      q?: string;
      qid?: string;
      y?: number;
      s?: string;
      i?: { imageUrl?: string; width?: number; height?: number };
    }>;
  };
  const items = Array.isArray(data.d) ? data.d : [];
  if (items.length === 0) return null;

  let bestScore = -1;
  let bestUrl: string | null = null;

  for (const item of items) {
    if (!item.l || !item.i?.imageUrl) continue;
    // Strictly accept feature films & TV movies only (never actors, series, games, shorts)
    const isMovie =
      item.qid === 'movie' ||
      item.qid === 'tvMovie' ||
      item.q === 'feature' ||
      item.q === 'TV movie';
    if (!isMovie) continue;

    // Enforce portrait theatrical poster dimensions (reject landscape stills)
    if (item.i.width && item.i.height) {
      const aspectRatio = item.i.height / item.i.width;
      if (aspectRatio < 1.15 || aspectRatio > 2.05) continue;
    }

    const titleScore = scoreTitleMatch(item.l, targetNorm);
    if (titleScore < 0) continue;

    let yearScore = 0;
    if (year && typeof item.y === 'number' && Number.isFinite(item.y)) {
      const diff = Math.abs(item.y - year);
      if (diff > 2) continue;
      if (diff === 2) {
        if (titleScore < 12) continue;
        yearScore = 3;
      } else if (diff === 1) {
        yearScore = 6;
      } else {
        yearScore = 10;
      }
    } else if (year) {
      // No release year on candidate — only allow exact title matches
      if (titleScore < 14) continue;
    }

    const totalScore = titleScore + yearScore;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestUrl = item.i.imageUrl;
    }
  }

  if (bestScore < 16 || !bestUrl) return null;

  // Resize Amazon CDN master poster to fast, crisp 600px theatrical JPEG (~30-60KB instead of 5MB raw)
  const optimizedUrl = bestUrl.replace(/\._V1_.*(\.[a-z]+)$/i, '._V1_QL80_UX600_$1');
  if (!isSafeAllowedImageUrl(optimizedUrl)) return null;

  return { url: optimizedUrl, score: bestScore };
}

async function lookupImdbPoster(query: string, year?: number): Promise<string | null> {
  const targetNorm = normalizeTitleForMatch(query);
  if (!targetNorm) return null;

  if (year) {
    const withYear = await queryImdbSuggestion(`${query} ${year}`, targetNorm, year);
    if (withYear && withYear.score >= 20) {
      return withYear.url;
    }
    const bare = await queryImdbSuggestion(query, targetNorm, year);
    if (bare && (!withYear || bare.score > withYear.score)) {
      return bare.url;
    }
    return withYear?.url ?? null;
  }

  const bare = await queryImdbSuggestion(query, targetNorm, undefined);
  return bare?.url ?? null;
}

async function lookupItunesPoster(
  query: string,
  year?: number,
  director?: string,
  country: 'US' | 'BR' = 'US',
  appendYearInTerm = false,
): Promise<string | null> {
  if (Date.now() < itunesBlockedUntil) return null;

  const searchTerm = appendYearInTerm && year ? `${query} ${year}` : query;
  const endpoint = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&media=movie&entity=movie&country=${country}&limit=15`;
  const res = await fetchWithTimeout(endpoint, {}, 4000);
  if (res.status === 403 || res.status === 429) {
    itunesBlockedUntil = Date.now() + 1000 * 60 * 5;
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json()) as {
    results?: Array<{
      trackName?: string;
      artistName?: string;
      releaseDate?: string;
      artworkUrl100?: string;
    }>;
  };
  const results = Array.isArray(data.results) ? data.results : [];
  if (results.length === 0) return null;

  const targetNorm = normalizeTitleForMatch(query);
  const directorTokens = getDirectorTokens(director);

  let bestScore = -1;
  let bestArtwork: string | null = null;

  for (const item of results) {
    if (!item.artworkUrl100 || !item.trackName) continue;
    const releaseYear = item.releaseDate ? Number(item.releaseDate.slice(0, 4)) : undefined;
    const directorMatches = doesDirectorMatch(item.artistName, directorTokens);

    // Hard year gate prevents wrong-decade remakes & homonyms (e.g. Possession 1981 vs 2012, Speak No Evil 2022 vs 2024)
    let yearScore = 0;
    if (year && releaseYear && Number.isFinite(releaseYear)) {
      const diff = Math.abs(releaseYear - year);
      if (diff > 2) {
        continue;
      }
      if (diff === 2) {
        // Only accept 2-year festival-vs-VOD drift when the director strictly matches
        if (!directorMatches) continue;
        yearScore = 3;
      } else if (diff === 1) {
        yearScore = 5;
      } else {
        yearScore = 8;
      }
    }

    const titleScore = scoreTitleMatch(item.trackName, targetNorm);
    if (titleScore < 0) continue;

    let score = titleScore + yearScore;

    if (directorTokens.length > 0 && item.artistName) {
      if (directorMatches) {
        score += 10;
      } else {
        // Penalize director mismatch so homonyms in adjacent years never beat the real film
        score -= targetNorm.length <= 6 ? 8 : 5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestArtwork = item.artworkUrl100;
    }
  }

  // Require high confidence (e.g., exact title + matching year, or strong title + matching director)
  if (bestScore < 14 || !bestArtwork) return null;

  // Upgrade iTunes artwork from 100x100 to crisp 600x900 theatrical ratio
  const highRes = bestArtwork.replace(/\/\d+x\d+bb\./i, '/600x900bb.');
  return isSafeAllowedImageUrl(highRes) ? highRes : null;
}

async function lookupWikipediaPoster(
  query: string,
  year?: number,
  director?: string,
): Promise<{ url: string | null; rateLimited: boolean }> {
  const candidates = year
    ? [`${query} (${year} film)`, `${query} (film)`, query]
    : [`${query} (film)`, query];
  const directorTokens = getDirectorTokens(director);
  let rateLimited = false;

  for (const title of candidates) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        title.replace(/\s+/g, '_'),
      )}`;
      const res = await fetchWithTimeout(url, {}, 3500);
      if (res.status === 429) {
        rateLimited = true;
        break;
      }
      if (!res.ok) continue;
      const data = (await res.json()) as {
        type?: string;
        title?: string;
        description?: string;
        extract?: string;
        thumbnail?: { source?: string; width?: number; height?: number };
        originalimage?: { source?: string; width?: number; height?: number };
      };
      if (data.type === 'disambiguation') continue;

      const textBlob = `${data.description ?? ''} ${data.extract ?? ''}`.toLowerCase();
      const normText = normalizeTitleForMatch(textBlob);

      if (!textBlob.includes('film') && !textBlob.includes('movie')) {
        continue;
      }

      if (year) {
        const yearMatches =
          textBlob.includes(String(year)) ||
          textBlob.includes(String(year - 1)) ||
          textBlob.includes(String(year + 1));
        const dirMatches =
          directorTokens.length > 0 &&
          directorTokens.some((tok) => tok.length >= 4 && normText.includes(tok));
        if (!yearMatches && !dirMatches) {
          continue;
        }
      }

      const imgObj = data.originalimage ?? data.thumbnail;
      const img = imgObj?.source;
      if (!img || !isSafeAllowedImageUrl(img)) continue;

      // Reject non-poster SVGs, logos, or landscape stills / actor headshots
      const lowerUrl = img.toLowerCase();
      if (lowerUrl.endsWith('.svg') || lowerUrl.includes('logo') || lowerUrl.includes('icon')) {
        continue;
      }
      if (imgObj?.width && imgObj?.height) {
        const aspectRatio = imgObj.height / imgObj.width;
        // Theatrical movie posters are strictly portrait (~1.25 to 1.85 height/width)
        if (aspectRatio < 1.18 || aspectRatio > 2.0) {
          continue;
        }
      }

      // Strip tracking query params from Wikimedia URLs for clean caching
      const cleanUrl = img.split('?')[0];
      return { url: isSafeAllowedImageUrl(cleanUrl) ? cleanUrl : img, rateLimited: false };
    } catch {
      // Try next candidate
    }
  }
  return { url: null, rateLimited };
}

const POSTER_MISS_CACHE_TTL_MS = 1000 * 60 * 2; // 2 minutes for misses

async function resolvePoster(
  primaryTitle: string,
  secondaryTitle: string,
  localizedTitle: string,
  year?: number,
  director?: string,
): Promise<{ remoteUrl: string | null; source: string }> {
  const cacheKey = `${normalizeTitleForMatch(primaryTitle || secondaryTitle || localizedTitle)}::${year ?? ''}::${normalizeTitleForMatch(director ?? '')}`;
  const cached = posterCache.get(cacheKey);
  if (cached) {
    const ttl = cached.remoteUrl ? POSTER_CACHE_TTL_MS : POSTER_MISS_CACHE_TTL_MS;
    if (Date.now() - cached.fetchedAt < ttl) {
      return { remoteUrl: cached.remoteUrl, source: cached.source };
    }
  }

  let remoteUrl: string | null = null;
  let source = 'fallback';
  let wasRateLimited = false;

  const uniqueTitles = Array.from(
    new Set(
      [primaryTitle, secondaryTitle, localizedTitle]
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  );

  // 1. Primary: Official IMDb Movie Posters (m.media-amazon.com — crisp, fast, zero rate-limiting)
  for (const term of uniqueTitles) {
    if (remoteUrl) break;
    try {
      remoteUrl = await lookupImdbPoster(term, year);
      if (remoteUrl) {
        source = 'imdb';
        break;
      }
    } catch {
      // Fall through to secondary providers
    }
  }

  // 2. Secondary: US iTunes with primary/secondary English titles (exact & year-boosted)
  if (!remoteUrl && Date.now() >= itunesBlockedUntil) {
    for (const term of uniqueTitles.slice(0, 2)) {
      if (remoteUrl || Date.now() < itunesBlockedUntil) break;
      try {
        remoteUrl = await lookupItunesPoster(term, year, director, 'US', false);
        if (remoteUrl) {
          source = 'itunes-us';
          break;
        }
        if (year && Date.now() >= itunesBlockedUntil) {
          remoteUrl = await lookupItunesPoster(term, year, director, 'US', true);
          if (remoteUrl) {
            source = 'itunes-us-year';
            break;
          }
        }
      } catch {
        // Ignore transient upstream error
      }
    }
  }

  // 3. Secondary: Brazil iTunes store
  if (!remoteUrl && Date.now() >= itunesBlockedUntil) {
    for (const term of uniqueTitles) {
      if (Date.now() < itunesBlockedUntil) break;
      try {
        remoteUrl = await lookupItunesPoster(term, year, director, 'BR', false);
        if (remoteUrl) {
          source = 'itunes-br';
          break;
        }
      } catch {
        // Ignore
      }
    }
  }

  // 4. Tertiary: Strict Wikipedia portrait theatrical poster verification
  if (!remoteUrl) {
    for (const term of uniqueTitles.slice(0, 2)) {
      try {
        const wikiResult = await lookupWikipediaPoster(term, year, director);
        if (wikiResult.rateLimited) {
          wasRateLimited = true;
          break;
        }
        if (wikiResult.url) {
          remoteUrl = wikiResult.url;
          source = 'wikipedia';
          break;
        }
      } catch {
        // Ignore
      }
    }
  }

  if (!wasRateLimited) {
    posterCache.set(cacheKey, {
      remoteUrl,
      source,
      fetchedAt: Date.now(),
    });
  }

  return { remoteUrl, source };
}

type AppUniverse = 'nocturna' | 'matine';

const VALID_HORROR_SUBGENRES = new Set([
  'Psicológico',
  'Sobrenatural',
  'Folk & Culto',
  'Thriller Noir',
  'Cósmico & Sci-Fi',
  'Found Footage',
  'Slasher & Sobrevivência',
  'Internacional',
]);

const VALID_ROMCOM_SUBGENRES = new Set([
  'Natal & Fim de Ano',
  'Clássico Romântico',
  'Inimigos a Amantes',
  'Falso Namoro',
  'Amigos a Amantes',
  'Segunda Chance',
  'Viagem & Destino',
  'Drama Romântico',
  'Internacional Rom-Com',
]);

const VALID_OBSCURITY = new Set(['Blockbuster', 'Clássico', 'Cult', 'Lado B', 'Raridade']);

function extractJsonArrayFromText(rawText: string): Array<Record<string, unknown>> | null {
  const trimmed = rawText.trim();
  const candidates: string[] = [trimmed];

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }

  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(trimmed.slice(firstBracket, lastBracket + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        return parsed as Array<Record<string, unknown>>;
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
}

function sanitizeMovieItems(
  parsed: Array<Record<string, unknown>>,
  options: {
    universe: AppUniverse;
    audioPreference: 'all' | 'dubbed-only' | 'dubbed-or-must-see';
    normalizedExcludeSet: Set<string>;
    minYear?: number;
    idPrefix?: string;
  },
) {
  const seenInBatch = new Set<string>();
  const currentYear = new Date().getFullYear();
  const minYear = options.minYear ?? 1920;
  const prefix = options.idPrefix ?? (options.universe === 'matine' ? 'rom-ai' : 'ai');
  const validSubgenres =
    options.universe === 'matine' ? VALID_ROMCOM_SUBGENRES : VALID_HORROR_SUBGENRES;
  const defaultSubgenre =
    options.universe === 'matine' ? 'Clássico Romântico' : 'Psicológico';

  return parsed
    .slice(0, 14)
    .map((item) => {
      const title = String(item.title ?? '').trim().slice(0, 180);
      const originalTitle = String(item.originalTitle ?? title).trim().slice(0, 180);
      const searchTitle = item.searchTitle
        ? String(item.searchTitle).trim().slice(0, 180)
        : undefined;
      const year = Math.round(Number(item.year));
      const imdbRating = Number(item.imdbRating);
      const runtimeMinutes = Number(item.runtimeMinutes) || 98;
      const rawSubgenre = String(item.subgenre ?? defaultSubgenre);
      const rawObscurity = String(item.obscurity ?? 'Lado B');
      const hasPtBrDub = Boolean(item.hasPtBrDub);

      if (!title || !Number.isFinite(year) || year < minYear || year > currentYear + 1) {
        return null;
      }

      const clampedImdb = Number(
        Math.max(4.0, Math.min(9.9, Number.isFinite(imdbRating) ? imdbRating : 7.0)).toFixed(1),
      );

      if (options.audioPreference === 'dubbed-only' && !hasPtBrDub) {
        return null;
      }
      if (options.audioPreference === 'dubbed-or-must-see' && !hasPtBrDub && clampedImdb < 7.5) {
        return null;
      }

      const normTitle = normalizeTitleForMatch(title);
      const normOrig = normalizeTitleForMatch(originalTitle);
      if (
        options.normalizedExcludeSet.has(normTitle) ||
        options.normalizedExcludeSet.has(normOrig) ||
        seenInBatch.has(normOrig)
      ) {
        return null;
      }
      seenInBatch.add(normOrig);

      const safeSlug = normOrig.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
      return {
        id: `${prefix}-${safeSlug || 'filme'}-${year}`,
        title,
        originalTitle,
        searchTitle,
        year,
        director: String(item.director ?? 'Desconhecido').trim().slice(0, 120),
        country: String(item.country ?? 'Internacional').trim().slice(0, 80),
        runtimeMinutes: Math.max(45, Math.min(240, Math.round(runtimeMinutes))),
        imdbRating: clampedImdb,
        subgenre: validSubgenres.has(rawSubgenre) ? rawSubgenre : defaultSubgenre,
        secondaryTag: item.secondaryTag
          ? String(item.secondaryTag).trim().slice(0, 80)
          : undefined,
        obscurity: VALID_OBSCURITY.has(rawObscurity) ? rawObscurity : 'Lado B',
        hasPtBrDub,
        synopsis: String(item.synopsis ?? '').trim().slice(0, 600),
        editorialNote: String(item.editorialNote ?? '').trim().slice(0, 400),
        isAiDiscovered: true,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);
}

function formatGeminiError(error: unknown, fallback: string): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const lower = raw.toLowerCase();
  if (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('high demand') ||
    lower.includes('timeout')
  ) {
    return {
      status: 503,
      message: 'A IA está com pico de demanda agora (503). Aguarde alguns segundos e tente novamente.',
    };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'A cota temporária da Curadoria IA foi atingida agora. Tente novamente em instantes.',
    };
  }
  return { status: 500, message: raw || fallback };
}

interface AppleRssEntry {
  'im:name'?: { label?: string };
  'im:artist'?: { label?: string };
  'im:releaseDate'?: { label?: string };
  'im:image'?: Array<{ label?: string }>;
  summary?: { label?: string };
  category?: { attributes?: { label?: string } };
}

async function fetchAppleBrLatestReleases(
  universe: AppUniverse,
  minYear: number,
): Promise<ReturnType<typeof sanitizeMovieItems>> {
  const feeds =
    universe === 'matine'
      ? [
          {
            url: 'https://itunes.apple.com/br/rss/topmovies/limit=40/genre=4412/json',
            defaultSubgenre: 'Clássico Romântico',
            defaultTag: 'Lançamento Romance',
          },
          {
            url: 'https://itunes.apple.com/br/rss/topmovies/limit=40/genre=4404/json',
            defaultSubgenre: 'Viagem & Destino',
            defaultTag: 'Comédia Romântica',
          },
        ]
      : [
          {
            url: 'https://itunes.apple.com/br/rss/topmovies/limit=40/genre=4408/json',
            defaultSubgenre: 'Sobrenatural',
            defaultTag: 'Lançamento Terror',
          },
          {
            url: 'https://itunes.apple.com/br/rss/topmovies/limit=40/genre=4416/json',
            defaultSubgenre: 'Psicológico',
            defaultTag: 'Lançamento Suspense',
          },
        ];

  const responses = await Promise.all(
    feeds.map(async (feed) => {
      try {
        const res = await fetchWithTimeout(feed.url, {}, 5000);
        if (!res.ok) return { feed, entries: [] as AppleRssEntry[] };
        const json = (await res.json()) as { feed?: { entry?: AppleRssEntry[] } };
        return { feed, entries: Array.isArray(json.feed?.entry) ? json.feed.entry : [] };
      } catch {
        return { feed, entries: [] as AppleRssEntry[] };
      }
    }),
  );

  const currentYear = new Date().getFullYear();
  const seen = new Set<string>();
  const collected: Array<{ releaseTime: number; movie: ReturnType<typeof sanitizeMovieItems>[number] }> = [];
  const romcomKeywords =
    /amor|romance|apaixon|casament|namor|coração|paixão|beijo|noiv|casal|encontro|romântic/;

  for (const { feed, entries } of responses) {
    for (const entry of entries) {
      const rawName = String(entry['im:name']?.label ?? '').trim();
      const releaseStr = String(entry['im:releaseDate']?.label ?? '');
      const year = Number(releaseStr.slice(0, 4));
      if (!rawName || !Number.isFinite(year) || year < minYear || year > currentYear + 1) {
        continue;
      }

      const cleanTitle = rawName.replace(/\s*\(\d{4}\)\s*$/, '').trim();
      const normKey = normalizeTitleForMatch(cleanTitle);
      if (!normKey || seen.has(normKey)) continue;

      const director = String(entry['im:artist']?.label ?? 'Desconhecido').trim().slice(0, 120);
      const rawSummary = String(entry.summary?.label ?? '').replace(/\s+/g, ' ').trim();
      const synopsis =
        rawSummary.length > 360 ? `${rawSummary.slice(0, 357).trimEnd()}...` : rawSummary;
      if (synopsis.length < 30) continue;

      const lowerSyn = `${cleanTitle} ${synopsis}`.toLowerCase();
      // For Matinê comedy feed (4404), keep only romantic-flavored titles so non-romantic comedies don't leak in
      if (universe === 'matine' && feed.url.includes('4404') && !romcomKeywords.test(lowerSyn)) {
        continue;
      }

      seen.add(normKey);

      // Seed server poster cache directly with Apple's official high-res BR theatrical artwork
      const images = Array.isArray(entry['im:image']) ? entry['im:image'] : [];
      const largestImg = images[images.length - 1]?.label;
      if (largestImg) {
        const highRes = largestImg.replace(/\/\d+x\d+bb\./i, '/600x900bb.');
        if (isSafeAllowedImageUrl(highRes)) {
          const cacheKey = `${normalizeTitleForMatch(cleanTitle)}::${year}::${normalizeTitleForMatch(director)}`;
          posterCache.set(cacheKey, {
            remoteUrl: highRes,
            source: 'itunes-br-rss',
            fetchedAt: Date.now(),
          });
        }
      }

      let subgenre = feed.defaultSubgenre;
      if (universe === 'matine') {
        if (/natal|natalin|christmas|papai noel|neve|véspera/.test(lowerSyn)) subgenre = 'Natal & Fim de Ano';
        else if (/rival|inimig|odei|disput|aposta/.test(lowerSyn)) subgenre = 'Inimigos a Amantes';
        else if (/fingi|falso|noivad|contrato/.test(lowerSyn)) subgenre = 'Falso Namoro';
        else if (/amig|infância/.test(lowerSyn)) subgenre = 'Amigos a Amantes';
        else if (/reencontr|ex-|passado|segunda chance/.test(lowerSyn)) subgenre = 'Segunda Chance';
        else if (/viagem|paris|itália|férias|ilha|verão/.test(lowerSyn)) subgenre = 'Viagem & Destino';
      } else {
        if (/culto|ritual|seita|aldeia|floresta/.test(lowerSyn)) subgenre = 'Folk & Culto';
        else if (/alien|espaço|experimento|vírus|futuro|sci-fi/.test(lowerSyn)) subgenre = 'Cósmico & Sci-Fi';
        else if (/serial killer|assassino|sobrevivência|mascarado|caçada/.test(lowerSyn)) {
          subgenre = 'Slasher & Sobrevivência';
        } else if (/detetive|investigação|crime|mistério|desaparec/.test(lowerSyn)) {
          subgenre = 'Thriller Noir';
        }
      }

      const safeSlug = normKey.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
      const releaseTime = Date.parse(releaseStr) || Date.UTC(year, 0, 1);
      const idPrefix = universe === 'matine' ? 'rom-new' : 'new';

      collected.push({
        releaseTime,
        movie: {
          id: `${idPrefix}-${safeSlug || 'filme'}-${year}`,
          title: cleanTitle,
          originalTitle: cleanTitle,
          searchTitle: cleanTitle,
          year,
          director,
          country: 'Lançamento BR',
          runtimeMinutes: 102,
          imdbRating: 6.8,
          subgenre,
          secondaryTag: feed.defaultTag,
          obscurity: 'Blockbuster',
          hasPtBrDub: true,
          synopsis,
          editorialNote: `Lançamento recente (${year}) em destaque nas lojas digitais e cinemas do Brasil.`,
          isAiDiscovered: true,
        },
      });
    }
  }

  return collected
    .sort((a, b) => b.releaseTime - a.releaseTime)
    .slice(0, 12)
    .map((item) => item.movie);
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Lookup official movie poster URL from allowlisted movie artwork providers
  app.get('/api/poster', async (req, res) => {
    const title = typeof req.query.title === 'string' ? req.query.title.slice(0, 120).trim() : '';
    const originalTitle =
      typeof req.query.originalTitle === 'string'
        ? req.query.originalTitle.slice(0, 120).trim()
        : '';
    const searchTitle =
      typeof req.query.searchTitle === 'string'
        ? req.query.searchTitle.slice(0, 120).trim()
        : '';
    const director =
      typeof req.query.director === 'string'
        ? req.query.director.slice(0, 120).trim()
        : '';
    const rawYear = typeof req.query.year === 'string' ? Number(req.query.year) : undefined;
    const year =
      rawYear && Number.isInteger(rawYear) && rawYear >= 1920 && rawYear <= 2030
        ? rawYear
        : undefined;

    if (!title && !originalTitle && !searchTitle) {
      res.status(400).json({ error: 'Título obrigatório.' });
      return;
    }

    const primaryQuery = searchTitle || originalTitle || title;
    const secondaryQuery = originalTitle && originalTitle !== primaryQuery ? originalTitle : '';
    const { remoteUrl, source } = await resolvePoster(
      primaryQuery,
      secondaryQuery,
      title,
      year,
      director || undefined,
    );
    res.json({
      posterUrl: remoteUrl ? `/api/poster-image?url=${encodeURIComponent(remoteUrl)}` : null,
      source,
    });
  });

  // In-memory LRU image buffer cache so upstream CDNs are never repeatedly hammered
  const IMAGE_BUFFER_CACHE_MAX = 220;
  const IMAGE_BUFFER_CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
  const imageBufferCache = new Map<
    string,
    { buffer: Buffer; contentType: string; cachedAt: number }
  >();

  // Strict allowlisted image proxy to prevent CORS/hotlink issues and SSRF
  app.get('/api/poster-image', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    let currentUrl = isSafeAllowedImageUrl(rawUrl);
    if (!currentUrl) {
      res.status(400).json({ error: 'URL de imagem não permitida.' });
      return;
    }

    const cacheKey = currentUrl.toString();
    const cachedImage = imageBufferCache.get(cacheKey);
    if (cachedImage && Date.now() - cachedImage.cachedAt < IMAGE_BUFFER_CACHE_TTL_MS) {
      res.setHeader('Content-Type', cachedImage.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(cachedImage.buffer);
      return;
    }

    try {
      let upstream: Response | null = null;
      for (let hops = 0; hops < 3; hops += 1) {
        upstream = await fetchWithTimeout(
          currentUrl.toString(),
          {
            redirect: 'manual',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            },
          },
          6000,
        );
        if (upstream.status >= 300 && upstream.status < 400) {
          const location = upstream.headers.get('location');
          if (!location) {
            res.status(502).end();
            return;
          }
          const resolved = new URL(location, currentUrl).toString();
          const safeNext = isSafeAllowedImageUrl(resolved);
          if (!safeNext) {
            res.status(403).end();
            return;
          }
          currentUrl = safeNext;
          continue;
        }
        break;
      }

      if (!upstream || !upstream.ok) {
        res.status(404).end();
        return;
      }

      const contentType = upstream.headers.get('content-type') ?? '';
      if (!contentType.startsWith('image/')) {
        res.status(415).end();
        return;
      }

      const buffer = Buffer.from(await upstream.arrayBuffer());
      if (imageBufferCache.size >= IMAGE_BUFFER_CACHE_MAX) {
        const oldestKey = imageBufferCache.keys().next().value;
        if (oldestKey) imageBufferCache.delete(oldestKey);
      }
      imageBufferCache.set(cacheKey, {
        buffer,
        contentType,
        cachedAt: Date.now(),
      });

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch {
      res.status(502).end();
    }
  });

  const HORROR_EXPLORATION_ANGLES = [
    'Foque em cinema asiático (Japão, Coreia do Sul, Tailândia, Taiwan, Indonésia) e festivais internacionais menos óbvios.',
    'Foque em terror e thriller europeu (França, Espanha, Dinamarca, Noruega, Áustria, Reino Unido, Polônia, Bélgica).',
    'Foque em pérolas latino-americanas, australianas, neozelandesas e canadenses de gênero (Sitges / Fantasia Film Festival).',
    'Foque em produções independentes norte-americanas e britânicas fora do mainstream (micro-budget aclamados, slow burn, Sundance Midnight).',
    'Foque em joias cult esquecidas das décadas de 1970, 1980, 1990 e início dos anos 2000 que fãs modernos costumam deixar passar.',
    'Foque em obras de gênero híbrido (thriller investigativo sombrio, folk horror obscuro, sci-fi paranoia, mockumentary raro).',
  ];

  const ROMCOM_EXPLORATION_ANGLES = [
    'Foque em comédias românticas natalinas e de fim de ano aconchegantes (neve, famílias, magia natalina, romances de inverno).',
    'Foque em clássicos confortáveis de comédia romântica dos anos 1990 e 2000 com ótima química e diálogos memoráveis.',
    'Foque em comédias românticas modernas (2018 em diante) elogiadas por leveza, humor inteligente e carisma.',
    'Foque em romances internacionais encantadores (Reino Unido, França, Itália, Coreia do Sul, Espanha, Brasil) cheios de charme.',
    'Foque em joias indie e dramedies românticas muito bem avaliadas (tipo Sundance e festivais) que fogem dos clichês óbvios.',
    'Foque em histórias deliciosas de inimigos a amantes, falso namoro e viagens inesquecíveis.',
  ];

  // Isolated AI discovery endpoint supporting both Nocturna (horror/thriller) and Matinê (romantic comedy)
  app.post('/api/discover', async (req, res) => {
    try {
      const body = (req.body ?? {}) as {
        universe?: unknown;
        subgenre?: unknown;
        minImdb?: unknown;
        obscurity?: unknown;
        decade?: unknown;
        audioPreference?: unknown;
        mood?: unknown;
        excludeTitles?: unknown;
        likedTitles?: unknown;
        dislikedTitles?: unknown;
        watchlistTitles?: unknown;
        skippedTitles?: unknown;
        preferredSubgenres?: unknown;
        avoidedSubgenres?: unknown;
        avoidPreferences?: unknown;
        anchorMovie?: unknown;
        batchNumber?: unknown;
        count?: unknown;
      };

      const universe: AppUniverse = body.universe === 'matine' ? 'matine' : 'nocturna';
      const validSubgenres =
        universe === 'matine' ? VALID_ROMCOM_SUBGENRES : VALID_HORROR_SUBGENRES;
      const defaultAnyLabel =
        universe === 'matine'
          ? 'Qualquer subgênero de comédia romântica ou romance leve'
          : 'Qualquer subgênero de terror ou thriller';

      const subgenre =
        typeof body.subgenre === 'string' && body.subgenre !== 'all' && validSubgenres.has(body.subgenre)
          ? body.subgenre
          : defaultAnyLabel;
      const minImdb =
        typeof body.minImdb === 'number' && Number.isFinite(body.minImdb)
          ? Math.max(0, Math.min(9.5, body.minImdb))
          : 6.5;
      const obscurity =
        typeof body.obscurity === 'string' ? body.obscurity.slice(0, 40) : 'all';
      const decade = typeof body.decade === 'string' ? body.decade.slice(0, 20) : 'all';
      const audioPreference =
        body.audioPreference === 'dubbed-only' || body.audioPreference === 'dubbed-or-must-see'
          ? body.audioPreference
          : 'all';
      const mood = typeof body.mood === 'string' ? body.mood.slice(0, 260).trim() : '';
      const requestedCount =
        typeof body.count === 'number' && Number.isFinite(body.count)
          ? Math.max(4, Math.min(12, Math.round(body.count)))
          : 10;
      const batchNumber =
        typeof body.batchNumber === 'number' && Number.isFinite(body.batchNumber)
          ? Math.max(0, Math.floor(body.batchNumber))
          : 0;

      const sanitizeList = (input: unknown, max: number) =>
        Array.isArray(input)
          ? input
              .filter((t): t is string => typeof t === 'string')
              .slice(0, max)
              .map((t) => t.slice(0, 100).trim())
              .filter(Boolean)
          : [];

      const excludeTitles = sanitizeList(body.excludeTitles, 1500);
      const likedTitles = sanitizeList(body.likedTitles, 25);
      const dislikedTitles = sanitizeList(body.dislikedTitles, 25);
      const watchlistTitles = sanitizeList(body.watchlistTitles, 20);
      const skippedTitles = sanitizeList(body.skippedTitles, 20);
      const preferredSubgenres = sanitizeList(body.preferredSubgenres, 5);
      const avoidedSubgenres = sanitizeList(body.avoidedSubgenres, 5);
      const avoidPreferences = sanitizeAvoidPreferences(body.avoidPreferences);
      const avoidDirectives = buildAvoidPromptDirectives(avoidPreferences, universe);
      const anchorMovie =
        body.anchorMovie && typeof body.anchorMovie === 'object'
          ? {
              title: String((body.anchorMovie as Record<string, unknown>).title ?? '').slice(0, 100).trim(),
              originalTitle: String((body.anchorMovie as Record<string, unknown>).originalTitle ?? '').slice(0, 100).trim(),
              year: Number((body.anchorMovie as Record<string, unknown>).year) || undefined,
              subgenre: String((body.anchorMovie as Record<string, unknown>).subgenre ?? '').slice(0, 50).trim(),
            }
          : null;

      const normalizedExcludeSet = new Set(
        excludeTitles.map((t) => normalizeTitleForMatch(t.replace(/\(\d{4}\)/g, ''))),
      );

      const obscurityGuide =
        universe === 'matine'
          ? obscurity === 'blockbusters'
            ? 'Priorize RIGOROSAMENTE grandes sucessos de bilheteria e comédias românticas famosas de estúdio/streaming muito bem avaliadas.'
            : obscurity === 'deep-cuts'
              ? 'Priorize comédias românticas independentes encantadoras, romances internacionais menos óbvios e joias escondidas do gênero.'
              : obscurity === 'classics'
                ? 'Priorize clássicos incontornáveis e cult queridos de comédia romântica dos anos 80, 90 e 2000.'
                : 'Equilibre grandes sucessos românticos populares com clássicos queridos e descobertas independentes encantadoras.'
          : obscurity === 'blockbusters'
            ? 'Priorize RIGOROSAMENTE blockbusters, grandes produções de estúdio e thrillers/terrores de alto orçamento muito bem avaliados (ex: Warner, Universal, Blumhouse, Paramount, A24 mainstream, Fincher, Wan, Peele, Scorsese) que o espectador possa ter deixado passar.'
            : obscurity === 'deep-cuts'
              ? 'Priorize RIGOROSAMENTE filmes Lado B, pérolas internacionais pouco óbvias, joias de festivais e raridades aclamadas — evite blockbusters batidos que qualquer fã experiente já assistiu.'
              : obscurity === 'classics'
                ? 'Priorize obras cult essenciais e clássicos incontornáveis bem avaliados.'
                : 'Equilibre grandes produções/blockbusters de alto orçamento bem avaliados com clássicos cult e joias menos óbvias do gênero (não fique preso apenas a filmes Lado B).';

      const currentYear = new Date().getFullYear();
      const recentStartYear = currentYear - 1;
      const useLiveSearch = decade === 'recent';

      const decadeGuide =
        decade === 'recent'
          ? `LANÇAMENTOS RECENTES (${recentStartYear}–${currentYear}): Pesquise na web ao vivo os filmes ${
              universe === 'matine' ? 'de comédia romântica e romance' : 'de terror e thriller'
            } recém-lançados nos cinemas e streamings entre ${recentStartYear} e ${currentYear}, incluindo lançamentos deste ano (${currentYear}).`
          : decade === '2020s'
            ? `Lançados entre 2020 e ${currentYear}.`
            : decade === '2010s'
              ? 'Lançados entre 2010 e 2019.'
              : decade === '2000s'
                ? 'Lançados entre 2000 e 2009.'
                : decade === 'classic'
                  ? 'Lançados antes de 2000.'
                  : 'Qualquer década (misture épocas relevantes, incluindo lançamentos recentes).';

      const audioGuide =
        audioPreference === 'dubbed-only'
          ? 'ÁUDIO OBRIGATÓRIO: Recomende APENAS filmes que possuem dublagem oficial em Português do Brasil (lançados dublados no cinema, DVD ou streamings no Brasil como Netflix, Prime Video, Max, Globoplay, Telecine). Defina `hasPtBrDub: true`.'
          : audioPreference === 'dubbed-or-must-see'
            ? 'PREFERÊNCIA DE ÁUDIO: Priorize fortemente filmes com dublagem em Português do Brasil (`hasPtBrDub: true`). Só inclua filmes apenas legendados (`hasPtBrDub: false`) se forem obras-primas imperdíveis com nota IMDb >= 7.5 que realmente compensem assistir legendado.'
            : 'Pode incluir filmes dublados em PT-BR (`hasPtBrDub: true`) e filmes apenas legendados (`hasPtBrDub: false`); informe `hasPtBrDub` com honestidade conforme o histórico de lançamento no Brasil.';

      const rawAngles =
        universe === 'matine' ? ROMCOM_EXPLORATION_ANGLES : HORROR_EXPLORATION_ANGLES;
      const compatibleAngles = rawAngles.filter((angle) =>
        isExplorationAngleCompatible(angle, avoidPreferences),
      );
      const angles = compatibleAngles.length > 0 ? compatibleAngles : rawAngles;
      const angleHint =
        !mood && !anchorMovie?.title && !useLiveSearch && subgenre === defaultAnyLabel
          ? angles[batchNumber % angles.length]
          : '';

      const promptExcludeSample = excludeTitles.slice(0, 800);
      const subgenreRule =
        universe === 'matine'
          ? '- `subgenre` deve ser estritamente um destes valores: "Natal & Fim de Ano", "Clássico Romântico", "Inimigos a Amantes", "Falso Namoro", "Amigos a Amantes", "Segunda Chance", "Viagem & Destino", "Drama Romântico", "Internacional Rom-Com".'
          : '- `subgenre` deve ser estritamente um destes valores: "Psicológico", "Sobrenatural", "Folk & Culto", "Thriller Noir", "Cósmico & Sci-Fi", "Found Footage", "Slasher & Sobrevivência", "Internacional".';

      const curatorRole =
        universe === 'matine'
          ? 'Você é a curadora chefe do Matinê, especialista apaixonada por COMÉDIAS ROMÂNTICAS e romances envolventes (jamais recomende terror, suspense pesado ou filmes violentos).'
          : 'Você é o curador chefe do Nocturna, especialista em cinema de TERROR e THRILLER (lançamentos de cinema, streaming, blockbusters de alto orçamento e festivais como Sitges, Fantasia e Sundance; jamais recomende comédias românticas).';

      const genreTarget =
        universe === 'matine' ? 'comédia romântica ou romance leve' : 'terror ou thriller';

      const prompt = [
        curatorRole,
        `Recomende EXATAMENTE ${requestedCount} filmes REAIS (jamais invente filmes) de ${genreTarget} que atendam aos critérios:`,
        anchorMovie?.title
          ? `- FILME-REFERÊNCIA PRINCIPAL: Recomende filmes com química, atmosfera, ritmo ou encanto próximos a "${anchorMovie.title}" (${anchorMovie.originalTitle}${anchorMovie.year ? `, ${anchorMovie.year}` : ''}).`
          : '',
        `- Subgênero preferido: ${subgenre}`,
        `- Nota mínima aproximada no IMDb: ${minImdb.toFixed(1)}`,
        `- Nível de profundidade: ${obscurityGuide}`,
        `- Época: ${decadeGuide}`,
        `- ${audioGuide}`,
        angleHint ? `- Ângulo de curadoria desta rodada (#${batchNumber + 1}): ${angleHint}` : '',
        mood ? `- Pedido/clima específico do espectador: "${mood}"` : '',
        likedTitles.length > 0
          ? `- FILMES QUE O ESPECTADOR JÁ ASSISTIU E CURTIU MUITO (puxe atmosfera, química e pegada semelhantes): ${likedTitles.join(', ')}`
          : '',
        watchlistTitles.length > 0
          ? `- FILMES NA LISTA "QUERO VER" (indicam o que desperta interesse atual): ${watchlistTitles.join(', ')}`
          : '',
        dislikedTitles.length > 0
          ? `- FILMES QUE O ESPECTADOR JÁ ASSISTIU E NÃO GOSTOU (CRÍTICO: evite tom, clichês, ritmo ou estilo parecidos com estes): ${dislikedTitles.join(', ')}`
          : '',
        preferredSubgenres.length > 0
          ? `- Subgêneros com maior afinidade recente: ${preferredSubgenres.join(', ')}`
          : '',
        avoidedSubgenres.length > 0
          ? `- Subgêneros rejeitados recentemente (evite): ${avoidedSubgenres.join(', ')}`
          : '',
        avoidDirectives.length > 0
          ? `- BLOQUEIOS PERMANENTES DO ESPECTADOR (PRIORIDADE MÁXIMA — NUNCA RECOMENDE FILMES QUE VIOLEM ESTAS REGRAS):\n  ${avoidDirectives.map((rule) => `• ${rule}`).join('\n  ')}`
          : '',
        skippedTitles.length > 0
          ? `- Filmes pulados recentemente (menor interesse): ${skippedTitles.join(', ')}`
          : '',
        promptExcludeSample.length > 0
          ? `- LISTA DE EXCLUSÃO OBRIGATÓRIA (NUNCA repita nenhum destes títulos já vistos ou já carregados): ${promptExcludeSample.join('; ')}`
          : '',
        'Regras de saída:',
        '- Escreva `title` (título em português do Brasil, ou original se não tiver título oficial em PT-BR), `originalTitle` (título original), `searchTitle` (título internacional em inglês usado nos cinemas/iTunes para busca precisa de pôster), `synopsis` (2 a 3 frases envolventes e sem spoilers em PT-BR) e `editorialNote` (1 frase curta e direta em PT-BR explicando por que este filme combina com o espectador).',
        subgenreRule,
        '- `obscurity` deve ser estritamente um destes valores: "Blockbuster", "Clássico", "Cult", "Lado B", "Raridade".',
        '- `hasPtBrDub` deve ser booleano (true se possui dublagem conhecida em Português do Brasil; false se costuma existir apenas legendado).',
        '- `imdbRating` deve ser a nota real aproximada do IMDb (número decimal de 1 casa, ex: 7.2).',
        useLiveSearch
          ? '- IMPORTANTE: Retorne EXCLUSIVAMENTE um array JSON válido (sem texto extra antes ou depois) onde cada objeto contém as chaves: title, originalTitle, searchTitle, year, director, country, runtimeMinutes, imdbRating, subgenre, secondaryTag, obscurity, hasPtBrDub, synopsis, editorialNote.'
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      const ai = getGeminiClient();
      const discoverModels = useLiveSearch
        ? ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']
        : ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'];

      const { result: response } = await runWithModelFallback(
        async (model) => {
          const thinkingConfig =
            model === 'gemini-4-hydrogen'
              ? { thinkingLevel: ThinkingLevel.LOW }
              : undefined;

          if (useLiveSearch) {
            return ai.models.generateContent({
              model,
              contents: prompt,
              config: {
                ...(thinkingConfig ? { thinkingConfig } : {}),
                tools: [{ googleSearch: {} }],
              },
            });
          }

          return ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              ...(thinkingConfig ? { thinkingConfig } : {}),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    originalTitle: { type: Type.STRING },
                    searchTitle: { type: Type.STRING },
                    year: { type: Type.INTEGER },
                    director: { type: Type.STRING },
                    country: { type: Type.STRING },
                    runtimeMinutes: { type: Type.INTEGER },
                    imdbRating: { type: Type.NUMBER },
                    subgenre: { type: Type.STRING },
                    secondaryTag: { type: Type.STRING },
                    obscurity: { type: Type.STRING },
                    hasPtBrDub: { type: Type.BOOLEAN },
                    synopsis: { type: Type.STRING },
                    editorialNote: { type: Type.STRING },
                  },
                  required: [
                    'title',
                    'originalTitle',
                    'year',
                    'director',
                    'country',
                    'runtimeMinutes',
                    'imdbRating',
                    'subgenre',
                    'obscurity',
                    'hasPtBrDub',
                    'synopsis',
                    'editorialNote',
                  ],
                },
              },
            },
          });
        },
        { models: discoverModels, timeoutMs: 22_000, baseDelayMs: 800 },
      );

      const parsed = extractJsonArrayFromText(response.text ?? '[]');
      if (!parsed) {
        res.status(502).json({ error: 'Resposta inesperada do curador.' });
        return;
      }

      const movies = sanitizeMovieItems(parsed, {
        universe,
        audioPreference,
        normalizedExcludeSet,
        minYear: useLiveSearch ? recentStartYear : 1920,
      }).filter((movie) => !isMovieBlockedByPreferences(movie, avoidPreferences, universe));

      res.json({ movies });
    } catch (error) {
      const formatted = formatGeminiError(
        error,
        'Não foi possível buscar novas recomendações agora.',
      );
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Live Radar of Newly Released Films isolated per universe (Nocturna vs Matinê)
  const LATEST_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
  const latestReleasesCacheByUniverse: Partial<
    Record<
      AppUniverse,
      {
        fetchedAt: number;
        movies: ReturnType<typeof sanitizeMovieItems>;
        sources: Array<{ title: string; uri: string }>;
      }
    >
  > = {};

  app.get('/api/latest-releases', async (req, res) => {
    try {
      const universe: AppUniverse = req.query.universe === 'matine' ? 'matine' : 'nocturna';
      const force = req.query.force === '1';
      const cachedEntry = latestReleasesCacheByUniverse[universe];
      if (!force && cachedEntry && Date.now() - cachedEntry.fetchedAt < LATEST_CACHE_TTL_MS) {
        res.json({
          movies: cachedEntry.movies,
          updatedAt: cachedEntry.fetchedAt,
          sources: cachedEntry.sources,
          cached: true,
        });
        return;
      }

      const currentYear = new Date().getFullYear();
      const prevYear = currentYear - 1;

      const geminiRadarPromise = (async () => {
        if (!process.env.GEMINI_API_KEY) {
          return {
            movies: [] as ReturnType<typeof sanitizeMovieItems>,
            sources: [] as Array<{ title: string; uri: string }>,
          };
        }
        const ai = getGeminiClient();
        const subgenreEnumText =
          universe === 'matine'
            ? '"Natal & Fim de Ano", "Clássico Romântico", "Inimigos a Amantes", "Falso Namoro", "Amigos a Amantes", "Segunda Chance", "Viagem & Destino", "Drama Romântico", "Internacional Rom-Com"'
            : '"Psicológico", "Sobrenatural", "Folk & Culto", "Thriller Noir", "Cósmico & Sci-Fi", "Found Footage", "Slasher & Sobrevivência", "Internacional"';

        const radarPrompt = [
          `Use a busca na web ao vivo para encontrar os 10 lançamentos mais recentes e comentados de filmes de ${
            universe === 'matine' ? 'COMÉDIA ROMÂNTICA e ROMANCE' : 'TERROR e THRILLER'
          } já lançados nos cinemas ou em streaming/VOD entre ${prevYear} e ${currentYear} (priorize os lançamentos mais novos de ${currentYear} e finais de ${prevYear}).`,
          'Inclua uma mistura equilibrada de grandes lançamentos/blockbusters de estúdio e filmes muito elogiados recentes.',
          'Jamais invente filmes ou inclua filmes que ainda não estrearam — liste apenas filmes reais já lançados.',
          'Retorne EXCLUSIVAMENTE um array JSON válido (sem texto antes ou depois) onde cada objeto tem:',
          `title (título em PT-BR), originalTitle (título original), searchTitle (título em inglês para busca de pôster), year (inteiro), director, country, runtimeMinutes (inteiro), imdbRating (número real aproximado 1 casa decimal), subgenre (um de: ${subgenreEnumText}), secondaryTag, obscurity (um de: "Blockbuster", "Clássico", "Cult", "Lado B", "Raridade"), hasPtBrDub (booleano: true se já possui dublagem PT-BR nos cinemas/streamings), synopsis (2 a 3 frases em PT-BR sem spoilers), editorialNote (1 frase curta indicando por que vale assistir este lançamento recente).`,
        ].join('\n');

        const { result: response } = await runWithModelFallback(
          (model) =>
            ai.models.generateContent({
              model,
              contents: radarPrompt,
              config: {
                ...(model === 'gemini-4-hydrogen'
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
                tools: [{ googleSearch: {} }],
              },
            }),
          { models: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'], timeoutMs: 20_000, baseDelayMs: 700 },
        );

        const parsed = extractJsonArrayFromText(response.text ?? '[]');
        const movies = parsed
          ? sanitizeMovieItems(parsed, {
              universe,
              audioPreference: 'all',
              normalizedExcludeSet: new Set<string>(),
              minYear: prevYear,
              idPrefix: universe === 'matine' ? 'rom-new' : 'new',
            })
          : [];

        const groundingChunks =
          response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        const sources = groundingChunks
          .map((chunk) => ({
            title: String(chunk.web?.title ?? '').trim(),
            uri: String(chunk.web?.uri ?? '').trim(),
          }))
          .filter((s) => s.uri.startsWith('https://'))
          .slice(0, 5);

        return { movies, sources };
      })().catch(() => ({
        movies: [] as ReturnType<typeof sanitizeMovieItems>,
        sources: [] as Array<{ title: string; uri: string }>,
      }));

      const [geminiResult, appleBrMovies] = await Promise.all([
        geminiRadarPromise,
        fetchAppleBrLatestReleases(universe, prevYear),
      ]);

      const merged: ReturnType<typeof sanitizeMovieItems> = [];
      const seenKeys = new Set<string>();
      for (const movie of [...geminiResult.movies, ...appleBrMovies]) {
        const keyOrig = `${normalizeTitleForMatch(movie.originalTitle)}::${movie.year}`;
        const keyPt = `${normalizeTitleForMatch(movie.title)}::${movie.year}`;
        if (seenKeys.has(keyOrig) || seenKeys.has(keyPt)) continue;
        seenKeys.add(keyOrig);
        seenKeys.add(keyPt);
        merged.push(movie);
      }

      const finalMovies = merged.sort((a, b) => b.year - a.year).slice(0, 14);
      const sources =
        geminiResult.sources.length > 0
          ? geminiResult.sources
          : [
              {
                title:
                  universe === 'matine'
                    ? 'Apple Store Brasil — Lançamentos Romance & Comédia'
                    : 'Apple Store Brasil — Lançamentos Terror & Suspense',
                uri: 'https://itunes.apple.com/br',
              },
            ];

      const nextCache = {
        fetchedAt: Date.now(),
        movies: finalMovies,
        sources,
      };
      latestReleasesCacheByUniverse[universe] = nextCache;

      res.json({
        movies: finalMovies,
        updatedAt: nextCache.fetchedAt,
        sources,
        cached: false,
      });
    } catch (error) {
      const formatted = formatGeminiError(error, 'Erro ao consultar lançamentos recentes.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nocturna server running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down Nocturna server gracefully...`);
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
