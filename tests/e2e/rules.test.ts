import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

/**
 * Firestore rules tests, run against the emulator.
 *
 * These exist because demo mode and unit tests structurally cannot reach this logic, and
 * every serious bug this project has shipped lived exactly here:
 *   - the collection-group rule that was present but at the wrong path, silently blanking
 *     every player's dashboard for weeks (see CLAUDE.md, "the dashboard's collection-group
 *     query needs three things")
 *   - the server-clock pick lock, which must not be replaceable by a status check
 *   - closed games being frozen
 *
 * A green typecheck told us nothing about any of them.
 */

// The `demo-` prefix is Firebase's documented convention for a project the emulators will
// never attempt auth or billing calls for. Belt and braces on top of the --project override
// in the npm script: nothing here should be able to reach the real popsanddrops project.
const PROJECT_ID = 'demo-popsanddrops-rules';

let testEnv: RulesTestEnvironment;

// Relative to now, not hardcoded dates. A literal future timestamp is a test that silently
// starts failing on a particular morning years from now, for reasons nobody will connect to
// this file.
const LOCK_TIME = Date.now() + 365 * 24 * 60 * 60 * 1000;
const PAST_LOCK = Date.now() - 365 * 24 * 60 * 60 * 1000;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seed with rules disabled: profiles, one open game, and two players' submissions.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/player1'), { role: 'user', displayName: 'Player One' });
    await setDoc(doc(db, 'users/player2'), { role: 'user', displayName: 'Player Two' });
    await setDoc(doc(db, 'users/admin1'), { role: 'admin', displayName: 'Admin' });
    await setDoc(doc(db, 'users/super1'), { role: 'superadmin', displayName: 'Super' });

    await setDoc(doc(db, 'games/openGame'), {
      status: 'OPEN',
      lockTime: LOCK_TIME,
      createdBy: 'admin1',
      dayCount: 1,
    });
    await setDoc(doc(db, 'games/lockedGame'), {
      status: 'OPEN', // status still OPEN, but the clock is past lockTime
      lockTime: PAST_LOCK,
      createdBy: 'admin1',
      dayCount: 1,
    });
    await setDoc(doc(db, 'games/closedGame'), {
      status: 'CLOSED',
      lockTime: PAST_LOCK,
      createdBy: 'admin1',
      dayCount: 1,
    });

    await setDoc(doc(db, 'games/openGame/submissions/player1'), {
      uid: 'player1',
      matchPicks: {},
      propBetPicks: {},
      tiebreakerAnswer: '',
      submittedAt: 1,
    });
    await setDoc(doc(db, 'games/openGame/submissions/player2'), {
      uid: 'player2',
      matchPicks: {},
      propBetPicks: {},
      tiebreakerAnswer: '',
      submittedAt: 2,
    });
    await setDoc(doc(db, 'games/lockedGame/submissions/player2'), {
      uid: 'player2',
      matchPicks: {},
      propBetPicks: {},
      tiebreakerAnswer: '',
      submittedAt: 3,
    });
  });
});

const asPlayer1 = () => testEnv.authenticatedContext('player1').firestore();
const asAdmin = () => testEnv.authenticatedContext('admin1').firestore();
const asSuper = () => testEnv.authenticatedContext('super1').firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

describe('collection-group query on submissions', () => {
  // The regression test for the bug that blanked every dashboard. This query is what the
  // player dashboard runs; it needs the recursive-wildcard rule, and a nested rule with the
  // identical condition does NOT authorize it.
  it('lets a player read their own submissions across all games', async () => {
    const db = asPlayer1();
    const q = query(collectionGroup(db, 'submissions'), where('uid', '==', 'player1'));
    const snap = await assertSucceeds(getDocs(q));
    expect(snap.docs.map((d) => d.data().uid)).toEqual(['player1']);
  });

  it('returns every game a player has entered, not just one', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'games/lockedGame/submissions/player1'), {
        uid: 'player1',
        matchPicks: {},
        propBetPicks: {},
        tiebreakerAnswer: '',
        submittedAt: 4,
      });
    });

    const db = asPlayer1();
    const q = query(collectionGroup(db, 'submissions'), where('uid', '==', 'player1'));
    const snap = await assertSucceeds(getDocs(q));
    expect(snap.size).toBe(2);
  });

  // The three negative tests below pin the `resource.data.uid == uid()` SCOPING clause, not
  // the existence of the recursive wildcard itself. Worth being precise about: if the whole
  // rule were deleted, every collection-group query would be denied and these three would
  // still pass — for the wrong reason. The two positive tests above are what actually catch
  // that, and they are the ones verified by mutation.
  it("refuses a query for someone else's submissions", async () => {
    const db = asPlayer1();
    const q = query(collectionGroup(db, 'submissions'), where('uid', '==', 'player2'));
    await assertFails(getDocs(q));
  });

  it('refuses an unfiltered collection-group query', async () => {
    const db = asPlayer1();
    await assertFails(getDocs(query(collectionGroup(db, 'submissions'))));
  });

  it('refuses anonymous access entirely', async () => {
    const db = asAnon();
    const q = query(collectionGroup(db, 'submissions'), where('uid', '==', 'player1'));
    await assertFails(getDocs(q));
  });
});

