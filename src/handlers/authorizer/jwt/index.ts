import { APIGatewayTokenAuthorizerHandler } from 'aws-lambda';
import jwt from 'jsonwebtoken';

import { isAccessTokenPayload } from '../../../interfaces';
import {
  getToken,
  getSigningKey,
  getWildcardResource,
  generatePolicyDocument,
} from '../../../lib/authorizer';

export const handler: APIGatewayTokenAuthorizerHandler = async (event) => {
  const token = getToken(event.authorizationToken);

  if (!token) {
    throw new Error('Invalid Authorization token');
  }

  const decodedToken = jwt.decode(token, { complete: true });

  if (!decodedToken || typeof decodedToken === 'string') {
    throw new Error('Invalid Authorization token');
  }

  if (!decodedToken['header'] || !decodedToken.header['kid']) {
    throw new Error('Invalid Authorization token');
  }

  const kid = decodedToken.header.kid;
  const signingKey = await getSigningKey(kid);

  const publicKey = signingKey.getPublicKey();

  const verifiedTokenPaylod = jwt.verify(token, publicKey, {
    audience: process.env.AUTH_AUDIENCE,
    issuer: process.env.AUTH_ISSURE,
  });

  if (!isAccessTokenPayload(verifiedTokenPaylod)) {
    throw new Error('Invalid Authorization token');
  }

  return {
    principalId: verifiedTokenPaylod.sub,
    policyDocument: generatePolicyDocument({
      effect: 'Allow',
      resource: getWildcardResource(event.methodArn),
    }),
    context: {
      token,
      tokenPayload: JSON.stringify(verifiedTokenPaylod),
    },
  };
};
