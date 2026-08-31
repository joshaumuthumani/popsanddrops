import type { ReactNode } from 'react';
import { CheckIcon } from '@/components/icons';

interface PickButtonProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  align?: 'center' | 'left';
  /** Show a leading check when selected (admin "mark winner" style). */
  showCheck?: boolean;
  size?: 'md' | 'lg';
}

/**
 * Selectable option button. Idle = faint white border; selected = gold border,
 * gold tint, gold text — exact values from the prototype's selPick/unselPick.
 */
export function PickButton({ selected, onClick, children, align = 'center', showCheck = false, size = 'md' }: PickButtonProps) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer font-extrabold pick-btn"
      style={{
        fontFamily: 'inherit',
        fontSize: size === 'lg' ? 15 : 14.5,
        padding: size === 'lg' ? 15 : 14,
        borderRadius: 11,
        border: `1.5px solid ${selected ? '#E7C92F' : 'rgba(255,255,255,.1)'}`,
        background: selected ? 'rgba(231,201,47,.14)' : 'rgba(255,255,255,.03)',
        color: selected ? '#E7C92F' : '#C8D4E8',
        textAlign: align,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        gap: 8,
        width: '100%',
      }}
    >
      {showCheck && selected && <CheckIcon size={16} strokeWidth={3} style={{ color: '#E7C92F' }} />}
      {children}
    </button>
  );
}
