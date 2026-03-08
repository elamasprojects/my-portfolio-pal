

## Fix: 404 on Page Refresh (Vercel)

**Problem:** Vercel serves static files. When a user refreshes on `/export` or any non-root route, Vercel looks for a file at that path, finds nothing, and returns 404. The React Router client-side routing never gets a chance to load.

**Fix:** Create a `vercel.json` in the project root with a catch-all rewrite to `index.html`.

```text
NEW: vercel.json
```

Contents:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

One file, one change. All routes will load `index.html` and React Router handles the rest.

