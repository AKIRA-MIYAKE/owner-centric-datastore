import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import {
  generateCORSHeaders,
  getUserId,
  getQueryStringParameters,
  handleApplicationError,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../../lib/api';
import { validateDate, validateTimezone } from '../../../../lib/date';

import { findGroupDataByPeriod } from '../../../../entities/group-data';

export type QueryStrings = { [key: string]: string } & {
  from?: string;
  to?: string;
  timezone?: string;
};

export function isValidQueryStrings(
  queryStrings: { [key: string]: string } // esint-disableli
): asserts queryStrings is QueryStrings {
  const errorMessages: string[] = [];

  if (typeof queryStrings['from'] !== 'undefined') {
    errorMessages.push(...validateDate(queryStrings['from']));
  }

  if (typeof queryStrings['to'] !== 'undefined') {
    errorMessages.push(...validateDate(queryStrings['to']));
  }

  if (typeof queryStrings['timezone'] !== 'undefined') {
    errorMessages.push(...validateTimezone(queryStrings['timezone']));
  }

  if (errorMessages.length > 0) {
    throw new Error(errorMessages.join(' / '));
  }
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const corsHeaders = generateCORSHeaders();

  try {
    const userId = getUserId(event.requestContext.authorizer);

    if (!userId) {
      return generateUnauthorizedProxyResult({ headers: corsHeaders });
    }

    const groupId = event.pathParameters && event.pathParameters['group_id'];

    if (!groupId) {
      return generateBadRequestProxyResult({ headers: corsHeaders });
    }

    const queryStrings = getQueryStringParameters(event.queryStringParameters);

    let from: string | undefined;
    let to: string | undefined;
    let timezone: string | undefined;

    if (queryStrings) {
      try {
        isValidQueryStrings(queryStrings);

        from = queryStrings.from;
        to = queryStrings.to;
        timezone = queryStrings.timezone;
      } catch (error) {
        return generateBadRequestProxyResult({
          headers: corsHeaders,
          message: error.message,
        });
      }
    }

    try {
      const documentClient = new DynamoDB.DocumentClient();

      const data = await findGroupDataByPeriod(documentClient, {
        userId,
        groupId,
        from,
        to,
        timezone,
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(data),
      };
    } catch (error) {
      return handleApplicationError({
        headers: corsHeaders,
        error,
      });
    }
  } catch (error) {
    console.log(error);
    return generateDefaultErrorProxyResult({
      headers: corsHeaders,
      error,
    });
  }
};
