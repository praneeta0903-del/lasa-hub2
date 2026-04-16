# Lasa Hub

## Overview

A mobile-first B2B supply chain app connecting rural Indian Kirana shop owners with their wholesale suppliers. Built with Expo (React Native) for the mobile frontend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Mobile**: Expo (React Native), expo-router for file-based routing
- **State**: React Context + AsyncStorage (local persistence)
- **API framework**: Express 5 (shared api-server)
- **Database**: PostgreSQL + Drizzle ORM (api-server)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`

## App Architecture

### Mobile App (`artifacts/lasa-hub`)

**User Flows:**
1. **Kirana Shop Owner** (mobile-first)
   - OTP login (`app/index.tsx`)
   - Home with Camera/Voice order buttons (`app/(tabs)/index.tsx`)
   - Camera scan — picks image, simulates AI extraction (`app/scan-order.tsx`)
   - Voice order — simulates recording + AI parsing (`app/voice-order.tsx`)
   - Review & send order with stock indicators (`app/review.tsx`)
   - Orders history list (`app/(tabs)/orders.tsx`)
   - Order detail view (`app/order-detail.tsx`)

2. **Wholesale Owner** (same app, role-based routing)
   - Dashboard with tabs by status (`app/wholesaler/index.tsx`)
   - Order fulfillment — fill amount, delivery time, send confirmation (`app/wholesaler/order/[id].tsx`)

**Key Context:**
- `context/AuthContext.tsx` — user auth, OTP flow, role selection
- `context/OrderContext.tsx` — orders CRUD with AsyncStorage, demo inventory

**Design Tokens:**
- Primary: `#D62B2B` (warm red)
- Accent: `#7A3B1E` (earthy brown)
- Background: `#FFFFFF`
- Language: Hindi/Telugu phrases throughout UI

## Integration TODOs (to activate live features)

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` — for real OTP SMS
- `GEMINI_API_KEY` — for real handwriting/voice AI extraction
- `MONGODB_URI` — to migrate from AsyncStorage to cloud DB

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
