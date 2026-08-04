# Design System

# Project: Modern Fashion Ecommerce

Version: 1.0

---

# Design Philosophy

The platform should feel

- Modern
- Minimal
- Trustworthy
- Fast
- Comfortable for long browsing sessions

The objective is to make product discovery effortless.

The design should prioritize:

- products over decoration
- whitespace over heavy borders
- soft neutral colors
- large imagery
- clear typography
- responsive shopping experience

Avoid unnecessary gradients, excessive shadows and flashy animations.

The design language should resemble modern ecommerce stores like Meesho, Myntra and Ajio while maintaining its own identity.

---

# Overall Layout

Desktop

```
----------------------------------------------------
Sticky Header
----------------------------------------------------

Category Navigation

----------------------------------------------------

Hero Banner

----------------------------------------------------

Quick Categories

----------------------------------------------------

Featured Sections

----------------------------------------------------

Products Grid

----------------------------------------------------

Footer
```

Maximum Width

1400px

Content Width

1320px

Horizontal Padding

Desktop
32px

Tablet
24px

Mobile
16px

---

# Color System

## Primary

Deep Purple

#6C2BD9

Hover

#5A22B4

Light Purple

#F4EEFF

---

## Secondary

Pink Accent

#FF4F8B

Only used for

- Offers
- Discounts
- Sale badges

---

## Success

#22C55E

Used for

- Ratings
- Stock Available
- Success states

---

## Warning

#F59E0B

---

## Error

#EF4444

---

## Background Colors

Primary Background

#FFFFFF

Secondary Background

#FAFAFB

Section Background

#F6F7FB

Product Card

#FFFFFF

Hover Background

#F8F8F8

---

## Text Colors

Primary

#1F2937

Secondary

#6B7280

Muted

#9CA3AF

Light

#D1D5DB

White

#FFFFFF

---

## Border

#E5E7EB

Hover Border

#D1D5DB

---

# Typography

Primary Font

Inter

Fallback

System UI

---

## Heading

Weight

700

Color

#111827

---

H1

40px

H2

32px

H3

24px

H4

20px

H5

18px

---

Body Large

16px

Weight

400

Line Height

28px

---

Body

15px

Line Height

24px

---

Small

13px

Line Height

20px

---

Caption

12px

---

Buttons

15px

Weight

600

---

# Spacing Scale

4px

8px

12px

16px

20px

24px

32px

40px

48px

64px

96px

Never use arbitrary spacing.

---

# Border Radius

Buttons

10px

Cards

12px

Inputs

10px

Images

12px

Badges

20px

Avatar

50%

---

# Shadows

Default

0 2px 10px rgba(0,0,0,.05)

Hover

0 8px 30px rgba(0,0,0,.08)

Modal

0 20px 60px rgba(0,0,0,.12)

---

# Header

Height

72px

Sticky

Yes

Background

White

Border Bottom

1px solid #E5E7EB

Contains

Logo

Search Bar

Become Seller

Wishlist

Cart

Account

---

Search Bar

Width

550px

Height

48px

Radius

999px

Background

#F5F5F5

No heavy border

Focus State

Purple outline

---

Navigation

Height

52px

White background

Horizontal scrolling on mobile

Active item

Purple underline

Hover

Purple text

---

# Hero Banner

Width

100%

Height

420px

Rounded

20px

Padding

40px

CTA Button

Large

Filled Purple

Hero Image

Right aligned

Offer Badge

Pink

---

# Category Chips

Horizontal Scroll

Circular images

80px

Label below image

Hover

Lift animation

Selected

Purple Border

---

# Product Grid

Desktop

4 columns

Gap

24px

Tablet

3 columns

Mobile

2 columns

Small Mobile

1 column

---

# Product Card

Background

White

Radius

14px

Shadow

Soft

Hover

Lift 6px

Shadow increase

---

Card Structure

Image

Product Name

Price

Old Price

Discount

Rating

Reviews

Seller

Delivery

Wishlist

---

Image

Aspect Ratio

4:5

Object Fit

Cover

Radius

12px

Background

#F8F8F8

---

Product Name

Maximum

2 lines

Ellipsis after second line

Font

15px

Weight

500

---

Price

Current

24px

Bold

Old Price

14px

Gray

Strikethrough

Discount

Green

14px

---

Rating Badge

Green background

White text

Rounded Pill

Contains

★

Rating

Review Count

---

Wishlist Button

