import { useLayoutEffect, useRef, useState } from 'react';

interface Tab<T extends string> {
  value: T;
  label: string;
}

interface SegmentedTabsProps<T extends string> {
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Connect each tab to its associated tabpanel when the parent renders one. */
  ariaControls?: (value: T) => string;
}

/**
 * Pill-style tab group (gold active state), matching the prototype's screen tabs.
 *
 * The active pill is a single element that slides between tabs on change — one clear
 * "the selection moved here" gesture rather than the old instant background swap
 * (emilkowalski/skills: state indication + spatial consistency, ease-out, ~220ms). Its
 * position is measured from the active button so it stays correct at any label width, and
 * the slide is neutralised under `prefers-reduced-motion` by the global rule in index.css.
 */
export function SegmentedTabs<T extends string>({ tabs, value, onChange, ariaControls }: SegmentedTabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  // Measure the active tab relative to the container so the pill lands exactly on it,
  // regardless of padding, gaps, or differing label widths. Runs before paint (no flash),
  // and re-runs on selection change and on resize.
  useLayoutEffect(() => {
    const measure = () => {
      const el = btnRefs.current[value];
      const container = containerRef.current;
      if (!el || !container) return;
      const c = container.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      setPill({ left: b.left - c.left, top: b.top - c.top, width: b.width, height: b.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [value, tabs]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Game views"
      className="relative flex gap-1"
      style={{
        background: 'rgba(255,255,255,.05)',
        border: '1px solid rgba(255,255,255,.09)',
        borderRadius: 11,
        padding: 4,
      }}
    >
      {pill && (
        <span
          aria-hidden
          className="seg-pill absolute"
          style={{
            left: 0,
            top: 0,
            width: pill.width,
            height: pill.height,
            transform: `translate(${pill.left}px, ${pill.top}px)`,
            background: 'rgba(231,201,47,.14)',
            borderRadius: 8,
            pointerEvents: 'none',
          }}
        />
      )}
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              btnRefs.current[t.value] = el;
            }}
            onClick={() => onChange(t.value)}
            id={`tab-${t.value}`}
            role="tab"
            aria-selected={on}
            aria-controls={ariaControls?.(t.value)}
            tabIndex={on ? 0 : -1}
            className="seg-tab cursor-pointer font-extrabold relative"
            style={{
              border: 'none',
              fontFamily: 'inherit',
              fontSize: 13,
              padding: '9px 15px',
              borderRadius: 8,
              background: 'transparent',
              color: on ? '#E7C92F' : '#6B7A99',
              zIndex: 1,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
