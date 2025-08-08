// amplify/backend.ts - CORREGIDO PARA AMPLIFY v6
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

/* === BACKEND CORREGIDO PARA TRANSCRIPCIÓN === */

// === DEFINIR BACKEND BÁSICO ===
export const backend = defineBackend({
  auth,
  data,
  storage,
});

// === PERMISOS PARA USUARIOS AUTENTICADOS ===
// Los usuarios necesitan permisos para AWS Transcribe desde el frontend
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(
  new PolicyStatement({
    actions: [
      // Permisos básicos de AWS Transcribe
      'transcribe:StartTranscriptionJob',
      'transcribe:GetTranscriptionJob', 
      'transcribe:ListTranscriptionJobs',
      'transcribe:DeleteTranscriptionJob', // Para cancelar jobs
    ],
    resources: ['*'],
  })
);

// Permisos básicos de S3 para usuarios
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(
  new PolicyStatement({
    actions: [
      's3:GetObject',
      's3:PutObject',
      's3:PutObjectAcl',
      's3:ListBucket',
      's3:GetBucketLocation',
      's3:DeleteObject', // Para eliminar videos/audio/transcripciones
    ],
    resources: [
      // ✅ CORREGIDO: Usar el bucket desde storage
      backend.storage.resources.bucket.bucketArn,
      `${backend.storage.resources.bucket.bucketArn}/*`,
    ],
  })
);

// ✅ CORREGIDO: Permisos para DynamoDB - Enfoque más simple y funcional
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(
  new PolicyStatement({
    actions: [
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
      'dynamodb:DeleteItem',
      'dynamodb:Query',
      'dynamodb:Scan',
    ],
    resources: [
      // ✅ SINTAXIS SIMPLIFICADA: Usar wildcard para todas las tablas de Amplify
      'arn:aws:dynamodb:*:*:table/*-AMPLIFY-*',
      'arn:aws:dynamodb:*:*:table/*Video*',
      'arn:aws:dynamodb:*:*:table/*AudioExtraction*',
      'arn:aws:dynamodb:*:*:table/*Transcription*',
    ],
  })
);

// Permisos para invocar funciones Lambda (cuando las creemos)
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(
  new PolicyStatement({
    actions: [
      'lambda:InvokeFunction',
    ],
    resources: [
      // Wildcards para las funciones que crearemos
      'arn:aws:lambda:*:*:function:audio-extraction-*',
      'arn:aws:lambda:*:*:function:transcription-*',
    ],
  })
);

// ✅ NUEVO: Permisos adicionales para guest users (sin autenticación)
backend.auth.resources.unauthenticatedUserIamRole.addToPrincipalPolicy(
  new PolicyStatement({
    actions: [
      'transcribe:StartTranscriptionJob',
      'transcribe:GetTranscriptionJob',
      'transcribe:ListTranscriptionJobs',
    ],
    resources: ['*'],
  })
);

backend.auth.resources.unauthenticatedUserIamRole.addToPrincipalPolicy(
  new PolicyStatement({
    actions: [
      's3:GetObject',
      's3:PutObject',
      's3:ListBucket',
    ],
    resources: [
      backend.storage.resources.bucket.bucketArn,
      `${backend.storage.resources.bucket.bucketArn}/*`,
    ],
  })
);

// ✅ SIMPLIFICADO: Permisos DynamoDB para guest users también
backend.auth.resources.unauthenticatedUserIamRole.addToPrincipalPolicy(
  new PolicyStatement({
    actions: [
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
      'dynamodb:Query',
      'dynamodb:Scan',
    ],
    resources: [
      'arn:aws:dynamodb:*:*:table/*-AMPLIFY-*',
      'arn:aws:dynamodb:*:*:table/*Video*',
      'arn:aws:dynamodb:*:*:table/*AudioExtraction*',
      'arn:aws:dynamodb:*:*:table/*Transcription*',
    ],
  })
);

/* === CONFIGURACIÓN ADICIONAL PARA DEBUGGING === */

// ✅ CORREGIDO: Debug info simplificado sin propiedades problemáticas
export const debugInfo = {
  bucketName: backend.storage.resources.bucket.bucketName,
  // Removemos la referencia problemática por ahora
  region: 'us-east-1',
  message: 'Backend configurado correctamente para transcripción',
};

console.log('🔧 Backend Debug Info:', debugInfo);