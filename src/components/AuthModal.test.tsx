import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { login, register, resendVerification, sendPasswordReset } = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  resendVerification: vi.fn(),
  sendPasswordReset: vi.fn(),
}));

let currentUser: { email: string } | null = null;

const { EMAIL_NOT_VERIFIED_CODE, AuthError } = vi.hoisted(() => {
  const code = 'auth/email-not-verified';
  class Err extends Error {
    code: string;
    constructor(c: string, m: string) {
      super(m);
      this.code = c;
    }
  }
  return { EMAIL_NOT_VERIFIED_CODE: code, AuthError: Err };
});

vi.mock('../context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../context/AuthContext')>('../context/AuthContext');
  return {
    ...actual,
    EMAIL_NOT_VERIFIED_CODE,
    AuthError,
    useAuth: () => ({
      user: currentUser,
      uid: currentUser ? 'u1' : undefined,
      isAuthenticated: false,
      isAuthReady: true,
      isAdmin: false,
      login,
      register,
      resendVerification,
      sendPasswordReset,
      logout: vi.fn(),
      deleteAccount: vi.fn(),
    }),
  };
});

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError }),
}));

import { AuthModal } from './AuthModal';

const fillLogin = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: password } });
};

const renderModal = (onClose = vi.fn()) => {
  render(
    <MemoryRouter>
      <AuthModal onClose={onClose} />
    </MemoryRouter>,
  );
  return onClose;
};

describe('AuthModal: подтверждение почты', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = null;
    // Лимит повторной отправки живёт в localStorage: без сброса следующий
    // тест видел бы паузу от предыдущего случая.
    localStorage.clear();
    // Контекст возвращает результат отправки; после clearAllMocks мок отдавал
    // undefined, и окно падало на чтении message.
    resendVerification.mockResolvedValue({
      sent: true,
      message: 'Письмо отправлено на user@ya.ru. Проверьте «Входящие» и «Спам».',
    });
    cleanup();
  });

  it('после регистрации показывает экран подтверждения и не остаётся в форме с неактивной кнопкой', async () => {
    register.mockResolvedValue(undefined);
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@ya.ru' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'Secret-2026!x' } });
    fireEvent.change(screen.getByLabelText('Подтвердите пароль'), { target: { value: 'Secret-2026!x' } });
    const checkboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    checkboxes.forEach((box) => fireEvent.click(box));

    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Подтверждение почты' })).toBeInTheDocument(),
    );
    expect(register).toHaveBeenCalledWith('user@ya.ru', 'Secret-2026!x');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Отправить повторно' })).not.toBeDisabled(),
    );
  });

  it('повторная отправка без сессии проходит через вход и не шлёт письмо впустую', async () => {
    currentUser = null;
    login.mockRejectedValue(new AuthError(EMAIL_NOT_VERIFIED_CODE, 'verify'));
    renderModal();

    fillLogin('user@ya.ru', 'Secret-2026!x');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
    });
    await waitFor(() => expect(screen.getByText('Отправить повторно')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Отправить повторно' }));
    });

    // Без сессии письмо отправляет сам контекст: он входит паролем внутри
    // resendVerification, поэтому окно передаёт адрес и пароль, а не логинится.
    await waitFor(() => expect(resendVerification).toHaveBeenCalledTimes(1));
    expect(resendVerification).toHaveBeenCalledWith('user@ya.ru', 'Secret-2026!x');
    expect(login).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
    expect(screen.getByText(/Письмо отправлено на user@ya\.ru/)).toBeInTheDocument();
  });

  it('повторная отправка с паролем входит и показывает успех, даже если почта ещё не подтверждена', async () => {
    currentUser = null;
    login
      .mockRejectedValueOnce(new AuthError(EMAIL_NOT_VERIFIED_CODE, 'verify'))
      .mockResolvedValueOnce({ user: { email: 'user@ya.ru', emailVerified: true } });
    renderModal();

    fillLogin('user@ya.ru', 'Secret-2026!x');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
    });
    await waitFor(() => expect(screen.getByText('Отправить повторно')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Отправить повторно' }));
    await act(async () => {});

    await waitFor(() =>
      expect(resendVerification).toHaveBeenCalledWith('user@ya.ru', 'Secret-2026!x'),
    );
    // Ожидаемая ветка «почта ещё не подтверждена» не поднимает красное уведомление.
    expect(toastError).not.toHaveBeenCalled();
    expect(screen.getByText(/Письмо отправлено на user@ya\.ru/)).toBeInTheDocument();
  });

  it('повторная отправка отдаёт адрес и пароль контексту, который ставит лимит', async () => {
    register.mockResolvedValue(undefined);
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@ya.ru' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'Secret-2026!x' } });
    fireEvent.change(screen.getByLabelText('Подтвердите пароль'), { target: { value: 'Secret-2026!x' } });
    document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((box) => fireEvent.click(box));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
    });
    await waitFor(() => expect(screen.getByText('Отправить повторно')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Отправить повторно' }));
    });

    // Письмо шлёт контекст: он же и ставит лимит на повторную отправку,
    // поэтому окно обязано передать адрес и пароль.
    await waitFor(() =>
      expect(resendVerification).toHaveBeenCalledWith('user@ya.ru', 'Secret-2026!x'),
    );
    expect(toastError).not.toHaveBeenCalled();
  });

  it('нажатие внутри карточки не закрывает окно, закрывает только клик по фону', async () => {
    const onClose = renderModal();

    fireEvent.click(screen.getByRole('heading', { name: 'Вход' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(document.querySelector('.auth-overlay') as HTMLElement);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
