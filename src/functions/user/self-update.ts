import { middyfy } from '@libs/lambda';
import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import createError from 'http-errors';
import { updateSelfUser as updateSelfUserRecord } from '@libs/db/operations/userOperations';
import { MessageResponse } from '@contracts/common/response';
import { SelfUpdateUserEvent, SelfUpdateUserEventSchema } from '@contracts/user/request';

const updateSelfUser = async (event: SelfUpdateUserEvent): Promise<MessageResponse> => {
  const { userId } = event.requestContext.authUser;
  const { firstName, lastName } = event.body;

  const updated = await updateSelfUserRecord(userId, { firstName, lastName });

  if (!updated) {
    throw new createError.NotFound('User not found');
  }

  return { message: 'User updated successfully' };
};

export const handler = middyfy<
  SelfUpdateUserEvent,
  MessageResponse,
  APIGatewayProxyEventV2WithJWTAuthorizer
>(updateSelfUser, {
  eventSchema: SelfUpdateUserEventSchema,
  mode: 'parse',
});

