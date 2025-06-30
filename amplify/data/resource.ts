// amplify/data/resource.ts
import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/*== STEP 1 ===============================================================
Updated schema for Video management instead of Todo.
This creates a Video database table with all necessary fields for video metadata.
The authorization rule allows authenticated users to perform CRUD operations.
=========================================================================*/

// package.json - Required dependencies
/*
Ensure these dependencies are in your package.json:

{
  "dependencies": {
    "@aws-amplify/backend": "^1.0.0",
    "aws-amplify": "^6.0.0",
    "@aws-amplify/ui-react": "^6.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}

Install with: npm install aws-amplify @aws-amplify/ui-react
*/

// amplify/auth/resource.ts (Update if needed)
import { defineAuth } from "@aws-amplify/backend";

export const auth = defineAuth({
  loginWith: {
    email: true, // Enable email/password login
  },
  // Allow guest access for public API operations
  userPoolClientRefreshTokenValidity: 30,
  userPoolClientAccessTokenValidity: 60,
  userPoolClientIdTokenValidity: 60,
});

/*== Auth Configuration Notes ==========================================
- Email/password authentication enabled
- Guest access allowed for public operations
- Token validity configured for reasonable session management
- Supports both authenticated and unauthenticated access patterns
=========================================================================*/

// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';

/*== Updated Backend Configuration =====================================
Added storage to the backend definition to enable S3 functionality.
This will create:
1. S3 bucket with name: file-uploader-demo-rodes-01
2. IAM roles and policies for access
3. CloudFormation resources for infrastructure
=========================================================================*/

export const backend = defineBackend({
  auth,
  data,
  storage,
});

/*== Storage Policy Configuration ====================================== 
The backend will automatically create:
- S3 bucket in us-east-1 region
- IAM policies for authenticated/guest access
- CORS configuration for web uploads
- CloudFront distribution (optional, for CDN)
=========================================================================*/

// amplify/storage/resource.ts
import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "file-uploader-demo-rodes-01",
  access: (allow) => ({
    "videos/*": [
      allow.authenticated.to(["read", "write", "delete"]),
      allow.guest.to(["read", "write"]) // Allow unauthenticated users to upload/view
    ],
    "thumbnails/*": [
      allow.authenticated.to(["read", "write", "delete"]),
      allow.guest.to(["read", "write"])
    ],
    "exports/*": [
      allow.authenticated.to(["read", "write", "delete"]),
      allow.guest.to(["read", "write"])
    ]
  }),
});

/*== Storage Configuration Notes =======================================
- Bucket name: file-uploader-demo-rodes-01
- Region: Will be created in same region as Amplify app (us-east-1)
- Access patterns:
  * videos/*: Main video files
  * thumbnails/*: Video thumbnails (future feature)
  * exports/*: Exported transcription files
- Permissions: Both authenticated and guest users can upload/read
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
      status: a.enum(["uploading", "processing", "completed", "failed"]).default("uploading"),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(["create", "read", "update", "delete"]),
      allow.authenticated().to(["create", "read", "update", "delete"])
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
    // Also enable user pool for authenticated users
    userPoolAuthorizationMode: {
      userPoolId: "default",
    },
  },
});

/*== STEP 2 ===============================================================
Frontend usage example:
=========================================================================*/

/* "use client"
import { generateClient } from "aws-amplify/data";
import { uploadData, getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

// Upload video to S3 and create database record
const uploadVideo = async (file: File, title: string, language: string, quality: string) => {
  try {
    // 1. Upload file to S3
    const s3Key = `videos/${Date.now()}-${file.name}`;
    const uploadResult = await uploadData({
      path: s3Key,
      data: file,
      options: {
        contentType: file.type,
        metadata: {
          title,
          language,
          quality
        }
      }
    }).result;

    // 2. Get public URL
    const s3Url = await getUrl({ path: s3Key });

    // 3. Create database record
    const videoRecord = await client.models.Video.create({
      title,
      s3Key,
      s3Url: s3Url.url.toString(),
      language,
      quality,
      fileSize: file.size,
      mimeType: file.type,
      status: "completed"
    });

    return videoRecord;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};

// List all videos
const { data: videos } = await client.models.Video.list();

// Get specific video
const { data: video } = await client.models.Video.get({ id: "video-id" });
*/