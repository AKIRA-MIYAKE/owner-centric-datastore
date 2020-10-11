import {
  APIGatewayEventDefaultAuthorizerContext,
  APIGatewayProxyResult,
} from 'aws-lambda';

import { AccessTokenPayload } from '../../interfaces';

export const generateCORSHeaders: () => {
  [key: string]: string | boolean;
} = () => {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
  };
};

export const getAccessToken: (
  authorizerContext: APIGatewayEventDefaultAuthorizerContext
) => string | undefined = (authorizerContext) => {
  if (!authorizerContext) {
    return undefined;
  }

  const token = authorizerContext['token'];

  if (!token) {
    return undefined;
  }

  return token;
};

export const getAccessTokenPayload: (
  authorizerContext: APIGatewayEventDefaultAuthorizerContext
) => AccessTokenPayload | undefined = (authorizerContext) => {
  if (!authorizerContext) {
    return undefined;
  }

  const tokenPayloadString = authorizerContext['tokenPayload'];

  if (!tokenPayloadString) {
    return undefined;
  }

  try {
    return JSON.parse(tokenPayloadString);
  } catch (error) {
    return undefined;
  }
};

export const isAuthorized: (
  authorizerContext: APIGatewayEventDefaultAuthorizerContext
) => boolean = (authorizerContext) => {
  const token = getAccessToken(authorizerContext);

  return !!token;
};

export const parseJSONBody: <T = { [key: string]: any }>(  // eslint-disable-line
  body: string | null
) => T | undefined = (body) => {
  if (!body) {
    return undefined;
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    return undefined;
  }
};

export const getQueryStringParameters: <T = { [key: string]: string }>(
  params: { [key: string]: string } | null
) => T | undefined = (params) => {
  if (!params) {
    return undefined;
  }

  return params as any;  // eslint-disable-line
};

export const generateBadRequestProxyResult: (params: {
  headers?: { [key: string]: string | boolean };
  message?: string;
}) => APIGatewayProxyResult = ({ headers, message }) => {
  return {
    statusCode: 400,
    headers,
    body: JSON.stringify({ message: message || 'Bad Request' }),
  };
};

export const generateUnauthorizedProxyResult: (params: {
  headers?: { [key: string]: string | boolean };
  message?: string;
}) => APIGatewayProxyResult = ({ headers, message }) => {
  return {
    statusCode: 401,
    headers,
    body: JSON.stringify({ message: message || 'Unauthorized' }),
  };
};

export const generateNotFoundProxyResult: (params: {
  headers?: { [key: string]: string | boolean };
  message?: string;
}) => APIGatewayProxyResult = ({ headers, message }) => {
  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ message: message || 'Not Found' }),
  };
};

export const generateDefaultErrorProxyResult: (params: {
  headers?: { [key: string]: string | boolean };
  error: any  // eslint-disable-line
}) => APIGatewayProxyResult = ({ headers, error }) => {
  return {
    statusCode: error['statusCode'] || 500,
    headers,
    body: JSON.stringify({
      ...error,
      message: error.message,
    }),
  };
};
