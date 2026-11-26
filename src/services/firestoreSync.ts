import type { User } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../firebase';
import type {
  AppUniverse,
  HorrorSubgenre,
  Movie,
  ObscurityTier,
  RomComSubgenre,
  SeenSentiment,
  Subgenre,
  UserLibraryState,
  UserMovieEntry,
} from '../types/movie';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

const VALID_HORROR_SUBGENRES = new Set<HorrorSubgenre>([
  'Psicológico',
  'Sobrenatural',
  'Folk & Culto',
  'Thriller Noir',
  'Cósmico & Sci-Fi',
  'Found Footage',
  'Slasher & Sobrevivência',
  'Internacional',
]);

const VALID_ROMCOM_SUBGENRES = new Set<RomComSubgenre>([
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

const VALID_OBSCURITY = new Set<ObscurityTier>([
  'Blockbuster',
  'Clássico',
  'Cult',
  'Lado B',
  'Raridade',
]);

function getUniverseCollections(universe: AppUniverse): {
  entries: string;
  discovered: string;
  external: string;
  defaultSubgenre: Subgenre;
  validSubgenres: Set<string>;
} {
  if (universe === 'matine') {
    return {
      entries: 'romcomEntries',
      discovered: 'romcomDiscoveredMovies',
      external: 'romcomExternalSeen',
      defaultSubgenre: 'Clássico Romântico',
      validSubgenres: VALID_ROMCOM_SUBGENRES,
    };
  }
  return {
    entries: 'entries',
    discovered: 'discoveredMovies',
    external: 'externalSeen',
    defaultSubgenre: 'Psicológico',
    validSubgenres: VALID_HORROR_SUBGENRES,
  };
}

function sanitizeDocId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned.length > 0 ? cleaned : `item-${Date.now()}`;
}

function clampString(value: string | undefined, max: number): string {
  return (value ?? '').trim().slice(0, max);
}

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
  return Date.now();
}

