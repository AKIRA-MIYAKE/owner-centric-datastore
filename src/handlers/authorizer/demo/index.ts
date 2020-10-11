import { APIGatewayTokenAuthorizerHandler } from 'aws-lambda';
import dayjs from 'dayjs';

import { AccessTokenPayload } from '../../../interfaces';
import {
  getToken,
  generatePolicyDocument,
  getWildcardResource,
} from '../../../lib/authorizer';

// Expect tokens of "Bearer user=xxxx"
export const handler: APIGatewayTokenAuthorizerHandler = async (event) => {
  const token = getToken(event.authorizationToken);

  if (!token) {
    throw new Error('Invalid Authorization token');
  }

  const splited = token.split('=');

  if (splited.length !== 2 || splited[0] !== 'user') {
    throw new Error('Invalid Authorization token');
  }

  const sub = splited[1];

  const now = dayjs();

  // Generate dummy access token payload
  const tokenPayload: AccessTokenPayload = {
    iss: 'https://owner-centric-datastore',
    sub,
    aud: 'https://owner-centric-datastore-api/',
    iat: now.unix(),
    exp: now.add(1, 'day').unix(),
    azp: 'owner-centric-datastore@demo',
  };

  return {
    principalId: sub,
    policyDocument: generatePolicyDocument({
      effect: 'Allow',
      resource: getWildcardResource(event.methodArn),
    }),
    context: {
      token,
      tokenPayload: JSON.stringify(tokenPayload),
    },
  };
};
