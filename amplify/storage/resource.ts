/*import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "file-uploader-demo-rodes-01",
  access: (allow) => ({
    "videos/*": [
      allow.guest.to(["read", "write"]),
      allow.authenticated.to(["read", "write", "delete"])
    ],
    "audio/*": [
      allow.guest.to(["read"]),
      allow.authenticated.to(["read", "delete"]) // ✅ Quitado el espacio extra
    ],
    "transcriptions/*": [
      allow.guest.to(["read"]),
      allow.authenticated.to(["read", "delete"])
    ],
  }),
});*/