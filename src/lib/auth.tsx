"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
};

const Ctx = createContext<AuthCtx>({ session: null, user: null, isAdmin: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const isAdmin = !!user?.email?.toLowerCase().endsWith("@admin.mydomain.com");

  const value = useMemo(() => ({ session, user, isAdmin }), [session, user, isAdmin]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);