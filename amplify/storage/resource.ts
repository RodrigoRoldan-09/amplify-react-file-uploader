// amplify/storage/resource.ts - OPTIMIZADO
import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "file-uploader-demo-rodes-01",
  access: (allow) => ({
    // === VIDEOS ORIGINALES ===
    "videos/*": [
      allow.guest.to(["read", "write"]),
      allow.authenticated.to(["read", "write", "delete"])
    ],
    
    // === AUDIO EXTRAÍDO ===
    "audio/*": [
      allow.guest.to(["read"]),
      allow.authenticated.to(["read", "delete"])
    ],
    
    // === TRANSCRIPCIONES ===
    "transcriptions/*": [
      allow.guest.to(["read"]),
      allow.authenticated.to(["read", "delete"])
    ],
    
    // === CARPETAS ADICIONALES ===
    "thumbnails/*": [
      allow.guest.to(["read", "write"]),
      allow.authenticated.to(["read", "write", "delete"])
    ],
    "exports/*": [
      allow.guest.to(["read", "write"]),
      allow.authenticated.to(["read", "write", "delete"])
    ],
    "temp/*": [
      allow.authenticated.to(["read", "write", "delete"])
    ]
  }),
});