Floating

Top Right

Circular

40px

Hover

Pink

---

Quick View

Appears on hover

Bottom overlay

---

# Sidebar Filters

Desktop

280px

Sticky

Top 90px

Background

White

Sections

Accordion

Each Section

Divider

Checkboxes

Color Swatches

Size Pills

Price Slider

---

Mobile

Filter Drawer

Bottom Sheet

---

# Buttons

Primary

Purple

White Text

Hover

Darker Purple

Radius

10px

Height

48px

---

Secondary

White

Purple Border

---

Ghost

Transparent

---

Danger

Red

---

# Forms

Input Height

48px

Radius

10px

Placeholder

Gray

Focus

Purple Border

---

Dropdown

Soft Shadow

Rounded

---

# Pagination

Centered

Rounded Numbers

Active

Purple

Hover

Light Purple

---

# Footer

Dark Background

#111827

Columns

Company

Support

Policies

Social

Newsletter

Bottom Copyright

Center aligned

---

# Icons

Style

Outlined

Stroke

2px

Library

Lucide

---

# Animations

Duration

250ms

Ease

ease-in-out

Hover Lift

Cards

Buttons

Category

Fade

Dropdown

Filter

Drawer

Slide

---

# Responsive Breakpoints

Desktop XL

1440+

Desktop

1280

Laptop

1024

Tablet

768

Mobile

480

Small Mobile

360

---

# Mobile Behavior

Sticky Bottom Navigation

Home

Categories

Wishlist

Cart

Account

---

Search

Full Width

---

Filter

Bottom Drawer

---

Category

Horizontal Scroll

---

Products

2 columns

16px gap

---

# Accessibility

Minimum Contrast

AA

Clickable Area

44px

Keyboard Navigation

Supported

Focus Ring

Visible

Image Alt

Mandatory

---

# Image Guidelines

Use high-resolution product images.

Consistent lighting.

White or soft neutral background.

Maintain identical aspect ratios across listings.

No watermarks.

---

# Design Tokens

Primary

#6C2BD9

Primary Hover

#5A22B4

Accent

#FF4F8B

Success

#22C55E

Warning

#F59E0B

Danger

#EF4444

Background

#FFFFFF

Surface

#FAFAFB

Border

#E5E7EB

Heading

#111827

Body

#4B5563

Muted

#9CA3AF

Radius

12px

Transition

250ms ease

Shadow

0 2px 10px rgba(0,0,0,.05)

---

# Future Expansion Ready

The design system must support future additions without redesign.

Future modules include:

- Authentication
- Wishlist
- Cart
- Checkout
- Order Tracking
- Vendor Dashboard
- Admin Dashboard
- Product Comparison
- Product Reviews
- AI Product Recommendations
- Flash Sales
- Coupons
- Loyalty Points
- Live Chat
- Multi-language
- Dark Mode
- Progressive Web App

---

# Token Reference — as built (Phase 1)

The tokens above are implemented as a single `@theme` block in `src/styles/global.css`.

Tailwind's default color, typography, radius, shadow, breakpoint and container scales are reset to
`initial` before the design tokens are declared. Off-system utilities such as `bg-blue-500`,
`text-xs` or `rounded-lg` therefore generate no CSS at all and render visibly unstyled, rather than
shipping a plausible but off-brand value.

Tailwind does not raise a build error for unknown utilities, so this is a loud safety net rather
than a hard gate — code review remains the point of enforcement.

## Breakpoint prefixes

Mobile-first. The unprefixed base tier is Small Mobile.

| Prefix | Min width | Device       |
| ------ | --------- | ------------ |
| none   | 360px     | Small Mobile |
| `xs:`  | 480px     | Mobile       |
| `md:`  | 768px     | Tablet       |
| `lg:`  | 1024px    | Laptop       |
| `xl:`  | 1280px    | Desktop      |
| `2xl:` | 1440px    | Desktop XL   |

Tailwind's default `sm:` (640px) is deliberately removed — it corresponds to no device tier in this
design system.

## Typography utilities

