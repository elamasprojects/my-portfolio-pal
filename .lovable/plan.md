

# Two Changes

## 1. Move /settings into profile dropdown
Settings is already in the dropdown (line ~120 of AppSidebar.tsx). Just need to confirm it's not duplicated in navItems — it's not (removed in previous edit). This is already done. No changes needed.

## 2. Add AI disclaimer to Chess page
Add a subtle red disclaimer below the input form at the bottom of `/chess`. Add translation keys for both EN and ES.

### Changes

**`src/pages/Chess.tsx`** — After the input form `div`, add a disclaimer paragraph with `text-destructive/70 text-xs text-center` styling, using `t("chess.disclaimer")`.

**`src/i18n/en.ts`** — Add:
```
"chess.disclaimer": "This is an AI assistant. It can make mistakes and nothing said here should be considered financial advice. For educational purposes only."
```

**`src/i18n/es.ts`** — Add:
```
"chess.disclaimer": "Este es un asistente de IA. Puede cometer errores y nada de lo dicho aquí debe considerarse asesoramiento financiero. Solo con fines educativos."
```

