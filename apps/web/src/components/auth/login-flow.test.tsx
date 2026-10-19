import { fireEvent, screen, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { OTP_LENGTH } from '@doqto/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMockDb } from '@/mocks/db';
import { handlers } from '@/mocks/handlers';
import { renderWithProviders } from '@/test/render';
import { LoginFlow, safeNext } from './login-flow';

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => search,
}));

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  resetMockDb();
  replace.mockReset();
  search = new URLSearchParams();
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function typeCode(code: string) {
  fireEvent.change(screen.getByLabelText('Digit 1'), { target: { value: code } });
}

async function sendCodeTo(digits: string) {
  fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: digits } });
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
  await screen.findByText('Enter the code');
}

describe('LoginFlow', () => {
  it('blocks an invalid number before calling the API', () => {
    renderWithProviders(<LoginFlow otpLength={OTP_LENGTH} />);
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(screen.getByRole('alert').textContent).toContain(
      'Enter a valid 10-digit Indian mobile number.',
    );
  });

  it('shows the demo hint, reports attempts left, then signs a new user in', async () => {
    renderWithProviders(<LoginFlow otpLength={OTP_LENGTH} />);
    await sendCodeTo('98765 43210');
    expect(screen.getByText('Sent to +91 98765 43210')).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('Demo mode: use code 123456');
    expect(screen.getByText('Resend code in 30s')).toBeTruthy();

    typeCode('111111');
    expect((await screen.findByRole('alert')).textContent).toContain(
      'That code is not right. 4 attempts left.',
    );

    typeCode('123456');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/profile?welcome=1'));
  });

  it('keeps a safe next path for new users', async () => {
    search = new URLSearchParams('next=/appointments');
    renderWithProviders(<LoginFlow otpLength={OTP_LENGTH} />);
    await sendCodeTo('9876543210');
    typeCode('123456');
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/profile?welcome=1&next=%2Fappointments'),
    );
  });

  it('locks after five wrong codes and offers a new code', async () => {
    renderWithProviders(<LoginFlow otpLength={OTP_LENGTH} />);
    await sendCodeTo('9876543210');
    for (let i = 0; i < 5; i++) {
      typeCode('000000');
      await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    }
    await screen.findByText('Too many wrong attempts. Request a new code and try again.');
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verify' })).toHaveProperty('disabled', true);
  });

  it('shows the rate limit message on the fourth request', async () => {
    renderWithProviders(<LoginFlow otpLength={OTP_LENGTH} />);
    for (let i = 0; i < 3; i++) {
      await sendCodeTo('9876543210');
      fireEvent.click(screen.getByRole('button', { name: 'Change number' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /Too many codes requested. Please wait 10 minutes/,
    );
  });
});

describe('safeNext', () => {
  const origin = 'https://doqto.in';
  it.each([
    ['/profile', '/profile'],
    ['/appointments?tab=past#top', '/appointments?tab=past#top'],
    ['/\\evil.com', null],
    ['/\\/evil.com', null],
    ['//evil.com', null],
    ['/.//evil.com', null],
    ['/..//evil.com', null],
    ['/%2e//evil.com', null],
    ['/a/..//evil.com', null],
    ['/clinic/./profile', '/clinic/profile'],
    ['/%5Cevil.com', '/%5Cevil.com'],
    ['https://evil.com', null],
    ['javascript:alert(1)', null],
    ['profile', null],
    ['', null],
    [null, null],
  ])('%s -> %s', (input, expected) => {
    expect(safeNext(input, origin)).toBe(expected);
  });
});
