declare namespace Cloudflare {
  interface Env {
    TYPESAFE_API_KEY?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
