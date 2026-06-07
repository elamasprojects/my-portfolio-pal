import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Detects a Wear OS / smartwatch browser and sends it to the round /watch view.
 * Watches report either a "Wear OS / watch" user agent OR a tiny, ~square screen
 * (e.g. Pixel Watch 4 45mm ≈ 456×456, often 228 CSS px @2x). Phones/tablets/desktops
 * are never that square + small, so false positives are unlikely.
 */
function isWatchDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/wear\s?os|smart-?watch|watch/i.test(ua)) return true;
  const screen = window.screen;
  const w = (screen && screen.width) || window.innerWidth || 0;
  const h = (screen && screen.height) || window.innerHeight || 0;
  if (!w || !h) return false;
  const maxDim = Math.max(w, h);
  const minDim = Math.min(w, h);
  return maxDim <= 480 && maxDim / minDim <= 1.2;
}

// Routes a watch should be allowed to stay on (auth flow, public pages, the watch itself).
const SKIP_PREFIXES = ["/watch", "/auth", "/landing", "/install", "/share", "/tools"];

export function WatchRedirect() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isWatchDevice()) return;
    const onAllowed = SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!onAllowed) navigate("/watch", { replace: true });
  }, [pathname, navigate]);

  return null;
}
