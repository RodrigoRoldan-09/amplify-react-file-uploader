// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

/*
=== BACKEND SIMPLIFICADO PARA TRANSCRIPCIÓN ===
Por ahora solo configuramos los recursos básicos y permisos de usuarios.
Las funciones Lambda las crearemos por separado usando el CLI de AWS
o las agregaremos después cuando tengamos la sintaxis correcta.
*/

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
      'arn:aws:s3:::file-uploader-demo-rodes-01',
      'arn:aws:s3:::file-uploader-demo-rodes-01/*',
    ],
  })
);

// Permisos para DynamoDB (para que el frontend pueda actualizar estados)
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
      backend.data.resources.tables['Video'].tableArn,
      backend.data.resources.tables['AudioExtractionJob'].tableArn,
      backend.data.resources.tables['TranscriptionJob'].tableArn,
      backend.data.resources.tables['TranscriptionConfig'].tableArn,
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

/*
=== PLAN PARA LAS FUNCIONES LAMBDA ===

Por ahora, las funciones Lambda las crearemos de una de estas formas:

OPCIÓN 1: Crear manualmente con AWS CLI
- aws lambda create-function
- Configurar permisos después

OPCIÓN 2: Usar AWS SAM
- template.yaml para definir las funciones
- sam deploy

OPCIÓN 3: Investigar la sintaxis correcta de Amplify v6
- Puede que necesitemos una versión más nueva
- O usar una sintaxis diferente

OPCIÓN 4: Crear las funciones en otro stack de CDK
- Separate lambda stack
- Importar referencias

Por ahora, este backend.ts te permitirá:
✅ Usar S3 para videos, audio y transcripciones
✅ Usar DynamoDB para tracking
✅ Usar AWS Transcribe desde el frontend
✅ Preparar permisos para cuando tengamos las Lambdas

=== PRÓXIMO PASO ===
Vamos a crear primero el servicio de transcripción que funcione
sin las Lambdas, y luego agregamos las Lambdas cuando tengamos
la configuración correcta.
*/