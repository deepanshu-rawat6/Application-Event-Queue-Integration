# Application Event Queue Integration

## Setup

### Localstack environment

```bash
docker run --rm -it -p 4566:4566 -p 4571:4571 --name localstack-dev localstack/localstack
```

### Installing `awscli-local`

```bash
pip3 install awscli-local
```

### Creating s3 bucket

```bash
awslocal s3api create-bucket --bucket localstack-bucket
```

To see the list of s3 buckets:

```bash
awslocal s3api list-buckets
```

To upload objects in the s3 bucket

```bash
awslocal s3api put-object --bucket localstack-bucket --key <key_name> --body  <body>
```

To list the objects in the s3 bucket

```bash
awslocal s3api list-objects --bucket localstack-bucket --query 'Contents[].{Key: Key, Size: Size}'
```

### Creating localstack SQS

```bash
awslocal sqs create-queue --queue-name localstack-queue
```

To list all queues

```bash
awslocal sqs list-queues
```

### Lambda function

Zipping the lambda function code:

```bash
zip lambda-handler.zip lambda-handler.ts
```

To create lambda function, run the command:

```bash
awslocal lambda create-function --function-name S3ToSQSFunction \
    --zip-file fileb://lambda-handler.zip \
    --handler lambda-handler.handler \
    --runtime nodejs20.x \
    --role arn:aws:iam::000000000000:role/lambda-role
```

### S3 bucket to trigger lambda function on object creation

```bash
awslocal s3api put-bucket-notification-configuration --bucket document-bucket --notification-configuration '{
    "LambdaFunctionConfigurations": [
        {
            "LambdaFunctionArn": "arn:aws:lambda:us-east-1:000000000000:function:S3ToSQSFunction",
            "Events": ["s3:ObjectCreated:*"]
        }
    ]
}'
```