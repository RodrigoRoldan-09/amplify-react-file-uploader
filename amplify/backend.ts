// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

export const backend = defineBackend({
  auth,
  data,
  storage,
});

// ✅ Agregar permisos de AWS Transcribe de forma más simple
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(
  new PolicyStatement({
    actions: [
      'transcribe:StartTranscriptionJob',
      'transcribe:GetTranscriptionJob',
      'transcribe:ListTranscriptionJobs',
    ],
    resources: ['*'],
  })
);

// ✅ Agregar permisos básicos de S3 sin referencias circulares
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(
  new PolicyStatement({
    actions: [
      's3:GetObject',
      's3:PutObject',
      's3:PutObjectAcl',
      's3:ListBucket',
      's3:GetBucketLocation',
    ],
    resources: [
      'arn:aws:s3:::*', // Todos los buckets
      'arn:aws:s3:::*/*', // Todos los objetos
    ],
  })
);