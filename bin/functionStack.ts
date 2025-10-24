import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { dsqlConnectPolicyFor, HttpLambdaRouter, LambdaRouteDefinition } from './cdk';

interface FunctionsStackProps extends StackProps {
  envName: string;
}

export class FunctionsStack extends Stack {
  constructor(scope: Construct, id: string, props: FunctionsStackProps) {
    super(scope, id, props);

    const { envName } = props;

    const dsqlClusterId = StringParameter.valueForStringParameter(this, '/dsql/cluster-id');

    const dsql = dsqlConnectPolicyFor(this.region, this.account, dsqlClusterId);

    const routes: LambdaRouteDefinition[] = [
      {
        functionPath: 'user/get',
        routeKey: 'GET /api/user',
        actions: [dsql],
        requiresAuth: true,
      },
      {
        functionPath: 'branch/list',
        routeKey: 'GET /branches',
        actions: [dsql],
        requiresAuth: true,
      },
      {
        functionPath: 'branch/create',
        routeKey: 'POST /branches',
        actions: [dsql],
        requiresAuth: true,
      },
      {
        functionPath: 'branch/update',
        routeKey: 'PUT /branches/{branchId}',
        actions: [dsql],
        requiresAuth: true,
      },
      {
        functionPath: 'branch/delete',
        routeKey: 'DELETE /branches/{branchId}',
        actions: [dsql],
        requiresAuth: true,
      },
    ];

    new HttpLambdaRouter(this, 'FunctionsRouts', { envName, routes });
  }
}
