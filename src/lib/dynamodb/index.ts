import { DynamoDB } from 'aws-sdk';

export const queryAll: (
  client: DynamoDB.DocumentClient,
  params: DynamoDB.DocumentClient.QueryInput,
  items?: DynamoDB.DocumentClient.ItemList
) => Promise<DynamoDB.DocumentClient.ItemList> = async (
  client,
  params,
  items = []
) => {
  const result = await client.query(params).promise();

  if (!result.Items) {
    return [...items];
  }

  const updatedItems = [...items, ...result.Items];

  if (typeof result.LastEvaluatedKey !== 'undefined') {
    return await queryAll(
      client,
      { ...params, ExclusiveStartKey: result.LastEvaluatedKey },
      updatedItems
    );
  } else {
    return updatedItems;
  }
};

export const batchWriteAll: (
  client: DynamoDB.DocumentClient,
  params: DynamoDB.DocumentClient.BatchWriteItemInput
) => Promise<void> = async (client, params) => {
  const items = params.RequestItems;
  const requestNumber = Object.keys(items).reduce((acc, current) => {
    acc = acc + items[current].length;
    return acc;
  }, 0);

  if (requestNumber <= 25) {
    await client.batchWrite(params).promise();
    return;
  }

  const chunk = Object.keys(items).reduce((acc, current) => {
    const requests = items[current];
    for (let i = 0; i < requests.length; i += 25) {
      acc.push({
        [current]: requests.slice(i, i + 25),
      });
    }

    return acc;
  }, [] as DynamoDB.DocumentClient.BatchWriteItemRequestMap[]);

  await chunk.reduce(async (acc, current) => {
    await acc;
    await client
      .batchWrite({
        RequestItems: current,
      })
      .promise();
  }, Promise.resolve());
};
