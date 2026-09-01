import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PickButton } from '@/components/PickButton';
import { SegmentedTabs } from '@/components/SegmentedTabs';

describe('accessible selection controls', () => {
  it('exposes PickButton selection through aria-pressed', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <PickButton selected={false} onClick={onClick}>
        Austin
      </PickButton>,
    );

    const button = screen.getByRole('button', { name: 'Austin' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();

    rerender(
      <PickButton selected onClick={onClick}>
        Austin
      </PickButton>,
    );
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('exposes segmented tab state and panel relationships', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <SegmentedTabs
          tabs={[
            { value: 'predict', label: 'Make Picks' },
            { value: 'live', label: 'Pop Rankings' },
          ]}
          value="predict"
          onChange={onChange}
          ariaControls={(value) => `${value}-panel`}
        />
        <div id="predict-panel" role="tabpanel" aria-labelledby="tab-predict" />
      </>,
    );

    const predict = screen.getByRole('tab', { name: 'Make Picks' });
    const live = screen.getByRole('tab', { name: 'Pop Rankings' });
    expect(predict).toHaveAttribute('aria-selected', 'true');
    expect(predict).toHaveAttribute('aria-controls', 'predict-panel');
    expect(predict).toHaveAttribute('tabindex', '0');
    expect(live).toHaveAttribute('aria-selected', 'false');
    expect(live).toHaveAttribute('aria-controls', 'live-panel');
    expect(live).toHaveAttribute('tabindex', '-1');

    await user.click(live);
    expect(onChange).toHaveBeenCalledWith('live');
  });
});
