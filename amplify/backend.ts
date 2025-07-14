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

// ✅ Agregar permisos de AWS Transcribe
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

// ✅ Agregar permisos adicionales de S3 para transcripciones
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(
  new PolicyStatement({
    actions: [
      's3:GetObject',
      's3:PutObject',
      's3:PutObjectAcl',
    ],
    resources: [
      `${backend.storage.resources.bucket.bucketArn}/*`,
      `${backend.storage.resources.bucket.bucketArn}/transcriptions/*`,
    ],
  })
);

// ✅ Opcional: Agregar permisos para acceso completo al bucket
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(
  new PolicyStatement({
    actions: [
      's3:ListBucket',
      's3:GetBucketLocation',
    ],
    resources: [backend.storage.resources.bucket.bucketArn],
  })
);