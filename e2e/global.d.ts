/**
 * Minimal ambient declarations for the E2E suite.
 *
 * The suite reads a handful of env vars for test credentials. Node type
 * definitions are not installed at the repo root (they only live under
 * apps/api/node_modules), so declare just the surface we use instead of
 * depending on @types/node.
 */
declare const process: {
  env: {
    CI?: string;
    E2E_EMAIL?: string;
    E2E_PASSWORD?: string;
    INITIAL_ADMIN_EMAIL?: string;
    INITIAL_ADMIN_PASSWORD?: string;
  };
};
