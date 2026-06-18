import { CheckIcon } from '@/components/icons';

interface ToastProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

/** Full-screen confirm overlay (matches the prototype's #ple-toast). */
export function Toast({ open, title, message, onClose }: ToastProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      style={{ background: 'rgba(8,10,15,.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-[380px] text-center animate-pop"
        style={{
          background: '#0A1228',
          border: '1px solid rgba(231,201,47,.3)',
          borderRadius: 18,
          padding: 34,
          boxShadow: '0 40px 90px -30px rgba(0,0,0,.8)',
        }}
      >
        <div
          className="mx-auto mb-[18px] grid place-items-center"
          style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(231,201,47,.14)' }}
        >
          <CheckIcon size={32} strokeWidth={2.6} style={{ color: '#E7C92F' }} />
        </div>
        <div
          className="mb-2 uppercase"
          style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}
        >
          {title}
        </div>
        <div className="mb-6 text-muted" style={{ fontSize: 14.5, lineHeight: 1.55 }}>
          {message}
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer font-black text-ink"
          style={{
            border: 'none',
            background: 'linear-gradient(120deg,#F4DB6B,#E7C92F 50%,#C9A91F)',
            fontSize: 14.5,
            padding: '13px 28px',
            borderRadius: 11,
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
