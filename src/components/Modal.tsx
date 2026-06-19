import { useEffect, type ReactNode } from 'react';

/** Centered overlay dialog. Click-outside and Escape close it; body scroll is locked while open. */
export function Modal({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.66)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '86vh',
          overflowY: 'auto',
          background: '#0A1228',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 18,
          padding: 24,
          boxShadow: '0 30px 80px rgba(0,0,0,.55)',
        }}
      >
        <div className="flex items-center justify-between gap-3" style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, textTransform: 'uppercase', lineHeight: 1.05 }}>
            {title}
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer bg-transparent flex-none"
            style={{ border: 'none', color: '#6B7A99', fontSize: 22, lineHeight: 1 }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
