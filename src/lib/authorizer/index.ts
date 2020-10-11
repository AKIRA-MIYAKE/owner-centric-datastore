import { promisify } from 'util';
import { APIGatewayTokenAuthorizerEvent, PolicyDocument } from 'aws-lambda';
import jwksClient, { SigningKey } from 'jwks-rsa';

export const getToken: (
  authorizationToken: APIGatewayTokenAuthorizerEvent['authorizationToken']
) => string | undefined = (authorizationToken) => {
  if (!authorizationToken) {
    return undefined;
  }

  if (!/^Bearer[ ]+([^ ]+)[ ]*$/i.test(authorizationToken)) {
    return undefined;
  }

  return authorizationToken.slice(7);
};

export const getSigningKey: (kid: string) => Promise<SigningKey> = async (
  kid
) => {
  const client = jwksClient({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${process.env.AUTH_ISSURE}/.well-known/jwks.json`,
  });

  return promisify(client.getSigningKey)(kid);
};

export const getWildcardResource: (methodArn: string) => string = (
  methodArn
) => {
  const splited = methodArn.split('/');
  return [splited[0], splited[1], '*', '*'].join('/');
};

export const generatePolicyDocument: (params: {
  effect: string;
  resource: string;
}) => PolicyDocument = ({ effect, resource }) => {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource,
      },
    ],
  };
};
