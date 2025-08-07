// services/transcriptionService.ts - FIXED VERSION
import { generateClient } from 'aws-amplify/data';
import { 
  TranscribeClient, 
  StartTranscriptionJobCommand, 
  GetTranscriptionJobCommand,
  TranscriptionJob,
  DeleteTranscriptionJobCommand,
  LanguageCode
} from '@aws-sdk/client-transcribe';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Schema } from '../amplify/data/resource';

const client = generateClient<Schema>();

/*
=== SERVICIO DE TRANSCRIPCIÓN SIMPLIFICADO ===
Esta versión funciona SIN Lambdas intermedias:
1. El frontend inicia jobs directamente en AWS Transcribe
2. Monitorea el progreso con polling
3. Cuando termina, descarga y procesa el resultado
4. Actualiza la UI en tiempo real

Flujo:
Video en S3 → AWS Transcribe (directo) → JSON resultado → Procesamiento → UI
*/

interface TranscriptionRequest {
  videoId: string;
  videoS3Key: string;
  language: string;
  enableSpeakerIdentification?: boolean;
  enableAutomaticPunctuation?: boolean;
}

interface TranscriptionProgress {
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  transcriptionText?: string;
  confidence?: number;
  error?: string;
  jobName?: string;
}

// Configuración del cliente AWS Transcribe - FIXED: Sin process.env
const transcribeClient = new TranscribeClient({ 
  region: 'us-east-1' // Región fija
});

const s3Client = new S3Client({ 
  region: 'us-east-1' // Región fija
});

const BUCKET_NAME = 'file-uploader-demo-rodes-01';

// Mapeo de idiomas a códigos de AWS Transcribe
const LANGUAGE_CODES: Record<string, LanguageCode> = {
  'english': LanguageCode.EN_US,
  'spanish': LanguageCode.ES_ES, 
  'french': LanguageCode.FR_FR,
  'german': LanguageCode.DE_DE,
  'italian': LanguageCode.IT_IT,
  'portuguese': LanguageCode.PT_BR,
  'russian': LanguageCode.RU_RU,
  'chinese': LanguageCode.ZH_CN,
  'japanese': LanguageCode.JA_JP,
  'arabic': LanguageCode.AR_SA
};

class TranscriptionService {
  
  /**
   * Inicia una transcripción directamente con AWS Transcribe
   */
  async startTranscription(request: TranscriptionRequest): Promise<{
    jobName: string;
    success: boolean;
  }> {
    console.log('🚀 Iniciando transcripción directa para video:', request.videoId);
    
    try {
      // === PASO 1: GENERAR NOMBRES ÚNICOS ===
      const timestamp = Date.now();
      const jobName = `transcribe_${request.videoId}_${timestamp}`;
      const languageCode = LANGUAGE_CODES[request.language] || LanguageCode.EN_US;
      
      // Construir URI del video en S3
      const mediaUri = `s3://${BUCKET_NAME}/${request.videoS3Key}`;
      
      // Ruta donde AWS Transcribe guardará el resultado
      const outputKey = `transcriptions/${timestamp}_${request.videoId}.json`;
      
      console.log('📝 Configuración de transcripción:', {
        jobName,
        mediaUri,
        languageCode,
        outputKey
      });

      // === PASO 2: CREAR REGISTROS DE TRACKING ===
      console.log('💾 Creando registro de job de transcripción...');
      
      await client.models.TranscriptionJob.create({
        jobId: jobName,
        transcribeJobName: jobName,
        videoId: request.videoId,
        audioS3Key: request.videoS3Key, // En este caso, usamos el video directamente
        transcriptionS3Key: outputKey,
        languageCode: languageCode,
        status: 'PENDING',
        enableSpeakerIdentification: request.enableSpeakerIdentification || false,
        enableAutomaticPunctuation: request.enableAutomaticPunctuation !== false,
        enableWordLevelTimestamps: true,
        createdAt: new Date().toISOString()
      });

      // === PASO 3: ACTUALIZAR VIDEO CON JOB INICIADO ===
      await client.models.Video.update({
        id: request.videoId,
        transcriptionStatus: 'not_started',
        transcriptionJobName: jobName,
        transcriptionJobId: jobName,
        transcriptionS3Key: outputKey
      });

      // === PASO 4: INICIAR JOB EN AWS TRANSCRIBE ===
      console.log('🎤 Enviando job a AWS Transcribe...');
      
      const transcribeParams = {
        TranscriptionJobName: jobName,
        LanguageCode: languageCode,
        Media: {
          MediaFileUri: mediaUri
        },
        OutputBucketName: BUCKET_NAME,
        OutputKey: outputKey,
        Settings: {
          ShowSpeakerLabels: request.enableSpeakerIdentification || false,
          MaxSpeakerLabels: request.enableSpeakerIdentification ? 2 : undefined,
          ShowAlternatives: true,
          MaxAlternatives: 3
        }
      };

      const command = new StartTranscriptionJobCommand(transcribeParams);
      const result = await transcribeClient.send(command);
      
      console.log('✅ Job enviado a AWS Transcribe:', result.TranscriptionJob?.TranscriptionJobName);

      // === PASO 5: ACTUALIZAR ESTADO A IN_PROGRESS ===
      await client.models.TranscriptionJob.update({
        id: jobName,
        status: 'IN_PROGRESS',
        submittedToTranscribeAt: new Date().toISOString()
      });

      await client.models.Video.update({
        id: request.videoId,
        transcriptionStatus: 'in_progress',
        transcriptionStartedAt: new Date().toISOString()
      });

      console.log('🎉 Transcripción iniciada exitosamente');
      
      return {
        jobName,
        success: true
      };

    } catch (error) {
      console.error('❌ Error iniciando transcripción:', error);
      
      // Actualizar estado de error
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      await client.models.Video.update({
        id: request.videoId,
        transcriptionStatus: 'failed',
        transcriptionError: errorMessage
      });
      
      throw error;
    }
  }

