import { z } from 'zod';

export const loginBodySchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

export type ILoginBody = z.infer<typeof loginBodySchema>;
