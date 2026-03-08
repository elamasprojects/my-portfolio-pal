

# PWA (Progressive Web App) Setup

Make the app installable from the browser on mobile (and desktop). Users visiting via Chrome or Safari will get an "Add to Home Screen" prompt.

## Changes

### 1. Install `vite-plugin-pwa`

### 2. Configure PWA in `vite.config.ts`

- Add `VitePWA` plugin with app manifest (name, icons, theme color, background color)
- Register service worker for offline support
- Add `navigateFallbackDenylist: [/^\/~oauth/]` to prevent caching OAuth redirects

### 3. Create PWA icons

- `public/pwa-192x192.png` and `public/pwa-512x512.png` (generated from existing favicon)

### 4. Update `index.html`

- Add `<meta name="theme-color">`, `<meta name="apple-mobile-web-app-capable">`, `<link rel="apple-touch-icon">`

### 5. Add `/install` page

- Simple page with install instructions for iOS (Share → Add to Home Screen) and Android (browser menu → Install)
- Triggers the browser's native install prompt on supported browsers via `beforeinstallprompt`

### 6. Route in `App.tsx`

- Add `/install` route (public, no auth required)

```text
NEW:
  public/pwa-192x192.png
  public/pwa-512x512.png
  src/pages/Install.tsx

MODIFIED:
  vite.config.ts          — add VitePWA plugin
  index.html              — add PWA meta tags
  src/App.tsx             — add /install route

DEPENDENCY:
  vite-plugin-pwa
```

