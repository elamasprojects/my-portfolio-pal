import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ChessKnight } from "@/components/ChessKnight";
import { FaXTwitter } from "react-icons/fa6";

const Auth = () => {
  const { session, loading } = useAuth();
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
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
        toast.success(t("auth.welcomeBack") + "!");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: username || email, username: username || undefined },
          },
        });
        if (error) throw error;
        toast.success(t("auth.accountCreated"));
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };




  const handleXSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "twitter",
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
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-primary">
                <ChessKnight className="h-8 w-8" />
                <span className="text-2xl font-serif font-bold tracking-tight text-foreground">
                  Chess
                </span>
              </div>
              <p className="text-xs text-muted-foreground italic">{t("auth.everyMoveMatters")}</p>
              {isLogin ? (
                <p className="text-sm font-medium text-foreground mt-2">{t("auth.welcomeBack")}</p>
              ) : (
                <p className="text-sm font-medium text-foreground mt-2">{t("auth.createAccount")}</p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                {!isLogin && (
                  <Input
                    type="text"
                    placeholder={t("auth.username")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                )}
                <Input
                  type="email"
                  placeholder={t("auth.email")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder={t("auth.password")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting
                    ? t("common.loading")
                    : isLogin
                      ? t("auth.signIn")
                      : t("auth.createAccount")}
                </Button>


                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleXSignIn}
                >
                  <FaXTwitter className="mr-2 size-4" />
                  {isLogin ? t("auth.signInX") : t("auth.signUpX")}
                </Button>
              </div>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline font-medium"
              >
                {isLogin ? t("auth.signUp") : t("auth.login")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
