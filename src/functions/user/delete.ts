import { middyfy } from '@libs/lambda';
import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import createError from 'http-errors';
import { deleteUser as deleteUserRecord } from '@libs/db/operations/userOperations';
import { DeleteUserEvent, DeleteUserEventSchema } from '@contracts/user/request';
import { MessageResponse } from '@contracts/common/response';

const deleteUser = async (event: DeleteUserEvent): Promise<MessageResponse> => {
  const { userId } = event.pathParameters;

  const removed = await deleteUserRecord(userId);

  if (!removed) {
    throw new createError.NotFound('User not found');
  }

  return { message: 'User deleted successfully' };
};

export const handler = middyfy<
  DeleteUserEvent,
  MessageResponse,
  APIGatewayProxyEventV2WithJWTAuthorizer
>(deleteUser, {
  eventSchema: DeleteUserEventSchema,
  mode: 'parse',
});

