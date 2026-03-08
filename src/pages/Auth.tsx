import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ChessKnight } from "@/components/ChessKnight";
import { FcGoogle } from "react-icons/fc";

const Auth = () => {
  const { session, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (session) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm.");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <DottedSurface className="pointer-events-none z-0" />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,_hsl(var(--background)/0.85)_0%,_transparent_70%)]" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="rounded-md border border-border bg-card/80 backdrop-blur">
          <div className="flex flex-col gap-6 p-6">
            {/* Logo & heading */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-primary">
                <ChessKnight className="h-8 w-8" />
                <span className="text-2xl font-serif font-bold tracking-tight text-foreground">
                  Chess
                </span>
              </div>
              <p className="text-xs text-muted-foreground italic">Every move counts.</p>
              {isLogin ? (
                <p className="text-sm font-medium text-foreground mt-2">Welcome back</p>
              ) : (
                <p className="text-sm font-medium text-foreground mt-2">Create an account</p>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting
                    ? "Loading..."
                    : isLogin
                      ? "Sign In"
                      : "Create an account"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                >
                  <FcGoogle className="mr-2 size-4" />
                  {isLogin ? "Sign in with Google" : "Sign up with Google"}
                </Button>
              </div>
            </form>

            {/* Toggle login/signup */}
            <div className="text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline font-medium"
              >
                {isLogin ? "Sign up" : "Login"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
