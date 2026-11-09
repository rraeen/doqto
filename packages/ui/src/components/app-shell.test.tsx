import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { activeNavHref, AppShell, type NavGroup } from './app-shell';
import { StatusChip } from './status-chip';

const nav: NavGroup[] = [
  {
    label: 'Practice',
    items: [
      { href: '/clinic', label: 'Dashboard' },
      { href: '/clinic/queue', label: 'Queue' },
    ],
  },
];

describe('activeNavHref', () => {
  it('picks the longest matching item, not the first prefix', () => {
    expect(activeNavHref(nav, '/clinic/queue')).toBe('/clinic/queue');
    expect(activeNavHref(nav, '/clinic/queue/42')).toBe('/clinic/queue');
    expect(activeNavHref(nav, '/clinic')).toBe('/clinic');
  });

  it('does not match a path that only shares a text prefix', () => {
    expect(activeNavHref(nav, '/clinics')).toBeUndefined();
    expect(activeNavHref(nav, '/other')).toBeUndefined();
  });
});

describe('AppShell', () => {
  it('marks the current page and renders the environment tag', () => {
    render(
      <AppShell
        productName="Doqto Admin"
        environmentTag="ADMIN"
        tone="admin"
        nav={nav}
        activePath="/clinic/queue"
      >
        <p>content</p>
      </AppShell>,
    );
    const current = screen.getAllByRole('link', { name: 'Queue' })[0];
    expect(current?.getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('ADMIN')).toBeTruthy();
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('opens the drawer from the menu button and closes it with Escape', () => {
    render(
      <AppShell productName="Doqto Console" nav={nav} activePath="/clinic">
        <p>content</p>
      </AppShell>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('StatusChip', () => {
  it('shows its label', () => {
    render(<StatusChip tone="warning">Waiting</StatusChip>);
    expect(screen.getByText('Waiting')).toBeTruthy();
  });
});
