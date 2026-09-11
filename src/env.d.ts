/// <reference types="vite/client" />

// Exposed to the bundle via `envPrefix: ['VITE_', 'IDU_']` in vite.config.ts.
interface ImportMetaEnv {
  readonly IDU_API_KEY?: string;
  readonly IDU_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
