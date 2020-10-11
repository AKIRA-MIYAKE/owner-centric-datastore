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

    const errorMessages: string[] = [];

    const nickname = requestBody['nickname'];

    if (typeof nickname === 'undefined') {
      errorMessages.push('"nickname" is required');
    }

    if (typeof nickname !== 'string') {
      errorMessages.push('"nickname" must be string');
    }

    if (errorMessages.length > 0) {
      return generateBadRequestProxyResult({
        headers: corsHeaders,
        message: errorMessages.join(' / '),
      });
    }

    const documentClient = new DynamoDB.DocumentClient();

    const user = await createUser(documentClient, {
      id: tokenPayload.sub,
      nickname: nickname,
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
