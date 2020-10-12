import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import dayjs from 'dayjs';

import {
  generateCORSHeaders,
  getAccessTokenPayload,
  getQueryStringParameters,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../../../lib/api';
import {
  toDateISOString,
  validateDate,
  validateTimezone,
} from '../../../../../lib/date';

import { findDataByPeriodWithDataType } from '../../../../../entities/data';

export type QueryStrings = { [key: string]: string } & {
  from?: string;
  to?: string;
  timezone?: string;
};

export function isQueryStrings(
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
    const tokenPayload = getAccessTokenPayload(event.requestContext.authorizer);

    if (!tokenPayload) {
      return generateUnauthorizedProxyResult({ headers: corsHeaders });
    }

    const dataType = event.pathParameters && event.pathParameters['data_type'];

    if (!dataType) {
      return generateBadRequestProxyResult({ headers: corsHeaders });
    }

    const queryStrings = getQueryStringParameters(event.queryStringParameters);

    let from: string | undefined;
    let to: string | undefined;
    let timezone: string | undefined;

    if (queryStrings) {
      try {
        isQueryStrings(queryStrings);

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

    const now = dayjs().startOf('day');

    const documentClient = new DynamoDB.DocumentClient();

    const data = await findDataByPeriodWithDataType(documentClient, {
      userId: tokenPayload.sub,
      from: from
        ? toDateISOString(from, { timezone })
        : toDateISOString(now.subtract(7, 'day').format('YYYY-MM-DD'), {
            timezone,
          }),
      to: to
        ? toDateISOString(to, { timezone, isEndOf: true })
        : toDateISOString(now.format('YYYY-MM-DD'), {
            timezone,
            isEndOf: true,
          }),
      dataType,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.log(error);
    return generateDefaultErrorProxyResult({ headers: corsHeaders, error });
  }
};
