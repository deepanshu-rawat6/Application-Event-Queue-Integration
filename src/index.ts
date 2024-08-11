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