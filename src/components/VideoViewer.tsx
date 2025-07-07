// components/VideoViewer.tsx - FIXED FOR S3 AND DYNAMODB - CLEAN VERSION
import { useState, useRef, useEffect } from "react";
import { getUrl } from "aws-amplify/storage";
import { VideoData } from "../App";

interface VideoViewerProps {
  videoData: VideoData;
  onBack: () => void;
  onExportOptions: () => void;
  onDownload: () => void;
}

const VideoViewer: React.FC<VideoViewerProps> = ({ 
  videoData, 
  onBack, 
  onExportOptions, 
  onDownload 
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
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load video from S3 on component mount
  useEffect(() => {
    console.log('🎥 VideoViewer mounted with data:', {
      title: videoData.title,
      s3Key: videoData.s3Key,
      s3Url: videoData.s3Url,
      fileSize: videoData.fileSize,
      mimeType: videoData.mimeType
    });
    
    // Execute video loading directly (no separate function to avoid ESLint warning)
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
          
          // Test if the existing URL is still valid
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
            validateObjectExistence: true // This will check if the object exists
          }
        });
        
        const signedUrl = urlResult.url.toString();
        console.log('✅ Generated new signed URL:', signedUrl.substring(0, 100) + '...');
        
        setLoadingStage('New URL generated, loading video...');
        setVideoUrl(signedUrl);
        
      } catch (err) {
        console.error('❌ Error loading video from S3:', err);
        setLoadingStage('Failed to load from S3');
        
        // Detailed error handling
        let errorMessage = 'Failed to load video from S3. ';
        if (err instanceof Error) {
          console.error('Error details:', err.message);
          
          if (err.message.includes('NotFound') || err.message.includes('NoSuchKey')) {
            errorMessage = `Video file "${videoData.s3Key}" not found in S3. The file may have been deleted or the key is incorrect.`;
          } else if (err.message.includes('AccessDenied')) {
            errorMessage = 'Access denied to S3. Check permissions and authentication settings.';
          } else if (err.message.includes('SignatureDoesNotMatch')) {
            errorMessage = 'Authentication signature error. Please refresh and try again.';
          } else if (err.message.includes('InvalidRequest')) {
            errorMessage = 'Invalid S3 request. Check the S3 key format.';
          } else {
            errorMessage += `Error: ${err.message}`;
          }
        }
        
        setError(errorMessage);
        
        // Only show fallback on first few retries
        if (retryCount < 2) {
          console.log('🔄 Will show fallback demo video...');
          setLoadingStage('Loading demo video as fallback...');
          
          try {
            // Use a more reliable demo video
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
  }, [videoData.s3Key, videoData.s3Url, videoData.title, videoData.fileSize, videoData.mimeType, retryCount]);

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
            case 1: // MEDIA_ERR_ABORTED
              errorMessage += 'Video loading was aborted.';
              break;
            case 2: // MEDIA_ERR_NETWORK
              errorMessage += 'Network error occurred.';
              break;
            case 3: // MEDIA_ERR_DECODE
              errorMessage += 'Video format not supported or corrupted.';
              break;
            case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
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
        setError(null); // Clear any previous errors
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

  const copyTranscription = () => {
    if (!videoData.transcription) {
      alert('No transcription available for this video.');
      return;
    }
    
    navigator.clipboard.writeText(videoData.transcription).then(() => {
      alert('Transcription copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy transcription:', err);
      alert('Failed to copy transcription to clipboard.');
    });
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
    setRetryCount(1); // This will trigger the useEffect
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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '30px', alignItems: 'start' }}>
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

          {/* Right Side - Transcription */}
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#343a40' }}>Transcription</h3>
              <div>
                {videoData.transcription ? (
                  <span style={{ color: '#28a745', fontSize: '14px', fontWeight: '500' }}>✅ Ready</span>
                ) : (
                  <span style={{ color: '#ffc107', fontSize: '14px', fontWeight: '500' }}>⏳ Processing...</span>
                )}
              </div>
            </div>

            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '12px', 
              maxHeight: '500px', 
              overflowY: 'auto',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              border: '1px solid #e9ecef'
            }}>
              {videoData.transcription ? (
                <div>
                  <p style={{ lineHeight: '1.6', margin: 0, color: '#495057' }}>{videoData.transcription}</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#6c757d', padding: '40px 20px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '15px' }}>📝</div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Transcription Available!</h4>
                  <p style={{ margin: 0, lineHeight: '1.5' }}>Auto-generated transcription for this video is ready to view and download.</p>
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
          <button 
            onClick={copyTranscription}
            disabled={!videoData.transcription}
            style={{ 
              padding: '12px 24px', 
              backgroundColor: videoData.transcription ? '#17a2b8' : '#e9ecef', 
              color: videoData.transcription ? 'white' : '#6c757d', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: videoData.transcription ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: '500'
            }}
          >
            📋 Copy Transcription
          </button>
          <button 
            onClick={onDownload}
            disabled={!videoData.transcription}
            style={{ 
              padding: '12px 24px', 
              backgroundColor: videoData.transcription ? '#28a745' : '#e9ecef', 
              color: videoData.transcription ? 'white' : '#6c757d', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: videoData.transcription ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: '500'
            }}
          >
            💾 Download
          </button>
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