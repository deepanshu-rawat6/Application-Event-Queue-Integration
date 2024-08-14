#!/bin/bash

# Create the directory to store the files
mkdir -p /tmp/test_files

# Loop to create 100,000 files
for i in $(seq 1 100000); do
    echo "Sample file $i" > /tmp/test_files/file_$i.txt
done

echo "Created 100,000 sample files in /tmp/test_files"