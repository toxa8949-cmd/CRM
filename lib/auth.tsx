'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

type Role = 'owner' | 'seller' | null;
type AuthState = { role: Role; email: string | null; ready: boolean };

const Ctx = createContext<AuthState>({ role: null, email: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ role: null, email: null, ready: false });

  useEffect(() => {
    function apply(session: any) {
      const user = session?.user;
      const role = (user?.user_metadata?.role as Role) || (user ? 'seller' : null);
      setState({ role, email: user?.email ?? null, ready: true });
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => apply(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const isOwner = (role: Role) => role === 'owner';
