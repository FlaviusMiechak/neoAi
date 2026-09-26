// env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    AGNES_API_KEY: string;
    AGNES_BASE_URL: string;
    NEXT_PUBLIC_API_URL: string;
  }
}