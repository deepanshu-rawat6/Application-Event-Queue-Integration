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