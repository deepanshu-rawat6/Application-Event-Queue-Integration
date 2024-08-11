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