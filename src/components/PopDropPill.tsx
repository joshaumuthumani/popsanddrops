import { CheckIcon, XIcon } from '@/components/icons';

export type GradeState = 'pop' | 'drop' | 'pending';

/** Pop ✓ (gold) / Drop ✗ (red) / Pending — the result reveal micro-copy (PRD §3). */
export function PopDropPill({ state }: { state: GradeState }) {
  if (state === 'pending') {
    return <span className="text-muted font-extrabold text-xs">Pending</span>;
  }
  if (state === 'pop') {
    return (
      <span className="flex items-center gap-1.5 font-black text-[13px]" style={{ color: '#E7C92F' }}>
        <CheckIcon size={16} strokeWidth={3} style={{ color: '#E7C92F' }} />
        POP
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 font-black text-[13px]" style={{ color: '#C0392B' }}>
      <XIcon size={16} strokeWidth={3} style={{ color: '#C0392B' }} />
      DROP
    </span>
  );
}
