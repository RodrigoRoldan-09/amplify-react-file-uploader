// amplify/data/resource.ts - NUEVA ARQUITECTURA CON AWS TRANSCRIBE
import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/*== ARQUITECTURA MEJORADA PARA TRANSCRIPCIÓN ===============================
Esta nueva implementación utiliza una arquitectura de 2 pasos:
1. Lambda de extracción de audio (video → audio)
2. Lambda de transcripción (audio → texto)

Estructura de S3:
- videos/          → Videos originales
- audio/           → Audio extraído de videos
- transcriptions/  → Archivos JSON con transcripciones
============================================================================*/

const schema = a.schema({
  Video: a
    .model({
      // Información básica del video
      title: a.string().required(),
      description: a.string(),
      s3Key: a.string().required(), // videos/timestamp_filename.mp4
      s3Url: a.url(), // URL firmada para reproducción
      language: a.string().required(), // idioma para transcripción
      quality: a.string().required(),
      
      // Metadatos del archivo
      duration: a.float(), // duración en segundos
      fileSize: a.integer(), // tamaño en bytes
      mimeType: a.string().default("video/mp4"),
      uploadedAt: a.datetime().default(new Date().toISOString()),
      status: a.enum(["uploading", "processing", "completed", "failed"]),
      
      // === NUEVA ARQUITECTURA: PASO 1 - EXTRACCIÓN DE AUDIO ===
      audioS3Key: a.string(), // audio/timestamp_filename.wav
      audioExtractionStatus: a.enum([
        "not_started",    // No iniciado
        "in_progress",    // Lambda extrayendo audio
        "completed",      // Audio extraído exitosamente
        "failed"          // Error en extracción
      ]),
      audioExtractionJobId: a.string(), // ID único del job de extracción
      audioExtractionError: a.string(), // Mensaje de error si falla
      audioFileSize: a.integer(), // Tamaño del archivo de audio
      audioDuration: a.float(), // Duración del audio extraído
      
      // === NUEVA ARQUITECTURA: PASO 2 - TRANSCRIPCIÓN ===
      transcriptionS3Key: a.string(), // transcriptions/timestamp_filename.json
      transcriptionStatus: a.enum([
        "not_started",    // No iniciado
        "waiting_audio",  // Esperando que se extraiga el audio
        "in_progress",    // AWS Transcribe procesando
        "completed",      // Transcripción completada
        "failed"          // Error en transcripción
      ]),
      transcriptionJobName: a.string(), // Nombre del job en AWS Transcribe
      transcriptionJobId: a.string(), // ID único del job de transcripción
      transcriptionError: a.string(), // Mensaje de error si falla
      
      // Texto final de transcripción (extraído del JSON)
      transcriptionText: a.string(), // Texto completo transcrito
      transcriptionConfidence: a.float(), // Confianza promedio (0-1)
      transcriptionWordCount: a.integer(), // Número de palabras
      
      // Timestamps para monitoreo
      audioExtractionStartedAt: a.datetime(),
      audioExtractionCompletedAt: a.datetime(),
      transcriptionStartedAt: a.datetime(),
      transcriptionCompletedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(["create", "read", "update", "delete"]),
    ]),

  // === TABLA PARA TRACKING DE JOBS DE EXTRACCIÓN DE AUDIO ===
  AudioExtractionJob: a
    .model({
      jobId: a.string().required(), // ID único generado
      videoId: a.string().required(), // FK al video
      videoS3Key: a.string().required(), // Ruta del video original
      audioS3Key: a.string(), // Ruta donde se guardará el audio
      status: a.enum([
        "PENDING",        // En cola
        "IN_PROGRESS",    // Lambda procesando
        "COMPLETED",      // Audio extraído
        "FAILED"          // Error
      ]),
      
      // Parámetros de extracción
      outputFormat: a.string().default("wav"), // wav, mp3, flac
      sampleRate: a.integer().default(16000), // Hz para Transcribe
      channels: a.integer().default(1), // mono para Transcribe
      
      // Resultados y errores
      extractedAudioSize: a.integer(),
      extractedAudioDuration: a.float(),
      errorMessage: a.string(),
      errorCode: a.string(),
      
      // Timestamps
      createdAt: a.datetime().default(new Date().toISOString()),
      startedAt: a.datetime(),
      completedAt: a.datetime(),
      
      // Metadata adicional
      lambdaRequestId: a.string(), // Para debugging
      processingTimeSeconds: a.float(),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(["create", "read", "update", "delete"]),
    ]),

  // === TABLA PARA TRACKING DE JOBS DE TRANSCRIPCIÓN ===
  TranscriptionJob: a
    .model({
      jobId: a.string().required(), // ID único generado
      transcribeJobName: a.string().required(), // Nombre en AWS Transcribe
      videoId: a.string().required(), // FK al video
      audioS3Key: a.string().required(), // Audio a transcribir
      transcriptionS3Key: a.string(), // Donde se guarda el JSON
      
      // Configuración de transcripción
      languageCode: a.string().required(), // en-US, es-ES, etc.
      mediaFormat: a.string().default("wav"), // wav, mp3, flac, mp4
      mediaSampleRateHertz: a.integer().default(16000),
      
      // Estado del job
      status: a.enum([
        "PENDING",        // Creado, no enviado a Transcribe
        "QUEUED",         // Enviado a AWS Transcribe
        "IN_PROGRESS",    // AWS Transcribe procesando
        "COMPLETED",      // Transcripción completada
        "FAILED"          // Error en transcripción
      ]),
      
      // Resultados de AWS Transcribe
      transcribeStatus: a.string(), // Estado directo de AWS
      transcriptionText: a.string(), // Texto extraído del JSON
      confidence: a.float(), // Confianza promedio
      wordCount: a.integer(),
      
      // Configuraciones avanzadas de Transcribe
      enableSpeakerIdentification: a.boolean().default(false),
      maxSpeakerLabels: a.integer(),
      enableAutomaticPunctuation: a.boolean().default(true),
      enableWordLevelTimestamps: a.boolean().default(true),
      
      // Errores y debugging
      errorMessage: a.string(),
      errorCode: a.string(),
      failureReason: a.string(), // Razón específica de AWS
      
      // Timestamps
      createdAt: a.datetime().default(new Date().toISOString()),
      submittedToTranscribeAt: a.datetime(),
      completedAt: a.datetime(),
      
      // Metadata
      lambdaRequestId: a.string(),
      processingTimeSeconds: a.float(),
      transcriptionJobArn: a.string(), // ARN del job en AWS
    })
    .authorization((allow) => [
      allow.publicApiKey().to(["create", "read", "update", "delete"]),
    ]),

  // === TABLA PARA CONFIGURACIÓN Y MONITOREO DEL SISTEMA ===
  TranscriptionConfig: a
    .model({
      configKey: a.string().required(), // Clave única de configuración
      configValue: a.string().required(), // Valor de la configuración
      description: a.string(), // Descripción de qué hace
      category: a.enum([
        "AUDIO_EXTRACTION",
        "TRANSCRIPTION",
        "STORAGE", 
        "SYSTEM"
      ]),
      
      // Metadata
      createdAt: a.datetime().default(new Date().toISOString()),
      updatedAt: a.datetime(),
      updatedBy: a.string(),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(["create", "read", "update", "delete"]),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

/*== ESTRUCTURA DE CARPETAS EN S3 =======================
file-uploader-demo-rodes-01/
├── videos/                    ← Videos originales
│   ├── 1640995200000_video1.mp4
│   └── 1640995300000_video2.mp4
├── audio/                     ← Audio extraído (Paso 1)
│   ├── 1640995200000_video1.wav
│   └── 1640995300000_video2.wav
└── transcriptions/            ← JSON con transcripciones (Paso 2)
    ├── 1640995200000_video1.json
    └── 1640995300000_video2.json

== EJEMPLO DE JSON DE TRANSCRIPCIÓN ===================
{
  "jobName": "transcribe_1640995200000_video1",
  "accountId": "123456789012",
  "results": {
    "transcripts": [
      {
        "transcript": "Hola, bienvenidos a este video..."
      }
    ],
    "items": [
      {
        "start_time": "0.12",
        "end_time": "0.56",
        "alternatives": [
          {
            "confidence": "0.9969",
            "content": "Hola"
          }
        ],
        "type": "pronunciation"
      }
    ]
  },
  "status": "COMPLETED"
}
=========================================================*/