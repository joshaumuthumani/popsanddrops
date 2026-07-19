// Domain types — mirror the Firestore data model (PRD §7).
// Engineering may use "score" internally; UI copy always uses Pop / Drop (PRD §3).

export type Role = 'user' | 'admin' | 'superadmin';

export type GameStatus = 'DRAFT' | 'OPEN' | 'LOCKED' | 'CLOSING' | 'CLOSED';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  role: Role;
  createdAt: number;
}

/** A single match — pick the winner from competitor options. */
export interface Match {
  id: string;
  /** Short label shown above the options, e.g. "AEW WORLD CHAMPIONSHIP". */
  name: string;
  options: string[];
  /**
   * Match poster, rendered as a 16:9 banner atop the pick card. In live mode this is always a
   * Firebase Storage download URL — pasted links are re-hosted (see src/lib/posters.ts) so the
   * app never depends on a third-party CDN, and no third-party URL is ever persisted here.
   * Demo-mode fixtures in src/data/mock.ts use inline `data:` URIs, which are never written to
   * Firestore; don't assume this parses as a Storage URL. Optional: matches may have no poster.
   */
  posterUrl?: string;
  /** 1-based night this match belongs to on a multi-night card. Absent ⇒ night 1. */
  day?: number;
}

/** A prop bet — pick one answer from the options. */
export interface PropBet {
  id: string;
  question: string;
  options: string[];
  /** 1-based night this prop belongs to on a multi-night card. Absent ⇒ night 1. */
  day?: number;
}

export interface Game {
  id: string;
  name: string;
  promotion: string;
  /** ISO date string for the event. */
  eventDate: string;
  /**
   * Epoch millis when picks lock. Source of truth for the countdown. One lock for the
   * whole game even on multi-night cards — nights are a presentational grouping, not an
   * access boundary (see docs/superpowers/specs/2026-07-19-multi-night-events-design.md).
   */
  lockTime: number;
  /** How many nights the event runs. 1 for a normal single-night card. */
  dayCount: number;
  /**
   * Nights whose interim standings email has already gone out. Written server-side by the
   * sendNightStandings callable so a retry can't mail the whole pod twice.
   */
  standingsSentFor?: number[];
  status: GameStatus;
  matches: Match[];
  propBets: PropBet[];
  tiebreakerQuestion: string;
  /** Correct tiebreaker answer, entered by an admin at close time. */
  tiebreakerAnswer?: string;
  /** Shareable invite code, e.g. "SLAM-4827". */
  joinCode: string;
  /** uids of the owner + co-admins. */
  admins: string[];
  createdBy: string;
  createdAt: number;
}

export interface Submission {
  uid: string;
  /** Denormalized from the user's profile so the live board needs no /users reads. */
  displayName?: string;
  photoURL?: string | null;
  /** matchId -> chosen option */
  matchPicks: Record<string, string>;
  /** propBetId -> chosen option */
  propBetPicks: Record<string, string>;
  tiebreakerAnswer: string;
  submittedAt: number;
  // Computed server-side (Cloud Function). "score" internal naming is allowed.
  popCount: number;
  dropCount: number;
  rank: number;
}

/** A result entered by an admin: questionId -> correct answer. */
export type Results = Record<string, string>;

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string | null;
  initials: string;
  popCount: number;
  dropCount: number;
  tiebreakerAnswer: string;
  rank: number;
}
