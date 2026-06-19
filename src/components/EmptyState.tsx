import { Link } from 'react-router-dom';
import { Card } from '@/components/primitives';

/** Friendly empty/zero-data placeholder used across dashboards and boards. */
export function EmptyState({
  title,
  body,
  ctaLabel,
  to,
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  to?: string;
}) {
  return (
    <Card style={{ padding: '40px 28px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 8 }}>{title}</div>
      <p className="text-muted" style={{ fontSize: 14, maxWidth: 380, margin: '0 auto 18px', lineHeight: 1.55 }}>
        {body}
      </p>
      {ctaLabel && to && (
        <Link
          to={to}
          className="no-underline font-extrabold"
          style={{
            display: 'inline-block',
            background: 'linear-gradient(120deg,#F4DB6B,#E7C92F 50%,#C9A91F)',
            color: '#1A1408',
            padding: '12px 22px',
            borderRadius: 11,
            fontSize: 14,
          }}
        >
          {ctaLabel}
        </Link>
      )}
    </Card>
  );
}
