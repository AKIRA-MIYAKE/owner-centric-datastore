import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import {
  generateCORSHeaders,
  getAccessTokenPayload,
  parseJSONBody,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../lib/api';

import { createUser } from '../../../entities/user';

export type RequestBody =  { [key: string]: any } & {  // eslint-disable-line
  nickname: string;
};

export function isValidRequestBody(
  requestBody: { [key: string]: any } // eslint-disable-line
): asserts requestBody is RequestBody {
  const errorMessages: string[] = [];

  if (typeof requestBody['nickname'] === 'undefined') {
    errorMessages.push('"nickname" is required');
  }

  if (typeof requestBody['nickname'] !== 'string') {
    errorMessages.push('"nickname" must be string');
  }

  if (errorMessages.length > 0) {
    throw new Error(errorMessages.join(' / '));
  }
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const corsHeaders = generateCORSHeaders();

  try {
    const tokenPayload = getAccessTokenPayload(event.requestContext.authorizer);

    if (!tokenPayload) {
      return generateUnauthorizedProxyResult({ headers: corsHeaders });
    }

    const requestBody = parseJSONBody(event.body);

    if (!requestBody) {
      return generateBadRequestProxyResult({ headers: corsHeaders });
    }

    try {
      isValidRequestBody(requestBody);
    } catch (error) {
      return generateBadRequestProxyResult({
        headers: corsHeaders,
        message: error.message,
      });
    }

    const documentClient = new DynamoDB.DocumentClient();

    const user = await createUser(documentClient, {
      id: tokenPayload.sub,
      nickname: requestBody.nickname,
    });

    if (!user) {
      return generateBadRequestProxyResult({
        headers: corsHeaders,
        message: 'User already exists',
      });
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(user),
    };
  } catch (error) {
    console.log(error);
    return generateDefaultErrorProxyResult({ headers: corsHeaders, error });
  }
};
