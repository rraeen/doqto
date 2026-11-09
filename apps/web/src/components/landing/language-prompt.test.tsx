import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { LanguagePrompt } from './language-prompt';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

const cookie = () => document.cookie.split('; ').find((c) => c.startsWith('doqto_lang='));
const clearCookie = () => {
  document.cookie = 'doqto_lang=; path=/; max-age=0';
};

describe('LanguagePrompt', () => {
  beforeEach(() => {
    clearCookie();
    refresh.mockReset();
  });
  afterEach(clearCookie);

  it('asks on the first visit, in both languages', async () => {
    renderWithProviders(<LanguagePrompt />);
    expect(await screen.findByText(/Choose your language/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'English' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'हिन्दी' })).toBeTruthy();
  });

  it('remembers the choice in the language cookie and refreshes the page', async () => {
    renderWithProviders(<LanguagePrompt />);
    fireEvent.click(await screen.findByRole('button', { name: 'हिन्दी' }));
    expect(cookie()).toBe('doqto_lang=hi');
    expect(refresh).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(/Choose your language/)).toBeNull());
  });

  it('keeps the current language and stops asking when it is closed without choosing', async () => {
    renderWithProviders(<LanguagePrompt />);
    await screen.findByText(/Choose your language/);
    fireEvent.click(screen.getByRole('button', { name: /Close/ }));
    expect(cookie()).toBe('doqto_lang=en');
    await waitFor(() => expect(screen.queryByText(/Choose your language/)).toBeNull());
  });

  it('does not ask again once a language is saved', () => {
    document.cookie = 'doqto_lang=en; path=/';
    renderWithProviders(<LanguagePrompt />);
    expect(screen.queryByText(/Choose your language/)).toBeNull();
  });
});
