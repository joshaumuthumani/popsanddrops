// Firestore data access for Pops & Drops. Reads/writes/subscriptions mirroring the
// PRD §6 model. Assumes Firebase is configured (callers guard with isFirebaseConfigured);
// hooks in src/hooks/data.ts fall back to mock data in Phase-0 demo mode.

import {
  collection,
  collectionGroup,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Game, GameStatus, LeaderboardEntry, Results, Role, Submission, UserProfile } from '@/types';
import { buildLeaderboard, type RankableSubmission } from '@/lib/scoring';

function reqDb() {
  if (!db) throw new Error('Firestore not configured');
  return db;
}

type Unsub = () => void;

// ---------- normalization ----------

function normalizeGame(id: string, data: Record<string, unknown>): Game {
  return {
    id,
    name: (data.name as string) ?? '',
    promotion: (data.promotion as string) ?? '',
    eventDate: (data.eventDate as string) ?? '',
    lockTime: Number(data.lockTime ?? 0),
    status: (data.status as GameStatus) ?? 'OPEN',
    matches: (data.matches as Game['matches']) ?? [],
    propBets: (data.propBets as Game['propBets']) ?? [],
    tiebreakerQuestion: (data.tiebreakerQuestion as string) ?? '',
    tiebreakerAnswer: (data.tiebreakerAnswer as string) ?? '',
    joinCode: (data.joinCode as string) ?? '',
    admins: (data.admins as string[]) ?? [],
    createdBy: (data.createdBy as string) ?? '',
    createdAt: Number(data.createdAt ?? 0),
  };
}

function normalizeSubmission(uid: string, data: Record<string, unknown>): Submission {
  return {
    uid,
    displayName: (data.displayName as string) ?? 'Player',
    photoURL: (data.photoURL as string | null) ?? null,
    matchPicks: (data.matchPicks as Record<string, string>) ?? {},
    propBetPicks: (data.propBetPicks as Record<string, string>) ?? {},
    tiebreakerAnswer: (data.tiebreakerAnswer as string) ?? '',
    submittedAt: Number(data.submittedAt ?? 0),
    popCount: Number(data.popCount ?? 0),
    dropCount: Number(data.dropCount ?? 0),
    rank: Number(data.rank ?? 0),
  };
}

// ---------- games ----------

export function subscribeGame(gameId: string, cb: (game: Game | null) => void): Unsub {
  return onSnapshot(doc(reqDb(), 'games', gameId), (snap) =>
    cb(snap.exists() ? normalizeGame(snap.id, snap.data()) : null),
  );
}

/** All games (Super Admin view). */
export function subscribeAllGames(cb: (games: Game[]) => void): Unsub {
  return onSnapshot(collection(reqDb(), 'games'), (snap) =>
    cb(snap.docs.map((d) => normalizeGame(d.id, d.data()))),
  );
}

export interface JoinedGame {
  game: Game;
  /** This user's standing in the game (populated once results are graded). */
  myResult: { popCount: number; dropCount: number; rank: number };
}

/** Games the user has joined — i.e. has a submission in (collection-group query), with their standing. */
export async function fetchJoinedGames(uid: string): Promise<JoinedGame[]> {
  const subs = await getDocs(query(collectionGroup(reqDb(), 'submissions'), where('uid', '==', uid)));
  const resultByGame = new Map<string, JoinedGame['myResult']>();
  subs.docs.forEach((d) => {
    const gid = d.ref.parent.parent?.id;
    if (!gid) return;
    const data = d.data();
    resultByGame.set(gid, {
      popCount: Number(data.popCount ?? 0),
      dropCount: Number(data.dropCount ?? 0),
      rank: Number(data.rank ?? 0),
    });
  });
  const joined = await Promise.all(
    [...resultByGame.keys()].map(async (gid) => {
      const g = await getDoc(doc(reqDb(), 'games', gid));
      return g.exists() ? { game: normalizeGame(g.id, g.data()), myResult: resultByGame.get(gid)! } : null;
    }),
  );
  return joined.filter((j): j is JoinedGame => j !== null);
}

export async function findGameByCode(code: string): Promise<Game | null> {
  const q = query(collection(reqDb(), 'games'), where('joinCode', '==', code.trim().toUpperCase()), limit(1));
  const snap = await getDocs(q);
  const d = snap.docs[0];
  return d ? normalizeGame(d.id, d.data()) : null;
}

const CODE_WORDS = ['SLAM', 'PIN', 'BELT', 'KICK', 'BUMP', 'HEEL', 'FACE', 'MANIA', 'BRAWL', 'SUPLEX'];

function generateJoinCode(): string {
  const word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  const num = 1000 + Math.floor(Math.random() * 9000);
  return `${word}-${num}`;
}

export interface NewGameInput {
  name: string;
  promotion: string;
  eventDate: string;
  lockTime: number;
  matches: Game['matches'];
  propBets: Game['propBets'];
  tiebreakerQuestion: string;
}

