import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Share, MoreVertical, Plus, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="text-center space-y-2">
          <img src="/pwa-192x192.png" alt="Chess app icon" className="w-20 h-20 mx-auto rounded-2xl shadow-lg" />
          <h1 className="text-2xl font-bold text-foreground font-serif">Install Chess</h1>
          <p className="text-muted-foreground text-sm">
            Add Chess to your home screen for quick access — no app store needed.
          </p>
        </div>

        {isInstalled ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-6 text-center">
              <p className="text-primary font-medium">✓ Chess is already installed!</p>
            </CardContent>
          </Card>
        ) : deferredPrompt ? (
          <Button onClick={handleInstall} className="w-full gap-2" size="lg">
            <Download className="h-5 w-5" />
            Install Chess
          </Button>
        ) : isIOS ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Install on iOS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Step
                number={1}
                icon={<Share className="h-4 w-4" />}
                text='Tap the Share button in Safari'
              />
              <Step
                number={2}
                icon={<Plus className="h-4 w-4" />}
                text='Scroll down and tap "Add to Home Screen"'
              />
              <Step
                number={3}
                icon={<Download className="h-4 w-4" />}
                text='Tap "Add" to confirm'
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Install on Android</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Step
                number={1}
                icon={<MoreVertical className="h-4 w-4" />}
                text="Tap the menu (⋮) in Chrome"
              />
              <Step
                number={2}
                icon={<Download className="h-4 w-4" />}
                text='Tap "Install app" or "Add to Home screen"'
              />
              <Step
                number={3}
                icon={<Plus className="h-4 w-4" />}
                text='Tap "Install" to confirm'
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Step({ number, icon, text }: { number: number; icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {number}
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm text-foreground">{text}</span>
      </div>
    </div>
  );
}
