import { StrictMode, useState } from 'react';
import { flushSync } from 'react-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Sheet, useFocusTrap } from '../src/index.ts';

function Empty({ close }: { close: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(close);
  return <div ref={ref} role="dialog" aria-label="Empty" />;
}

function Nested({ together = false }: { together?: boolean }) {
  const [open, setOpen] = useState(false);
  const [child, setChild] = useState(together);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open parent</button>
      {open && (
        <Sheet title="Parent" onClose={() => setOpen(false)}>
          <button onClick={() => setChild(true)}>Open child</button>
          {child && (
            <Sheet title="Child" onClose={() => flushSync(() => setChild(false))}>
              <button>Child action</button>
            </Sheet>
          )}
        </Sheet>
      )}
    </>
  );
}

describe('modal focus ownership', () => {
  it('preserves typing focus across callback changes and calls the latest close handler', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    function Form() {
      const [open, setOpen] = useState(false);
      const [name, setName] = useState('');
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && (
            <Sheet
              title="Edit"
              onClose={() => {
                close(name);
                setOpen(false);
              }}
            >
              <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            </Sheet>
          )}
        </>
      );
    }
    render(
      <StrictMode>
        <Form />
      </StrictMode>,
    );
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);
    const input = screen.getByRole('textbox');
    await user.type(input, 'Maria');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('Maria');
    await user.keyboard('{Escape}');
    expect(close).toHaveBeenCalledExactlyOnceWith('Maria');
    expect(opener).toHaveFocus();
    expect(opener.closest('[inert]')).toBeNull();
  });

  it('keeps an empty dialog focusable and traps both tab directions', async () => {
    const close = vi.fn();
    const { unmount } = render(<Empty close={close} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveFocus();
    const user = userEvent.setup();
    await user.tab();
    expect(dialog).toHaveFocus();
    await user.tab({ shift: true });
    expect(dialog).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(close).toHaveBeenCalledOnce();
    unmount();
    expect(dialog).not.toHaveAttribute('tabindex');
    expect(document.body.querySelector('[inert]')).toBeNull();
  });

  it.each([false, true])(
    'orders nested portal dialogs even when mounted together: %s',
    async (together) => {
      const user = userEvent.setup();
      render(<Nested together={together} />);
      const opener = screen.getByRole('button', { name: 'Open parent' });
      await user.click(opener);
      if (!together) await user.click(screen.getByRole('button', { name: 'Open child' }));
      const child = screen.getByRole('dialog', { name: 'Child' });
      const parent = screen.getByRole('dialog', { name: 'Parent', hidden: true });
      expect(child).toHaveAttribute('aria-modal', 'true');
      expect(parent).toHaveAttribute('aria-modal', 'false');
      expect(parent.closest('[inert]')).not.toBeNull();
      expect(child.parentElement!.style.getPropertyValue('--focus-layer')).toBe('1');
      await user.tab();
      expect(within(child).getByRole('button', { name: 'Child action' })).toHaveFocus();
      await user.tab();
      expect(within(child).getByRole('button', { name: 'Close' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'Child' })).toBeNull();
      expect(parent).toHaveAttribute('aria-modal', 'true');
      expect(parent).toContainElement(document.activeElement as HTMLElement);
      if (!together) expect(screen.getByRole('button', { name: 'Open child' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(opener).toHaveFocus();
    },
  );

  it('skips unavailable controls and follows positive tab order and radio groups', async () => {
    const user = userEvent.setup();
    render(
      <Sheet title="Controls" onClose={() => {}}>
        <button tabIndex={2}>Second</button>
        <button tabIndex={1}>First</button>
        <button hidden>Hidden</button>
        <div style={{ display: 'none' }}>
          <button>Invisible</button>
        </div>
        <div aria-hidden="true">
          <button>Inaccessible</button>
        </div>
        <fieldset disabled>
          <button>Disabled field</button>
        </fieldset>
        <button disabled>Disabled</button>
        <button tabIndex={-1}>Skipped</button>
        <input type="radio" name="choice" aria-label="Unchecked" />
        <input type="radio" name="choice" aria-label="Checked" defaultChecked />
        <details>
          <summary>Details</summary>
          <button>Collapsed</button>
        </details>
        <div contentEditable aria-label="Editor" />
      </Sheet>,
    );
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    for (const name of ['Second', 'Close', 'Checked', 'Details', 'Editor', 'First']) {
      await user.tab();
      expect(document.activeElement).toHaveAccessibleName(name);
    }
    await user.tab({ shift: true });
    expect(document.activeElement).toHaveAccessibleName('Editor');
  });

  it('recovers when the focused control is removed or disabled, and rejects outside focus', async () => {
    function Changing({ remove = false, disabled = false }) {
      return (
        <>
          <button>Outside</button>
          <Sheet title="Changing" onClose={() => {}}>
            {!remove && <button disabled={disabled}>Action</button>}
          </Sheet>
        </>
      );
    }
    const { rerender } = render(<Changing />);
    const action = screen.getByRole('button', { name: 'Action' });
    act(() => action.focus());
    rerender(<Changing disabled />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());
    rerender(<Changing />);
    act(() => screen.getByRole('button', { name: 'Action' }).focus());
    rerender(<Changing remove />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());
    act(() => screen.getByRole('button', { name: 'Outside', hidden: true }).focus());
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('preserves existing background attributes and masks newly inserted branches', async () => {
    const old = document.createElement('aside');
    old.setAttribute('aria-hidden', 'false');
    old.setAttribute('inert', 'existing');
    document.body.append(old);
    const { unmount } = render(<Empty close={() => {}} />);
    const late = document.createElement('div');
    act(() => document.body.append(late));
    await waitFor(() => expect(late).toHaveAttribute('inert'));
    expect(old).toHaveAttribute('aria-hidden', 'true');
    unmount();
    expect(old).toHaveAttribute('aria-hidden', 'false');
    expect(old).toHaveAttribute('inert', 'existing');
    expect(late).not.toHaveAttribute('inert');
    expect(late).not.toHaveAttribute('aria-hidden');
    old.remove();
    late.remove();
  });

  it('uses the main landmark when an entire nested tree and its opener disappear', async () => {
    const user = userEvent.setup();
    function Tree({ show = true }) {
      return (
        <main>
          <button>External</button>
          {show && <Nested together />}
        </main>
      );
    }
    const { rerender } = render(<Tree />);
    const external = screen.getByRole('button', { name: 'External' });
    await user.click(screen.getByRole('button', { name: 'Open parent' }));
    rerender(<Tree show={false} />);
    expect(external.closest('[inert]')).toBeNull();
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('restores the surviving opener when nested dialogs unmount together', async () => {
    const user = userEvent.setup();
    function Tree() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>External</button>
          {open && (
            <Sheet title="Outer" onClose={() => setOpen(false)}>
              <Sheet title="Inner" onClose={() => setOpen(false)}>
                <button>Inner action</button>
              </Sheet>
            </Sheet>
          )}
        </>
      );
    }
    render(
      <StrictMode>
        <Tree />
      </StrictMode>,
    );
    const external = screen.getByRole('button', { name: 'External' });
    await user.click(external);
    await user.keyboard('{Escape}');
    expect(external).toHaveFocus();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not steal focus when a lower independent dialog disappears', () => {
    function Pair({ lower = true }) {
      return (
        <>
          {lower && <Empty close={() => {}} />}
          <Sheet title="Upper" onClose={() => {}}>
            <input aria-label="Upper value" />
          </Sheet>
        </>
      );
    }
    const { rerender } = render(<Pair />);
    const input = screen.getByRole('textbox');
    act(() => input.focus());
    rerender(<Pair lower={false} />);
    expect(input).toHaveFocus();
  });

  it('respects consumed Escape and composition events', () => {
    const close = vi.fn();
    render(
      <Sheet title="Keys" onClose={close}>
        <input
          aria-label="Keys"
          onKeyDown={(event) => {
            if (event.key === 'Escape') event.preventDefault();
          }}
        />
      </Sheet>,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), {
      key: 'Escape',
      isComposing: true,
    });
    expect(close).not.toHaveBeenCalled();
  });
});
