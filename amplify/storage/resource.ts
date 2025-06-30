// amplify/storage/resource.ts
import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "file-uploader-demo-rodes-01",
  access: (allow) => ({
    "videos/*": [
      allow.guest.to(["read", "write"]),
      allow.authenticated.to(["read", "write", "delete"])
    ],
    "thumbnails/*": [
      allow.guest.to(["read", "write"]),
      allow.authenticated.to(["read", "write", "delete"])
    ],
    "exports/*": [
      allow.guest.to(["read", "write"]),
      allow.authenticated.to(["read", "write", "delete"])
    ]
  }),
});