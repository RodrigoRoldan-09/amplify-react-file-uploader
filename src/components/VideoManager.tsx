// components/VideoManager.tsx - CON TRANSCRIPCIÓN INTEGRADA
import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import { getUrl, remove, list } from "aws-amplify/storage";
import type { Schema } from "../../amplify/data/resource";
import TranscriptionService from "../../services/transcriptionService";

const client = generateClient<Schema>();

type DatabaseVideo = {
  id: string;
  title?: string | null;
  description?: string | null;
  s3Key: string;
  s3Url?: string | null;
  language?: string | null;
  quality?: string | null;
  transcription?: string | null;
  transcriptionText?: string | null; // Agregado para manejar ambos campos
  duration?: number | null;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedAt?: string | null;
  status?: string | null;
  transcriptionStatus?: string | null;
  transcriptionJobName?: string | null;
  audioExtractionStatus?: string | null;
};

export interface VideoItem {
  id: string;
  title: string;
  description: string;
  s3Key: string;
  s3Url: string;
  language: string;
  quality: string;
  duration: string;
  fileSize: string;
  uploadedAt: string;
  thumbnail: string;
  status?: string;
  transcriptionStatus?: string;
  transcriptionJobName?: string;
  hasTranscription?: boolean;
  transcription?: string;
}

interface VideoManagerProps {
  onBack: () => void;
  onViewVideo: (video: VideoItem) => void;
  onUploadNew: () => void;
}

