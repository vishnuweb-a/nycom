# Yarnvia Development Phases

Version: 1.0

---

# Purpose

This document defines the complete development roadmap for the Yarnvia project.

Every phase should be completed, tested, and reviewed before moving to the next phase.

The project is a **UI Prototype / MVP**, therefore the primary objective is to build a polished shopping experience instead of a feature-heavy ecommerce backend.

---

# Development Principles

Every phase must satisfy the following before proceeding:

- Responsive
- Pixel Perfect
- Reusable Components
- Accessible
- Optimized
- Clean Architecture
- Matches design.md
- Matches prd.md
- Follows guidelines.md

---

# Phase 0 — Project Initialization

## Objective

Prepare the development environment.

### Tasks

- Initialize React + Vite + TypeScript
- Configure Tailwind CSS
- Configure ESLint
- Configure Prettier
- Configure Folder Structure
- Configure React Router
- Install Required Packages
- Setup Environment Variables
- Configure Git Repository
- Create Documentation Folder

### Deliverables

- Project boots successfully
- Folder structure finalized
- Documentation added
- No UI implementation

---

# Phase 1 — Design System

## Objective

Build the foundation of the UI.

### Tasks

- Color Tokens
- Typography
- Spacing System
- Shadows
- Border Radius
- Breakpoints
- Animations
- Icons
- Global Styles

### Deliverables

- Design tokens
- Global theme
- Reusable styles

---

# Phase 2 — Core Layout

## Objective

Develop the common application structure.

### Components

- Header
- Navbar
- Search Bar
- Footer
- Container
- Section Wrapper
- Breadcrumb
- Newsletter
- Query Form

### Deliverables

Every page should already have

Header

↓

Content

↓

Footer

---

# Phase 3 — Reusable Components

## Objective

Create reusable UI components.

### Components

Button

Input

Textarea

Dropdown

Modal

Drawer

Accordion

Badge

Loader

Skeleton

Pagination

Product Card

Category Card

Rating Badge

Price Component

Quantity Selector

Empty State

Toast

All components should be independent and reusable.

---

# Phase 4 — Home Page

## Objective

Complete the landing page.

### Sections

Hero Carousel

↓

Categories

↓

Featured Products

↓

Top Selling

↓

Why Yarnvia

↓

Newsletter

↓

Contact Form

↓

Footer

### Deliverables

Fully responsive homepage.

---

# Phase 5 — Shop Page

## Objective

Product browsing experience.

### Features

Search

Category Filter

Price Filter

Brand Filter

Color Filter

Size Filter

Rating Filter

Sorting

Responsive Grid

Pagination

### Deliverables

Complete product listing page.

---

# Phase 6 — Product Details

## Objective

Detailed product information.

### Features

Image Gallery

Zoom

Title

Description

Ratings

Sizes

Quantity

Price

Add To Cart

Buy Now

Related Products

### Deliverables

Complete product details page.

---

# Phase 7 — Cart

## Objective

Shopping cart functionality.

### Features

Product List

Update Quantity

Remove Product

Subtotal

Shipping

Discount

Grand Total

Coupon Field (UI Only)

Proceed To Checkout

### Deliverables

Interactive cart page.

---

# Phase 8 — Checkout

## Objective

Create a smooth checkout flow.

### Steps

Shipping Address

↓

Delivery Method

↓

Payment Method

↓

Order Summary

↓

Place Order

### Deliverables

Complete checkout UI.

---

# Phase 9 — Order Pages

## Objective

Order management screens.

### Pages

Order Success

My Orders

Order Details

### Deliverables

Complete order workflow.

---

# Phase 10 — Backend Integration

## Objective

Connect frontend with Supabase.

### Tasks

Connect Supabase

Fetch Products

Fetch Categories

Fetch Carousel

Store Contact Queries

Retrieve Data

Mock Orders

### Cloudinary

Upload Images

Store Secure URLs

Retrieve Images

### Deliverables

Dynamic frontend using Supabase.

---

# Phase 11 — Responsive Optimization

## Objective

Optimize every screen.

### Devices

Desktop

Laptop

Tablet

Mobile

Small Mobile

### Deliverables

Responsive across all breakpoints.

---

# Phase 12 — Animations & Polish

## Objective

Improve user experience.

### Features

Page Transitions

Hover Effects

Card Animations

Drawer Animations

Button Effects

Smooth Scrolling

Loading Skeletons

### Deliverables

Production-quality interactions.

---

# Phase 13 — Testing

## Objective

Validate the application.

### Testing Checklist

Navigation

Forms

Filters

Search

Cart

Checkout

Responsiveness

Accessibility

Performance

Broken Links

Image Loading

### Deliverables

Application passes all checks.

---

# Phase 14 — Performance Optimization

## Objective

Improve speed and efficiency.

### Tasks

Lazy Loading

Route Splitting

Image Optimization

Code Splitting

Memoization

Bundle Optimization

Cloudinary Optimization

### Deliverables

Fast loading application.

---

# Phase 15 — Final Review

## Objective

Prepare for deployment.

### Checklist

✔ UI matches design.md

✔ Features match prd.md

✔ Architecture matches architecture.md

✔ Rules follow guidelines.md

✔ Responsive

✔ Accessible

✔ Optimized

✔ Clean Code

✔ No Console Errors

✔ No Dead Code

✔ No Hardcoded Values

---

# Phase 16 — Deployment

## Objective

Deploy the application.

### Frontend

Vercel

### Database

Supabase

### Images

Cloudinary

### Deliverables

Publicly accessible application.

---

---

# Phase Scope Amendments

Recorded as phases complete, so this roadmap stays accurate.

## Phase 0 / Phase 1 — delivered together

CSS-first Tailwind v4 makes the token layer inseparable from build configuration; there is no
meaningful "Tailwind configured" state that excludes the tokens.

## Phase 2 — amended scope

**Pulled forward from Phase 3:** `Button` (with `buttonVariants`). Header, Footer, the 404 page and
the route error boundary all need it, and building Phase 2 without it would have duplicated button
styling in five places.

**Moved to Phase 4:** Newsletter and Query Form. Both were listed as Phase 2 components, but their
data path — `services/` and the Supabase client — does not exist until Phase 10, and no
`newsletter_subscribers` table appears in any schema. Building them in Phase 2 would have meant
either a fake submit handler or a stub. They ship in Phase 4 alongside the Home and Contact pages
that own their handlers, and are wired to Supabase in Phase 10.

**Added:** `MobileBottomNav`, required by `design.md` → Mobile Behavior but absent from the Phase 2
component list.

**Deferred within Phase 3:** `Input`, `Textarea` and `IconButton` were built and then removed before
commit — with the forms moved to Phase 4 they had no consumer, and shipping unused components
violates the no-dead-code rule. They return in Phase 3 or Phase 4 with real consumers.

## Phase 3 — reduced scope

`Button` is already delivered. The remaining Phase 3 components are unchanged.
