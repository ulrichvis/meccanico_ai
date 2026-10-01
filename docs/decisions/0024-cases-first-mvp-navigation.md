# ADR 0024: Cases-first MVP navigation

- Date: 2026-10-01
- Status: Accepted

## Context

The MVP is an operational tool for importing sources and browsing automotive cases. Its informational landing page adds navigation and presentation content that operators do not need.

## Decision

Use `/cases` as the MVP home page. The root route redirects to it using Next.js server-side navigation, preserving existing case search URLs and the single browsing read model.

The shared application shell contains only Sources, Cases, Upload PDF, and the persistent English/Italian language selector. Navigation stays available on mobile. Remove the landing component, its unused CSS and translations, branding presentation, and footer.

## Consequences

Users enter the case index immediately. The existing upload, extraction, source detail, and optional review flows remain accessible. No database, provider, authentication, or deployment configuration changes are required.

## Manual verification

1. Open `/` and confirm the browser reaches `/cases`.
2. Follow Sources, Cases, and Upload PDF and confirm each route opens.
3. Switch English and Italian and confirm all three links and the selector translate without changing routes.
4. Repeat at a 390 px mobile width and confirm every navigation item remains visible, without horizontal overflow.
