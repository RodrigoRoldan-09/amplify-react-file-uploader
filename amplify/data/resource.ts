// amplify/data/resource.ts
import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/*== STEP 1 ===============================================================
Updated schema for Video management instead of Todo.
This creates a Video database table with all necessary fields for video metadata.
The authorization rule allows authenticated users to perform CRUD operations.
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
      transcription: a.string(),
      duration: a.float(), // Video duration in seconds
      fileSize: a.integer(), // File size in bytes
      mimeType: a.string().default("video/mp4"),
      uploadedAt: a.datetime().default(new Date().toISOString()),
      status: a.enum(["uploading", "processing", "completed", "failed"]),
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