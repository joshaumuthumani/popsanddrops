import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Game } from '@/types';
import { Card, GoldButton, SectionLabel } from '@/components/primitives';
import { Countdown } from '@/components/Countdown';
import { Avatar } from '@/components/Avatar';
import { ArrowRightIcon } from '@/components/icons';
import { MOCK_ADMIN_STATS } from '@/data/mock';

interface Props {
  game: Game;
  onEnterLive: () => void;
}

/** ADMIN · DASHBOARD — countdown, join code, co-admins, "Enter live results" (design admin-dash). */
export function AdminDashboardPanel({ game, onEnterLive }: Props) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const open = game.status === 'OPEN';

  const copyLink = () => {
    const link = `${window.location.origin}/join/${game.joinCode}`;
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section>
      {/* top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginBottom: 18 }}>
        <div
          style={{
            gridColumn: 'span 2',
            minWidth: 280,
            background: 'linear-gradient(120deg,rgba(192,57,43,.16),rgba(192,57,43,.03))',
            border: '1px solid rgba(192,57,43,.3)',
            borderRadius: 16,
            padding: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#F39AAB', marginBottom: 6 }}>
              SUBMISSIONS LOCK IN
            </div>
            <Countdown targetMs={game.lockTime} size="lg" sepColor="#7a3a45" />
          </div>
          <div className="flex items-center gap-2" style={{ background: 'rgba(0,0,0,.25)', borderRadius: 999, padding: '8px 14px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E7C92F', boxShadow: '0 0 8px #E7C92F' }} />
            <span style={{ fontWeight: 800, fontSize: 12.5 }}>{open ? 'Open for picks' : game.status}</span>
          </div>
        </div>
        <Card style={{ padding: 22, borderRadius: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: '#6B7A99' }}>PLAYERS JOINED</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 48, lineHeight: 1.1 }}>{MOCK_ADMIN_STATS.playersJoined}</div>
        </Card>
        <Card style={{ padding: 22, borderRadius: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: '#6B7A99' }}>SUBMITTED</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 48, lineHeight: 1.1 }}>
            {MOCK_ADMIN_STATS.submitted}
            <span style={{ fontSize: 18, color: '#6B7A99' }}>/{MOCK_ADMIN_STATS.playersJoined}</span>
          </div>
        </Card>
      </div>

      {/* invite + co-admins */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14, marginBottom: 18 }}>
        <Card style={{ padding: 22, borderRadius: 16 }}>
          <SectionLabel style={{ fontSize: 13, letterSpacing: '.08em', marginBottom: 14 }}>Invite your group</SectionLabel>
          <div className="flex gap-2.5 items-center flex-wrap">
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 26,
                letterSpacing: '.14em',
                background: 'rgba(0,0,0,.3)',
                border: '1.5px dashed rgba(231,201,47,.4)',
                borderRadius: 11,
                padding: '10px 18px',
                color: '#E7C92F',
              }}
            >
              {game.joinCode}
            </div>
            <button
              onClick={copyLink}
              className="cursor-pointer font-extrabold transition-all duration-200"
              style={{
                fontFamily: 'inherit',
                fontSize: 13.5,
                border: `1.5px solid ${copied ? '#E7C92F' : 'rgba(255,255,255,.16)'}`,
                background: 'transparent',
                color: copied ? '#E7C92F' : '#F5F5F5',
                padding: '12px 18px',
                borderRadius: 10,
              }}
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>
            Anyone with the code can join and sign in with Google — no manual adds.
          </p>
        </Card>

        <Card style={{ padding: 22, borderRadius: 16 }}>
          <SectionLabel style={{ fontSize: 13, letterSpacing: '.08em', marginBottom: 14 }}>Co-admins</SectionLabel>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <Avatar initials="JD" highlight size={32} />
              <div className="flex-1">
                <div style={{ fontWeight: 800, fontSize: 14 }}>
                  Jordan D. <span style={{ color: '#E7C92F', fontSize: 11, fontWeight: 800 }}>· you</span>
                </div>
                <div className="text-muted" style={{ fontSize: 12 }}>Owner</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Avatar initials="SR" size={32} />
              <div className="flex-1">
                <div style={{ fontWeight: 800, fontSize: 14 }}>Steph R.</div>
                <div className="text-muted" style={{ fontSize: 12 }}>Co-admin</div>
              </div>
            </div>
            <button
              className="cursor-pointer font-extrabold"
              style={{
                fontFamily: 'inherit',
                fontSize: 13,
                border: '1.5px dashed rgba(255,255,255,.16)',
                background: 'transparent',
                color: '#6B7A99',
                padding: 10,
                borderRadius: 10,
                marginTop: 2,
              }}
            >
              + Add a co-admin
            </button>
          </div>
        </Card>
      </div>

      {/* run the show */}
      <Card
        style={{ padding: '20px 22px', borderRadius: 16 }}
        className="flex items-center justify-between gap-4 flex-wrap"
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Ready to run the show?</div>
          <div className="text-muted" style={{ fontSize: 13.5 }}>
            Mark winners match-by-match and the board updates for everyone live.
          </div>
        </div>
        <GoldButton onClick={onEnterLive} style={{ fontSize: 14.5, padding: '14px 22px', borderRadius: 11 }}>
          Enter live results
          <ArrowRightIcon size={16} strokeWidth={2.6} style={{ color: '#1A1408' }} />
        </GoldButton>
      </Card>

      <div className="text-center" style={{ marginTop: 18 }}>
        <button
          onClick={() => navigate(`/admin/game/${game.id}/close`)}
          className="bg-transparent border-0 cursor-pointer underline"
          style={{ color: '#6B7A99', fontSize: 12.5 }}
        >
          Skip to close game &amp; send results →
        </button>
      </div>
    </section>
  );
}
