import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";

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

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <DottedSurface className="pointer-events-none z-0" />
      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-primary">
            <TrendingUp className="h-8 w-8" />
            <span className="text-2xl font-bold tracking-tight text-foreground">Portfolio Tracker</span>
          </div>
          <p className="text-muted-foreground text-sm">Look first. Then leap.</p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{isLogin ? "Welcome back" : "Create account"}</CardTitle>
            <CardDescription>
              {isLogin ? "Sign in to your account" : "Start tracking your portfolio"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline font-medium"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
