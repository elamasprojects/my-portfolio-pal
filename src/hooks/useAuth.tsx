import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_SINGLE_USER: Session = {
  access_token: "single-user-token",
  token_type: "bearer",
  expires_in: 360000,
  refresh_token: "single-user-refresh",
  user: {
    id: "single-user",
    email: "user@chess.local",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  },
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: DEFAULT_SINGLE_USER,
  user: DEFAULT_SINGLE_USER.user,
  loading: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(DEFAULT_SINGLE_USER);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (isMounted) {
        if (currentSession) {
          setSession(currentSession);
        } else {
          setSession(DEFAULT_SINGLE_USER);
        }
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) {
        setSession(DEFAULT_SINGLE_USER);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (isMounted) {
          setSession(currentSession || DEFAULT_SINGLE_USER);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
