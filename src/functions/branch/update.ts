import { middyfy } from '@libs/lambda';
import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { updateBranch as updateBranchRecord } from '@libs/db/operations/branchOperations';
import { BranchResponse } from '@contracts/branch/response';
import { UpdateBranchEvent, UpdateBranchEventSchema } from '@contracts/branch/request';
import createError from 'http-errors';

const updateBranch = async (event: UpdateBranchEvent): Promise<BranchResponse> => {
  const { branchId } = event.pathParameters;
  const { name, owner, contact } = event.body;

  const branch = await updateBranchRecord(branchId, {
    name,
    ownerId: typeof owner === 'undefined' ? undefined : owner,
    contact: typeof contact === 'undefined' ? undefined : contact,
  });

  if (!branch) {
    throw new createError.NotFound('Branch not found');
  }

  return branch;
};

export const handler = middyfy<
  UpdateBranchEvent,
  BranchResponse,
  APIGatewayProxyEventV2WithJWTAuthorizer
>(updateBranch, {
  eventSchema: UpdateBranchEventSchema,
  mode: 'parse',
});
