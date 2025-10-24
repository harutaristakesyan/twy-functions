import { AuthContext } from '@contracts/common/auth';
import z from 'zod';

export const GetUserEventSchema = z.object({
  requestContext: AuthContext,
});

export type GetUserEvent = z.infer<typeof GetUserEventSchema>;