const VideoManager: React.FC<VideoManagerProps> = ({ onBack, onViewVideo, onUploadNew }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  // CRUD state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLanguage, setEditLanguage] = useState("");
  const [editQuality, setEditQuality] = useState("");
  const [saving, setSaving] = useState(false);
  
  // === NUEVOS ESTADOS PARA TRANSCRIPCIÓN ===
  const [transcriptionProgress, setTranscriptionProgress] = useState<Record<string, number>>({});
  const [transcriptionMessages, setTranscriptionMessages] = useState<Record<string, string>>({});
  const [pollingVideos, setPollingVideos] = useState<Set<string>>(new Set());
  
  const videosPerPage = 3;

  const languages = [
    { value: 'english', label: 'English' },
    { value: 'spanish', label: 'Spanish' },
    { value: 'french', label: 'French' },
    { value: 'german', label: 'German' },
    { value: 'italian', label: 'Italian' },
    { value: 'portuguese', label: 'Portuguese' },
    { value: 'russian', label: 'Russian' },
    { value: 'chinese', label: 'Chinese' },
    { value: 'japanese', label: 'Japanese' },
    { value: 'arabic', label: 'Arabic' }
  ];

  const addDebugInfo = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const debugMessage = `[${timestamp}] ${message}`;
    console.log(debugMessage);
    setDebugInfo(prev => [...prev.slice(-10), debugMessage]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown date';
    }
  };

  const generateThumbnailUrl = (title: string): string => {
    const colors = ['8B5CF6', 'A855F7', '9333EA', '7C3AED', '6D28D9'];
    const color = colors[title.length % colors.length];
    const encodedTitle = encodeURIComponent(title.substring(0, 15));
    return `https://via.placeholder.com/200x120/${color}/ffffff?text=${encodedTitle}`;
  };

  // === FUNCIONES PARA TRANSCRIPCIÓN ===
  
  // Get transcription status badge
  const getTranscriptionBadge = (status?: string, hasTranscription?: boolean) => {
    if (hasTranscription) {
      return { icon: '✅', text: 'Completada', color: '#28a745' };
    }
    
    switch (status) {
      case 'completed':
        return { icon: '✅', text: 'Completada', color: '#28a745' };
      case 'in_progress':
        return { icon: '⏳', text: 'Procesando...', color: '#ffc107' };
      case 'failed':
        return { icon: '❌', text: 'Error', color: '#dc3545' };
      case 'not_started':
        return { icon: '⏸️', text: 'Sin iniciar', color: '#6c757d' };
      default:
        return { icon: '❓', text: 'Desconocido', color: '#6c757d' };
    }
  };

  // Iniciar transcripción para un video
  const startTranscription = async (videoId: string, videoS3Key: string, language: string) => {
    try {
      console.log(`Iniciando transcripción para video ${videoId}`);
      
      // Actualizar estado local inmediatamente
      setVideos(prevVideos => 
        prevVideos.map(video => 
          video.id === videoId 
            ? { ...video, transcriptionStatus: 'in_progress' }
            : video
        )
      );
      
      setTranscriptionMessages(prev => ({
        ...prev,
        [videoId]: 'Iniciando transcripción...'
      }));
      
      const result = await TranscriptionService.startTranscription({
        videoId,
        videoS3Key,
        language,
        enableSpeakerIdentification: false,
        enableAutomaticPunctuation: true
      });
      
      console.log(`✅ Transcripción iniciada: ${result.jobName}`);
      
      setTranscriptionMessages(prev => ({
        ...prev,
        [videoId]: `Job iniciado: ${result.jobName}`
      }));
      
      // Iniciar polling para este video
      startVideoPolling(videoId);
      
    } catch (error) {
      console.error('❌ Error iniciando transcripción:', error);
      
      // Actualizar estado de error
      setVideos(prevVideos => 
        prevVideos.map(video => 
          video.id === videoId 
            ? { ...video, transcriptionStatus: 'failed' }
            : video
        )
      );
      
      setTranscriptionMessages(prev => ({
        ...prev,
        [videoId]: 'Error iniciando transcripción'
      }));
      
      alert('Error iniciando transcripción. Revisa la consola para más detalles.');
    }
  };

  // Polling para un video específico
  const startVideoPolling = useCallback((videoId: string) => {
    if (pollingVideos.has(videoId)) {
      console.log(`⚠️ Ya hay polling activo para video ${videoId}`);
      return;
    }

    console.log(`🚀 Iniciando polling para video ${videoId}`);
    setPollingVideos(prev => new Set([...prev, videoId]));

    const pollInterval = setInterval(async () => {
      try {
        const progress = await TranscriptionService.checkProgress(videoId);
        
        console.log(`📊 Progreso video ${videoId}:`, progress);
        
        setTranscriptionProgress(prev => ({
          ...prev,
          [videoId]: progress.progress
        }));
        
        setTranscriptionMessages(prev => ({
          ...prev,
          [videoId]: progress.message
        }));
        
        if (progress.status === 'completed') {
          // Actualizar video con transcripción completada
          setVideos(prevVideos => 
            prevVideos.map(video => 
              video.id === videoId 
                ? { 
                    ...video, 
                    transcriptionStatus: 'completed',
                    hasTranscription: true,
                    transcription: progress.transcriptionText 
                  }
                : video
            )
          );
          
          // Detener polling
          clearInterval(pollInterval);
          setPollingVideos(prev => {
            const newSet = new Set(prev);
            newSet.delete(videoId);
            return newSet;
          });
          
          console.log(`✅ Transcripción completada para video ${videoId}`);
          
        } else if (progress.status === 'failed') {
          // Actualizar video con error
          setVideos(prevVideos => 
            prevVideos.map(video => 
              video.id === videoId 
                ? { ...video, transcriptionStatus: 'failed' }
                : video
            )
          );
          
          // Detener polling
          clearInterval(pollInterval);
          setPollingVideos(prev => {
            const newSet = new Set(prev);
            newSet.delete(videoId);
            return newSet;
          });
          
          console.log(`❌ Transcripción falló para video ${videoId}: ${progress.error}`);
        }
        
      } catch (error) {
        console.error(`❌ Error verificando progreso de ${videoId}:`, error);
        
        // Detener polling en caso de error
        clearInterval(pollInterval);
        setPollingVideos(prev => {
          const newSet = new Set(prev);
          newSet.delete(videoId);
          return newSet;
        });
      }
    }, 10000); // Check cada 10 segundos (menos frecuente que en VideoViewer)

    // Auto-stop después de 20 minutos
    setTimeout(() => {
      clearInterval(pollInterval);
      setPollingVideos(prev => {
        const newSet = new Set(prev);
        newSet.delete(videoId);
        return newSet;
      });
    }, 1200000); // 20 minutos
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollingVideos]);

  // Retry transcription
  const retryTranscription = async (videoId: string, s3Key: string, language: string) => {
    await startTranscription(videoId, s3Key, language);
  };

// Test S3 connectivity
const testS3Connection = useCallback(async () => {
  try {
    addDebugInfo('Testing S3 connectivity...');
    const listResult = await list({ path: 'videos/' });
    addDebugInfo(`S3 List Result: Found ${listResult.items.length} items`);
    
    if (listResult.items.length > 0) {
      const firstItem = listResult.items[0];
      addDebugInfo(`First S3 item: ${firstItem.path}`);
      
      try {
        await getUrl({ path: firstItem.path });
        addDebugInfo(`✅ S3 URL generation successful`);
        return true;
      } catch (urlError) {
        addDebugInfo(`❌ S3 URL generation failed: ${urlError}`);
        return false;
      }
    } else {
      addDebugInfo('No items found in S3 videos/ folder');
      return true;
    }
  } catch (error) {
    addDebugInfo(`❌ S3 connectivity test failed: ${error}`);
    return false;
  }
}, [addDebugInfo]); // ✅ Agregada la dependencia addDebugInfo

