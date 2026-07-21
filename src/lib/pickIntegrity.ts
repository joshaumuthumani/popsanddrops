import type { Game, Submission } from '@/types';

/** A question reduced to what pick-integrity needs: its id and current options. */
export interface QuestionOptions {
  id: string;
  options: string[];
}

/** Impact of a pending edit on already-submitted picks. */
export interface OrphanImpact {
  /** Distinct submissions with at least one orphaned pick. */
  totalAffected: number;
  /** Per (question, chosen option) tally, for a human-readable warning. */
  byOption: { questionId: string; option: string; count: number }[];
}

/** All gradeable questions of a game (matches then prop bets) as {id, options}. */
export function gameQuestions(game: Pick<Game, 'matches' | 'propBets'>): QuestionOptions[] {
  return [
    ...game.matches.map((m) => ({ id: m.id, options: m.options })),
    ...game.propBets.map((p) => ({ id: p.id, options: p.options })),
  ];
}

/** matchPicks + propBetPicks merged into one id->option map (ids are unique across both). */
export function submissionPicks(
  sub: Pick<Submission, 'matchPicks' | 'propBetPicks'>,
): Record<string, string> {
  return { ...sub.matchPicks, ...sub.propBetPicks };
}

/**
 * Question ids whose saved pick is orphaned: a non-empty pick for a question that no longer
 * exists, or whose chosen option is no longer offered. Scoring matches the saved option
 * STRING, so an orphaned pick can never score again — this is the core edit hazard.
 */
export function orphanedPickIds(
  questions: QuestionOptions[],
  picks: Record<string, string>,
): string[] {
  const byId = new Map(questions.map((q) => [q.id, q.options]));
  return Object.entries(picks)
    .filter(([id, choice]) => {
      if (!choice) return false;
      const options = byId.get(id);
      if (!options) return true;
      return !options.includes(choice);
    })
    .map(([id]) => id);
}

/** Current question ids the player hasn't answered (added after they submitted, or skipped). */
export function unansweredQuestionIds(
  questions: QuestionOptions[],
  picks: Record<string, string>,
): string[] {
  return questions.filter((q) => !picks[q.id]).map((q) => q.id);
}

/**
 * Aggregate orphan impact of a pending edit: pass the DRAFT (edited) questions and the game's
 * existing submissions. Powers the admin's pre-save confirmation.
 */
export function orphanImpact(
  questions: QuestionOptions[],
  submissions: Pick<Submission, 'matchPicks' | 'propBetPicks'>[],
): OrphanImpact {
  // Nested map (questionId -> option -> count) rather than a delimited string key: option
  // text is free-form and routinely contains spaces ("Roman Reigns"), so any single-char
  // separator would truncate the option on split.
  const perQuestion = new Map<string, Map<string, number>>();
  let totalAffected = 0;
  for (const sub of submissions) {
    const picks = submissionPicks(sub);
    const orphans = orphanedPickIds(questions, picks);
    if (orphans.length) totalAffected++;
    for (const qid of orphans) {
      const option = picks[qid];
      const options = perQuestion.get(qid) ?? new Map<string, number>();
      options.set(option, (options.get(option) ?? 0) + 1);
      perQuestion.set(qid, options);
    }
  }
  const byOption: OrphanImpact['byOption'] = [];
  for (const [questionId, options] of perQuestion) {
    for (const [option, count] of options) byOption.push({ questionId, option, count });
  }
  return { totalAffected, byOption };
}
