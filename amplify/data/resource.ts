// amplify/data/resource.ts - WITH TRANSCRIPTION SUPPORT (FIXED)
import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/*== UPDATED SCHEMA WITH TRANSCRIPTION SUPPORT ===============================================================
Enhanced schema for Video management with AWS Transcribe integration.
Added fields for transcription job tracking and status management.
=========================================================================*/
const schema = a.schema({
  Video: a
    .model({
      title: a.string().required(),
      description: a.string(),
      s3Key: a.string().required(), // S3 object key for the video file
      s3Url: a.url(), // S3 public URL for playback
      language: a.string().required(),
      quality: a.string().required(),
      
      // Transcription fields
      transcription: a.string(),
      transcriptionJobName: a.string(), // AWS Transcribe job name
      transcriptionStatus: a.enum(["not_started", "in_progress", "completed", "failed"]),
      transcriptionS3Key: a.string(), // S3 key for transcription output file
      transcriptionJobId: a.string(), // Unique job identifier
      
      // Media fields
      duration: a.float(), // Video duration in seconds
      fileSize: a.integer(), // File size in bytes
      mimeType: a.string().default("video/mp4"),
      uploadedAt: a.datetime().default(new Date().toISOString()),
      status: a.enum(["uploading", "processing", "completed", "failed"]),
      
      // Audio conversion fields (for transcription)
      audioS3Key: a.string(), // S3 key for converted audio file
      audioConversionStatus: a.enum(["not_started", "in_progress", "completed", "failed"]),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(["create", "read", "update", "delete"]),
    ]),

  // Transcription Jobs tracking table
  TranscriptionJob: a
    .model({
      jobName: a.string().required(),
      videoId: a.string().required(),
      status: a.enum(["QUEUED", "IN_PROGRESS", "COMPLETED", "FAILED"]),
      languageCode: a.string().required(),
      mediaFileUri: a.string().required(),
      outputS3Key: a.string(),
      createdAt: a.datetime().default(new Date().toISOString()),
      completedAt: a.datetime(),
      errorMessage: a.string(),
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
    // API Key is used for a.allow.public() rules
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});