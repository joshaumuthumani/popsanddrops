import type { CSSProperties, ReactNode } from 'react';

/** Dark card surface (#0A1228 with faint border) — the app's base panel. */
export function Card({ children, style, className = '' }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: '#0A1228',
        border: '1px solid rgba(255,255,255,.07)',
        borderRadius: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Gold uppercase section label, e.g. "MATCH PREDICTIONS · 1 POP EACH". */
export function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="uppercase"
      style={{ fontWeight: 900, fontSize: 13, letterSpacing: '.1em', color: '#E7C92F', ...style }}
    >
      {children}
    </div>
  );
}

/**
 * Night divider for multi-night cards, e.g. "NIGHT 1". Sits ABOVE the Match/Prop section
 * labels, so it's deliberately larger and uses the display face — the hierarchy has to read
 * as "night contains sections", not the other way round. Never rendered for single-night
 * games (questionsByDay returns an empty label).
 */
export function NightHeading({ label, style }: { label: string; style?: CSSProperties }) {
  return (
    <div className="flex items-center gap-3" style={{ margin: '10px 0 16px', ...style }}>
      <span
        className="uppercase whitespace-nowrap"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: 26,
          lineHeight: 1,
          letterSpacing: '.04em',
          color: '#77E0E8',
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(119,224,232,.35),transparent)' }} />
    </div>
  );
}

/** Cyan eyebrow above page titles, e.g. "USER APP · PARTICIPANT". */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div style={{ color: '#77E0E8', fontWeight: 900, fontSize: 11, letterSpacing: '.22em', marginBottom: 8 }}>
      {children}
    </div>
  );
}

/** Big Bebas Neue page title. */
export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1
      className="uppercase"
      style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'clamp(28px,4vw,42px)', lineHeight: 1 }}
    >
      {children}
    </h1>
  );
}

/** Primary gold gradient CTA. */
export function GoldButton({
  children,
  onClick,
  full = false,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  full?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer font-black text-ink"
      style={{
        fontFamily: 'inherit',
        border: 'none',
        background: 'linear-gradient(120deg,#F4DB6B,#E7C92F 50%,#C9A91F)',
        fontSize: 16,
        padding: 18,
        borderRadius: 13,
        boxShadow: '0 10px 30px rgba(231,201,47,.26)',
        width: full ? '100%' : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Live banner (red, pulsing dot) used on Make Picks and Live Control. */
export function LiveBanner({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3.5"
      style={{
        background: 'linear-gradient(90deg,rgba(192,57,43,.14),rgba(192,57,43,.02))',
        border: '1px solid rgba(192,57,43,.3)',
        borderRadius: 14,
        padding: '16px 20px',
      }}
    >
      <span
        className="flex-none animate-pulse-dot"
        style={{ width: 9, height: 9, borderRadius: '50%', background: '#C0392B', boxShadow: '0 0 10px #C0392B' }}
      />
      <div className="flex-1">
        <div style={{ fontWeight: 800, fontSize: 14.5 }}>{title}</div>
        <div className="text-muted" style={{ fontSize: 13 }}>
          {subtitle}
        </div>
      </div>
      {right}
    </div>
  );
}

/** Big number stat card (Pop Count / Rank / Players joined, etc.). */
export function StatCard({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: highlight
          ? 'linear-gradient(180deg,rgba(231,201,47,.1),rgba(231,201,47,.02))'
          : '#0A1228',
        border: `1px solid ${highlight ? 'rgba(231,201,47,.28)' : 'rgba(255,255,255,.07)'}`,
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '.1em',
          color: highlight ? '#E7C92F' : '#6B7A99',
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, lineHeight: 1.1 }}>
        {value}
        {sub && <span style={{ fontSize: 18, color: '#6B7A99' }}>{sub}</span>}
      </div>
    </div>
  );
}
