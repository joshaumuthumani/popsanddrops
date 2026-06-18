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
}

/** A prop bet — pick one answer from the options. */
export interface PropBet {
  id: string;
  question: string;
  options: string[];
}

export interface Game {
  id: string;
  name: string;
  promotion: string;
  /** ISO date string for the event. */
  eventDate: string;
  /** Epoch millis when picks lock. Source of truth for the countdown. */
  lockTime: number;
  status: GameStatus;
  matches: Match[];
  propBets: PropBet[];
  tiebreakerQuestion: string;
  /** Shareable invite code, e.g. "SLAM-4827". */
  joinCode: string;
  /** uids of the owner + co-admins. */
  admins: string[];
  createdBy: string;
  createdAt: number;
}

export interface Submission {
  uid: string;
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