describe('pick lock is enforced by the server clock', () => {
  it('allows a player to submit while the game is open and before lock', async () => {
    const db = asPlayer1();
    await assertSucceeds(
      setDoc(doc(db, 'games/openGame/submissions/player1'), {
        uid: 'player1',
        matchPicks: { m1: 'Roman' },
        propBetPicks: {},
        tiebreakerAnswer: '5',
        submittedAt: 10,
      }),
    );
  });

  it('refuses a submission once past lockTime even though status is still OPEN', async () => {
    // The invariant: the lock is the server clock, not the stored status. A forgotten
    // status flip must not reopen submissions.
    const db = asPlayer1();
    await assertFails(
      setDoc(doc(db, 'games/lockedGame/submissions/player1'), {
        uid: 'player1',
        matchPicks: { m1: 'Roman' },
        propBetPicks: {},
        tiebreakerAnswer: '5',
        submittedAt: 10,
      }),
    );
  });

  it("refuses a player writing to someone else's submission document", async () => {
    const db = asPlayer1();
    await assertFails(
      setDoc(doc(db, 'games/openGame/submissions/player2'), {
        uid: 'player2',
        matchPicks: { m1: 'Seth' },
        propBetPicks: {},
        tiebreakerAnswer: '',
        submittedAt: 10,
      }),
    );
  });

  it('refuses a submission claiming a different uid than the caller', async () => {
    const db = asPlayer1();
    await assertFails(
      setDoc(doc(db, 'games/openGame/submissions/player1'), {
        uid: 'player2',
        matchPicks: {},
        propBetPicks: {},
        tiebreakerAnswer: '',
        submittedAt: 10,
      }),
    );
  });
});

describe('reading other players picks', () => {
  it("hides another player's picks before lock", async () => {
    const db = asPlayer1();
    await assertFails(getDoc(doc(db, 'games/openGame/submissions/player2')));
  });

  it("reveals another player's picks after lock", async () => {
    const db = asPlayer1();
    await assertSucceeds(getDoc(doc(db, 'games/lockedGame/submissions/player2')));
  });

  it('lets an admin read submissions before lock', async () => {
    const db = asAdmin();
    await assertSucceeds(getDoc(doc(db, 'games/openGame/submissions/player2')));
  });
});

describe('closed games are frozen', () => {
  it('refuses an admin editing a closed game', async () => {
    const db = asAdmin();
    await assertFails(setDoc(doc(db, 'games/closedGame'), { status: 'OPEN' }, { merge: true }));
  });

  it('refuses an admin writing results to a closed game', async () => {
    const db = asAdmin();
    await assertFails(setDoc(doc(db, 'games/closedGame/results/m1'), { value: 'Roman' }));
  });

  it('allows an admin to write results while the game is live', async () => {
    const db = asAdmin();
    await assertSucceeds(setDoc(doc(db, 'games/openGame/results/m1'), { value: 'Roman' }));
  });

  it('refuses a non-admin writing results at all', async () => {
    const db = asPlayer1();
    await assertFails(setDoc(doc(db, 'games/openGame/results/m1'), { value: 'Roman' }));
  });
});

describe('the shared-admin model', () => {
  // Access is by global role, never by createdBy or per-game membership. A freshly
  // promoted admin who saw an empty console was a real bug here.
  it('lets any admin edit a game they did not create', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/admin2'), { role: 'admin', displayName: 'Other' });
    });
    const db = testEnv.authenticatedContext('admin2').firestore();
    await assertSucceeds(setDoc(doc(db, 'games/openGame'), { status: 'LOCKED' }, { merge: true }));
  });

  it('refuses a plain user editing a game', async () => {
    const db = asPlayer1();
    await assertFails(setDoc(doc(db, 'games/openGame'), { status: 'LOCKED' }, { merge: true }));
  });

  it('lets only a super admin delete a game', async () => {
    await assertFails(assertDelete(asAdmin()));
    await assertSucceeds(assertDelete(asSuper()));
  });
});

describe('role escalation', () => {
  it('refuses a user promoting themselves to admin', async () => {
    const db = asPlayer1();
    await assertFails(
      setDoc(doc(db, 'users/player1'), { role: 'admin', displayName: 'Player One' }),
    );
  });

  it('lets a user update their own profile without touching role', async () => {
    const db = asPlayer1();
    await assertSucceeds(
      setDoc(doc(db, 'users/player1'), { role: 'user', displayName: 'Renamed' }),
    );
  });

  it('lets a super admin promote someone', async () => {
    const db = asSuper();
    await assertSucceeds(
      setDoc(doc(db, 'users/player1'), { role: 'admin', displayName: 'Player One' }),
    );
  });
});

describe('leaderboard is server-written only', () => {
  it('refuses a client write even from an admin', async () => {
    const db = asAdmin();
    await assertFails(setDoc(doc(db, 'games/openGame/leaderboard/current'), { entries: [] }));
  });

  it('allows any signed-in user to read it', async () => {
    const db = asPlayer1();
    await assertSucceeds(getDoc(doc(db, 'games/openGame/leaderboard/current')));
  });
});

// Small helper — deleteDoc imported lazily to keep the import list above readable.
async function assertDelete(db: ReturnType<typeof asAdmin>) {
  const { deleteDoc } = await import('firebase/firestore');
  return deleteDoc(doc(db, 'games/openGame'));
}
