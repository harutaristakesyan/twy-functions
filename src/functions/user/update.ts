import { middyfy } from '@libs/lambda';
import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import createError from 'http-errors';
import { updateUser as updateUserRecord } from '@libs/db/operations/userOperations';
import { MessageResponse } from '@contracts/common/response';
import { UpdateUserEvent, UpdateUserEventSchema } from '@contracts/user/request';

const updateUser = async (event: UpdateUserEvent): Promise<MessageResponse> => {
  const { userId } = event.pathParameters;
  const { branch, role, isActive } = event.body;

  const updated = await updateUserRecord(userId, {
    branchId: typeof branch === 'undefined' ? undefined : branch,
    role: typeof role === 'undefined' ? undefined : role,
    isActive,
  });

  if (!updated) {
    throw new createError.NotFound('User not found');
  }

  return { message: 'User updated successfully' };
};

export const handler = middyfy<
  UpdateUserEvent,
  MessageResponse,
  APIGatewayProxyEventV2WithJWTAuthorizer
>(updateUser, {
  eventSchema: UpdateUserEventSchema,
  mode: 'parse',
});

