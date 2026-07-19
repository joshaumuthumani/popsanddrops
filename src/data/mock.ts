// Mock data for Phase 0 (UI-only, no backend). Mirrors the design prototype's
// "AEW All In 2026" game so screens render exactly as designed.

import type { Game, LeaderboardEntry, Submission, UserProfile } from '@/types';

export const MOCK_CURRENT_USER: UserProfile = {
  uid: 'u-you',
  displayName: 'Jordan D.',
  email: 'jordan@example.com',
  photoURL: null,
  role: 'superadmin', // lets the demo reach both User app and Admin console
  createdAt: Date.now() - 86_400_000 * 30,
};

// Lock time ~2h14m33s out, matching the prototype countdown feel.
const LOCK_TIME = Date.now() + (2 * 3600 + 14 * 60 + 33) * 1000;

export const MOCK_GAME: Game = {
  id: 'g-aew-allin-2026',
  name: 'AEW All In 2026',
  promotion: 'AEW',
  eventDate: '2026-08-30',
  lockTime: LOCK_TIME,
  // Two nights, so demo mode exercises night grouping. WrestleMania 42 below stays
  // single-night, covering the ungrouped path in the same session.
  dayCount: 2,
  status: 'OPEN',
  joinCode: 'SLAM-4827',
  tiebreakerQuestion: 'Main event match length, in minutes',
  admins: ['u-you', 'u-steph'],
  createdBy: 'u-you',
  createdAt: Date.now() - 86_400_000 * 3,
  matches: [
    {
      id: 'm1',
      name: 'AEW WORLD CHAMPIONSHIP',
      options: ['Swerve Strickland', 'Will Ospreay'],
      // Demo mode has no Storage, so this stands in as an inline SVG — it keeps the poster
      // render path visible in Phase-0 without reaching for a third-party image.
      posterUrl:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23022f84'/%3E%3Cstop offset='1' stop-color='%23c0392b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='320' height='180' fill='url(%23g)'/%3E%3Ctext x='160' y='96' font-family='sans-serif' font-size='15' font-weight='700' fill='rgba(255,255,255,.6)' text-anchor='middle' letter-spacing='3'%3EMATCH POSTER%3C/text%3E%3C/svg%3E",
    },
    { id: 'm2', name: 'AEW INTERNATIONAL CHAMPIONSHIP', options: ['Konosuke Takeshita', 'Kyle Fletcher'] },
    { id: 'm3', name: "AEW WOMEN'S WORLD TITLE", options: ['Toni Storm', 'Mariah May'] },
    { id: 'm4', day: 2, name: 'AEW TNT CHAMPIONSHIP', options: ['Jon Moxley', 'Darby Allin'] },
    { id: 'm5', day: 2, name: 'AEW WORLD TAG TEAM', options: ['The Young Bucks', 'FTR'] },
    {
      id: 'm6', day: 2,
      name: 'AEW CASINO GAUNTLET · WINNER',
      options: ['“Hangman” Adam Page', 'Kazuchika Okada', 'MJF', 'Orange Cassidy'],
      // Second demo poster, on a 4-option match — exercises the case where the choices
      // stack taller than the poster.
      posterUrl:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180'%3E%3Cdefs%3E%3ClinearGradient id='g2' x1='0' y1='1' x2='1' y2='0'%3E%3Cstop offset='0' stop-color='%230b52a1'/%3E%3Cstop offset='1' stop-color='%23c9a91f'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='320' height='180' fill='url(%23g2)'/%3E%3Ctext x='160' y='96' font-family='sans-serif' font-size='14' font-weight='700' fill='rgba(0,0,0,.45)' text-anchor='middle' letter-spacing='3'%3EGAUNTLET%3C/text%3E%3C/svg%3E",
    },
  ],
  propBets: [
    { id: 'p1', question: 'A new champion is crowned tonight?', options: ['Yes', 'No'] },
    { id: 'p2', question: 'Will the main event go past 25 minutes?', options: ['Yes', 'No'] },
    { id: 'p3', day: 2, question: 'Will there be a surprise return or debut?', options: ['Yes', 'No'] },
    { id: 'p4', day: 2, question: 'How does the main event end?', options: ['Pinfall', 'Submission', 'DQ / No contest'] },
  ],
};

// A second game so the User dashboard + Admin dashboard list feel real.
export const MOCK_GAMES: Game[] = [
  MOCK_GAME,
  {
    id: 'g-wm42',
    name: 'WrestleMania 42',
    promotion: 'WWE',
    eventDate: '2026-04-05',
    lockTime: Date.now() - 86_400_000 * 4,
    dayCount: 1,
    status: 'CLOSED',
    joinCode: 'MANIA-1042',
    tiebreakerQuestion: 'Total match time of the main event, in minutes',
    admins: ['u-you'],
    createdBy: 'u-you',
    createdAt: Date.now() - 86_400_000 * 40,
    matches: [
      { id: 'wm1', name: 'UNDISPUTED WWE CHAMPIONSHIP', options: ['Cody Rhodes', 'Roman Reigns'] },
      { id: 'wm2', name: 'WORLD HEAVYWEIGHT CHAMPIONSHIP', options: ['Gunther', 'Jey Uso'] },
    ],
    propBets: [{ id: 'wp1', question: 'A title changes hands?', options: ['Yes', 'No'] }],
  },
];

// The current user's in-progress submission for the live board demo.
export const MOCK_MY_SUBMISSION: Submission = {
  uid: 'u-you',
  matchPicks: { m1: 'Swerve Strickland', m2: 'Konosuke Takeshita', m3: 'Toni Storm', m4: 'Darby Allin' },
  propBetPicks: {},
  tiebreakerAnswer: '23',
  submittedAt: Date.now() - 3_600_000,
  popCount: 2,
  dropCount: 1,
  rank: 3,
};

// Partial graded results for the live board (matches the prototype reveal state).
export const MOCK_RESULTS: Record<string, string> = {
  m1: 'Swerve Strickland', // Pop
  m2: 'Kyle Fletcher', // Drop (user picked Takeshita)
  m3: 'Toni Storm', // Pop
};

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { uid: 'u-dwayne', displayName: 'Dwayne K.', photoURL: null, initials: 'DK', popCount: 3, dropCount: 0, tiebreakerAnswer: '24', rank: 1 },
  { uid: 'u-steph', displayName: 'Steph R.', photoURL: null, initials: 'SR', popCount: 3, dropCount: 0, tiebreakerAnswer: '27', rank: 2 },
  { uid: 'u-you', displayName: 'You', photoURL: null, initials: 'JD', popCount: 2, dropCount: 1, tiebreakerAnswer: '23', rank: 3 },
  { uid: 'u-marcus', displayName: 'Marcus J.', photoURL: null, initials: 'MJ', popCount: 2, dropCount: 1, tiebreakerAnswer: '22', rank: 4 },
];

export const MOCK_ADMIN_STATS = {
  playersJoined: 14,
  submitted: 11,
};
