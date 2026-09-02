# Startup Engine Design System

## 1. Atmosphere & Identity

Startup Engine feels like a focused operating console for high-stakes startup
work: calm, trustworthy, and precise. The signature is a restrained dark
surface hierarchy with one clear blue action color, keeping onboarding direct
and low-friction.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | `--background` | white | deep slate | Page background |
| Surface/secondary | `--card` | white | deep slate | Cards and panels |
| Text/primary | `--foreground` | deep slate | near-white | Headlines and body |
| Text/secondary | `--muted-foreground` | slate | muted slate | Hints and secondary copy |
| Border/default | `--border` | light slate | slate | Cards, dividers, inputs |
| Border/input | `--input` | light slate | slate | Form controls |
| Accent/primary | `--primary` | blue | bright blue | CTAs, active tabs, focus |
| Accent/foreground | `--primary-foreground` | near-white | deep slate | Text on primary controls |
| Status/success | emerald utilities | emerald | emerald | Invite confirmation |
| Status/error | `--destructive` | red | muted red | Form and fetch errors |

### Rules

- Use semantic Tailwind tokens backed by the CSS variables in `src/index.css`.
- Blue is reserved for interactive actions and active states.
- Success and error treatments are compact, bordered inline messages.

## 3. Typography

### Scale

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| H2 | `text-2xl` | bold | Auth and invite card titles |
| Body | `text-base` | regular | Main explanatory copy |
| Body/sm | `text-sm` | regular/medium | Labels, hints, controls |
| Caption | `text-xs` | medium | Supporting metadata |

### Font Stack

- Primary: Inter, system-ui, sans-serif (already loaded by the application)
- Mono: system monospace only where existing product surfaces require it

## 4. Spacing & Layout

### Base Unit

All spacing derives from a 4px base and uses Tailwind's standard scale.

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Icon-to-label details |
| `space-2` | 8px | Compact groups and hints |
| `space-4` | 16px | Form field rhythm |
| `space-6` | 24px | Card internals and section gaps |
| `space-8` | 32px | Card padding and form top offset |
| `space-12` | 48px | Page-level vertical breathing room |

- Auth surfaces are centered in a `max-w-md` column.
- Full-height public auth pages use `min-h-[100dvh]` with responsive padding.

## 5. Components

### Public auth card

- **Structure**: centered wrapper, shadcn `Card` + `CardContent`, logo mark,
  title/subtitle, form content.
- **Variants**: login, registration, invite status.
- **Spacing**: `p-8`, `space-y-4`, `gap-3` for grouped controls.
- **States**: default, loading, success, error, disabled.
- **Accessibility**: semantic form controls, visible focus rings, labels or
  accessible placeholders where inherited auth markup uses them.
- **Motion**: shadcn transition utilities only; no layout animation.

### Registration mode selector

- **Structure**: Radix/shadcn `Tabs` with two `TabsTrigger` controls.
- **Variants**: fund (default), startup.
- **Spacing**: full-width `TabsList` with equal-width triggers.
- **States**: active, hover, focus, disabled.
- **Accessibility**: Radix keyboard navigation and selected state semantics.

## 6. Motion & Interaction

- Use existing shadcn transition utilities for color and focus changes.
- Loading is represented by disabled controls and existing spinner icons where
  appropriate.
- Respect reduced motion through the existing CSS/component behavior.

## 7. Depth & Surface

### Strategy

Mixed: semantic borders establish card and control boundaries, while the
existing logo mark uses a restrained tinted shadow for emphasis.

- Cards: `border bg-card shadow-sm`.
- Inputs: `border-input bg-background`.
- No raw color values or one-off shadows in new page components.
