# Design Token Architecture

## Three-Layer System

A scalable design system uses three layers: Primitive → Semantic → Component.

### Layer 1: Primitives (Base Palette)

Raw color values — never use directly in components.

```css
@theme {
  --primitive-purple-400: oklch(0.60 0.25 270);
  --primitive-purple-500: oklch(0.55 0.25 270);
  --primitive-purple-600: oklch(0.50 0.25 270);

  --primitive-blue-400: oklch(0.65 0.20 250);
  --primitive-blue-500: oklch(0.60 0.20 250);
  --primitive-blue-600: oklch(0.55 0.20 250);

  --primitive-green-500: oklch(0.65 0.18 145);
  --primitive-green-600: oklch(0.60 0.18 145);

  --primitive-red-500: oklch(0.60 0.22 25);
  --primitive-red-600: oklch(0.55 0.22 25);

  /* Neutral scale */
  --primitive-gray-50: oklch(0.98 0.01 250);
  --primitive-gray-100: oklch(0.96 0.01 250);
  --primitive-gray-200: oklch(0.92 0.01 250);
  --primitive-gray-300: oklch(0.85 0.01 250);
  --primitive-gray-400: oklch(0.70 0.01 250);
  --primitive-gray-500: oklch(0.50 0.01 250);
  --primitive-gray-600: oklch(0.40 0.01 250);
  --primitive-gray-700: oklch(0.30 0.01 250);
  --primitive-gray-800: oklch(0.20 0.01 250);
  --primitive-gray-900: oklch(0.15 0.01 250);
}
```

### Layer 2: Semantic Tokens

Map primitives to meaning. These are what components should reference.

```css
@theme {
  --color-brand-primary: var(--primitive-purple-500);
  --color-brand-secondary: var(--primitive-blue-500);

  --color-success: var(--primitive-green-500);
  --color-error: var(--primitive-red-500);
  --color-warning: oklch(0.75 0.18 85);
  --color-info: var(--primitive-blue-500);

  --color-background: var(--primitive-gray-50);
  --color-foreground: var(--primitive-gray-900);
  --color-surface: oklch(1.0 0 0);
  --color-border: var(--primitive-gray-300);
}
```

### Layer 3: Component Tokens

Bind semantics to specific component states.

```css
@theme {
  /* Button */
  --color-button-primary-bg: var(--color-brand-primary);
  --color-button-primary-hover: var(--primitive-purple-600);
  --color-button-primary-text: oklch(1.0 0 0);
  --color-button-primary-disabled-bg: var(--primitive-gray-300);
  --color-button-primary-disabled-text: var(--primitive-gray-500);

  --color-button-destructive-bg: var(--color-error);
  --color-button-destructive-hover: var(--primitive-red-600);
  --color-button-destructive-text: oklch(1.0 0 0);

  --color-button-outline-bg: transparent;
  --color-button-outline-hover: var(--primitive-gray-100);
  --color-button-outline-border: var(--color-border);
  --color-button-outline-text: var(--color-foreground);

  /* Input */
  --color-input-bg: var(--color-surface);
  --color-input-border: var(--color-border);
  --color-input-border-focus: var(--color-brand-primary);
  --color-input-border-error: var(--color-error);
  --color-input-placeholder: var(--primitive-gray-500);

  /* Card */
  --color-card-bg: var(--color-surface);
  --color-card-border: var(--color-border);
  --color-card-hover-border: var(--primitive-gray-400);
}
```

### Usage in Components

```html
<button class="
  bg-button-primary-bg text-button-primary-text
  hover:bg-button-primary-hover
  disabled:bg-button-primary-disabled-bg disabled:text-button-primary-disabled-text
  px-4 py-2 rounded-md
">
  Submit
</button>

<input class="
  bg-input-bg border border-input-border
  focus:border-input-border-focus focus:ring-2 focus:ring-primary
  px-3 py-2 rounded-md
" />
```

## Status Color Patterns

```css
@theme {
  --status-success-bg: oklch(0.95 0.03 145);
  --status-success-border: oklch(0.80 0.10 145);
  --status-success-text: var(--primitive-green-600);

  --status-warning-bg: oklch(0.95 0.03 85);
  --status-warning-border: oklch(0.85 0.10 85);
  --status-warning-text: oklch(0.45 0.18 85);

  --status-error-bg: oklch(0.95 0.03 25);
  --status-error-border: oklch(0.80 0.10 25);
  --status-error-text: var(--primitive-red-600);

  --status-info-bg: oklch(0.95 0.03 250);
  --status-info-border: oklch(0.80 0.10 250);
  --status-info-text: var(--primitive-blue-600);
}
```

```html
<div class="bg-status-success-bg border border-status-success-border text-status-success-text p-4 rounded-md">
  Operation completed successfully.
</div>
```

## Color Manipulation with color-mix

Generate variations from a single base color:

```css
@theme {
  --color-primary: oklch(0.55 0.25 270);

  --color-primary-light: color-mix(in oklch, var(--color-primary), white 20%);
  --color-primary-dark: color-mix(in oklch, var(--color-primary), black 20%);
  --color-primary-muted: color-mix(in oklch, var(--color-primary), var(--color-background) 70%);
}
```

## Accessibility Tokens

Ensure WCAG AA compliance (4.5:1 for normal text, 3:1 for large text):

```css
@theme {
  --ring-color: var(--color-primary);
  --ring-offset-color: var(--color-background);
  --ring-offset-width: 2px;
  --ring-width: 2px;
}
```

```html
<button class="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
  Accessible button
</button>
```
