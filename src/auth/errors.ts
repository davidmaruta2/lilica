export type AuthAction = 'signUp' | 'signIn' | 'resend' | 'recovery' | 'password' | 'profile';

export function friendlyAuthError(error: unknown, action: AuthAction): string {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return 'Lilica could not connect just now. Check your connection and try again.';
  }
  if (message.includes('already registered') || message.includes('already exists')) {
    return 'An account already uses this email. Try logging in instead.';
  }
  if (message.includes('invalid login') || message.includes('invalid credentials')) {
    return 'That email and password do not match. Please try again.';
  }
  if (message.includes('email not confirmed')) {
    return 'Please verify your email before logging in.';
  }
  if (message.includes('password') && (message.includes('weak') || message.includes('least')) ) {
    return 'Choose a password with at least 8 characters.';
  }
  if (message.includes('expired') || message.includes('invalid') && message.includes('token')) {
    return 'That code is no longer valid. Please request a new one.';
  }
  if (message.includes('rate') || message.includes('seconds')) {
    return 'Please wait a moment before trying again.';
  }

  const fallback: Record<AuthAction, string> = {
    signUp: 'Your account could not be created just now. Please try again.',
    signIn: 'Lilica could not log you in just now. Please try again.',
    resend: 'A new verification email could not be sent just now.',
    recovery: 'A recovery email could not be sent just now.',
    password: 'Your password could not be updated. Please request a new recovery code.',
    profile: 'Your profile could not be saved just now. Please try again.',
  };
  return fallback[action];
}
