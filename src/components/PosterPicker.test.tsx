import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Both mocks must be declared before the component is imported.
vi.mock('@/lib/firebase', () => ({ isFirebaseConfigured: true }));

const ingestPosterUrl = vi.fn();
const uploadPosterFile = vi.fn();
vi.mock('@/lib/posters', () => ({
  ingestPosterUrl: (...args: unknown[]) => ingestPosterUrl(...args),
  uploadPosterFile: (...args: unknown[]) => uploadPosterFile(...args),
  PosterError: class PosterError extends Error {},
}));

const { PosterPicker } = await import('@/components/PosterPicker');

beforeEach(() => {
  ingestPosterUrl.mockReset();
  uploadPosterFile.mockReset();
});

/**
 * Regression tests for the poster-link bugs. Each of these shipped at some point, and each
 * was invisible: the UI reported nothing wrong while quietly discarding work or refusing to
 * publish. See issue #17 and commit 7a555ae.
 */
describe('PosterPicker', () => {
  it('reports a typed link as pending, so publish cannot silently discard it', async () => {
    const onPendingChange = vi.fn();
    render(<PosterPicker uid="admin1" onChange={vi.fn()} onPendingChange={onPendingChange} />);

    await userEvent.type(screen.getByPlaceholderText(/paste an image link/i), 'https://x.test/a.jpg');

    expect(onPendingChange).toHaveBeenLastCalledWith(true);
  });

  it('retracts the pending flag when unmounted', async () => {
    // The row was removed while a link sat in the box. If the flag outlives the component,
    // the builder counts a pending poster for a question that no longer exists and refuses
    // to publish forever, pointing at a link box that is no longer on screen.
    const onPendingChange = vi.fn();
    const { unmount } = render(
      <PosterPicker uid="admin1" onChange={vi.fn()} onPendingChange={onPendingChange} />,
    );

    await userEvent.type(screen.getByPlaceholderText(/paste an image link/i), 'https://x.test/a.jpg');
    expect(onPendingChange).toHaveBeenLastCalledWith(true);

    unmount();
    expect(onPendingChange).toHaveBeenLastCalledWith(false);
  });

  it('fetches a pasted link on blur, without needing the Add button', async () => {
    // Requiring the Add click was the original silent discard: the link looked accepted,
    // then vanished at publish.
    ingestPosterUrl.mockResolvedValue('https://storage.test/posters/admin1/x.jpg');
    const onChange = vi.fn();
    render(<PosterPicker uid="admin1" onChange={onChange} onPendingChange={vi.fn()} />);

    const input = screen.getByPlaceholderText(/paste an image link/i);
    await userEvent.type(input, 'https://x.test/a.jpg');
    await userEvent.tab(); // blur

    await waitFor(() => expect(ingestPosterUrl).toHaveBeenCalledWith('https://x.test/a.jpg'));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('https://storage.test/posters/admin1/x.jpg'),
    );
  });

  it('hands back only what the ingest returned, never the pasted URL itself', async () => {
    // CLAUDE.md: posters are always re-hosted in our own bucket; a third-party URL must
    // never reach Match.posterUrl.
    const hosted = 'https://firebasestorage.googleapis.com/v0/b/x/o/posters%2Fadmin1%2Fa.jpg';
    ingestPosterUrl.mockResolvedValue(hosted);
    const onChange = vi.fn();
    render(<PosterPicker uid="admin1" onChange={onChange} onPendingChange={vi.fn()} />);

    await userEvent.type(
      screen.getByPlaceholderText(/paste an image link/i),
      'https://wwe.example.com/poster.jpg',
    );
    await userEvent.tab();

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(hosted));
    expect(onChange).not.toHaveBeenCalledWith('https://wwe.example.com/poster.jpg');
  });

  it('surfaces an ingest failure instead of failing quietly', async () => {
    ingestPosterUrl.mockRejectedValue(new Error('nope'));
    const onChange = vi.fn();
    render(<PosterPicker uid="admin1" onChange={onChange} onPendingChange={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/paste an image link/i), 'https://x.test/a.jpg');
    await userEvent.tab();

    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });
});
