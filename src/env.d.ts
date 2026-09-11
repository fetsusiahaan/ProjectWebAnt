/// <reference types="vite/client" />

// Exposed to the bundle via `envPrefix: ['VITE_', 'IDU_']` in vite.config.ts.
// IDU_API_KEY is deliberately absent: the key lives in the Cloudflare Worker
// (workers/ai-proxy.ts) and must never reach the browser.
interface ImportMetaEnv {
  /** Overrides the same-origin proxy path. Only needed to point at a deployed
   *  Worker from a different host; normally left unset. */
  readonly IDU_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
