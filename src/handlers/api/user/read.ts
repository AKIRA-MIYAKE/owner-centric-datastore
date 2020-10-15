import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import {
  generateCORSHeaders,
  getUserId,
  handleApplicationError,
  generateUnauthorizedProxyResult,
  generateNotFoundProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../lib/api';

import { getUser } from '../../../entities/user';

export const handler: APIGatewayProxyHandler = async (event) => {
  const corsHeaders = generateCORSHeaders();

  try {
    const userId = getUserId(event.requestContext.authorizer);

    if (!userId) {
      return generateUnauthorizedProxyResult({ headers: corsHeaders });
    }

    try {
      const documentClient = new DynamoDB.DocumentClient();

      const user = await getUser(documentClient, { userId });

      if (!user) {
        return generateNotFoundProxyResult({
          headers: corsHeaders,
          message: 'User is not registered',
        });
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(user),
      };
    } catch (error) {
      return handleApplicationError(error);
    }
  } catch (error) {
    console.log(error);
    return generateDefaultErrorProxyResult({ headers: corsHeaders, error });
  }
};
