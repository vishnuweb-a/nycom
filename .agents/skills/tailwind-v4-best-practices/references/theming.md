# Theming

## Dark Mode with @theme

```css
/* Base theme (light) */
@theme {
  --color-background: oklch(1.0 0 0);
  --color-foreground: oklch(0.20 0.01 250);
  --color-surface: oklch(0.98 0.01 250);
  --color-card: oklch(1.0 0 0);
  --color-border: oklch(0.90 0.01 250);
  --color-text-primary: oklch(0.20 0.01 250);
  --color-text-secondary: oklch(0.45 0.01 250);
  --color-primary: oklch(0.55 0.25 270);
}

/* Dark theme — automatic via system preference */
@media (prefers-color-scheme: dark) {
  @theme {
    --color-background: oklch(0.15 0.01 250);
    --color-foreground: oklch(0.95 0.01 250);
    --color-surface: oklch(0.20 0.01 250);
    --color-card: oklch(0.18 0.01 250);
    --color-border: oklch(0.30 0.01 250);
    --color-text-primary: oklch(0.95 0.01 250);
    --color-text-secondary: oklch(0.65 0.01 250);
    --color-primary: oklch(0.65 0.25 270); /* Lighter in dark mode */
  }
}
```

## Manual Theme Override with data-theme

```css
[data-theme="light"] {
  @theme {
    --color-background: oklch(1.0 0 0);
    --color-foreground: oklch(0.20 0.01 250);
  }
}

[data-theme="dark"] {
  @theme {
    --color-background: oklch(0.15 0.01 250);
    --color-foreground: oklch(0.95 0.01 250);
  }
}
```

## Brand Theme Variants

```css
[data-theme="brand-purple"] {
  @theme {
    --color-primary: oklch(0.55 0.25 270);
    --color-secondary: oklch(0.60 0.20 250);
  }
}

[data-theme="brand-green"] {
  @theme {
    --color-primary: oklch(0.65 0.18 145);
    --color-secondary: oklch(0.70 0.20 85);
  }
}
```

## Theme Switching (JavaScript)

```typescript
type Theme = 'light' | 'dark' | 'system';

function setTheme(theme: Theme) {
  const root = document.documentElement;

  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }

  localStorage.setItem('theme', theme);
}

function getTheme(): Theme {
  return (localStorage.getItem('theme') as Theme) ?? 'system';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  setTheme(getTheme());
});
```

## Runtime Dynamic Theming

For apps that allow users to pick a brand color at runtime:

```css
@theme {
  --color-primary: var(--runtime-primary, oklch(0.55 0.25 270));
  --color-secondary: var(--runtime-secondary, oklch(0.65 0.20 340));
  --color-background: var(--runtime-background, oklch(1.0 0 0));
  --color-foreground: var(--runtime-foreground, oklch(0.20 0.01 250));
}
```

```typescript
interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  foreground: string;
}

class ThemeManager {
  private root = document.documentElement;

  setTheme(colors: Partial<ThemeColors>) {
    Object.entries(colors).forEach(([key, value]) => {
      if (value) this.root.style.setProperty(`--runtime-${key}`, value);
    });
  }

  resetTheme() {
    ['primary', 'secondary', 'background', 'foreground'].forEach(key => {
      this.root.style.removeProperty(`--runtime-${key}`);
    });
  }
}

export const themeManager = new ThemeManager();
```

## User Preference Detection

```typescript
interface UserPreferences {
  colorScheme: 'light' | 'dark' | 'auto';
  reducedMotion: boolean;
  highContrast: boolean;
}

function detectPreferences(): UserPreferences {
  return {
    colorScheme: (localStorage.getItem('color-scheme') as 'light' | 'dark') ?? 'auto',
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    highContrast: window.matchMedia('(prefers-contrast: high)').matches,
  };
}

function applyPreferences(prefs: UserPreferences) {
  const root = document.documentElement;

  if (prefs.colorScheme === 'auto') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', prefs.colorScheme);
  }

  root.classList.toggle('reduce-motion', prefs.reducedMotion);
  root.classList.toggle('high-contrast', prefs.highContrast);
}
```

## Responsive Tokens

Mobile-first token overrides:

```css
@theme {
  --spacing-section: theme(spacing.8);
  --spacing-card: theme(spacing.4);

  @media (min-width: theme(breakpoint.md)) {
    --spacing-section: theme(spacing.12);
    --spacing-card: theme(spacing.6);
  }

  @media (min-width: theme(breakpoint.lg)) {
    --spacing-section: theme(spacing.16);
    --spacing-card: theme(spacing.8);
  }
}
```
