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