  /**
   * Monitorea el progreso de una transcripción
   */
  async checkProgress(videoId: string): Promise<TranscriptionProgress> {
    try {
      // Obtener estado actual del video
      const videoResult = await client.models.Video.get({ id: videoId });
      
      if (!videoResult.data) {
        throw new Error(`Video no encontrado: ${videoId}`);
      }
      
      const video = videoResult.data;
      const jobName = video.transcriptionJobName;
      
      if (!jobName) {
        return {
          status: 'not_started',
          progress: 0,
          message: 'Transcripción no iniciada'
        };
      }

      // === VERIFICAR ESTADO EN AWS TRANSCRIBE ===
      console.log('🔍 Verificando estado en AWS Transcribe:', jobName);
      
      const command = new GetTranscriptionJobCommand({
        TranscriptionJobName: jobName
      });
      
      const result = await transcribeClient.send(command);
      const job = result.TranscriptionJob;
      
      if (!job) {
        throw new Error(`Job no encontrado en AWS Transcribe: ${jobName}`);
      }

      console.log('📊 Estado del job:', job.TranscriptionJobStatus);

      // === PROCESAR SEGÚN EL ESTADO ===
      switch (job.TranscriptionJobStatus) {
        case 'COMPLETED':
          return await this.handleCompletedJob(videoId, job);
          
        case 'FAILED':
          await this.handleFailedJob(videoId, job.FailureReason || 'Error desconocido');
          return {
            status: 'failed',
            progress: 0,
            message: `Error: ${job.FailureReason || 'Error desconocido'}`,
            error: job.FailureReason || 'Error desconocido'
          };
          
        case 'IN_PROGRESS':
          return {
            status: 'in_progress',
            progress: 50, // Progreso estimado
            message: 'AWS Transcribe procesando audio...',
            jobName: jobName
          };
          
        case 'QUEUED':
          return {
            status: 'in_progress',
            progress: 25,
            message: 'En cola de AWS Transcribe...',
            jobName: jobName
          };
          
        default:
          return {
            status: 'in_progress',
            progress: 10,
            message: `Estado: ${job.TranscriptionJobStatus}`,
            jobName: jobName
          };
      }
      
    } catch (error) {
      console.error('❌ Error verificando progreso:', error);
      return {
        status: 'failed',
        progress: 0,
        message: 'Error verificando progreso',
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Maneja un job completado
   */
  private async handleCompletedJob(videoId: string, job: TranscriptionJob): Promise<TranscriptionProgress> {
    try {
      console.log('✅ Job completado, descargando resultado...');
      
      if (!job.Transcript?.TranscriptFileUri) {
        throw new Error('No se encontró URI del archivo de transcripción');
      }

      // === DESCARGAR RESULTADO DE S3 ===
      const transcriptionData = await this.downloadTranscriptionResult(job.Transcript.TranscriptFileUri);
      
      // === PROCESAR TEXTO ===
      const processedResult = this.processTranscriptionResult(transcriptionData);
      
      console.log(`📝 Texto procesado: ${processedResult.wordCount} palabras, confianza: ${processedResult.averageConfidence.toFixed(2)}`);

      // === ACTUALIZAR BASE DE DATOS ===
      await client.models.Video.update({
        id: videoId,
        transcriptionStatus: 'completed',
        transcriptionCompletedAt: new Date().toISOString(),
        transcriptionText: processedResult.text,
        transcriptionConfidence: processedResult.averageConfidence,
        transcriptionWordCount: processedResult.wordCount
      });

      if (job.TranscriptionJobName) {
        await client.models.TranscriptionJob.update({
          id: job.TranscriptionJobName,
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
          transcriptionText: processedResult.text,
          confidence: processedResult.averageConfidence,
          wordCount: processedResult.wordCount
        });
      }

      return {
        status: 'completed',
        progress: 100,
        message: 'Transcripción completada exitosamente',
        transcriptionText: processedResult.text,
        confidence: processedResult.averageConfidence,
        jobName: job.TranscriptionJobName || undefined
      };

    } catch (error) {
      console.error('❌ Error procesando job completado:', error);
      await this.handleFailedJob(videoId, error instanceof Error ? error.message : 'Error procesando resultado');
      
      return {
        status: 'failed',
        progress: 0,
        message: 'Error procesando resultado',
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Maneja un job fallido
   */
  private async handleFailedJob(videoId: string, errorMessage: string): Promise<void> {
    await client.models.Video.update({
      id: videoId,
      transcriptionStatus: 'failed',
      transcriptionError: errorMessage
    });
  }

  /**
   * Descarga el resultado de transcripción desde S3
   */
  private async downloadTranscriptionResult(s3Uri: string): Promise<Record<string, unknown>> {
    // Extraer bucket y key de la URI S3
    const match = s3Uri.match(/s3:\/\/([^/]+)\/(.+)/);
    if (!match) {
      throw new Error(`URI S3 inválida: ${s3Uri}`);
    }
    
    const [, bucket, key] = match;
    
    console.log(`📥 Descargando transcripción: ${bucket}/${key}`);
    
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('No se pudo descargar el archivo de transcripción');
    }
    
    const bodyContent = await response.Body.transformToString();
    return JSON.parse(bodyContent);
  }

  /**
   * Procesa el JSON de AWS Transcribe para extraer texto
   */
  private processTranscriptionResult(transcriptionData: Record<string, unknown>): {
    text: string;
    wordCount: number;
    averageConfidence: number;
  } {
    console.log('🔄 Procesando resultado de transcripción...');
    
    if (!transcriptionData.results) {
      throw new Error('Formato de transcripción inválido: falta results');
    }
    
    const results = transcriptionData.results as Record<string, unknown>;
    
    // Extraer texto principal
    const transcripts = results.transcripts as Array<{ transcript: string }>;
    const mainTranscript = transcripts?.[0]?.transcript || '';
    
    // Procesar items para obtener confianza
    const items = (results.items as Array<Record<string, unknown>>) || [];
    const confidenceValues = items
      .map((item) => {
        const alternatives = item.alternatives as Array<{ confidence: string }>;
        return alternatives?.[0]?.confidence;
      })
      .filter((conf): conf is string => conf !== undefined)
      .map((conf: string) => parseFloat(conf));
    
    const averageConfidence = confidenceValues.length > 0 
      ? confidenceValues.reduce((sum, conf) => sum + conf, 0) / confidenceValues.length 
      : 0;
    
    const wordCount = mainTranscript.split(/\s+/).filter(word => word.length > 0).length;
    
    console.log(`✅ Procesamiento completado: ${wordCount} palabras, confianza ${averageConfidence.toFixed(2)}`);
    
    return {
      text: mainTranscript,
      wordCount,
      averageConfidence
    };
  }

  /**
   * Cancela una transcripción en curso
   */
  async cancelTranscription(videoId: string): Promise<void> {
    try {
      console.log('🛑 Cancelando transcripción para video:', videoId);
      
      const videoResult = await client.models.Video.get({ id: videoId });
      const video = videoResult.data;
      
      if (video?.transcriptionJobName) {
        // Intentar cancelar en AWS Transcribe
        try {
          const command = new DeleteTranscriptionJobCommand({
            TranscriptionJobName: video.transcriptionJobName
          });
          await transcribeClient.send(command);
          console.log('✅ Job cancelado en AWS Transcribe');
        } catch (error) {
          console.warn('⚠️ No se pudo cancelar job en AWS Transcribe:', error);
        }
      }
      
      // Actualizar estado local
      await client.models.Video.update({
        id: videoId,
        transcriptionStatus: 'failed',
        transcriptionError: 'Cancelado por el usuario'
      });
      
      console.log('✅ Transcripción cancelada');
      
    } catch (error) {
      console.error('❌ Error cancelando transcripción:', error);
      throw error;
    }
  }

  /**
   * Obtiene el código de idioma para AWS Transcribe
   */
  getAWSLanguageCode(language: string): LanguageCode {
    return LANGUAGE_CODES[language] || LanguageCode.EN_US;
  }
}

// Exportar instancia singleton
export default new TranscriptionService();