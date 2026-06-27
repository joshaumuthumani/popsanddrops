import { useGame } from '@/hooks/data';
import { Modal } from '@/components/Modal';
import { GameResultsBoard } from '@/components/GameResultsBoard';

/** Final standings for one game in a dialog (top 3 Gold/Silver/Bronze). Mounted only when open. */
export function GameResultsModal({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const { game } = useGame(gameId);
  return (
    <Modal onClose={onClose} title={game?.name ?? 'Final results'}>
      <GameResultsBoard gameId={gameId} />
    </Modal>
  );
}
