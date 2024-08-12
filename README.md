# Application Event Queue Integration with LocalStack

This guide walks you through setting up an application event queue integration using LocalStack, S3, SQS, and AWS Lambda. The goal is to create a system where objects uploaded to an S3 bucket trigger a Lambda function, which then publishes a message to an SQS queue. Another Lambda function will consume messages from this queue, process them, and send logs to CloudWatch.

## Prerequisites

- [Docker](https://www.docker.com/) installed and running
- [awscli-local (`awslocal`)](https://github.com/localstack/awscli-local) installed (`pip3 install awscli-local`)
- LocalStack Docker image (`localstack/localstack`)

## Architecture

![architecture](.img/arch.png)

## Setup

### Localstack environment

Run the following command to start LocalStack in a Docker container:

```bash
docker run --rm -it -p 4566:4566 -p 4571:4571 --name localstack-dev localstack/localstack
```

### Installing `awscli-local`

#### To install awscli-local, run this command:

```bash
pip3 install awscli-local
```

### Creating s3 bucket

#### Create an S3 bucket in LocalStack:

```bash
awslocal s3api create-bucket --bucket localstack-bucket
```

OR

Simply use run the command `npm run createS3Bucket`

For reference: `createS3-bucket.ts`:

```ts
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";
import config from "./config";

export const s3Client = new S3Client({
    endpoint: 'http://localhost:4566',
    credentials: {
        accessKeyId: config.AWS_ACCESS_KEY as string,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY as string
    },
    forcePathStyle: true,
    region: 'us-east-1',
});

const createS3Bucket = async () => {
    const bucketParams = {
        Bucket: config.AWS_BUCKET
    };
    try {
        await s3Client.send(new CreateBucketCommand(bucketParams));
        console.log('Bucket created successfully');
    } catch (err) {
        console.error('Error creating bucket:', err);
    }
};

(async () => {
    await createS3Bucket();
})();
```

#### Verify that the bucket was created::

```bash
awslocal s3api list-buckets
```

#### To upload objects in the s3 bucket

```bash
awslocal s3api put-object --bucket localstack-bucket --key <key_name> --body  <body>
```

#### To list the objects in the s3 bucket

```bash
awslocal s3api list-objects --bucket localstack-bucket --query 'Contents[].{Key: Key, Size: Size}'
```

### Creating localstack SQS

#### Create an SQS queue in LocalStack:

```bash
awslocal sqs create-queue --queue-name localstack-queue
```

OR

Simply use run the command `npm run createSQS`.

For reference: `createSQS.ts`:

```ts
import { SQSClient, CreateQueueCommand } from '@aws-sdk/client-sqs';
import config from './config';

export const sqsClient = new SQSClient({
    endpoint: 'http://localhost:4566',
    credentials: {
        accessKeyId: config.AWS_ACCESS_KEY as string,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY as string
    },
    region: 'us-east-1',
});

const createSQSQueue = async () => {
    const queueParams = {
        QueueName: config.AWS_QUEUE
    };
    try {
        const data = await sqsClient.send(new CreateQueueCommand(queueParams));
        console.log('Queue created successfully:', data.QueueUrl);
        return data.QueueUrl;
    } catch (err) {
        console.error('Error creating queue:', err);
    }
};

(async () => {
    await createSQSQueue();
})();
```

### To list all queues

```bash
awslocal sqs list-queues
```

### Lambda function from SQS to processing logs(consumer function)

#### Zip the processing Lambda function code:

```bash
zip function.zip index.mjs node_modules/
```


#### To create lambda function, run the command:

```bash
 awslocal lambda create-function --function-name SQSToProcessing \
    --zip-file fileb://function.zip \
    --handler index.handler \
    --runtime nodejs20.x \
    --role arn:aws:iam::000000000000:role/lambda-role
```

#### Enable X-Ray tracing for the Lambda function:

```bash
awslocal lambda update-function-configuration --function-name SQSToProcessing \
    --tracing-config Mode=Active
```

#### Set up the SQS trigger with a batch size and maximum concurrency:

```bash
awslocal lambda create-event-source-mapping --function-name SQSToProcessing \
    --event-source-arn arn:aws:sqs:us-east-1:000000000000:localstack-queue \
    --batch-size 1 --enabled
```

#### To ensure that a maximum of three Lambda functions run concurrently, set the concurrency limit:

Here we are making only 5 concurrent executions

```bash
awslocal lambda put-function-concurrency --function-name SQSToProcessing \
    --reserved-concurrent-executions 5
```

## Implementation

### Basic experss server setup

Choosing a basic express server, for uploading documents/logs to the `S3` bucket.

Here, is the `index.ts` file for reference.

```ts
import express from 'express';
import http from 'http';
import { uploadFileToS3 } from './uploadToS3Bucket';

const app = express();

app.use(express.json()
);

const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    uploadFileToS3();
    console.log(`Server is running on port ${PORT}`);
});
```

### Uploading to S3

For uploading to S3 bucket, we are using `@aws-sdk` v3 for latest support for js/ts clients.

```ts
import { PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import config from './config';
import { s3Client as s3 } from './createS3-bucket';

export const uploadFileToS3 = async () => {

    const file = './test-file.txt'
    const fileName = 'testFile'

    if (!fs.existsSync(file)) {
        console.error(`File not found: ${file}`);
        return;
    }

    const data = fs.readFileSync(file);

    const bucketName = config.AWS_BUCKET;
    if (!bucketName) {
        throw new Error('AWS_BUCKET environment variable is not defined.');
    }

    for (let i = 1; i <= 100; i++) {
        const fileName = `testFile_${i}`; 
        const params = {
            Bucket: bucketName,
            Key: fileName,
            Body: data
        };

        try {
            const command = new PutObjectCommand(params);
            const response = await s3.send(command);
            console.log(`File ${fileName} uploaded successfully`, response);
        } catch (s3err) {
            console.error(`Error uploading file ${fileName}:`, s3err);
        }
    }
}
```

Here, for extensive testing, we are uploading a document `100` times, to check how our lambda handlers perform under stress.

### Creating lambda handlers

#### Publishing messages

Creating a publishing handler and naming the file `index.mjs` to support ECMAscript modules.

```js
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({
    endpoint: 'http://host.docker.internal:4566',
    region: 'us-east-1',
    credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
    },
});

export const handler = async (event) => {
    const record = event.Records[0];
    const bucketName = record.s3.bucket.name;
    const objectKey = record.s3.object.key;

    const messageBody = JSON.stringify({
        bucket: bucketName,
        key: objectKey,
    });

    const params = {
        QueueUrl: 'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/localstack-queue',
        MessageBody: messageBody,
    };

    try {
        const data = await sqs.send(new SendMessageCommand(params));
        console.log('Message sent to SQS:', data.MessageId);
    } catch (err) {
        console.error('Error sending message to SQS:', err);
    }
}
```

Here we have just one dependency of `@aws-sdk/client-sqs`, in order to push messages to `SQS`.

Then, we will create a zip named `function.zip`, which includes `index.mjs` along with `node_modules` for the dependencies.

```bash
zip function.zip index.mjs node_modules/
```

We will be creating our publishing function `S3ToSQSFunction`, with the following command:

```bash
awslocal lambda create-function --function-name S3ToSQSFunction \
    --zip-file fileb://function.zip \
    --handler index.handler \
    --runtime nodejs20.x \
    --role arn:aws:iam::000000000000:role/lambda-role
```

Finally, we will set triggers for our lambda function, to compute as soon as documents are uploaded in `S3 bucket`.

```bash
awslocal s3api put-bucket-notification-configuration --bucket localstack-bucket --notification-configuration '{
    "LambdaFunctionConfigurations": [
        {
            "LambdaFunctionArn": "arn:aws:lambda:us-east-1:000000000000:function:S3ToSQSFunction",
            "Events": ["s3:ObjectCreated:*"]
        }
    ]
}'
```

We can see the logs, of our documents being pushed to SQS.

![publishing_messages](.img/publishing_messages.png)

#### Consuming messages

Creating a consumer handler and naming the file `index.mjs` to support ECMAscript modules.

```js
import { SQSClient, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { Metrics } from "@aws-lambda-powertools/metrics";

const logger = new Logger();
const tracer = new Tracer();
const metrics = new Metrics();

const sqs = new SQSClient({
    endpoint: 'http://host.docker.internal:4566',
    region: 'us-east-1',
    credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
    },
});

export const handler = tracer.captureLambdaHandler(async (event) => {
    console.log('Handler invoked. Event received:', JSON.stringify(event));
    const segment = tracer.getSegment();
    const subsegment = segment.addNewSubsegment('Processing SQS Event');
    tracer.annotateColdStart();

    try {
        for (const record of event.Records) {
            console.log('Processing record:', JSON.stringify(record));
            const messageBody = record.body;
            const messageAttributes = record.messageAttributes;

            const transformedMessage = {
                id: record.messageId,
                body: JSON.parse(messageBody),
                attributes: messageAttributes,
            };

            logger.info('Transformed Message:', transformedMessage);
            console.log('Transformed message:', transformedMessage);

            metrics.addMetric('ProcessedMessages', 'Count', 1);
            metrics.publishStoredMetrics();
            console.log('Metrics published for message:', transformedMessage.id);

            await sqs.send(new DeleteMessageCommand({
                QueueUrl: record.eventSourceARN.split(':').slice(-1)[0],
                ReceiptHandle: record.receiptHandle
            }));
            console.log('Message deleted from SQS:', record.messageId);
        }
    } catch (err) {
        logger.error('Error processing SQS message:', err);
        console.error('Error encountered:', err);
        throw err;
    } finally {
        subsegment.close();
        console.log('Subsegment closed.');
    }
});
```

Here we have just one dependency of `@aws-sdk/client-sqs` , `@aws-lambda-powertools/logger` ,
`@aws-lambda-powertools/metrics`, `@aws-lambda-powertools/tracer` , `@aws-sdk/client-sqs`, in order to consume messages from `SQS`, transform the documents/logs into json objects and then finally sending the metrics to `Cloudwatch`.

Then, we will create a zip named `function.zip`, which includes `index.mjs` along with `node_modules` for the dependencies.

```bash
zip function.zip index.mjs node_modules/
```

We will be creating our publishing function `SQSToProcessing`, with the following command:

```bash
awslocal lambda create-function --function-name SQSToProcessing \
    --zip-file fileb://function.zip \
    --handler index.handler \
    --runtime nodejs20.x \
    --role arn:aws:iam::000000000000:role/lambda-role
```

We will set triggers for our lambda function, to compute as soon as documents are pushed to `SQS queue`.

```bash
awslocal lambda create-event-source-mapping --function-name SQSToProcessing \
    --event-source-arn arn:aws:sqs:us-east-1:000000000000:localstack-queue \
    --batch-size 1 --enabled
```

Enabling `X-Ray tracing` for the Lambda function:

```bash
awslocal lambda update-function-configuration --function-name SQSToProcessing \
    --tracing-config Mode=Active
```

Finally, to ensure that a maximum of three Lambda functions run concurrently, set the `concurrency limit`:

```bash
awslocal lambda put-function-concurrency --function-name SQSToProcessing \
    --reserved-concurrent-executions 3
```

### Cloudwatch metrics

#### Message received from SQS

![message_received](.img/message_received.png)

#### Messages deleted from SQS

![messages_deleted](.img/message_deleted.png)