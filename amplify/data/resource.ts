// amplify/data/resource.ts
import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  Video: a
    .model({
      title: a.string().required(),
      description: a.string(),
      s3Key: a.string().required(),
      language: a.string().required(),
      quality: a.string(),
      duration: a.float(),
      fileSize: a.integer(),
      status: a.string(),
      transcriptionStatus: a.string(),
      transcriptionJobName: a.string(),
      transcriptionJobId: a.string(),
      transcriptionStartedAt: a.datetime(),
      transcriptionCompletedAt: a.datetime(),
      transcriptionError: a.string(),
      transcriptionText: a.string(),
      transcriptionS3Key: a.string(),
      uploadedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(["create", "read", "update", "delete"]),
    ]),
    
  TranscriptionJob: a
    .model({
      jobId: a.string().required(),
      videoId: a.string().required(),
      status: a.string(),
      transcribeJobName: a.string(),
      submittedToTranscribeAt: a.datetime(),
      completedAt: a.datetime(),
      audioS3Key: a.string(),
      transcriptionText: a.string(),
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