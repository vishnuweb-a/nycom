import { z } from 'zod';

/**
 * Validated client environment.
 *
 * Vite inlines `import.meta.env` at build time, so a missing variable would
 * otherwise surface as a runtime `undefined` deep inside a service call. Parsing
 * here fails loudly at module load with an actionable message instead.
 *
 * Only `VITE_`-prefixed variables exist in the browser bundle. Privileged
 * credentials (service role, Cloudinary API secret) are deliberately absent.
 */

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  VITE_CLOUDINARY_CLOUD_NAME: z.string().min(1, 'VITE_CLOUDINARY_CLOUD_NAME is required'),
  VITE_CLOUDINARY_UPLOAD_PRESET: z.string().optional(),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `  • ${issue.message}`).join('\n');

  throw new Error(
    `Invalid environment configuration:\n${issues}\n\n` +
      'Copy .env.example to .env and fill in the missing values.',
  );
}

export const env = parsed.data;
