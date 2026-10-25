# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from `Inventory_Angular/`:

- `npm start` (`ng serve`): dev server on http://localhost:4200
- `npm run build` (`ng build`): production build to `dist/` (budgets: 500kB warn / 1MB error initial, 4kB/8kB per component style)
- `npm test` (`ng test`): Vitest via `@angular/build:unit-test`, jsdom, watch mode in a TTY
- One-shot run: `ng test --watch=false`
- Single file: `ng test --include src/app/app.spec.ts`; by test name: `ng test --filter "should render"`
- There is no lint target configured.

## Context

This folder is one project in the `Inventory` monorepo (git root is the parent directory). Siblings:

- `../Inventory_Api`: ASP.NET Core (.NET 10) REST API, JWT auth, SQL Server. Dev URL `http://localhost:5293`; its CORS already allows `http://localhost:4200` in Development.
- `../Inventory_React`: the current React SPA, which this Angular app is meant to replace. CI (`../.github/workflows`) and the `docker-compose*.yml` files only build the React app so far, not this one.

## Teaching project: read before changing code

This app is a port of the React app built **as an Angular course**. `LEARNING_PLAN.md` maps each step of the learning plan (A1 → C4) to the code. Conventions:

- `LEARN(<step>)` comments explain worked code; `TODO(<step>)` comments are exercises left for the learner on purpose. **Do not implement a `TODO` unless the user asks for that exercise**, and keep the `LEARN`/`TODO` comments in the same style when adding code.
- Exercise stubs stay runnable: Observable methods return `todo(step, what)` (`core/todo.ts`), which the UI shows as "À implémenter … TODO(step)"; sync stubs return a neutral value. Exercise specs are written but `describe.skip`ped.
- `features/categories` is the complete reference implementation that other features copy.

## Architecture

- `core/` (singletons: API types and errors, `AuthService` + interceptor + guards, toasts), `shared/` (presentational UI, pipes, domain display helpers; never imports `features/`), `layout/shell` (signed-in frame), `features/<name>/` (API service + pages + routes per feature).
- Data flow: `XxxApi` service returns HttpClient Observables → pages load with `rxResource` (read `error()`/`hasValue()` before `value()`, which throws in error state) → templates. Writes `subscribe()`, toast, then `reload()`.
- List filters live in the URL; `withComponentInputBinding()` binds route and query params to component inputs of the same name.
- Angular 22 defaults that matter: zoneless, components OnPush by default, resources and Signal Forms are stable APIs.
- `src/styles.scss` is the React app's stylesheet copied as is, so templates reuse its class names; icons are `<app-icon name="…">` over the `public/icons.svg` sprite.
- UI text and the `LEARN`/`TODO` teaching comments (plus their "Exemple commenté" / "EXERCICE" headers) are in French, addressing the learner as "tu", formatted `LEARN(B2) : …`; code and other comments are English. `API_BASE_URL` comes from `src/environments/` (`http://localhost:5293` in development).

A previous Angular attempt was deleted in commit `19cb2d2` (`git show 19cb2d2^:Inventory_Angular/src/app/...`).

## Target design and API contract

- `../Design_Brief_Angular.md` (French) is the spec for the screens: French UI, euros (`12,50 €`), dates `JJ/MM/AAAA HH:mm`, desktop first, two roles (`User` read-only, `Admin` write) carried in the JWT `role` claim, standalone components + signals, Angular Material or equivalent, Material Icons, AA contrast.
- `../README.md` is the current, authoritative API contract and overrides the older brief where they differ: all routes are under `/api/v1/`; movement types are `In` / `Out` / `Adjustment`; paged search params are `name`, `minPrice`, `maxPrice`, `lowStockOnly`, `categoryId`, `sortBy`, `sortDirection`, `askedPage`, `pageSize`; any authenticated user can record stock movements.
- Errors are ProblemDetails (`application/problem+json`): 400 field errors in `errors`, 401 (try `/auth/refresh`, then back to login), 403, 404, 409 (concurrency via `rowVersion`, or deleting an entity still in use), 422 (movement would make stock negative), 429 (auth rate limit, honor `Retry-After`).
- The API's OpenAPI document is meant to generate the Angular client: `npx ng-openapi-gen --input http://localhost:5293/openapi/v1.json --output src/app/api` (API must run in Development).
