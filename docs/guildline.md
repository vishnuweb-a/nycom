# Yarnvia Development Guidelines

Version: 1.0

---

# Purpose

This document defines the working rules for every AI agent, developer, designer, and contributor working on the Yarnvia project.

Every task should follow these guidelines before implementation.

The objective is consistency, maintainability, scalability, and production-quality output.

---

# Project Overview

Project Name

Yarnvia

Type

Modern Fashion Ecommerce Website

Goal

Build a premium clothing shopping website with a beautiful UI, reusable architecture, responsive layouts, and scalable codebase.

---

# Agent Behavior

You are NOT just a code generator.

You are

- Product Designer
- UI/UX Designer
- Frontend Architect
- Software Engineer
- Performance Optimizer
- Accessibility Reviewer
- Code Reviewer

Before writing any code

Always

1. Understand the requirement
2. Think about scalability
3. Think about maintainability
4. Think about responsiveness
5. Think about performance
6. Think about accessibility
7. Think about reusability

Never rush into implementation.

---

# Working Methodology

Always follow this order

Requirement

↓

Planning

↓

Component Breakdown

↓

Folder Analysis

↓

Implementation

↓

Optimization

↓

Testing

↓

Review

↓

Completion

Never directly jump into coding.

---

# UI Design Rules

The interface should always feel

Modern

Minimal

Clean

Premium

Elegant

Fast

Trustworthy

Products should always remain the primary focus.

Do not overcrowd the UI.

Whitespace is a feature.

---

# Color Rules

Always use design tokens.

Never hardcode colors.

Correct

Primary

Secondary

Background

Surface

Border

Error

Warning

Success

Incorrect

#ff0000

#123456

rgb()

Random gradients

Random opacity

---

# Typography Rules

Only use project typography.

Maintain hierarchy.

Heading

↓

Subheading

↓

Body

↓

Caption

Never mix font families.

Never randomly change font weights.

---

# Layout Rules

Always use

Container

Section

Grid

Flex

Avoid absolute positioning unless necessary.

Maintain consistent spacing.

Never use magic numbers.

---

# Responsive Rules

Always design mobile-first.

Support

Desktop

Laptop

Tablet

Mobile

Small Mobile

Every component must work on every screen size.

Never assume desktop only.

---

# Component Rules

Every UI element must be reusable.

Examples

Button

Input

Product Card

Navbar

Footer

Filter

Modal

Badge

Loader

Pagination

Accordion

Dropdown

Never duplicate components.

If similar functionality exists

Reuse it.

---

# Naming Convention

Components

PascalCase

ProductCard

Navbar

HeroBanner

Hooks

camelCase

useCart

useProducts

Variables

camelCase

Functions

camelCase

Constants

UPPER_CASE

CSS Variables

kebab-case

Folder Names

lowercase

Never use spaces.

Never use unclear names.

Bad

abc

data1

temp

good

product-card

cart-service

filter-sidebar

---

# Folder Structure Rules

Every feature must have its own folder.

Example

src/

components/

pages/

layouts/

hooks/

services/

lib/

utils/

context/

types/

constants/

assets/

styles/

Do not dump files into one folder.

---

# Styling Rules

Use Tailwind CSS.

Avoid inline styles.

Avoid unnecessary CSS.

Use utility classes.

Create reusable variants.

No duplicated styles.

---

# State Management

Local State

useState

Shared State

Context API

Large Scale

Redux / Zustand (future)

Never prop-drill unnecessarily.

---

# API Rules

Keep API logic separated.

Never call APIs inside UI components.

Use

services/

or

api/

Example

product.service.ts

auth.service.ts

cart.service.ts

---

# Data Rules

Never hardcode production data.

Use

Mock Data

↓

API

↓

Database

Keep the UI independent.

---

# Product Card Rules

Every product card must contain

Image

Category

Title

Short Description

Original Price

Discount Price

Discount Badge

Rating

Available Sizes

Add To Cart

Wishlist

Hover Effect

Never overcrowd cards.

---

# Search Rules

Search must support

Product Name

Category

Tags

Brand

Future

AI Search

Autocomplete

Suggestions

Recent Searches

---

# Filter Rules

Filters must remain independent.

Category

Price

Brand

Size

Color

Discount

Availability

Rating

Sorting

Each filter should be reusable.

---

# Cart Rules

Every action must update

Cart Count

Total Price

Subtotal

Tax

Shipping

Grand Total

Immediately.

No refresh required.

---

# Checkout Rules

Checkout must be simple.

Maximum

4 steps

Address

↓

Delivery

↓

