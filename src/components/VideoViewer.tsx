// components/VideoViewer.tsx - CON TRANSCRIPCIÓN EN TIEMPO REAL - ERRORES CORREGIDOS
import { useState, useRef, useEffect, useCallback } from "react";
import { getUrl } from "aws-amplify/storage";
import { VideoData } from "../App";
import TranscriptionService from "../../services/transcriptionService";

interface VideoViewerProps {
  videoData: VideoData;
  onBack: () => void;
  onExportOptions: () => void;
}

const VideoViewer: React.FC<VideoViewerProps> = ({ 
  videoData, 
  onBack, 
  onExportOptions 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [urlLoading, setUrlLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<string>('Initializing...');
  const [retryCount, setRetryCount] = useState(0);
  
  // === NUEVOS ESTADOS PARA TRANSCRIPCIÓN ===
  const [transcriptionStatus, setTranscriptionStatus] = useState<'not_started' | 'in_progress' | 'completed' | 'failed'>('not_started');
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [transcriptionMessage, setTranscriptionMessage] = useState('');
  const [transcriptionText, setTranscriptionText] = useState('');
  const [transcriptionConfidence, setTranscriptionConfidence] = useState(0);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // === CARGAR VIDEO DESDE S3 ===
  useEffect(() => {
    console.log('🎥 VideoViewer mounted with data:', {
      title: videoData.title,
      s3Key: videoData.s3Key,
      s3Url: videoData.s3Url,
      fileSize: videoData.fileSize,
      mimeType: videoData.mimeType,
      transcription: videoData.transcription
    });
    
    (async () => {
      try {
        setUrlLoading(true);
        setError(null);
        setLoadingStage('Connecting to S3...');
        
        console.log('🔗 Loading video from S3:', videoData.s3Key);
        console.log('🔗 Existing URL:', videoData.s3Url);
        
        // Method 1: Try using existing s3Url if it looks valid and not expired
        if (videoData.s3Url && 
            videoData.s3Url !== '' && 
            !videoData.s3Url.startsWith('#') && 
            (videoData.s3Url.includes('http') || videoData.s3Url.includes('amazonaws.com'))) {
          
          console.log('🔄 Trying existing signed URL first...');
          setLoadingStage('Testing existing URL...');
          
          try {
            const response = await fetch(videoData.s3Url, { method: 'HEAD' });
            if (response.ok) {
              console.log('✅ Existing URL is valid, using it');
              setLoadingStage('Using existing URL...');
              setVideoUrl(videoData.s3Url);
              return;
            } else {
              console.log('⚠️ Existing URL expired or invalid, generating new one');
            }
          } catch (testError) {
            console.log('⚠️ Existing URL test failed, generating new one');
          }
        }
        
        // Method 2: Generate new signed URL
        setLoadingStage('Generating new signed URL...');
        console.log('🔄 Generating new signed URL for:', videoData.s3Key);
        
        const urlResult = await getUrl({ 
          path: videoData.s3Key,
          options: {
            expiresIn: 3600, // 1 hour
            useAccelerateEndpoint: false,
            validateObjectExistence: true
          }
        });
        
        const signedUrl = urlResult.url.toString();
        console.log('✅ Generated new signed URL:', signedUrl.substring(0, 100) + '...');
        
        setLoadingStage('New URL generated, loading video...');
        setVideoUrl(signedUrl);
        
      } catch (err) {
        console.error('❌ Error loading video from S3:', err);
        setLoadingStage('Failed to load from S3');
        
        let errorMessage = 'Failed to load video from S3. ';
        if (err instanceof Error) {
          console.error('Error details:', err.message);
          
          if (err.message.includes('NotFound') || err.message.includes('NoSuchKey')) {
            errorMessage = `Video file "${videoData.s3Key}" not found in S3. The file may have been deleted or the key is incorrect.`;
          } else if (err.message.includes('AccessDenied')) {
            errorMessage = 'Access denied to S3. Check permissions and authentication settings.';
          } else {
            errorMessage += `Error: ${err.message}`;
          }
        }
        
        setError(errorMessage);
        
        if (retryCount < 2) {
          console.log('🔄 Will show fallback demo video...');
          setLoadingStage('Loading demo video as fallback...');
          
          try {
            const demoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
            console.log('🎬 Loading demo video:', demoUrl);
            setVideoUrl(demoUrl);
            setError(`Could not load "${videoData.title}". Showing demo video instead. Original error: ${errorMessage}`);
          } catch (fallbackError) {
            console.error('❌ Demo video fallback also failed:', fallbackError);
            setError('Failed to load video. Please check your connection and try again.');
            setUrlLoading(false);
          }
        } else {
          setUrlLoading(false);
        }
      }
    })();
  }, [videoData.s3Key, videoData.s3Url, videoData.title, videoData.fileSize, videoData.mimeType, videoData.transcription, retryCount]);

  // === POLLING PARA MONITOREAR TRANSCRIPCIÓN ===
  const startTranscriptionPolling = useCallback(() => {
    if (isPolling) {
      console.log('⚠️ Polling already active, skipping...');
      return;
    }

    console.log('🚀 Starting transcription polling...');
    setIsPolling(true);

    const pollInterval = setInterval(async () => {
      try {
        console.log('🔍 Checking transcription progress...');
        
        if (!videoData.id) {
          console.error('❌ No video ID available');
          clearInterval(pollInterval);
          setIsPolling(false);
          return;
        }
        
        const progress = await TranscriptionService.checkProgress(videoData.id);
        
        console.log('📊 Transcription progress:', progress);
        
        setTranscriptionProgress(progress.progress);
        setTranscriptionMessage(progress.message);
        setTranscriptionError(progress.error || null);
        
        if (progress.status === 'completed') {
          setTranscriptionStatus('completed');
          setTranscriptionText(progress.transcriptionText || '');
          setTranscriptionConfidence(progress.confidence || 0);
          setTranscriptionMessage('Transcripción completada exitosamente');
          clearInterval(pollInterval);
          setIsPolling(false);
          console.log('✅ Transcription completed!');
          
        } else if (progress.status === 'failed') {
          setTranscriptionStatus('failed');
          setTranscriptionError(progress.error || 'Error desconocido');
          setTranscriptionMessage('Transcripción falló');
          clearInterval(pollInterval);
          setIsPolling(false);
          console.log('❌ Transcription failed:', progress.error);
          
        } else if (progress.status === 'in_progress') {
          setTranscriptionStatus('in_progress');
        }
        
      } catch (error) {
        console.error('❌ Error checking transcription progress:', error);
        setTranscriptionError('Error verificando progreso');
        clearInterval(pollInterval);
        setIsPolling(false);
      }
    }, 5000); // Check every 5 seconds

    // Auto-stop polling after 15 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setIsPolling(false);
      if (transcriptionStatus === 'in_progress') {
        setTranscriptionMessage('Transcripción tomó más tiempo del esperado');
      }
    }, 900000); // 15 minutes
  }, [isPolling, videoData.id, transcriptionStatus]);

  // === INICIALIZAR ESTADO DE TRANSCRIPCIÓN ===
  useEffect(() => {
    console.log('🎤 Initializing transcription state...');
    
    // Usar 'transcription' en lugar de 'transcriptionStatus' que no existe en VideoData
    const initialStatus = videoData.transcription ? 'completed' : 'not_started';
    const initialText = videoData.transcription || '';
    
    setTranscriptionStatus(initialStatus as 'not_started' | 'in_progress' | 'completed' | 'failed');
    setTranscriptionText(initialText);
    
    console.log('📊 Initial transcription state:', {
      status: initialStatus,
      hasText: !!initialText
    });

    // Si la transcripción está en progreso, iniciar polling
    // Como no tenemos transcriptionStatus, asumimos que si no hay texto pero 
    // debería haber, está en progreso
    if (!initialText && videoData.language) {
      console.log('🔄 No transcription found, might be in progress...');
      // Podrías iniciar polling aquí si es necesario
    }
  }, [videoData.id, videoData.transcription, videoData.language, startTranscriptionPolling]);

  // === FUNCIONES DE TRANSCRIPCIÓN ===
  const startTranscription = async () => {
    try {
      console.log('🚀 Starting transcription for video:', videoData.id);
      
      if (!videoData.id) {
        throw new Error('No video ID available');
      }
      
      setTranscriptionStatus('in_progress');
      setTranscriptionMessage('Iniciando transcripción...');
      setTranscriptionError(null);
      setTranscriptionProgress(0);
      
      const result = await TranscriptionService.startTranscription({
        videoId: videoData.id,
        videoS3Key: videoData.s3Key,
        language: videoData.language || 'english',
        enableSpeakerIdentification: false,
        enableAutomaticPunctuation: true
      });
      
      console.log('✅ Transcription started:', result);
      setTranscriptionMessage(`Job iniciado: ${result.jobName}`);
      
      // Start polling
      startTranscriptionPolling();
      
    } catch (error) {
      console.error('❌ Error starting transcription:', error);
      setTranscriptionStatus('failed');
      setTranscriptionError(error instanceof Error ? error.message : 'Error desconocido');
      setTranscriptionMessage('Error iniciando transcripción');
    }
  };

  const cancelTranscription = async () => {
    try {
      console.log('🛑 Canceling transcription...');
      
      if (!videoData.id) {
        throw new Error('No video ID available');
      }
      
      await TranscriptionService.cancelTranscription(videoData.id);
      
      setTranscriptionStatus('failed');
      setTranscriptionMessage('Transcripción cancelada');
      setTranscriptionError('Cancelado por el usuario');
      setIsPolling(false);
      
      console.log('✅ Transcription canceled');
      
    } catch (error) {
      console.error('❌ Error canceling transcription:', error);
      alert('Error cancelando transcripción');
    }
  };

  const copyTranscription = () => {
    if (!transcriptionText) {
      alert('No hay transcripción disponible para copiar.');
      return;
    }
    
    navigator.clipboard.writeText(transcriptionText).then(() => {
      alert('¡Transcripción copiada al portapapeles!');
    }).catch(err => {
      console.error('Failed to copy transcription:', err);
      alert('Error copiando transcripción al portapapeles.');
    });
  };

  const downloadTranscription = () => {
    if (!transcriptionText) {
      alert('No hay transcripción disponible para descargar.');
      return;
    }
    
    const blob = new Blob([transcriptionText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoData.title}_transcription.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // === CONTROLES DE VIDEO (código original) ===
  useEffect(() => {
    const video = videoRef.current;
    if (video && videoUrl) {
      video.volume = volume;
      
      const updateTime = () => setCurrentTime(video.currentTime);
      const updateDuration = () => {
        if (video.duration && !isNaN(video.duration)) {
          setDuration(video.duration);
          console.log('✅ Video duration loaded:', video.duration);
        }
      };
      const handlePlay = () => {
        console.log('▶️ Video started playing');
        setIsPlaying(true);
      };
      const handlePause = () => {
        console.log('⏸️ Video paused');
        setIsPlaying(false);
      };
      const handleEnded = () => {
        console.log('🏁 Video ended');
        setIsPlaying(false);
      };
      const handleError = (e: Event) => {
        console.error('❌ Video playback error:', e);
        const videoElement = e.target as HTMLVideoElement;
        if (videoElement && videoElement.error) {
          console.error('Video error details:', {
            code: videoElement.error.code,
            message: videoElement.error.message
          });
          
          let errorMessage = 'Failed to play video. ';
          switch (videoElement.error.code) {
            case 1:
              errorMessage += 'Video loading was aborted.';
              break;
            case 2:
              errorMessage += 'Network error occurred.';
              break;
            case 3:
              errorMessage += 'Video format not supported or corrupted.';
              break;
            case 4:
              errorMessage += 'Video format not supported.';
              break;
            default:
              errorMessage += 'Unknown error occurred.';
          }
          setError(errorMessage);
        }
      };
      const handleLoadStart = () => {
        console.log('🔄 Video loading started');
        setLoadingStage('Loading video data...');
      };
      const handleCanPlay = () => {
        console.log('✅ Video can play');
        setLoadingStage('Ready to play');
        setUrlLoading(false);
        setError(null);
      };
      const handleLoadedData = () => {
        console.log('✅ Video data loaded');
        setLoadingStage('Video loaded successfully');
      };
      const handleWaiting = () => {
        console.log('⏳ Video buffering...');
        setLoadingStage('Buffering...');
      };
      const handleCanPlayThrough = () => {
        console.log('✅ Video can play through');
        setLoadingStage('Ready to play');
        setUrlLoading(false);
      };
      
      // Add all event listeners
      video.addEventListener('timeupdate', updateTime);
      video.addEventListener('loadedmetadata', updateDuration);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('error', handleError);
      video.addEventListener('loadstart', handleLoadStart);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('canplaythrough', handleCanPlayThrough);
      
      return () => {
        video.removeEventListener('timeupdate', updateTime);
        video.removeEventListener('loadedmetadata', updateDuration);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('error', handleError);
        video.removeEventListener('loadstart', handleLoadStart);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('canplaythrough', handleCanPlayThrough);
      };
    }
  }, [volume, videoUrl]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (video && videoUrl && !urlLoading) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play().catch(err => {
          console.error('❌ Error playing video:', err);
          setError('Failed to play video. The video may be corrupted or in an unsupported format.');
        });
      }
    } else {
      console.log('⚠️ Cannot play: video not ready', { video: !!video, videoUrl: !!videoUrl, urlLoading });
    }
  };

  const handleVideoClick = () => {
    if (!urlLoading && !error) {
      togglePlayPause();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (video && videoUrl && !urlLoading && duration > 0) {
      const time = parseFloat(e.target.value);
      video.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    const video = videoRef.current;
    if (video) {
      video.volume = newVolume;
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const retryVideoLoad = () => {
    console.log('🔄 Retrying video load... Attempt:', retryCount + 1);
    setError(null);
    setVideoUrl('');
    setUrlLoading(true);
    setRetryCount(prev => prev + 1);
  };

  const resetRetries = () => {
    setRetryCount(0);
    setError(null);
    setVideoUrl('');
    setUrlLoading(true);
    setRetryCount(1);
  };

  // === FUNCIONES AUXILIARES PARA UI ===
  const getTranscriptionStatusColor = () => {
    switch (transcriptionStatus) {
      case 'completed': return '#28a745';
      case 'in_progress': return '#ffc107';
      case 'failed': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getTranscriptionStatusIcon = () => {
    switch (transcriptionStatus) {
      case 'completed': return '✅';
      case 'in_progress': return '⏳';
      case 'failed': return '❌';
      default: return '📝';
    }
  };

  const getTranscriptionStatusText = () => {
    switch (transcriptionStatus) {
      case 'completed': return 'Transcripción Completada';
      case 'in_progress': return 'Transcribiendo...';
      case 'failed': return 'Error en Transcripción';
      default: return 'Sin Transcripción';
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#343a40', color: 'white', padding: '15px 30px', borderBottom: '1px solid #dee2e6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: '24px' }}>🎬 File Uploader</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onBack} style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              ← Back to Library
            </button>
            <button onClick={onExportOptions} style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Export Options
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>
        {/* Video Info Header */}
        <div style={{ marginBottom: '25px', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 15px 0', fontSize: '28px', color: '#343a40' }}>{videoData.title}</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', color: '#6c757d', fontSize: '14px' }}>
            <span>📁 {videoData.s3Key}</span>
            <span>📏 {formatFileSize(videoData.fileSize)}</span>
            <span>🌐 {videoData.language}</span>
            <span>⚡ {videoData.quality}</span>
            <span style={{ 
              padding: '2px 8px', 
              borderRadius: '12px', 
              backgroundColor: videoData.status === 'completed' ? '#d4edda' : '#fff3cd',
              color: videoData.status === 'completed' ? '#155724' : '#856404'
            }}>
              {videoData.status?.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Main Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: '30px', alignItems: 'start' }}>
          {/* Left Side - Video */}
          <div>
            {/* Video Container */}
            <div style={{ 
              position: 'relative',
              width: '100%',
              backgroundColor: '#000',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
              aspectRatio: '16/9'
            }}>
              {urlLoading && (
                <div style={{ 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: '#1a1a1a',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  padding: '20px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '24px' }}>Loading Video...</h3>
                  <p style={{ margin: '0 0 20px 0', fontSize: '16px', opacity: 0.8 }}>{loadingStage}</p>
                  <div style={{ fontSize: '14px', opacity: 0.6, textAlign: 'left' }}>
                    <p style={{ margin: '5px 0' }}><strong>S3 Key:</strong> {videoData.s3Key}</p>
                    <p style={{ margin: '5px 0' }}><strong>File Size:</strong> {formatFileSize(videoData.fileSize)}</p>
                    <p style={{ margin: '5px 0' }}><strong>MIME Type:</strong> {videoData.mimeType}</p>
                    <p style={{ margin: '5px 0' }}><strong>Retry Count:</strong> {retryCount}</p>
                  </div>
                </div>
              )}
              
              {error && !urlLoading && (
                <div style={{ 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: '#dc3545',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  padding: '20px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '24px' }}>Video Load Error</h3>
                  <p style={{ margin: '0 0 20px 0', fontSize: '16px', maxWidth: '400px' }}>{error}</p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={retryVideoLoad} style={{ padding: '10px 20px', backgroundColor: '#fff', color: '#dc3545', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                      🔄 Retry Load
                    </button>
                    <button onClick={resetRetries} style={{ padding: '10px 20px', backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid white', borderRadius: '4px', cursor: 'pointer' }}>
                      🔄 Reset & Retry
                    </button>
                    <button onClick={onBack} style={{ padding: '10px 20px', backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid white', borderRadius: '4px', cursor: 'pointer' }}>
                      ← Go Back
                    </button>
                  </div>
                </div>
              )}
              
              {videoUrl && (
                <video
                  ref={videoRef}
                  onClick={handleVideoClick}
                  controls={false}
                  preload="metadata"
                  crossOrigin="anonymous"
                  style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    backgroundColor: '#000',
                    display: urlLoading ? 'none' : 'block',
                    cursor: urlLoading || error ? 'default' : 'pointer'
                  }}
                >
                  <source src={videoUrl} type={videoData.mimeType || 'video/mp4'} />
                  <p>Your browser does not support the video tag.</p>
                </video>
              )}
            </div>

            {/* Video Controls */}
            <div style={{ 
              marginTop: '20px', 
              padding: '20px', 
              backgroundColor: 'white', 
              borderRadius: '12px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button 
                  onClick={togglePlayPause}
                  disabled={urlLoading || !!error}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: urlLoading || error ? '#e9ecef' : '#007bff',
                    color: urlLoading || error ? '#6c757d' : 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: urlLoading || error ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    minWidth: '120px'
                  }}
                >
                  {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                </button>
                
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ minWidth: '50px', fontSize: '14px', fontWeight: '500', color: '#495057' }}>
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    disabled={urlLoading || !!error || duration === 0}
                    style={{ 
                      flex: 1,
                      height: '6px',
                      borderRadius: '3px',
                      backgroundColor: '#e9ecef',
                      outline: 'none',
                      cursor: urlLoading || error || duration === 0 ? 'not-allowed' : 'pointer'
                    }}
                  />
                  <span style={{ minWidth: '50px', fontSize: '14px', fontWeight: '500', color: '#495057' }}>
                    {formatTime(duration)}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px' }}>
                    {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    style={{ width: '100px', height: '6px', borderRadius: '3px', backgroundColor: '#e9ecef', outline: 'none', cursor: 'pointer' }}
                  />
                  <span style={{ minWidth: '40px', fontSize: '12px', fontWeight: '500', color: '#6c757d' }}>
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* S3 Status */}
            <div style={{ 
              marginTop: '15px', 
              padding: '15px', 
              backgroundColor: 'white', 
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ backgroundColor: '#28a745', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                    S3
                  </span>
                  <span style={{ fontSize: '14px', color: '#495057' }}>
                    Bucket: file-uploader-demo-rodes-01
                  </span>
                </div>
                <div>
                  {urlLoading && <span style={{ color: '#ffc107', fontWeight: '500' }}>⏳ {loadingStage}</span>}
                  {videoUrl && !urlLoading && !error && <span style={{ color: '#28a745', fontWeight: '500' }}>✅ Ready</span>}
                  {error && <span style={{ color: '#dc3545', fontWeight: '500' }}>❌ Error</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Transcription Panel */}
          <div>
            {/* Transcription Header */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '12px 12px 0 0',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              borderBottom: '1px solid #e9ecef'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, fontSize: '20px', color: '#343a40' }}>🎤 Transcripción</h3>
                <div style={{ 
                  padding: '4px 12px', 
                  borderRadius: '20px', 
                  backgroundColor: getTranscriptionStatusColor(),
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {getTranscriptionStatusIcon()} {getTranscriptionStatusText()}
                </div>
              </div>

              {/* Transcription Progress */}
              {transcriptionStatus === 'in_progress' && (
                <div style={{ marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', color: '#495057' }}>Progreso</span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#495057' }}>{transcriptionProgress}%</span>
                  </div>
                  <div style={{ 
                    width: '100%', 
                    backgroundColor: '#e9ecef', 
                    borderRadius: '10px', 
                    overflow: 'hidden',
                    height: '8px'
                  }}>
                    <div 
                      style={{ 
                        width: `${transcriptionProgress}%`,
                        height: '100%',
                        backgroundColor: '#ffc107',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                  <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#6c757d', fontStyle: 'italic' }}>
                    {transcriptionMessage}
                  </p>
                </div>
              )}

              {/* Transcription Actions */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {transcriptionStatus === 'not_started' && (
                  <button 
                    onClick={startTranscription}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    🚀 Iniciar Transcripción
                  </button>
                )}

                {transcriptionStatus === 'in_progress' && (
                  <button 
                    onClick={cancelTranscription}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    🛑 Cancelar
                  </button>
                )}

                {transcriptionStatus === 'failed' && (
                  <button 
                    onClick={startTranscription}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ffc107',
                      color: '#212529',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    🔄 Reintentar
                  </button>
                )}

                {transcriptionStatus === 'completed' && transcriptionText && (
                  <>
                    <button 
                      onClick={copyTranscription}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      📋 Copiar
                    </button>
                    <button 
                      onClick={downloadTranscription}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      💾 Descargar
                    </button>
                  </>
                )}
              </div>

              {/* Transcription Stats */}
              {transcriptionStatus === 'completed' && transcriptionText && (
                <div style={{ 
                  marginTop: '15px', 
                  padding: '10px', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#495057'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span>📝 Palabras:</span>
                    <strong>{transcriptionText.split(/\s+/).filter(w => w.length > 0).length}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span>🎯 Confianza:</span>
                    <strong>{(transcriptionConfidence * 100).toFixed(1)}%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>🌐 Idioma:</span>
                    <strong>{videoData.language || 'english'}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Transcription Content */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '0 0 12px 12px',
              maxHeight: '500px', 
              overflowY: 'auto',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              border: '1px solid #e9ecef',
              borderTop: 'none'
            }}>
              {transcriptionStatus === 'completed' && transcriptionText ? (
                <div style={{ padding: '20px' }}>
                  <p style={{ 
                    lineHeight: '1.6', 
                    margin: 0, 
                    color: '#495057',
                    fontSize: '15px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {transcriptionText}
                  </p>
                </div>
              ) : transcriptionStatus === 'in_progress' ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#6c757d', 
                  padding: '40px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '15px'
                }}>
                  <div style={{ fontSize: '48px' }}>⏳</div>
                  <h4 style={{ margin: 0, color: '#495057' }}>Transcribiendo...</h4>
                  <p style={{ margin: 0, lineHeight: '1.5', textAlign: 'center' }}>
                    AWS Transcribe está procesando tu video.<br />
                    Esto puede tomar algunos minutos.
                  </p>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#6c757d',
                    backgroundColor: '#f8f9fa',
                    padding: '8px 12px',
                    borderRadius: '20px',
                    fontFamily: 'monospace'
                  }}>
                    {transcriptionMessage}
                  </div>
                  {isPolling && (
                    <div style={{ fontSize: '11px', color: '#28a745' }}>
                      🔄 Verificando cada 5 segundos...
                    </div>
                  )}
                </div>
              ) : transcriptionStatus === 'failed' ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#dc3545', 
                  padding: '40px 20px' 
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '15px' }}>❌</div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#dc3545' }}>Error en Transcripción</h4>
                  <p style={{ margin: '0 0 15px 0', lineHeight: '1.5' }}>
                    {transcriptionError || 'La transcripción falló por un error desconocido.'}
                  </p>
                  <button 
                    onClick={startTranscription}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#ffc107',
                      color: '#212529',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    🔄 Intentar de Nuevo
                  </button>
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#6c757d', 
                  padding: '40px 20px' 
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '15px' }}>📝</div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Sin Transcripción</h4>
                  <p style={{ margin: '0 0 15px 0', lineHeight: '1.5' }}>
                    Este video aún no tiene transcripción.<br />
                    Puedes generar una automáticamente.
                  </p>
                  <button 
                    onClick={startTranscription}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold'
                    }}
                  >
                    🚀 Generar Transcripción
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div style={{ 
          marginTop: '40px', 
          display: 'flex', 
          gap: '15px', 
          justifyContent: 'center', 
          flexWrap: 'wrap',
          padding: '20px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <button onClick={onBack} style={{ 
            padding: '12px 24px', 
            backgroundColor: '#6c757d', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}>
            ← Back to Library
          </button>
          
          {transcriptionStatus === 'completed' && transcriptionText && (
            <>
              <button 
                onClick={copyTranscription}
                style={{ 
                  padding: '12px 24px', 
                  backgroundColor: '#17a2b8', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                📋 Copy Transcription
              </button>
              <button 
                onClick={downloadTranscription}
                style={{ 
                  padding: '12px 24px', 
                  backgroundColor: '#28a745', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                💾 Download
              </button>
            </>
          )}
          
          <button onClick={onExportOptions} style={{ 
            padding: '12px 24px', 
            backgroundColor: '#ffc107', 
            color: '#212529', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}>
            ⚙️ Export Options
          </button>
          <button onClick={retryVideoLoad} style={{ 
            padding: '12px 24px', 
            backgroundColor: '#fd7e14', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}>
            🔄 Reload Video
          </button>
        </div>
      </main>
    </div>
  );
};

export default VideoViewer;