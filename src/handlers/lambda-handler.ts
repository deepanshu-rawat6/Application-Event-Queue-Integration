import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import config from "../config";

const sqs = new SQSClient({
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: {
        accessKeyId: config.AWS_ACCESS_KEY as string,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY as string,
    },
});

export const handler = async (event: any) => {
    const record = event.Records[0];
    const bucketName = record.s3.bucket.name;
    const objectKey = record.s3.object.key;

    const messageBody = JSON.stringify({
        bucket: bucketName,
        key: objectKey,
    });

    const params = {
        QueueUrl: config.SQS_URL,
        MessageBody: messageBody,
    };

    try {
        const data = await sqs.send(new SendMessageCommand(params));
        console.log('Message sent to SQS:', data.MessageId);
    } catch (err) {
        console.error('Error sending message to SQS:', err);
    }
};
