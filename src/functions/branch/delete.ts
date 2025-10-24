import { middyfy } from '@libs/lambda';
import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResult,
} from 'aws-lambda';
import { deleteBranch as deleteBranchRecord } from '@libs/db/operations/branchOperations';
import { DeleteBranchEvent, DeleteBranchEventSchema } from '@contracts/branch/request';
import createError from 'http-errors';

const deleteBranch = async (event: DeleteBranchEvent): Promise<APIGatewayProxyResult> => {
  const { branchId } = event.pathParameters;

  const removed = await deleteBranchRecord(branchId);

  if (!removed) {
    throw new createError.NotFound('Branch not found');
  }

  return {
    statusCode: 204,
    headers: { 'Content-Type': 'application/json' },
    body: '',
  };
};

export const handler = middyfy<
  DeleteBranchEvent,
  APIGatewayProxyResult,
  APIGatewayProxyEventV2WithJWTAuthorizer
>(deleteBranch, {
  eventSchema: DeleteBranchEventSchema,
  mode: 'parse',
});
