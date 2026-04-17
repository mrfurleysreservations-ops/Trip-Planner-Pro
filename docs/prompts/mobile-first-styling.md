# Mobile-First Styling Fix

## Preamble
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Goal
This app will ship to the App Store and Google Play (via Capacitor). 99% of users will be on phones. Right now the app looks terrible on mobile — text is tiny, there's excessive white space, and you have to scroll unnecessarily. We need to make it look great on a standard phone screen (375×812 baseline) WITHOUT scrolling on the main dashboard.

## Problems to Fix

### 1. No viewport meta tag — `app/layout.tsx`
The root layout has no viewport configuration. Mobile browsers default to ~980px desktop width and scale everything down. This is the #1 reason text is tiny.

**Fix:** Add Next.js viewport export:
```ts
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};
```
Add this as a named export alongside the existing `metadata` export. Do NOT put it inside the metadata object — Next.js 14 requires `viewport` as a separate export.

### 2. Tab bar labels are 9px — `app/components/tab-bar.tsx`
Line 91: `fontSize: "9px"` is unreadable on any phone.

**Fix:** Bump tab label font size to `"11px"`. Also bump the icon size on line 68 from `"20px"` to `"22px"`. Keep the badge font at `"9px"` — that's fine for a notification dot.

### 3. Header/title bar text too small — `app/components/app-shell.tsx`
Line 83: Logo is `fontSize: "16px"`, line 99: Sign Out button is `fontSize: "12px"`.

**Fix:** Logo to `"18px"`, Sign Out button to `"13px"`. Also reduce the header padding from `"10px 20px"` to `"8px 16px"` — we need to be tighter on mobile.

### 4. Dashboard has too much padding and small fonts — `app/dashboard/dashboard.tsx`
- Line 134: Container has `maxWidth: "900px"` and `padding: "28px 24px"` — way too much vertical and horizontal padding for a phone.
- Line 52: Trip name is `fontSize: "16px"` — fine, keep it.
- Line 57: Location is `fontSize: "13px"` — bump to `"14px"`.
- Line 64: Date text is `fontSize: "12px"` — bump to `"13px"`.
- Line 162: "Your Trips" heading is `fontSize: "22px"` — keep it.
- Lines 189–196 and 210–217: Section headers ("Upcoming", "Past Trips") are `fontSize: "13px"` — bump to `"14px"`.
- Line 144: Welcome card title is `fontSize: "16px"` — bump to `"17px"`.
- Line 146: Welcome card description is `fontSize: "14px"` — keep it.

**Fix:** Change the container on line 134 to `padding: "16px 16px"` and remove or reduce `maxWidth` to `"600px"`. The 900px max-width is desktop-oriented — on a 375px screen it does nothing but on a 600px tablet it wastes space. Bump the font sizes listed above.

### 5. Global CSS has no mobile breakpoints — `app/globals.css`
Zero `@media` queries. All spacing is fixed.

**Fix:** Add a mobile-first media query block at the bottom of `globals.css`:

```css
/* Mobile-first adjustments (default is mobile, scale UP for desktop) */
@media (min-width: 768px) {
  .card-glass {
    padding: 20px;
  }
  .btn {
    padding: 12px 24px;
    font-size: 15px;
  }
}

/* Ensure touch targets are at least 44px on mobile */
@media (max-width: 767px) {
  .btn {
    min-height: 44px;
    font-size: 15px;
  }
  .btn-sm {
    min-height: 36px;
    font-size: 13px;
  }
  .input-modern {
    font-size: 16px; /* prevents iOS zoom on focus */
    padding: 12px 14px;
  }
  .badge {
    font-size: 12px;
    padding: 4px 10px;
  }
}
```

Important: set `.input-modern` to `font-size: 16px` on mobile. iOS auto-zooms the page when you tap an input with font-size below 16px. This is critical for Capacitor.

## Files to Change (and ONLY these files)
1. `app/layout.tsx` — add viewport export
2. `app/globals.css` — add mobile media queries at the bottom
3. `app/components/tab-bar.tsx` — bump font/icon sizes
4. `app/components/app-shell.tsx` — bump header font sizes, tighten padding
5. `app/dashboard/dashboard.tsx` — reduce container padding, bump small font sizes

## Rules
- Do NOT introduce Tailwind, CSS modules, or any CSS framework.
- Do NOT change the inline-styles pattern — keep it consistent with the existing codebase.
- Do NOT create new wrapper components or utility files.
- Do NOT change any functionality, routing, data fetching, or state logic — this is styling only.
- The tab bar has 6 items. Keep all 6. Do not collapse or hamburger-menu them.
- Test mentally against a 375×812 viewport. The dashboard with 2–3 trip cards should fit without scrolling below the fold.