export async function ensureUserProfile(user: User): Promise<void> {
  if (!VALID_ID_REGEX.test(user.uid)) return;
  const userPath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    const displayName = clampString(user.displayName ?? 'Cinéfilo', 120);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (snap.data()?.displayName !== displayName && displayName.length > 0) {
      await updateDoc(ref, {
        displayName,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function syncMovieEntryToCloud(
  uid: string,
  universe: AppUniverse,
  movieId: string,
  entry: UserMovieEntry,
): Promise<void> {
  const cols = getUniverseCollections(universe);
  const safeMovieId = sanitizeDocId(movieId);
  const entryPath = `users/${uid}/${cols.entries}/${safeMovieId}`;
  const ref = doc(db, 'users', uid, cols.entries, safeMovieId);

  try {
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      const payload: Record<string, unknown> = {
        ownerId: uid,
        movieId: safeMovieId,
        status: entry.status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (entry.sentiment === 'liked' || entry.sentiment === 'disliked') {
        payload.sentiment = entry.sentiment;
      }
      if (
        typeof entry.personalRating === 'number' &&
        entry.personalRating >= 1 &&
        entry.personalRating <= 5
      ) {
        payload.personalRating = Math.round(entry.personalRating);
      }
      await setDoc(ref, payload);
    } else {
      const updatePayload: Record<string, unknown> = {
        status: entry.status,
        updatedAt: serverTimestamp(),
        sentiment:
          entry.sentiment === 'liked' || entry.sentiment === 'disliked'
            ? entry.sentiment
            : deleteField(),
        personalRating:
          typeof entry.personalRating === 'number' &&
          entry.personalRating >= 1 &&
          entry.personalRating <= 5
            ? Math.round(entry.personalRating)
            : deleteField(),
      };
      await updateDoc(ref, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, entryPath);
  }
}

export async function deleteMovieEntryFromCloud(
  uid: string,
  universe: AppUniverse,
  movieId: string,
): Promise<void> {
  const cols = getUniverseCollections(universe);
  const safeMovieId = sanitizeDocId(movieId);
  const entryPath = `users/${uid}/${cols.entries}/${safeMovieId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, cols.entries, safeMovieId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, entryPath);
  }
}

function buildDiscoveredMoviePayload(
  uid: string,
  universe: AppUniverse,
  movie: Movie,
): Record<string, unknown> {
  const cols = getUniverseCollections(universe);
  const safeId = sanitizeDocId(movie.id);
  const subgenre: Subgenre = cols.validSubgenres.has(movie.subgenre)
    ? movie.subgenre
    : cols.defaultSubgenre;
  const obscurity: ObscurityTier = VALID_OBSCURITY.has(movie.obscurity)
    ? movie.obscurity
    : 'Lado B';

  const payload: Record<string, unknown> = {
    ownerId: uid,
    id: safeId,
    title: clampString(movie.title, 180) || 'Sem título',
    originalTitle: clampString(movie.originalTitle || movie.title, 180) || 'Untitled',
    year: Math.max(1900, Math.min(2035, Math.round(movie.year || 2020))),
    imdbRating: Math.max(0, Math.min(10, Number((movie.imdbRating || 6.5).toFixed(1)))),
    runtimeMinutes: Math.max(20, Math.min(400, Math.round(movie.runtimeMinutes || 100))),
    director: clampString(movie.director, 120) || 'Desconhecido',
    country: clampString(movie.country, 80) || 'Internacional',
    subgenre,
    obscurity,
    hasPtBrDub: Boolean(movie.hasPtBrDub),
    synopsis: clampString(movie.synopsis, 600) || 'Sinopse indisponível.',
    isAiDiscovered: movie.isAiDiscovered !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const searchTitle = clampString(movie.searchTitle, 180);
  if (searchTitle) payload.searchTitle = searchTitle;

  const secondaryTag = clampString(movie.secondaryTag, 80);
  if (secondaryTag) payload.secondaryTag = secondaryTag;

  const editorialNote = clampString(movie.editorialNote, 400);
  if (editorialNote) payload.editorialNote = editorialNote;

  return payload;
}

export async function syncDiscoveredMoviesToCloud(
  uid: string,
  universe: AppUniverse,
  movies: Movie[],
): Promise<void> {
  if (movies.length === 0) return;
  const cols = getUniverseCollections(universe);
  const basePath = `users/${uid}/${cols.discovered}`;
  try {
    const batch = writeBatch(db);
    let ops = 0;

    for (const movie of movies.slice(0, 60)) {
      const safeId = sanitizeDocId(movie.id);
      const ref = doc(db, 'users', uid, cols.discovered, safeId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        batch.set(ref, buildDiscoveredMoviePayload(uid, universe, movie));
        ops += 1;
      }
    }

    if (ops > 0) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, basePath);
  }
}

export async function syncExternalSeenTitlesToCloud(
  uid: string,
  universe: AppUniverse,
  allTitles: string[],
): Promise<void> {
  const cols = getUniverseCollections(universe);
  const basePath = `users/${uid}/${cols.external}`;
  const sanitized = Array.from(
    new Set(
      allTitles
        .map((t) => clampString(t, 160))
        .filter((t) => t.length > 0),
    ),
  ).slice(0, 5000);

  const chunks: string[][] = [];
  for (let i = 0; i < sanitized.length; i += 100) {
    chunks.push(sanitized.slice(i, i + 100));
  }

  try {
    const existingSnap = await getDocs(
      query(collection(db, 'users', uid, cols.external), where('ownerId', '==', uid)),
    );
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));

    for (let i = 0; i < chunks.length; i += 1) {
      const chunkId = `chunk-${i}`;
      const ref = doc(db, 'users', uid, cols.external, chunkId);
      if (existingIds.has(chunkId)) {
        await updateDoc(ref, {
          titles: chunks[i],
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          ownerId: uid,
          chunkId,
          titles: chunks[i],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      existingIds.delete(chunkId);
    }

    for (const staleChunkId of existingIds) {
      await deleteDoc(doc(db, 'users', uid, cols.external, staleChunkId));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, basePath);
  }
}

export async function mergeLocalLibraryIntoCloud(
  uid: string,
  universe: AppUniverse,
  localState: UserLibraryState,
): Promise<void> {
  const entriesEntries = Object.entries(localState.entries);
  if (
    entriesEntries.length === 0 &&
    localState.discoveredMovies.length === 0 &&
    localState.customSeenTitles.length === 0
  ) {
    return;
  }

  const cols = getUniverseCollections(universe);
  const basePath = `users/${uid}/${cols.entries}`;
  try {
    const existingEntriesSnap = await getDocs(
      query(collection(db, 'users', uid, cols.entries), where('ownerId', '==', uid)),
    );
    const cloudEntryIds = new Set(existingEntriesSnap.docs.map((d) => d.id));

    for (const [movieId, entry] of entriesEntries) {
      const safeId = sanitizeDocId(movieId);
      if (!cloudEntryIds.has(safeId)) {
        await syncMovieEntryToCloud(uid, universe, safeId, entry);
      }
    }

    if (localState.discoveredMovies.length > 0) {
      await syncDiscoveredMoviesToCloud(uid, universe, localState.discoveredMovies);
    }

    if (localState.customSeenTitles.length > 0) {
      const existingChunksSnap = await getDocs(
        query(collection(db, 'users', uid, cols.external), where('ownerId', '==', uid)),
      );
      const cloudTitles: string[] = [];
      existingChunksSnap.forEach((docSnap) => {
        const list = docSnap.data()?.titles;
        if (Array.isArray(list)) {
          for (const item of list) {
            if (typeof item === 'string') cloudTitles.push(item);
          }
        }
      });
      const mergedTitles = Array.from(new Set([...cloudTitles, ...localState.customSeenTitles]));
      if (mergedTitles.length > cloudTitles.length) {
        await syncExternalSeenTitlesToCloud(uid, universe, mergedTitles);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, basePath);
  }
}

export interface CloudLibrarySnapshot {
  entries: Record<string, UserMovieEntry>;
  discoveredMovies: Movie[];
  customSeenTitles: string[];
}

export function subscribeToUserLibrary(
  uid: string,
  universe: AppUniverse,
  onUpdate: (partial: Partial<CloudLibrarySnapshot>) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const cols = getUniverseCollections(universe);
  const entriesPath = `users/${uid}/${cols.entries}`;
  const discoveredPath = `users/${uid}/${cols.discovered}`;
  const externalPath = `users/${uid}/${cols.external}`;

  const unsubEntries = onSnapshot(
    query(collection(db, 'users', uid, cols.entries), where('ownerId', '==', uid)),
    (snapshot) => {
      const entries: Record<string, UserMovieEntry> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const status = data.status;
        if (status === 'seen' || status === 'watchlist' || status === 'skipped') {
          const sentiment: SeenSentiment | undefined =
            data.sentiment === 'liked' || data.sentiment === 'disliked'
              ? data.sentiment
              : undefined;
          entries[docSnap.id] = {
            status,
            sentiment,
            personalRating:
              typeof data.personalRating === 'number' ? data.personalRating : undefined,
            updatedAt: toMillis(data.updatedAt),
          };
        }
      });
      onUpdate({ entries });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, entriesPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );

  const unsubDiscovered = onSnapshot(
    query(collection(db, 'users', uid, cols.discovered), where('ownerId', '==', uid)),
    (snapshot) => {
      const items: Array<{ movie: Movie; createdMs: number }> = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (typeof d.title === 'string' && typeof d.originalTitle === 'string') {
          const resolvedSubgenre = (
            cols.validSubgenres.has(d.subgenre) ? d.subgenre : cols.defaultSubgenre
          ) as Subgenre;
          items.push({
            createdMs: toMillis(d.createdAt),
            movie: {
              id: docSnap.id,
              title: d.title,
              originalTitle: d.originalTitle,
              searchTitle: typeof d.searchTitle === 'string' ? d.searchTitle : undefined,
              year: typeof d.year === 'number' ? d.year : 2020,
              imdbRating: typeof d.imdbRating === 'number' ? d.imdbRating : 6.8,
              runtimeMinutes: typeof d.runtimeMinutes === 'number' ? d.runtimeMinutes : 100,
              director: typeof d.director === 'string' ? d.director : 'Desconhecido',
              country: typeof d.country === 'string' ? d.country : 'Internacional',
              subgenre: resolvedSubgenre,
              secondaryTag: typeof d.secondaryTag === 'string' ? d.secondaryTag : undefined,
              obscurity: VALID_OBSCURITY.has(d.obscurity) ? d.obscurity : 'Lado B',
              hasPtBrDub: typeof d.hasPtBrDub === 'boolean' ? d.hasPtBrDub : true,
              synopsis: typeof d.synopsis === 'string' ? d.synopsis : '',
              editorialNote: typeof d.editorialNote === 'string' ? d.editorialNote : '',
              isAiDiscovered: d.isAiDiscovered !== false,
            },
          });
        }
      });
      items.sort((a, b) => b.createdMs - a.createdMs);
      onUpdate({ discoveredMovies: items.map((item) => item.movie) });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, discoveredPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );

  const unsubExternal = onSnapshot(
    query(collection(db, 'users', uid, cols.external), where('ownerId', '==', uid)),
    (snapshot) => {
      const allTitles: string[] = [];
      snapshot.forEach((docSnap) => {
        const list = docSnap.data()?.titles;
        if (Array.isArray(list)) {
          for (const item of list) {
            if (typeof item === 'string' && item.trim().length > 0) {
              allTitles.push(item);
            }
          }
        }
      });
      onUpdate({ customSeenTitles: Array.from(new Set(allTitles)) });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, externalPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );

  return () => {
    unsubEntries();
    unsubDiscovered();
    unsubExternal();
  };
}
