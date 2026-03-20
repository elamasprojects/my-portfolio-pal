

# Plan: Sección de Seguridad y Privacidad de Datos

## Resumen

Crear una página `/security` con toda la información sobre seguridad y privacidad de datos del usuario, y hacerla accesible desde 3 puntos: sidebar (desktop), menú de perfil (mobile), y landing page.

## Implementación

### 1. Nueva página `src/pages/Security.tsx`

Página con secciones claras usando Cards:

- **Almacenamiento anónimo**: datos vinculados a UUID, no a identidad real. Emails aislados en `auth.users`.
- **Row-Level Security (RLS)**: cada usuario solo accede a sus propios datos.
- **Cifrado**: AES-256 en reposo, TLS 1.2+ en tránsito.
- **Certificación SOC 2 Type II**: infraestructura Supabase/AWS.
- **OCR e imágenes**: las imágenes se procesan en memoria (base64), se envían a la Edge Function para extracción y se descartan inmediatamente. Nunca se almacenan.
- **Autenticación JWT**: tokens seguros gestionados por Supabase Auth.

Diseño: íconos por sección (Shield, Lock, Eye, Image, Key), estilo consistente con el resto de la app.

### 2. Sidebar desktop — `src/components/AppSidebar.tsx`

- Agregar `{ titleKey: "nav.security", url: "/security", icon: ShieldCheck }` al array `navItems`.
- Agregar traducción `nav.security` en ambos idiomas.

### 3. Mobile — `src/components/MobileNav.tsx`

- Agregar `{ titleKey: "nav.security", url: "/security", icon: ShieldCheck }` al array `moreItems` (dentro del drawer "Ver Más").

### 4. Routing — `src/App.tsx`

- Agregar ruta protegida: `/security` → `<Security />`.

### 5. Landing page — `src/pages/Landing.tsx`

- Nueva sección antes del Final CTA, con 3-4 bullets resumiendo las garantías de seguridad (anonimato, cifrado, SOC 2, OCR sin almacenamiento).
- Ícono ShieldCheck, título "Tu data está segura", botón "Saber más" que lleva a `/security`.

### 6. Traducciones — `src/i18n/en.ts` y `es.ts`

~20 keys nuevas: `nav.security`, `security.title`, `security.anonymous.*`, `security.rls.*`, `security.encryption.*`, `security.ocr.*`, `security.soc2.*`, `landing.security.*`.

## Archivos

| Archivo | Cambio |
|---|---|
| `src/pages/Security.tsx` | Nuevo |
| `src/App.tsx` | Ruta `/security` |
| `src/components/AppSidebar.tsx` | Nav item |
| `src/components/MobileNav.tsx` | More item |
| `src/pages/Landing.tsx` | Sección seguridad |
| `src/i18n/en.ts` | ~20 keys |
| `src/i18n/es.ts` | ~20 keys |