Payment

↓

Confirmation

Do not create unnecessary forms.

---

# Form Rules

Every form must include

Validation

Loading State

Success State

Error State

Disabled State

Required Indicator

No uncontrolled inputs.

---

# Error Handling

Every API request must handle

Loading

Success

Empty State

Failure

Retry

Offline

Never leave blank screens.

---

# Empty States

Every page must have

Illustration

Message

Action Button

Examples

No Orders

No Products

No Wishlist

Cart Empty

Search Not Found

---

# Loading States

Never use blank pages.

Use

Skeletons

Loaders

Shimmer Effects

Progress Indicators

---

# Animation Rules

Animations should improve UX.

Do not distract users.

Allowed

Fade

Scale

Slide

Hover Lift

Button Ripple

Accordion

Drawer

Not Allowed

Flash

Bounce Forever

Random Rotation

Excessive Motion

---

# Accessibility Rules

Every image

Alt Text

Buttons

Labels

Keyboard Navigation

Visible Focus

Proper Contrast

Semantic HTML

Use

header

nav

main

section

footer

Never use div everywhere.

---

# Performance Rules

Lazy load

Images

Routes

Heavy Components

Optimize

Images

Fonts

Bundle Size

Avoid unnecessary renders.

---

# Security Rules

Never expose

API Keys

Secrets

Passwords

Tokens

Validate

Every input.

Sanitize

Every request.

---

# Git Rules

Every commit should represent one feature.

Good

feat: add product filters

fix: checkout validation

refactor: optimize navbar

Bad

update

changes

done

---

# Documentation Rules

Every feature must include

Purpose

Usage

Props

Dependencies

Example

Future Improvements

---

# Code Review Checklist

Before marking complete

✔ Responsive

✔ Accessible

✔ Reusable

✔ Optimized

✔ No Console Logs

✔ No Dead Code

✔ Proper Naming

✔ Clean Folder Structure

✔ Type Safe

✔ No Hardcoded Values

✔ Matches Design System

---

# Design Consistency

Always follow

design.md

Never invent new colors.

Never invent new spacing.

Never invent new typography.

Every new component must match the design system.

---

# PRD Compliance

Before implementing any feature

Read

prd.md

Confirm

Purpose

User Flow

Navigation

Dependencies

Acceptance Criteria

Do not implement features outside the PRD unless explicitly instructed.

---

# Communication Style (Agent Response Rules)

The agent should communicate like a senior product engineer.

Always:

- Explain the implementation plan before coding.
- State assumptions if requirements are unclear.
- Break large tasks into smaller milestones.
- Mention affected files before making changes.
- Highlight trade-offs when multiple approaches exist.
- Suggest improvements, but do not change scope without approval.

Response format:

1. Requirement Understanding
2. Implementation Plan
3. Files/Components Affected
4. Dependencies
5. Implementation
6. Validation Performed
7. Next Recommended Step

Never:

- Skip explanations for complex changes.
- Claim a feature is complete without verifying it.
- Invent APIs, database schemas, or business rules.
- Ignore existing project architecture.

---

# Do Not

Do NOT

Hardcode colors

Hardcode spacing

Duplicate components

Write unstructured code

Mix business logic with UI

Ignore responsiveness

Ignore accessibility

Ignore loading states

Ignore empty states

Ignore error handling

Ignore validations

Ignore folder structure

Ignore naming conventions

Ignore design.md

Ignore prd.md

Overcomplicate solutions

Use placeholder production code

Introduce breaking changes without documenting them

---

# Always

Always

Read the requirement completely.

Follow the PRD.

Follow the design system.

Build reusable components.

Maintain clean architecture.

Write scalable code.

Optimize performance.

Keep code readable.

Think like a product engineer.

Think before implementing.

Deliver production-quality work.

---

# Backend Guidelines (MVP Architecture)

## Architecture Goal

The backend is intentionally lightweight.

This project is a **UI Prototype / MVP**, not a complete ecommerce platform.

The objective is to demonstrate a realistic shopping experience while minimizing backend complexity.

---

# Backend Stack

Database

Supabase PostgreSQL

Authentication

Supabase Auth (Optional for MVP)

Storage

Cloudinary

Backend Framework

None unless absolutely required.

If server logic is needed, use lightweight Supabase Edge Functions only.

---

# Image Management

All product images must be stored inside Cloudinary.

Workflow

Admin Upload

↓

Upload Image to Cloudinary

↓

Receive Secure URL

↓

Store URL inside Supabase

↓

Frontend fetches URL

↓

Image rendered directly from Cloudinary

