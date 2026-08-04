# Migrating from Tailwind v3 to v4

## Key Changes

1. **Configuration**: `tailwind.config.js` → `@theme` in CSS
2. **Import**: `@tailwind base/components/utilities` → `@import "tailwindcss"`
3. **Colors**: Default palette now uses OKLCH
4. **Utilities**: Many class names renamed for consistency
5. **Browser support**: Requires Safari 16.4+, Chrome 111+, Firefox 128+

## Migration Steps

### 1. Run the Automated Upgrade

```bash
npx @tailwindcss/upgrade
```

This handles most class name renames and import updates automatically.

### 2. Convert Config to @theme

Move your `tailwind.config.js` color/spacing/font definitions into CSS:

```css
/* Before: tailwind.config.js */
/* colors: { primary: '#7c3aed' } */

/* After: app.css */
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.55 0.25 270);
}
```

### 3. Update CSS Imports

```css
/* Before */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* After */
@import "tailwindcss";
```

### 4. Common Class Name Renames

```
v3                     →  v4
───────────────────────────────
bg-gradient-to-r       →  bg-linear-to-r
bg-gradient-to-br      →  bg-linear-to-br
flex-shrink-0          →  shrink-0
flex-grow              →  grow
decoration-clone       →  box-decoration-clone
decoration-slice       →  box-decoration-slice
```

### 5. Common Breaking Changes

| v3 Pattern | Issue in v4 | Fix |
|-----------|------------|-----|
| `tailwind.config.js` plugins | Plugin API changed | Update to v4 plugin format or use `@utility` |
| `@apply` in components | Discouraged | Use `theme()` or utility classes directly |
| `purge` / `content` config | Removed | v4 auto-detects; use `source()` for monorepos |
| `darkMode: 'class'` | Not a JS option | Use `@media (prefers-color-scheme: dark)` or `[data-theme]` |
| Custom color palette in JS | Not in JS anymore | Define in `@theme` with OKLCH values |

### 6. Testing Checklist

After migration, verify:
- [ ] Color rendering matches design (OKLCH may shift some colors)
- [ ] Custom utilities still work
- [ ] Dark mode toggles correctly
- [ ] Plugin functionality intact
- [ ] No dynamic class construction broken by renames
- [ ] Build output size is similar or smaller
