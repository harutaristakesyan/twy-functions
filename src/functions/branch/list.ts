import { middyfy } from '@libs/lambda';
import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { listBranches as listBranchRecords } from '@libs/db/operations/branchOperations';
import { BranchListResponse } from '@contracts/branch/response';
import { ListBranchesEvent, ListBranchesEventSchema } from '@contracts/branch/request';

const listBranches = async (): Promise<BranchListResponse> => {
  return listBranchRecords();
};

export const handler = middyfy<
  ListBranchesEvent,
  BranchListResponse,
  APIGatewayProxyEventV2WithJWTAuthorizer
>(listBranches, {
  eventSchema: ListBranchesEventSchema,
  mode: 'parse',
});