/** Creates a published (OPEN) game owned by the creator. Returns the new game id. */
export async function createGame(input: NewGameInput, creator: UserProfile): Promise<string> {
  const ref = doc(collection(reqDb(), 'games'));
  const game = {
    name: input.name.trim(),
    promotion: input.promotion.trim(),
    eventDate: input.eventDate,
    lockTime: input.lockTime,
    status: 'OPEN' as GameStatus,
    matches: input.matches,
    propBets: input.propBets,
    tiebreakerQuestion: input.tiebreakerQuestion.trim(),
    tiebreakerAnswer: '',
    joinCode: generateJoinCode(),
    admins: [creator.uid],
    createdBy: creator.uid,
    createdAt: Date.now(),
  };
  await setDoc(ref, game);
  return ref.id;
}

// ---------- submissions ----------

export function subscribeMySubmission(
  gameId: string,
  uid: string,
  cb: (sub: Submission | null) => void,
): Unsub {
  return onSnapshot(doc(reqDb(), 'games', gameId, 'submissions', uid), (snap) =>
    cb(snap.exists() ? normalizeSubmission(snap.id, snap.data()) : null),
  );
}

export function subscribeSubmissions(gameId: string, cb: (subs: Submission[]) => void): Unsub {
  return onSnapshot(collection(reqDb(), 'games', gameId, 'submissions'), (snap) =>
    cb(snap.docs.map((d) => normalizeSubmission(d.id, d.data()))),
  );
}

export interface SubmissionInput {
  matchPicks: Record<string, string>;
  propBetPicks: Record<string, string>;
  tiebreakerAnswer: string;
}

export async function saveSubmission(
  gameId: string,
  user: UserProfile,
  input: SubmissionInput,
): Promise<void> {
  const ref = doc(reqDb(), 'games', gameId, 'submissions', user.uid);
  await setDoc(ref, {
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL,
    matchPicks: input.matchPicks,
    propBetPicks: input.propBetPicks,
    tiebreakerAnswer: input.tiebreakerAnswer.trim(),
    submittedAt: Date.now(),
    popCount: 0,
    dropCount: 0,
    rank: 0,
  });
}

// ---------- results ----------

export function subscribeResults(gameId: string, cb: (results: Results) => void): Unsub {
  return onSnapshot(collection(reqDb(), 'games', gameId, 'results'), (snap) => {
    const out: Results = {};
    snap.docs.forEach((d) => {
      out[d.id] = (d.data().correctAnswer as string) ?? '';
    });
    cb(out);
  });
}

export async function setResult(
  gameId: string,
  questionId: string,
  correctAnswer: string,
  uid: string,
): Promise<void> {
  await setDoc(doc(reqDb(), 'games', gameId, 'results', questionId), {
    correctAnswer,
    enteredAt: Date.now(),
    enteredBy: uid,
  });
}

export async function clearResult(gameId: string, questionId: string): Promise<void> {
  await updateDoc(doc(reqDb(), 'games', gameId, 'results', questionId), {
    correctAnswer: deleteField(),
  });
}

// ---------- close ----------

/** Records the correct tiebreaker and closes the game; the onGameClose function emails results. */
export async function closeGame(gameId: string, tiebreakerAnswer: string): Promise<void> {
  await updateDoc(doc(reqDb(), 'games', gameId), {
    tiebreakerAnswer: tiebreakerAnswer.trim(),
    status: 'CLOSED' as GameStatus,
  });
}

// ---------- users (admin management) ----------

export function subscribeUsers(cb: (users: UserProfile[]) => void): Unsub {
  return onSnapshot(collection(reqDb(), 'users'), (snap) =>
    cb(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          displayName: (data.displayName as string) ?? 'Player',
          email: (data.email as string) ?? '',
          photoURL: (data.photoURL as string | null) ?? null,
          role: (data.role as Role) ?? 'user',
          createdAt: Number(data.createdAt ?? 0),
        };
      }),
    ),
  );
}

export async function setUserRole(uid: string, role: Role): Promise<void> {
  await updateDoc(doc(reqDb(), 'users', uid), { role });
}

// ---------- composed leaderboard ----------

/** Computes the live board client-side from raw submissions + results (post-lock readable). */
export function leaderboardFrom(game: Game, subs: Submission[], results: Results): LeaderboardEntry[] {
  const rankable: RankableSubmission[] = subs.map((s) => ({
    uid: s.uid,
    displayName: s.displayName ?? 'Player',
    photoURL: s.photoURL ?? null,
    matchPicks: s.matchPicks,
    propBetPicks: s.propBetPicks,
    tiebreakerAnswer: s.tiebreakerAnswer,
    submittedAt: s.submittedAt,
  }));
  return buildLeaderboard(game, rankable, results, game.status === 'CLOSED');
}
