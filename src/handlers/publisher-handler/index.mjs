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