| Utility        | Size / line height  | Use                        |
| -------------- | ------------------- | -------------------------- |
| `text-caption` | 12 / 16             | Captions                   |
| `text-small`   | 13 / 20             | Small text                 |
| `text-base`    | 15 / 24             | Body                       |
| `text-lg`      | 16 / 28             | Body Large                 |
| `text-button`  | 15 / 20, weight 600 | Buttons                    |
| `text-h5`      | 18 / 26             | H5                         |
| `text-h4`      | 20 / 28             | H4                         |
| `text-h3`      | 24 / 32             | H3                         |
| `text-h2`      | 32 / 40             | H2                         |
| `text-h1`      | 40 / 48             | H1                         |
| `text-price`   | 24 / 32             | Product card current price |

Body sizes are named `base` and `lg` rather than `body` because `--text-body` and `--color-body`
would both compile to an ambiguous `text-body` utility.

Headings scale down on small screens by swapping tokens — for example `text-h3 md:text-h1` — never
by introducing intermediate sizes.

## Color utilities

`primary` · `primary-hover` · `primary-light` · `accent` · `success` · `warning` · `danger` ·
`background` · `surface` · `section` · `hover` · `placeholder` · `search` · `footer` · `heading` ·
`text` · `body` · `secondary` · `muted` · `light` · `border` · `border-hover` · `white` · `black`

## Radius, shadow and named dimensions

Radius: `rounded-button` (10) · `rounded-input` (10) · `rounded-card` (12) · `rounded-image` (12) ·
`rounded-product` (14) · `rounded-hero` (20) · `rounded-badge` (20) · `rounded-pill` (999)

Shadow: `shadow-card` · `shadow-card-hover` · `shadow-modal`

Dimensions (usable as width, height, padding, margin and gap): `header` (72) · `nav` (52) ·
`hero` (420) · `searchbar` (550) · `sidebar` (280) · `control` (48) · `category` (80) · `tap` (44).
The numeric 4px spacing scale remains available and covers every step in the spacing scale above.

## Shared utilities

- `container-page` — centred content column, max 1320px, with the 16 / 24 / 32px responsive
  horizontal padding from this document.
- `line-clamp-2-fixed` — two-line ellipsis for product titles.

## Product grid columns — resolved

`prd.md` section 8 specifies 2 columns on mobile while the Product Grid section above specifies 1
column on Small Mobile. Resolution: **2 columns from 480px, 1 column below 480px**, which satisfies
the PRD at every device it names and preserves the Small Mobile intent of this document.

## Motion

Default transition duration is 250ms with `ease-in-out`, applied globally via
`--default-transition-duration`. A `prefers-reduced-motion: reduce` block in the base layer
neutralises animation, transition and smooth scrolling for users who request it.

---

# Layout Chrome — as built (Phase 2)

## Header

Sticky, `z-40`, white, 1px bottom border, as specified. The responsive behaviour is:

| Tier                 | Layout                                                           |
| -------------------- | ---------------------------------------------------------------- |
| Small Mobile, Mobile | Logo + cart on row one, full-width search on row two; height auto |
| Tablet               | Single 72px row: logo, search, cart                               |
| Laptop and up        | Single 72px row: logo, primary nav, search, cart                  |

The two-row mobile treatment implements "Search — Full Width" from Mobile Behavior. Header height is
72px from Tablet up as specified; on mobile it is taller because it carries two rows.

Wishlist, Account and "Become Seller" are not rendered — see the omissions table in
`architecture.md`. Primary navigation (Home, Shop, My Orders) appears from Laptop up; below that,
navigation is served by the category bar and the mobile bottom bar.

## Category navigation

52px tall, white, horizontally scrollable on narrow screens with the scrollbar hidden. The active
item carries the purple bottom border; inactive items are body colour and turn purple on hover.
Entries are Shop All, Men, Women, Children.

## Footer

Dark `#111827` background. Four columns at Laptop width, two at Tablet, one stacked on Mobile:
brand and tagline, Shop, Your Account, Support. A bottom row holds social links and the copyright.

Two deviations from this document:

1. **Social links render as text, not brand glyphs.** `lucide-react` 1.x removed all brand icons for
   trademark reasons, and this document names Lucide as the icon library. Hand-authoring brand SVG
   paths was rejected. If brand marks are wanted, a dedicated icon dependency needs approval.
2. **Policy links are omitted.** `prd.md` §16 lists About, Privacy Policy, Terms, Refund Policy and
   FAQs, but `prd.md` §5 defines no routes for them and no phase builds them. They are omitted
   rather than linked to 404s. This is an open PRD gap.

## Mobile bottom navigation

