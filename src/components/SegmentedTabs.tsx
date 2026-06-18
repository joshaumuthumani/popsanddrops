interface Tab<T extends string> {
  value: T;
  label: string;
}

interface SegmentedTabsProps<T extends string> {
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Pill-style tab group (gold active state), matching the prototype's screen tabs. */
export function SegmentedTabs<T extends string>({ tabs, value, onChange }: SegmentedTabsProps<T>) {
  return (
    <div
      className="flex gap-1"
      style={{
        background: 'rgba(255,255,255,.05)',
        border: '1px solid rgba(255,255,255,.09)',
        borderRadius: 11,
        padding: 4,
      }}
    >
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className="cursor-pointer font-extrabold"
            style={{
              border: 'none',
              fontFamily: 'inherit',
              fontSize: 13,
              padding: '9px 15px',
              borderRadius: 8,
              background: on ? 'rgba(231,201,47,.14)' : 'transparent',
              color: on ? '#E7C92F' : '#6B7A99',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
