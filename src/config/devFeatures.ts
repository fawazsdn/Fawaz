/**
 * Centralized development-feature gate.
 *
 * Every developer-only affordance — the demo role switcher, "reset demo
 * data", and any future debug/moderator-shortcut UI that only makes sense
 * against this frontend's mock data layer — must check `IS_DEV_BUILD`
 * rather than scattering ad hoc `__DEV__` checks (or none at all) around
 * the app. That keeps this a single, auditable place to confirm no
 * developer-only control can ship in a production build, and a single
 * place to change the policy later (e.g. an internal TestFlight build
 * that intentionally keeps a debug menu).
 *
 * `__DEV__` is set by React Native's bundler: true for a dev-client/
 * Metro-served build, false for a release/production build (including
 * EAS `preview` and `production` profiles, which build in release mode).
 * It is not something client code can override at runtime.
 */
export const IS_DEV_BUILD = __DEV__;
