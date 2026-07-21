import type { Game } from '@/types';

/** One row in the game builder/editor before it's cleaned into a domain question. */
export interface DraftQuestion {
  id: string;
  label: string;
  options: string[];
  /** Matches only — a Storage URL for the match poster. Prop bets never carry one. */
  posterUrl?: string;
  /** 1-based night. Only meaningful when the event runs more than one night. */
  day?: number;
}

export const newId = () => Math.random().toString(36).slice(2, 8);

/** The form's editable state, hydrated from an existing game (edit) or blank (create). */
export interface GameFormInitial {
  name: string;
  promotion: string;
  eventDate: string;
  /** Value for <input type="datetime-local">, i.e. "YYYY-MM-DDTHH:mm" in local time. */
  lockTimeLocal: string;
  dayCount: number;
  tiebreaker: string;
  matches: DraftQuestion[];
  props: DraftQuestion[];
}

/** A blank form: one empty match, a Yes/No prop, single night. */
export function emptyGameForm(): GameFormInitial {
  return {
    name: '',
    promotion: '',
    eventDate: '',
    lockTimeLocal: '',
    dayCount: 1,
    tiebreaker: '',
    matches: [{ id: newId(), label: '', options: ['', ''] }],
    props: [{ id: newId(), label: '', options: ['Yes', 'No'] }],
  };
}

/** Hydrate the form from an existing game (edit mode). */
export function draftFromGame(game: Game): GameFormInitial {
  const toDraft = (q: { id: string; options: string[]; day?: number }, label: string, posterUrl?: string): DraftQuestion => ({
    id: q.id,
    label,
    options: [...q.options],
    day: q.day,
    ...(posterUrl ? { posterUrl } : {}),
  });
  // epoch millis -> "YYYY-MM-DDTHH:mm" in LOCAL time for the datetime-local input.
  const local = new Date(game.lockTime - new Date(game.lockTime).getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  return {
    name: game.name,
    promotion: game.promotion,
    eventDate: game.eventDate,
    lockTimeLocal: local,
    dayCount: Math.max(1, game.dayCount || 1),
    tiebreaker: game.tiebreakerQuestion,
    matches: game.matches.map((m) => toDraft(m, m.name, m.posterUrl)),
    props: game.propBets.map((p) => toDraft(p, p.question)),
  };
}

/** DraftQuestion -> domain-shaped question, dropping blank options/rows. */
export const cleanQuestions = (qs: DraftQuestion[]) =>
  qs
    .map((q) => ({
      id: q.id,
      label: q.label.trim(),
      options: q.options.map((o) => o.trim()).filter(Boolean),
      posterUrl: q.posterUrl,
      day: q.day,
    }))
    .filter((q) => q.label && q.options.length >= 2);
