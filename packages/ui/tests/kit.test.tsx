/**
 * The smaller kit components, through what a person or an assistive technology
 * can observe: names, roles, and what stays hidden.
 */

import { MemoryNavigation } from '@platform/navigation';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Breadcrumb, KitIcon, MicLevel, SpeakingBars, UiProvider } from '../src/index.ts';

describe('Breadcrumb', () => {
  it('is a named list of links to the places above this screen', () => {
    render(
      <MemoryNavigation
        route="/es/a1/mission/m/use"
        layout={() => (
          <Breadcrumb
            items={[
              { label: 'Study', to: '/es/a1/study' },
              { label: 'Missions', to: '/es/a1/study?tab=missions' },
            ]}
          />
        )}
      />,
    );
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });

    expect(
      within(trail)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/es/a1/study', '/es/a1/study?tab=missions']);
  });

  it('renders nothing when there is nowhere above', () => {
    const { container } = render(<Breadcrumb items={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('MicLevel', () => {
  it('is hidden from assistive technology and clamps what the microphone reports', () => {
    const { container } = render(<MicLevel level={3} />);
    const meter = container.firstElementChild!;

    expect(meter).toHaveAttribute('aria-hidden', 'true');
    expect(meter).toHaveAttribute('data-level', '1.00');
  });
});

describe('SpeakingBars', () => {
  it('is decorative, and says when it is paused', () => {
    const { container, rerender } = render(<SpeakingBars />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstElementChild).not.toHaveAttribute('data-paused');

    rerender(<SpeakingBars paused />);
    expect(container.firstElementChild).toHaveAttribute('data-paused', 'true');
  });
});

describe('KitIcon', () => {
  it('draws with the app’s icon set when one is provided', () => {
    render(
      <UiProvider icon={(name) => <svg data-testid={`app-${name}`} />}>
        <KitIcon name="close" />
      </UiProvider>,
    );

    expect(screen.getByTestId('app-close')).toBeInTheDocument();
  });

  it('falls back to a hidden text glyph without one', () => {
    const { container } = render(<KitIcon name="close" />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container).toHaveTextContent('×');
  });
});
