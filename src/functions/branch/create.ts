import { middyfy } from '@libs/lambda';
import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResult } from 'aws-lambda';
import { createBranch as createBranchRecord } from '@libs/db/operations/branchOperations';
import { CreateBranchEvent, CreateBranchEventSchema } from '@contracts/branch/request';
import { BranchResponse } from '@contracts/branch/response';

const createBranch = async (event: CreateBranchEvent): Promise<APIGatewayProxyResult> => {
  const { name, owner, contact } = event.body;

  const branch = await createBranchRecord({
    name,
    ownerId: owner,
    contact: contact ?? null,
  });

  const response: BranchResponse = branch;

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(response),
  };
};

export const handler = middyfy<
  CreateBranchEvent,
  APIGatewayProxyResult,
  APIGatewayProxyEventV2WithJWTAuthorizer
>(createBranch, {
  eventSchema: CreateBranchEventSchema,
  mode: 'parse',
});
