# Advanced Patterns

## Table of Contents
1. [Container Queries](#container-queries)
2. [CSS Grid Layouts](#css-grid-layouts)
3. [Animations](#animations)
4. [Custom Utilities](#custom-utilities)
5. [Plugin Development](#plugin-development)
6. [Performance](#performance)

## Container Queries

Component-based responsive design — responds to container width, not viewport.

```html
<div class="@container">
  <div class="@sm:p-6 @md:flex @md:gap-6 @lg:grid @lg:grid-cols-2">
    <div class="@md:flex-1">Content</div>
    <div class="@md:flex-1">Sidebar</div>
  </div>
</div>
```

Named containers for targeted queries:

```css
@layer components {
  .product-card {
    container-type: inline-size;
    container-name: product-card;
  }

  .product-card__content {
    display: flex;
    flex-direction: column;
    gap: theme(spacing.4);
  }

  @container product-card (min-width: 400px) {
    .product-card__content {
      flex-direction: row;
      align-items: center;
    }
  }

  @container product-card (min-width: 600px) {
    .product-card__content {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
    }
  }
}
```

## CSS Grid Layouts

### Named Grid Areas

```css
@layer components {
  .dashboard-layout {
    display: grid;
    grid-template-areas:
      'header header header'
      'sidebar main aside'
      'footer footer footer';
    grid-template-columns: 250px 1fr 300px;
    grid-template-rows: auto 1fr auto;
    min-height: 100vh;
    gap: theme(spacing.4);
  }

  .dashboard-header { grid-area: header; }
  .dashboard-sidebar { grid-area: sidebar; }
  .dashboard-main { grid-area: main; }
  .dashboard-aside { grid-area: aside; }
  .dashboard-footer { grid-area: footer; }

  @media (max-width: theme(breakpoint.lg)) {
    .dashboard-layout {
      grid-template-areas: 'header' 'main' 'aside' 'footer';
      grid-template-columns: 1fr;
    }
    .dashboard-sidebar { display: none; }
  }
}
```

### Subgrid for Card Alignment

```css
@layer components {
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: theme(spacing.6);
  }

  .card {
    display: grid;
    grid-template-rows: subgrid;
    grid-row: span 3;
  }
}
```

## Animations

### Keyframe Animations via @theme

```css
@theme {
  --animate-fade-in: fade-in 0.5s ease-out;
  --animate-slide-up: slide-up 0.3s ease-out;
  --animate-bounce-in: bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes bounce-in {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.05); }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
}
```

```html
<div class="animate-fade-in">Fades in</div>
<div class="animate-slide-up">Slides up</div>
```

### Scroll-Driven Animations

```css
@layer utilities {
  .animate-on-scroll {
    animation: fade-in linear;
    animation-timeline: view();
    animation-range: entry 0% cover 30%;
  }
}
```

### Reduced Motion

Always respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-fade-in { animation: none; opacity: 1; }
  .transition-all { transition: none; }
}
```

## Custom Utilities

### @utility Directive

```css
@utility text-balance {
  text-wrap: balance;
}

@utility scroll-snap-x {
  scroll-snap-type: x mandatory;
}

@utility scroll-snap-child {
  scroll-snap-align: start;
  scroll-snap-stop: always;
}
```

### Cascade Layers

```css
@import "tailwindcss";

@layer base {
  html { font-family: theme(fontFamily.body); }
}

@layer components {
  .card {
    background-color: theme(colors.card);
    border: 1px solid theme(colors.border);
  }
}

@layer utilities {
  .text-balance { text-wrap: balance; }
}
```

## Plugin Development

```javascript
// plugins/custom-utilities.js
export default function customUtilities({ addUtilities }) {
  addUtilities({
    '.text-shadow': { 'text-shadow': '0 2px 4px rgba(0,0,0,0.1)' },
    '.text-shadow-lg': { 'text-shadow': '0 4px 8px rgba(0,0,0,0.15)' },
    '.glass': {
      'background': 'rgba(255, 255, 255, 0.1)',
      'backdrop-filter': 'blur(10px)',
      'border': '1px solid rgba(255, 255, 255, 0.2)',
    },
  });
}
```

```javascript
// vite.config.js
import tailwindcss from '@tailwindcss/vite'
import customUtilities from './plugins/custom-utilities'

export default {
  plugins: [tailwindcss({ plugins: [customUtilities] })],
}
```

## Performance

### Vite Plugin (100x+ faster incremental builds)

```javascript
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss()],
  build: { cssMinify: 'lightningcss' },
})
```

### Content Detection Optimization (monorepos)

```css
@import "tailwindcss" layer(base, components, utilities)
  source("./src/**/*.{js,jsx,ts,tsx}");
```

### Bundle Size Analysis

```javascript
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    tailwindcss(),
    visualizer({ open: true, gzipSize: true, brotliSize: true }),
  ],
})
```
