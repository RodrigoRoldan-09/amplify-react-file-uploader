// amplify/storage/resource.ts
import { defineStorage } from "@aws-amplify/backend";

/*
=== CONFIGURACIÓN DE S3 PARA NUEVA ARQUITECTURA ===
Ahora necesitamos 3 carpetas principales:
- videos/         → Videos originales subidos por usuarios
- audio/          → Audio extraído por Lambda (formato optimizado para Transcribe)
- transcriptions/ → Resultados JSON de AWS Transcribe

También mantenemos las carpetas existentes:
- thumbnails/     → Miniaturas de videos
- exports/        → Archivos exportados por usuarios
*/

export const storage = defineStorage({
  name: "file-uploader-demo-rodes-01",
  access: (allow) => ({
    // === VIDEOS ORIGINALES ===
    // Los usuarios pueden subir videos
    // Los permisos para Lambdas se configuran en backend.ts con IAM policies
    "videos/*": [
      allow.guest.to(["read", "write"]),
      allow.authenticated.to(["read", "write", "delete"])
    ],
    
    // === AUDIO EXTRAÍDO (NUEVA CARPETA) ===
    // Solo usuarios pueden leer, las Lambdas escriben vía IAM policies
    "audio/*": [
      allow.guest.to(["read"]), // Solo lectura para usuarios
      allow.authenticated.to(["read", "delete"]) // Usuarios autenticados pueden eliminar
    ],
    
    // === TRANSCRIPCIONES (NUEVA CARPETA) ===
    // Solo usuarios pueden leer, AWS Transcribe y Lambdas escriben vía IAM policies
    "transcriptions/*": [
      allow.guest.to(["read"]), // Solo lectura para usuarios
      allow.authenticated.to(["read", "delete"]) // Usuarios autenticados pueden eliminar
    ],
    
    // === CARPETAS EXISTENTES ===
    "thumbnails/*": [
      allow.guest.to(["read", "write"]),
      allow.authenticated.to(["read", "write", "delete"])
    ],
    "exports/*": [
      allow.guest.to(["read", "write"]),
      allow.authenticated.to(["read", "write", "delete"])
    ],
    
    // === CARPETA TEMPORAL (OPCIONAL) ===
    // Para archivos temporales durante procesamiento
    "temp/*": [
      allow.authenticated.to(["read", "write", "delete"])
    ]
  }),
});

/*
=== EXPLICACIÓN DE PERMISOS ===

1. videos/*:
   - Usuarios: pueden subir y ver videos
   - Lambdas: acceso configurado en backend.ts con IAM policies

2. audio/*:
   - Usuarios: solo pueden leer/descargar audio extraído
   - audio-extraction-lambda: escribe audio extraído aquí (vía IAM)
   - transcription-lambda: lee audio para transcribir (vía IAM)

3. transcriptions/*:
   - Usuarios: solo pueden leer transcripciones
   - transcription-lambda: guarda resultados de transcripción (vía IAM)
   - AWS Transcribe: también guarda sus resultados aquí (vía IAM)

4. temp/*:
   - Para archivos temporales durante procesamiento
   - Se limpia automáticamente con lifecycle policies

IMPORTANTE: Los permisos para las Lambdas y AWS Transcribe se configuran
en backend.ts usando IAM policies, no en este archivo.
*/