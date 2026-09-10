import { Session } from '@supabase/supabase-js';
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { friendlyAuthError } from './errors';
import { hasSupabaseConfig, supabase } from './client';

export type OrganiserProfile = {
  id: string;
  displayName: string;
  avatarPath?: string;
};

type Result = { ok: true } | { ok: false; message: string };
type SignUpResult = Result & { verificationRequired?: boolean };

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  profile: OrganiserProfile | null;
  profileLoading: boolean;
  profileError?: string;
  recoveryMode: boolean;
  linkError?: string;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<Result>;
  resendVerification: (email: string) => Promise<Result>;
  verifySignUp: (email: string, code: string) => Promise<Result>;
  requestRecovery: (email: string) => Promise<Result>;
  verifyRecovery: (email: string, code: string) => Promise<Result>;
  updatePassword: (password: string) => Promise<Result>;
  saveProfile: (displayName: string) => Promise<Result>;
  signOut: () => Promise<Result>;
  clearRecoveryMode: () => void;
  retryProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const CALLBACK_URL = 'lilica://auth/callback';
const RECOVERY_URL = 'lilica://auth/recovery';

function linkParameters(url: string) {
  const normalized = url.replace('#', '?');
  const parsed = new URL(normalized);
  return parsed.searchParams;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<OrganiserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string>();
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [linkError, setLinkError] = useState<string>();

  async function loadProfile(nextSession: Session | null) {
    if (!nextSession) {
      setProfile(null);
      setProfileError(undefined);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_path')
      .eq('id', nextSession.user.id)
      .maybeSingle();

    if (error) {
      setProfile(null);
      setProfileError('Lilica could not load your profile just now. Check your connection and try again.');
    } else if (data) {
      setProfile({
        id: data.id,
        displayName: data.display_name,
        avatarPath: data.avatar_path ?? undefined,
      });
      setProfileError(undefined);
    } else {
      setProfile(null);
      setProfileError(undefined);
    }
    setProfileLoading(false);
  }

  async function handleAuthLink(url: string) {
    try {
      const params = linkParameters(url);
      const errorDescription = params.get('error_description');
      if (errorDescription) throw new Error(errorDescription);

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
      }

      if (params.get('type') === 'recovery' || url.startsWith(RECOVERY_URL)) {
        setRecoveryMode(true);
      }
      setLinkError(undefined);
    } catch (error) {
      if (url.startsWith(RECOVERY_URL)) setRecoveryMode(true);
      setLinkError(friendlyAuthError(error, 'password'));
    }
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      let restoredSession = data.session;

      if (restoredSession) {
        const { data: validated, error } = await supabase.auth.getUser();
        const rejectedByServer = error?.status === 401 || error?.status === 403;
        const identityChanged = !error && validated.user?.id !== restoredSession.user.id;

        if (rejectedByServer || identityChanged) {
          await supabase.auth.signOut({ scope: 'local' });
          restoredSession = null;
        }
      }

      if (!mounted) return;
      setSession(restoredSession);
      return loadProfile(restoredSession);
    }).finally(() => {
      if (mounted) setLoading(false);
    });

    Linking.getInitialURL().then((url) => {
      if (url) void handleAuthLink(url);
    });
    const linkSubscription = Linking.addEventListener('url', ({ url }) => void handleAuthLink(url));
    const authSubscription = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      void loadProfile(nextSession);
    });
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });

    return () => {
      mounted = false;
      linkSubscription.remove();
      authSubscription.data.subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    session,
    profile,
    profileLoading,
    profileError,
    recoveryMode,
    linkError,
    async signUp(email, password) {
      if (!hasSupabaseConfig) return { ok: false, message: 'Lilica account services are not configured.' };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) return { ok: false, message: friendlyAuthError(error, 'signUp') };
      const identities = data.user?.identities ?? [];
      if (data.user && identities.length === 0) {
        return { ok: false, message: 'An account already uses this email. Try logging in instead.' };
      }
      return { ok: true, verificationRequired: !data.session };
    },
    async signIn(email, password) {
      if (!hasSupabaseConfig) return { ok: false, message: 'Lilica account services are not configured.' };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error
        ? { ok: false, message: friendlyAuthError(error, 'signIn') }
        : { ok: true };
    },
    async resendVerification(email) {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      return error
        ? { ok: false, message: friendlyAuthError(error, 'resend') }
        : { ok: true };
    },
    async verifySignUp(email, code) {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
      return error
        ? { ok: false, message: friendlyAuthError(error, 'password') }
        : { ok: true };
    },
    async requestRecovery(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return error
        ? { ok: false, message: friendlyAuthError(error, 'recovery') }
        : { ok: true };
    },
    async verifyRecovery(email, code) {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
      return error
        ? { ok: false, message: friendlyAuthError(error, 'password') }
        : { ok: true };
    },
    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { ok: false, message: friendlyAuthError(error, 'password') };
      setRecoveryMode(false);
      return { ok: true };
    },
    async saveProfile(displayName) {
      if (!session) return { ok: false, message: 'Please log in again to save your profile.' };
      const trimmed = displayName.trim();
      const query = profile
        ? supabase.from('profiles').update({ display_name: trimmed }).eq('id', session.user.id)
        : supabase.from('profiles').insert({ id: session.user.id, display_name: trimmed });
      const { error } = await query;
      if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
      setProfile({ id: session.user.id, displayName: trimmed });
      return { ok: true };
    },
    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) return { ok: false, message: friendlyAuthError(error, 'signIn') };
      setSession(null);
      setProfile(null);
      setProfileError(undefined);
      setRecoveryMode(false);
      return { ok: true };
    },
    clearRecoveryMode: () => setRecoveryMode(false),
    retryProfile: () => loadProfile(session),
  }), [linkError, loading, profile, profileError, profileLoading, recoveryMode, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