Sticky, hidden from Tablet up, with `env(safe-area-inset-bottom)` padding so it clears the home
indicator on notched devices. Four destinations — Home, Shop, Orders, Cart. Wishlist and Account
from Mobile Behavior are omitted until those features exist. The active item is purple and its icon
renders at a heavier stroke.

## Buttons

`Button` implements the four specified variants — primary, secondary, ghost, danger — in two sizes,
`sm` (44px) and `md` (48px). Both meet the 44px minimum clickable area; 48px matches the Buttons
section above. A loading state swaps the label for a spinner, sets `aria-busy` and blocks
interaction.

## Focus and motion

Focus rings come from the global `:focus-visible` rule established in Phase 1, so no component
declares its own. All hover transitions inherit the 250ms `ease-in-out` default and are neutralised
under `prefers-reduced-motion: reduce`.

---

# Shop Listing — as built

## Layout

| Tier          | Filters                    | Grid      |
| ------------- | -------------------------- | --------- |
| Small Mobile  | Bottom drawer              | 1 column  |
| Mobile        | Bottom drawer              | 2 columns |
| Tablet        | Sticky 280px sidebar       | 3 columns |
| Laptop        | Sticky 280px sidebar       | 3 columns |
| Desktop XL    | Sticky 280px sidebar       | 4 columns |

The sidebar sticks at `top-32`, clearing the 72px header plus the 52px category bar, and scrolls
independently when the filter list is taller than the viewport.

## Price filter — deviation from "Price Slider"

This document specifies a price slider. The implementation uses four quick bands plus a Min/Max
number pair instead.

A dual-thumb slider needs pointer precision that is unreliable on touch, is awkward to operate with
a keyboard, and announces poorly to screen readers. Typed inputs let a shopper enter an exact budget
and are natively accessible. The bands cover the common case in one tap.

## Filter visibility

A facet with fewer than two options is not rendered — a lone checkbox that cannot change the result
set is noise. Availability appears only when the current selection contains both in- and
out-of-stock items.

## Active filter chips

Selected filters render as removable chips above the grid, with a Clear all action. Without them the
only way to see what is narrowing a result set is to open the sidebar, which on mobile means opening
the drawer.

## Product card addition

The card gained a stock indicator beneath the size list: "In stock" in success green, or "Only N
left" in warning amber at five units or fewer. Out-of-stock products keep the existing overlay
treatment. This is shared with the homepage rails.

## Mobile filter drawer

Bottom sheet at up to 85% viewport height, with a pinned footer holding Clear all and a "Show N
results" dismiss. Focus moves into the sheet on open and returns to the trigger on close, Tab is
trapped inside, Escape dismisses, and the page behind is locked from scrolling.

---

# Product Details — as built

## Layout

| Tier              | Arrangement                                                     |
| ----------------- | --------------------------------------------------------------- |
| Small Mobile      | Gallery, panel, delivery, details, specs, related; sticky bar    |
| Mobile            | As above, actions side by side in the sticky bar                 |
| Tablet            | Gallery and thumbnails side by side, panel below                 |
| Laptop / Desktop  | Two columns — sticky gallery left, panel right                   |

The gallery sticks at `top-32` on large screens so the imagery stays in view while the longer right
column scrolls.

## Mobile purchase bar

Fixed to the bottom edge, hidden from tablet up, and it **covers the global mobile bottom
navigation** on this route. Two stacked bars would consume roughly a third of a small viewport, and
purchasing is the only task that matters on a product page. Page content carries bottom padding so
nothing hides behind it.

## Gallery

Hero image with a thumbnail strip beside it on desktop and beneath on mobile. Thumbnails are a radio
group, so arrow keys move between views and the selection is announced. The hero is keyed on the
asset so the fade replays on each change.

Zoom is architecturally prepared but not implemented: magnification needs only a larger Cloudinary
derivative of the same active asset.

## Size and quantity

Sizes render as a radio group. Sold-out sizes remain visible, struck through and disabled. A product
with a single buyable size auto-selects it. Quantity is a stepper bounded by the selected size's
stock, with no free-text entry, so an invalid value cannot be produced.

## Animation tokens

`animate-fade-in` and `animate-rise-in` were added to the `@theme` block — 250ms `ease-in-out`,
matching the Animations section above. Both are neutralised by the existing
`prefers-reduced-motion` rule.

## Toast

Bottom-centre on mobile (clearing the purchase bar), bottom-right from tablet up. Auto-dismisses
after 3.5 seconds, capped at three visible, each individually dismissible.
