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
        const fileName = `testFile_${i}`;  // Unique file name for each upload
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

    // const params = {
    //     Bucket: bucketName,
    //     Key: fileName,
    //     Body: data
    // };

    // try {
    //     const command = new PutObjectCommand(params);
    //     const response = await s3.send(command);
    //     console.log('File uploaded successfully', response);
    // } catch (s3err) {
    //     console.error('Error uploading file:', s3err);
    // }

}
