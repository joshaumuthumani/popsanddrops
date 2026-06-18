// Player avatar — gold gradient for "you"/#1, navy for everyone else,
// or the Google photo when available. Matches the prototype avatars.

interface AvatarProps {
  initials: string;
  photoURL?: string | null;
  highlight?: boolean;
  size?: number;
}

export function Avatar({ initials, photoURL, highlight = false, size = 30 }: AvatarProps) {
  const style = {
    width: size,
    height: size,
    fontSize: size <= 30 ? 12 : 13,
  };
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={initials}
        style={{ ...style, objectFit: 'cover' }}
        className="rounded-full flex-none"
      />
    );
  }
  return (
    <div
      style={style}
      className={`flex-none grid place-items-center rounded-full font-black ${
        highlight ? 'text-base' : 'text-textsoft'
      }`}
      // Inline gradient/solid to hit the exact prototype colors.
      // gold gradient for highlight, navy card otherwise.
    >
      <span
        style={{
          width: size,
          height: size,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '9999px',
          background: highlight ? 'linear-gradient(135deg,#E7C92F,#B8941C)' : '#1C2E5A',
          color: highlight ? '#080810' : '#C8D4E8',
        }}
      >
        {initials}
      </span>
    </div>
  );
}
