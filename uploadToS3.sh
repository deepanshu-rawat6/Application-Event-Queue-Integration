#!/bin/bash

SOURCE_FILE="./test-file.txt"
BUCKET_NAME="localstack-bucket"

upload_file() {
  local i=$1
  local UNIQUE_FILENAME="sample_$i.txt"
  
  cp "$SOURCE_FILE" "/tmp/$UNIQUE_FILENAME"
  awslocal s3 cp "/tmp/$UNIQUE_FILENAME" s3://$BUCKET_NAME/$UNIQUE_FILENAME
  rm "/tmp/$UNIQUE_FILENAME"
}

export -f upload_file
export SOURCE_FILE
export BUCKET_NAME

# Parallel execution to speed up the upload process
seq 1 100000 | parallel -j 10 upload_file {}

echo "Completed uploading 100,000 files to s3://$BUCKET_NAME/"