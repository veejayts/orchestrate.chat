declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    NEXT_PUBLIC_SITE_URL?: string;
    NEXT_PUBLIC_WEB_SEARCH_MAX_RESULTS?: string;
    NEXT_PUBLIC_WEB_SEARCH_CONTEXT_SIZE?: string;
  }
}