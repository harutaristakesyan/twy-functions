import { middyfy } from '@libs/lambda';
import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import createError from 'http-errors';
import { changeLoadStatus as changeLoadStatusRecord } from '@libs/db/operations/loadOperations';
import { ChangeLoadStatusEvent, ChangeLoadStatusEventSchema } from '@contracts/load/request';
import { ChangeLoadStatusResponse } from '@contracts/load/response';

const changeLoadStatus = async (
  event: ChangeLoadStatusEvent,
): Promise<ChangeLoadStatusResponse> => {
  const { loadId } = event.pathParameters;
  const { status } = event.body;

  const updated = await changeLoadStatusRecord(loadId, status);

  if (!updated) {
    throw new createError.NotFound('Load not found');
  }

  return {
    message: 'Load status updated successfully',
    loadId,
    status,
  };
};

export const handler = middyfy<
  ChangeLoadStatusEvent,
  ChangeLoadStatusResponse,
  APIGatewayProxyEventV2WithJWTAuthorizer
>(changeLoadStatus, {
  eventSchema: ChangeLoadStatusEventSchema,
  mode: 'parse',
});
