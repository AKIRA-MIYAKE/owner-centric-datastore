import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import {
  generateCORSHeaders,
  getUserId,
  handleApplicationError,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../../lib/api';

import { deleteData } from '../../../../entities/data';

export const handler: APIGatewayProxyHandler = async (event) => {
  const corsHeaders = generateCORSHeaders();

  try {
    const userId = getUserId(event.requestContext.authorizer);

    if (!userId) {
      return generateUnauthorizedProxyResult({ headers: corsHeaders });
    }

    const dataId = event.pathParameters && event.pathParameters['data_id'];

    if (!dataId) {
      return generateBadRequestProxyResult({ headers: corsHeaders });
    }

    try {
      const documentClient = new DynamoDB.DocumentClient();

      await deleteData(documentClient, { userId, dataId });

      return {
        statusCode: 204,
        headers: corsHeaders,
        body: '',
      };
    } catch (error) {
      return handleApplicationError({
        headers: corsHeaders,
        error,
      });
    }
  } catch (error) {
    console.log(error);
    return generateDefaultErrorProxyResult({ headers: corsHeaders, error });
  }
};