// Test DynamoDB connectivity
const testDynamoDBConnection = useCallback(async () => {
  try {
    addDebugInfo('Testing DynamoDB connectivity...');
    const result = await client.models.Video.list({});
    addDebugInfo(`DynamoDB Result: Found ${result.data?.length || 0} records`);
    addDebugInfo(`DynamoDB Errors: ${result.errors?.length || 0} errors`);
    
    if (result.errors && result.errors.length > 0) {
      result.errors.forEach((error, index) => {
        addDebugInfo(`DynamoDB Error ${index + 1}: ${error.message}`);
      });
    }
    
    return result;
  } catch (error) {
    addDebugInfo(`❌ DynamoDB connectivity test failed: ${error}`);
    throw error;
  }
}, [addDebugInfo]); // ✅ Agregada la dependencia addDebugInfo

  const processVideosData = useCallback(async (dbVideos: DatabaseVideo[]) => {
    console.log(`Processing ${dbVideos.length} videos from database`);
    
    if (!dbVideos || dbVideos.length === 0) {
      console.log('No videos to process');
      setVideos([]);
      return;
    }

    const processedVideos = await Promise.all(
      dbVideos.map(async (video, index) => {
        try {
          console.log(`Processing video ${index + 1}: ${video.s3Key}`);
          
          let signedUrl = '';
          try {
            const urlResult = await getUrl({ path: video.s3Key });
            signedUrl = urlResult.url.toString();
            console.log(`✅ Got signed URL for ${video.s3Key}`);
          } catch (urlError) {
            console.log(`❌ Failed to get URL for ${video.s3Key}: ${urlError}`);
            signedUrl = `#error-${video.id}`;
          }

          const processedVideo = {
            id: video.id,
            title: video.title || 'Untitled Video',
            description: video.description || 'No description',
            s3Key: video.s3Key,
            s3Url: signedUrl,
            language: video.language || 'english',
            quality: video.quality || 'medium',
            duration: formatDuration(video.duration || 0),
            fileSize: formatFileSize(video.fileSize || 0),
            uploadedAt: formatDate(video.uploadedAt || new Date().toISOString()),
            thumbnail: generateThumbnailUrl(video.title || 'Video'),
            status: video.status || 'completed',
            transcriptionStatus: video.transcriptionStatus || 'not_started',
            transcriptionJobName: video.transcriptionJobName || undefined,
            hasTranscription: !!(video.transcription || video.transcriptionText) && 
                              ((video.transcription?.trim() && video.transcription.trim().length > 0) || 
                               (video.transcriptionText?.trim() && video.transcriptionText.trim().length > 0)),
            transcription: video.transcription || video.transcriptionText || undefined
          } as VideoItem;

          console.log(`✅ Processed video: ${processedVideo.title} (Transcription: ${processedVideo.transcriptionStatus})`);
          
          // Si el video está en progreso, iniciar polling
          if (processedVideo.transcriptionStatus === 'in_progress') {
            console.log(`🔄 Video ${video.id} en progreso, iniciando polling...`);
            setTimeout(() => startVideoPolling(video.id), 2000); // Delay para evitar sobrecarga
          }
          
          return processedVideo;
        } catch (error) {
          console.log(`❌ Error processing video ${video.id}: ${error}`);
          return null;
        }
      })
    );

    const validVideos = processedVideos.filter((video): video is VideoItem => video !== null);
    console.log(`✅ Successfully processed ${validVideos.length}/${dbVideos.length} videos`);
    setVideos(validVideos);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startVideoPolling]);

  const loadVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo([]);
      
      addDebugInfo('=== STARTING VIDEO LOAD PROCESS ===');
      
      // Test S3 first
      const s3Works = await testS3Connection();
      if (!s3Works) {
        setError('S3 connectivity issues detected. Check console for details.');
        return;
      }
      
      // Test DynamoDB
      const result = await testDynamoDBConnection();
      
      if (result.data && result.data.length > 0) {
        addDebugInfo(`Found ${result.data.length} videos in DynamoDB`);
        await processVideosData(result.data as DatabaseVideo[]);
      } else {
        addDebugInfo('No videos found in DynamoDB');
        setVideos([]);
      }
      
      addDebugInfo('=== VIDEO LOAD PROCESS COMPLETE ===');
    } catch (err) {
      const errorMessage = `Failed to load videos: ${err instanceof Error ? err.message : 'Unknown error'}`;
      addDebugInfo(`❌ ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processVideosData, testS3Connection, testDynamoDBConnection]);

  // CRUD Operations
  const handleEditStart = (video: VideoItem) => {
    console.log('🖊️ Starting edit for video:', video.title);
    setEditingId(video.id);
    setEditTitle(video.title);
    setEditDescription(video.description);
    setEditLanguage(video.language);
    setEditQuality(video.quality);
  };

  const handleEditSave = async (id: string) => {
    if (!editTitle.trim()) {
      alert('Title cannot be empty');
      return;
    }

    setSaving(true);
    try {
      console.log('💾 Saving video updates:', id);
      addDebugInfo(`Updating video ${id} with new data`);
      
      const updateResult = await client.models.Video.update({
        id,
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        language: editLanguage,
        quality: editQuality
      });

      if (updateResult.errors && updateResult.errors.length > 0) {
        throw new Error(updateResult.errors[0].message);
      }

      console.log('✅ Video updated successfully:', updateResult);
      addDebugInfo(`✅ Video ${id} updated successfully`);

      // Update local state immediately
      setVideos(prevVideos =>
        prevVideos.map(video =>
          video.id === id
            ? {
                ...video,
                title: editTitle.trim(),
                description: editDescription.trim() || 'No description',
                language: editLanguage,
                quality: editQuality
              }
            : video
        )
      );

      // Clear editing state
      handleEditCancel();
      
      alert('Video updated successfully!');

    } catch (error) {
      console.error('❌ Error updating video:', error);
      addDebugInfo(`❌ Failed to update video ${id}: ${error}`);
      alert(`Failed to update video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEditCancel = () => {
    console.log('❌ Canceling edit');
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    setEditLanguage("");
    setEditQuality("");
  };

  const handleViewVideo = (video: VideoItem) => {
    console.log('🎥 Opening video viewer for:', video.title);
    addDebugInfo(`Opening video viewer for: ${video.title}`);
    onViewVideo(video);
  };

  // Manual create test video with transcription
  const createTestVideo = async () => {
    try {
      addDebugInfo('Creating test video with transcription in DynamoDB...');
      
      const testVideo = await client.models.Video.create({
        title: 'Test Video with Transcription',
        description: 'This is a test video created for debugging with transcription enabled',
        s3Key: 'videos/test-video-transcribe.mp4',
        language: 'english',
        quality: 'high',
        transcriptionText: 'This is a test transcription. Hello and welcome to this test video. We are demonstrating the transcription functionality powered by AWS Transcribe. The system can automatically convert speech to text in multiple languages. This feature makes videos more accessible and searchable.',
        transcriptionStatus: 'completed',
        transcriptionJobName: 'test_job_' + Date.now(),
        duration: 120,
        fileSize: 1024 * 1024 * 50, // 50MB
        mimeType: 'video/mp4',
        uploadedAt: new Date().toISOString(),
        status: 'completed'
      });
      
      if (testVideo.data && !Array.isArray(testVideo.data)) {
        const videoData = testVideo.data as { id?: string };
        const videoId = videoData.id;
        if (videoId) {
          addDebugInfo(`✅ Test video with transcription created: ${videoId}`);
        } else {
          addDebugInfo(`❌ Failed to get video ID from created test video`);
        }
      } else {
        addDebugInfo(`❌ Failed to get video ID from created test video`);
      }
      
      loadVideos(); // Reload to see the new video
    } catch (error) {
      addDebugInfo(`❌ Failed to create test video: ${error}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this video? This will also remove any transcription data.")) return;

    try {
      const video = videos.find(v => v.id === id);
      if (!video) return;

      console.log('🗑️ Deleting video:', video.title);
      addDebugInfo(`Deleting video: ${video.title}`);

      // Delete from S3 (optional - file might not exist)
      try {
        await remove({ path: video.s3Key });
        addDebugInfo(`✅ S3 file deleted: ${video.s3Key}`);
      } catch (s3Error) {
        console.warn('⚠️ S3 deletion failed (file may not exist):', s3Error);
        addDebugInfo(`⚠️ S3 deletion failed: ${s3Error}`);
      }

      // Delete from DynamoDB
      await client.models.Video.delete({ id });
      addDebugInfo(`✅ Database record deleted: ${id}`);

      // Update local state
      setVideos(videos.filter(video => video.id !== id));
      setSelectedVideos(selectedVideos.filter(selectedId => selectedId !== id));

      console.log('✅ Video deleted successfully');
      alert('Video and transcription data deleted successfully!');

    } catch (error) {
      console.error('❌ Error deleting video:', error);
      addDebugInfo(`❌ Failed to delete video: ${error}`);
      alert('Failed to delete video. Please try again.');
    }
  };

  useEffect(() => {
    addDebugInfo('VideoManager component mounted');
    loadVideos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadVideos]);

  const filteredVideos = videos.filter(video =>
    video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredVideos.length / videosPerPage);
  const startIndex = (currentPage - 1) * videosPerPage;
  const endIndex = startIndex + videosPerPage;
  const currentVideos = filteredVideos.slice(startIndex, endIndex);

  const toggleSelectVideo = (id: string) => {
    setSelectedVideos(prev =>
      prev.includes(id) ? prev.filter(vid => vid !== id) : [...prev, id]
    );
  };

  const selectAllVideos = () => {
    setSelectedVideos(currentVideos.map(video => video.id));
  };

  const deselectAllVideos = () => {
    setSelectedVideos([]);
  };

  const handleBulkDelete = async () => {
    if (selectedVideos.length === 0) return;
    if (!window.confirm(`Delete ${selectedVideos.length} selected videos? This will remove them from S3, the database, and any transcription data.`)) return;

    try {
      console.log('🗑️ Bulk deleting videos:', selectedVideos);
      addDebugInfo(`Starting bulk delete of ${selectedVideos.length} videos`);

      await Promise.all(selectedVideos.map(async (videoId) => {
        const video = videos.find(v => v.id === videoId);
        if (!video) return;

        // Delete from S3 (optional - file might not exist)
        try {
          await remove({ path: video.s3Key });
          addDebugInfo(`✅ S3 file deleted: ${video.s3Key}`);
        } catch (s3Error) {
          console.warn(`⚠️ S3 deletion failed for ${video.s3Key}:`, s3Error);
          addDebugInfo(`⚠️ S3 deletion failed: ${s3Error}`);
        }

        // Delete from DynamoDB
        await client.models.Video.delete({ id: videoId });
        addDebugInfo(`✅ Database record deleted: ${videoId}`);
      }));

      // Update local state
      setVideos(videos.filter(video => !selectedVideos.includes(video.id)));
      setSelectedVideos([]);

      console.log('✅ Bulk deletion completed');
      addDebugInfo(`✅ Bulk deletion completed: ${selectedVideos.length} videos deleted`);
      alert(`Successfully deleted ${selectedVideos.length} videos and their transcription data!`);

    } catch (error) {
      console.error('❌ Error during bulk deletion:', error);
      addDebugInfo(`❌ Bulk deletion failed: ${error}`);
      alert('Some videos failed to delete. Please try again.');
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (loading) {
    return (
      <div className="video-manager">
        <header className="header">
          <div className="header-left">
            <h1 className="logo">🎬 File Uploader</h1>
          </div>
        </header>
        <main className="manager-content">
          <div className="loading-state">
            <div className="loading-icon">⏳</div>
            <h3>Loading videos...</h3>
            <p>Running diagnostics...</p>
            
            <div className="debug-info">
              <h4>Debug Log:</h4>
              <div className="debug-messages">
                {debugInfo.map((message, index) => (
                  <div key={index} className="debug-message">{message}</div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-manager">
        <header className="header">
          <div className="header-left">
            <h1 className="logo">🎬 File Uploader</h1>
          </div>
        </header>
        <main className="manager-content">
          <div className="error-state">
            <div className="error-icon">❌</div>
            <h3>Error loading videos</h3>
            <p>{error}</p>
            
            <div className="debug-info">
              <h4>Debug Log:</h4>
              <div className="debug-messages">
                {debugInfo.map((message, index) => (
                  <div key={index} className="debug-message">{message}</div>
                ))}
              </div>
            </div>
            
            <div className="error-actions">
              <button className="action-btn primary" onClick={loadVideos}>
                Retry
              </button>
              <button className="action-btn secondary" onClick={createTestVideo}>
                Create Test Video
              </button>
              <button className="action-btn secondary" onClick={() => {
                setError(null);
                setVideos([]);
              }}>
                Clear Error
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="video-manager">
      <header className="header">
        <div className="header-left">
          <h1 className="logo">🎬 File Uploader</h1>
        </div>
        <div className="header-right">
          <button className="header-btn primary" onClick={onUploadNew}>Upload</button>
          <button className="header-btn">Upload Videos</button>
          <button className="header-btn">Export Options</button>
        </div>
      </header>

      <main className="manager-content">
        <div className="manager-header">
          <div className="manager-title">
            <h2>Video Library with AWS Transcribe</h2>
            <span className="video-count">
              {filteredVideos.length} videos found
            </span>
          </div>
          
          <div className="manager-actions">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search videos..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="search-icon">🔍</span>
            </div>
            
            <button className="action-btn primary" onClick={onUploadNew}>
              + Add New Video
            </button>
          </div>
        </div>

        {/* Debug Panel */}
        <div className="debug-panel">
          <details>
            <summary>🔧 Debug Information ({debugInfo.length} messages)</summary>
            <div className="debug-info">
              <div className="debug-actions">
                <button className="debug-btn" onClick={loadVideos}>Reload Videos</button>
                <button className="debug-btn" onClick={createTestVideo}>Create Test Video</button>
                <button className="debug-btn" onClick={() => setDebugInfo([])}>Clear Log</button>
              </div>
              <div className="debug-messages">
                {debugInfo.map((message, index) => (
                  <div key={index} className="debug-message">{message}</div>
                ))}
              </div>
            </div>
          </details>
        </div>

        {/* === NUEVA SECCIÓN: TRANSCRIPTION STATUS OVERVIEW === */}
        {videos.length > 0 && (
          <div className="transcription-overview" style={{
            backgroundColor: 'white',
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '20px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>🎤 Estado de Transcripciones</h4>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              {(() => {
                const completed = videos.filter(v => v.hasTranscription).length;
                const inProgress = videos.filter(v => v.transcriptionStatus === 'in_progress').length;
                const failed = videos.filter(v => v.transcriptionStatus === 'failed').length;
                const notStarted = videos.filter(v => v.transcriptionStatus === 'not_started' || !v.transcriptionStatus).length;
                
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ color: '#28a745', fontWeight: 'bold' }}>✅ {completed}</span>
                      <span style={{ fontSize: '14px', color: '#6c757d' }}>Completadas</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ color: '#ffc107', fontWeight: 'bold' }}>⏳ {inProgress}</span>
                      <span style={{ fontSize: '14px', color: '#6c757d' }}>En Progreso</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ color: '#dc3545', fontWeight: 'bold' }}>❌ {failed}</span>
                      <span style={{ fontSize: '14px', color: '#6c757d' }}>Con Error</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ color: '#6c757d', fontWeight: 'bold' }}>⏸️ {notStarted}</span>
                      <span style={{ fontSize: '14px', color: '#6c757d' }}>Sin Iniciar</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedVideos.length > 0 && (
          <div className="bulk-actions">
            <span className="selection-count">{selectedVideos.length} videos selected</span>
            <div className="bulk-buttons">
              <button className="bulk-btn secondary" onClick={deselectAllVideos}>
                Deselect All
              </button>
              <button className="bulk-btn danger" onClick={handleBulkDelete}>
                Delete Selected ({selectedVideos.length})
              </button>
            </div>
          </div>
        )}

        {/* Manager Controls */}
        <div className="manager-controls">
          <div className="select-actions">
            <button className="control-btn purple" onClick={selectAllVideos}>
              Select All on Page ({currentVideos.length})
            </button>
            <button className="control-btn purple" onClick={deselectAllVideos}>
              Deselect All
            </button>
          </div>
          
          <div className="pagination-info">
            <span>
              Page {currentPage} of {totalPages} | 
              Showing {currentVideos.length} of {filteredVideos.length} videos
            </span>
          </div>
        </div>

        <div className="videos-table">
          {currentVideos.map((video) => {
            const transcriptionBadge = getTranscriptionBadge(video.transcriptionStatus, video.hasTranscription);
            const isPolling = pollingVideos.has(video.id);
            const progress = transcriptionProgress[video.id] || 0;
            const message = transcriptionMessages[video.id] || '';
            
            return (
              <div key={video.id} className={`video-row ${selectedVideos.includes(video.id) ? 'selected' : ''}`}>
                <div className="video-row-content">
                  <div className="video-checkbox-container">
                    <input
                      type="checkbox"
                      className="video-checkbox"
                      checked={selectedVideos.includes(video.id)}
                      onChange={() => toggleSelectVideo(video.id)}
                    />
                  </div>

                  <div className="video-thumbnail-small" onClick={() => handleViewVideo(video)}>
                    <img src={video.thumbnail} alt={video.title} />
                    <div className="play-overlay-small">
                      <div className="play-button-small">▶</div>
                    </div>
                    <div className="duration-badge-small">{video.duration}</div>
                    <div className="s3-badge">S3</div>
                    {/* Transcription status badge on thumbnail */}
                    <div className="transcription-badge" style={{ 
                      position: 'absolute', 
                      top: '5px', 
                      right: '5px', 
                      backgroundColor: transcriptionBadge.color, 
                      color: 'white', 
                      padding: '2px 6px', 
                      borderRadius: '10px', 
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>
                      {transcriptionBadge.icon}
                    </div>
                  </div>

                  <div className="video-details">
                    {editingId === video.id ? (
                      // EDIT MODE
                      <div className="edit-form-inline">
                        <div className="edit-row">
                          <div className="edit-field">
                            <label>Title:</label>
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="edit-input"
                              disabled={saving}
                              placeholder="Enter video title"
                            />
                          </div>
                          <div className="edit-field">
                            <label>Language:</label>
                            <select
                              value={editLanguage}
                              onChange={(e) => setEditLanguage(e.target.value)}
                              className="edit-select"
                              disabled={saving}
                            >
                              {languages.map(lang => (
                                <option key={lang.value} value={lang.value}>
                                  {lang.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="edit-field">
                            <label>Quality:</label>
                            <select
                              value={editQuality}
                              onChange={(e) => setEditQuality(e.target.value)}
                              className="edit-select"
                              disabled={saving}
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                        </div>
                        <div className="edit-field">
                          <label>Description:</label>
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="edit-textarea"
                            disabled={saving}
                            placeholder="Enter video description"
                            rows={2}
                          />
                        </div>
                        <div className="edit-buttons">
                          <button 
                            className="save-btn" 
                            onClick={() => handleEditSave(video.id)}
                            disabled={saving || !editTitle.trim()}
                          >
                            {saving ? '💾 Saving...' : '💾 Save'}
                          </button>
                          <button 
                            className="cancel-btn" 
                            onClick={handleEditCancel}
                            disabled={saving}
                          >
                            ❌ Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // VIEW MODE
                      <>
                        <h3 className="video-title-row" onClick={() => handleViewVideo(video)}>
                          {video.title}
                          {video.status === 'processing' && <span className="status-badge processing">Processing</span>}
                          {video.status === 'failed' && <span className="status-badge failed">Failed</span>}
                        </h3>
                        <p className="video-description-row">{video.description}</p>
                        
                        {/* === NUEVA SECCIÓN: TRANSCRIPTION STATUS CON PROGRESO === */}
                        <div className="transcription-status-row" style={{ 
                          margin: '8px 0', 
                          padding: '8px 12px', 
                          backgroundColor: '#f8f9fa', 
                          borderRadius: '8px',
                          border: `1px solid ${transcriptionBadge.color}20`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                            <span style={{ 
                              color: transcriptionBadge.color, 
                              fontWeight: 'bold', 
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}>
                              {transcriptionBadge.icon} {transcriptionBadge.text}
                              {isPolling && <span style={{ fontSize: '10px', color: '#ffc107' }}>🔄</span>}
                            </span>
                            
                            {/* Progress percentage */}
                            {video.transcriptionStatus === 'in_progress' && (
                              <span style={{ fontSize: '11px', fontWeight: 'bold', color: transcriptionBadge.color }}>
                                {progress}%
                              </span>
                            )}
                          </div>
                          
                          {/* Progress bar for in-progress transcriptions */}
                          {video.transcriptionStatus === 'in_progress' && (
                            <div style={{
                              width: '100%',
                              height: '4px',
                              backgroundColor: '#e9ecef',
                              borderRadius: '2px',
                              overflow: 'hidden',
                              marginBottom: '5px'
                            }}>
                              <div style={{
                                width: `${progress}%`,
                                height: '100%',
                                backgroundColor: transcriptionBadge.color,
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          )}
                          
                          {/* Status message */}
                          {message && (
                            <div style={{ fontSize: '11px', color: '#6c757d', fontStyle: 'italic' }}>
                              {message}
                            </div>
                          )}
                          
                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                            {video.transcriptionStatus === 'not_started' && (
                              <button 
                                onClick={() => startTranscription(video.id, video.s3Key, video.language)}
                                style={{
                                  background: '#28a745',
                                  color: 'white',
                                  border: 'none',
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                  fontSize: '10px',
                                  cursor: 'pointer'
                                }}
                              >
                                🚀 Iniciar
                              </button>
                            )}
                            
                            {video.transcriptionStatus === 'failed' && (
                              <button 
                                onClick={() => retryTranscription(video.id, video.s3Key, video.language)}
                                style={{
                                  background: '#ffc107',
                                  color: '#212529',
                                  border: 'none',
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                  fontSize: '10px',
                                  cursor: 'pointer'
                                }}
                              >
                                🔄 Reintentar
                              </button>
                            )}
                            
                            {video.hasTranscription && (
                              <span style={{ 
                                background: '#d4edda',
                                color: '#155724',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '10px',
                                fontWeight: 'bold'
                              }}>
                                📝 Texto Disponible
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="video-meta-row">
                          <span className="meta-item">📅 {video.uploadedAt}</span>
                          <span className="meta-item">📏 {video.fileSize}</span>
                          <span className="meta-item">🌐 {video.language}</span>
                          <span className={`quality-badge ${video.quality}`}>{video.quality.toUpperCase()}</span>
                          <span className="meta-item s3-path">🗂️ {video.s3Key}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="video-actions-row">
                    {editingId !== video.id && (
                      <>
                        <button 
                          className="action-icon-large edit"
                          onClick={() => handleEditStart(video)}
                          title="Edit video metadata"
                        >
                          ✏️ Edit
                        </button>
                        <button 
                          className="action-icon-large view"
                          onClick={() => handleViewVideo(video)}
                          title="View video"
                        >
                          👁️ View
                        </button>
                        {!video.hasTranscription && video.transcriptionStatus !== 'in_progress' && (
                          <button 
                            className="action-icon-large success"
                            onClick={() => startTranscription(video.id, video.s3Key, video.language)}
                            title="Start transcription"
                          >
                            🎤 Transcribir
                          </button>
                        )}
                        {video.transcriptionStatus === 'failed' && (
                          <button 
                            className="action-icon-large warning"
                            onClick={() => retryTranscription(video.id, video.s3Key, video.language)}
                            title="Retry transcription"
                          >
                            🔄 Retry
                          </button>
                        )}
                        <button 
                          className="action-icon-large danger"
                          onClick={() => handleDelete(video.id)}
                          title="Delete video and transcription"
                        >
                          🗑️ Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredVideos.length === 0 && !loading && (
          <div className="empty-state">
            <div className="empty-icon">📹</div>
            <h3>No videos found</h3>
            <p>
              {searchTerm 
                ? "Try adjusting your search terms" 
                : "Upload your first video with automatic transcription"
              }
            </p>
            <div className="empty-actions">
              <button className="action-btn primary" onClick={onUploadNew}>
                Upload Video with Transcription
              </button>
              <button className="action-btn secondary" onClick={createTestVideo}>
                Create Test Video
              </button>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button 
              className="pagination-btn" 
              onClick={goToPrevPage} 
              disabled={currentPage === 1}
            >
              ← Previous
            </button>
            
            <div className="pagination-numbers">
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                let page;
                if (totalPages <= 10) {
                  page = i + 1;
                } else {
                  // Show pages around current page
                  const start = Math.max(1, currentPage - 4);
                  const end = Math.min(totalPages, start + 9);
                  page = start + i;
                  if (page > end) return null;
                }
                
                return (
                  <button
                    key={page}
                    className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                    onClick={() => goToPage(page)}
                  >
                    {page}
                  </button>
                );
              }).filter(Boolean)}
              
              {totalPages > 10 && currentPage < totalPages - 5 && (
                <>
                  <span className="pagination-ellipsis">...</span>
                  <button
                    className="pagination-number"
                    onClick={() => goToPage(totalPages)}
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>
            
            <button 
              className="pagination-btn" 
              onClick={goToNextPage} 
              disabled={currentPage === totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </main>

      <div className="manager-footer">
        <button className="footer-btn secondary" onClick={onBack}>
          ← Back to Home
        </button>
        <div className="storage-info">
          <span>S3 + AWS Transcribe | Debug: {debugInfo.length} logs | Polling: {pollingVideos.size} videos</span>
        </div>
      </div>
    </div>
  );
};

export default VideoManager;