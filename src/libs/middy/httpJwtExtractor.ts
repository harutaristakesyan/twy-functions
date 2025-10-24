import middy from '@middy/core';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { RequestContext } from 'aws-cdk-lib/aws-apigateway';

export const httpJwtExtractor =
  (): middy.MiddlewareObj<APIGatewayProxyEventV2WithJWTAuthorizer> => {
    return {
      before: (request: middy.Request<APIGatewayProxyEventV2WithJWTAuthorizer>) => {
        console.log('🔍 JWT extractor triggered');
        console.log(
          '➡️ Raw event.requestContext:',
          JSON.stringify(request.event.requestContext, null, 2),
        );

        const authorizer = request.event.requestContext?.authorizer;
        if (!authorizer) {
          console.warn('⚠️ No authorizer found in request context');
          return;
        }

        const claims = authorizer.jwt?.claims;
        if (!claims) {
          console.warn('⚠️ No JWT claims found');
          return;
        }

        console.log('✅ JWT claims:', claims);

        if (!claims.sub) {
          console.warn('⚠️ JWT "sub" claim is missing');
          return;
        }

        const user = {
          userId: String(claims.sub),
        };

        console.log('👤 Extracted user:', user);

        request.event.requestContext = {
          ...request.event.requestContext,
          authUser: user,
        } as APIGatewayProxyEventV2WithJWTAuthorizer['requestContext'] & RequestContext;
      },
    };
  };
