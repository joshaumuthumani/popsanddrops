// Data hooks. Each subscribes to live Firestore when configured, and falls back to the
// Phase-0 mock data when no Firebase keys are present (so `npm run dev` still demos).

import { useEffect, useMemo, useState } from 'react';
import { isFirebaseConfigured } from '@/lib/firebase';
import type { Game, LeaderboardEntry, Results, Submission, UserProfile } from '@/types';
import * as store from '@/lib/store';
import { leaderboardFrom } from '@/lib/store';
import {
  MOCK_GAMES,
  MOCK_LEADERBOARD,
  MOCK_MY_SUBMISSION,
  MOCK_RESULTS,
} from '@/data/mock';

/** Picks freeze at lockTime regardless of stored status; CLOSED/CLOSING also count as locked. */
export function isLocked(game: Pick<Game, 'lockTime' | 'status'>): boolean {
  return Date.now() >= game.lockTime || ['LOCKED', 'CLOSING', 'CLOSED'].includes(game.status);
}

export function isGameAdmin(game: Game | null, user: UserProfile | null): boolean {
  if (!game || !user) return false;
  return user.role === 'superadmin' || game.admins.includes(user.uid);
}

export function useGame(gameId?: string) {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }
    if (!isFirebaseConfigured) {
      setGame(MOCK_GAMES.find((g) => g.id === gameId) ?? MOCK_GAMES[0]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return store.subscribeGame(gameId, (g) => {
      setGame(g);
      setLoading(false);
    });
  }, [gameId]);
  return { game, loading };
}

/** Games shown on the user dashboard: ones they've joined (have a submission in), with standing. */
export function useUserGames(user: UserProfile | null) {
  const [joined, setJoined] = useState<store.JoinedGame[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setJoined(MOCK_GAMES.map((game) => ({ game, myResult: { popCount: 0, dropCount: 0, rank: 0 } })));
      setLoading(false);
      return;
    }
    if (!user) {
      setJoined([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    store
      .fetchJoinedGames(user.uid)
      .then((j) => alive && setJoined(j))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user]);
  return { joined, loading };
}

/** Games on the admin dashboard: all (super admin) or ones the admin runs. */
export function useAdminGames(user: UserProfile | null) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setGames(MOCK_GAMES);
      setLoading(false);
      return;
    }
    if (!user) {
      setGames([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const cb = (g: Game[]) => {
      setGames(g);
      setLoading(false);
    };
    return user.role === 'superadmin'
      ? store.subscribeAllGames(cb)
      : store.subscribeAdminGames(user.uid, cb);
  }, [user]);
  return { games, loading };
}

export function useMySubmission(gameId: string | undefined, uid: string | undefined) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setSubmission(MOCK_MY_SUBMISSION);
      setLoading(false);
      return;
    }
    if (!gameId || !uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return store.subscribeMySubmission(gameId, uid, (s) => {
      setSubmission(s);
      setLoading(false);
    });
  }, [gameId, uid]);
  return { submission, loading };
}

export function useResults(gameId?: string) {
  const [results, setResults] = useState<Results>({});
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setResults(MOCK_RESULTS);
      return;
    }
    if (!gameId) return;
    return store.subscribeResults(gameId, setResults);
  }, [gameId]);
  return results;
}

/** All submissions — only readable by admins, or by anyone once the game is locked. */
export function useSubmissions(game: Game | null, user: UserProfile | null) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const canRead = game ? isGameAdmin(game, user) || isLocked(game) : false;
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setSubmissions([]);
      return;
    }
    if (!game || !canRead) {
      setSubmissions([]);
      return;
    }
    return store.subscribeSubmissions(game.id, setSubmissions);
  }, [game, canRead]);
  return { submissions, canRead };
}

/** The live Pop Rankings board, computed from raw submissions + results. */
export function useLeaderboard(game: Game | null, user: UserProfile | null): LeaderboardEntry[] {
  const { submissions, canRead } = useSubmissions(game, user);
  const results = useResults(game?.id);
  return useMemo(() => {
    if (!isFirebaseConfigured) return MOCK_LEADERBOARD;
    if (!game || !canRead) return [];
    return leaderboardFrom(game, submissions, results);
  }, [game, submissions, results, canRead]);
}

export function useUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return store.subscribeUsers((u) => {
      setUsers(u);
      setLoading(false);
    });
  }, []);
  return { users, loading };
}

/** Admin dashboard counts. */
export function useAdminStats(game: Game | null, user: UserProfile | null) {
  const { submissions } = useSubmissions(game, user);
  const count = submissions.length;
  return { playersJoined: count, submitted: count };
}
