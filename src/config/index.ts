import 'dotenv/config';

export default {
    PORT: process.env.PORT || 3000,
    AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY_ID,
    AWS_REGION: process.env.AWS_REGION,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_BUCKET: process.env.AWS_BUCKET,
    AWS_QUEUE: process.env.AWS_QUEUE,
    SQS_URL: process.env.SQS_URL
}