The frontend should NEVER store images locally.

Never store image blobs inside Supabase.

Always store only

- secure_url
- public_id
- metadata (optional)

---

# Database Responsibility

Supabase should only manage lightweight business data.

Examples

Products

Categories

Featured Products

Top Selling Products

Orders (Mock)

Users (Optional)

Product Images (Cloudinary URLs)

Carousel Images

Contact Queries

No complex database relationships are required for this MVP.

---

# Backend Scope

The backend should only support

✔ Fetch Products

✔ Fetch Categories

✔ Fetch Featured Products

✔ Fetch Carousel Images

✔ Fetch Top Selling Products

✔ Upload Images to Cloudinary

✔ Store Cloudinary URL in Supabase

✔ Read Cloudinary URL from Supabase

✔ Submit Contact Form

✔ Store Cart (optional)

Everything else should remain frontend-driven.

---

# NOT Required

Do NOT implement

Inventory Management

Payment Gateway

Coupon Engine

Shipping APIs

Notification Service

Recommendation Engine

Admin Roles

Analytics

Invoice Generation

Warehouse Management

Real Authentication Flow

Order Tracking APIs

Microservices

Redis

Message Queues

Caching Layers

Background Workers

Complex Security Policies

These are intentionally outside the project scope.

---

# Product Data Structure

Every product should contain

id

title

slug

category

gender

description

price

discount_price

sizes

tags

rating

featured

top_selling

image_urls

created_at

updated_at

The image_urls field should contain Cloudinary Secure URLs.

---

# Carousel Structure

id

title

subtitle

button_text

button_link

image_url

active

display_order

---

# Categories

Children

Women

Men

Each category should contain

name

slug

cover_image

description

---

# Contact Form

Fields

Name

Email

Phone

Subject

Message

Submitted At

Status

Store responses inside Supabase.

No email integration is required.

---

# Image Upload Rules

Always upload to Cloudinary first.

Never upload directly into Supabase Storage.

Cloudinary becomes the single source of truth for all media.

Folder Structure

/yarnvia/

carousel/

products/

categories/

brands/

avatars/

Future folders may be added later.

---

# Frontend Data Flow

User

↓

Frontend

↓

Supabase

↓

Cloudinary URL

↓

Cloudinary CDN

↓

Image Display

No backend processing should be required for rendering images.

---

# Agent Instructions

Whenever implementing backend functionality,

Always assume

Supabase stores data.

Cloudinary stores images.

The frontend consumes only Supabase records.

If a feature requires image upload,

Always

Upload → Cloudinary

↓

Store URL → Supabase

↓

Retrieve URL → Frontend

Never suggest storing product images inside Supabase Storage unless explicitly requested by the project owner.

---

# Development Philosophy

Keep the backend as thin as possible.

Invest effort into

- UI polish
- User experience
- Component architecture
- Responsiveness
- Clean code

Do not spend development time building enterprise backend features that are outside the MVP scope.

The shopping experience should _feel_ production-ready, even if the backend remains intentionally lightweight.

---

# Addendum — Conventions established in Phase 0 / Phase 1

## Filename note

This file is referenced throughout the documentation as `guidelines.md`; the actual filename is
`guildline.md`. Both refer to this document.

## Design tokens are enforced by the build

`src/styles/global.css` resets Tailwind's default scales to `initial`, so any off-system utility
generates no CSS and the element renders visibly unstyled. Tailwind does not error on unknown
utilities, so review is still the point of enforcement — but a violation is now obvious on screen
instead of quietly shipping an off-brand color.

If a value you need does not exist as a token, the correct action is to add it to `design.md` first
and then to the `@theme` block — never to reach for an arbitrary value.

## Product facets — brand, color and availability

Brand, color and stock are stored as namespaced entries in the product `tags` array
(`brand:levis`, `color:navy`, `stock:in`) rather than as dedicated columns.

Rules:

- Only the typed facet utility in `utils/` may parse or construct these strings.
- Components and filters consume structured, typed values — never raw tags.
- Facet keys are defined once as constants; never inline the `brand:` or `color:` prefix.

This keeps the promotion of facets to real database columns a single-file change.

## Import convention

Use the `@/` alias for all cross-directory imports. ESLint rejects relative paths that traverse two
or more directories upward.

## Page module convention

Every page lives in `src/pages/<PageName>/`, exports the component as a **default** export from
`<PageName>Page.tsx`, and re-exports it from an `index.ts`. The router relies on the default export
for lazy loading.

## Documentation formatting

`docs/` is excluded from Prettier so specification prose is never reflowed by tooling.
