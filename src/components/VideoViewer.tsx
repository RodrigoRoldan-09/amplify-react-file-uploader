// components/VideoViewer.tsx - S3 STREAMING INTEGRATION
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load video from S3 on component mount
  useEffect(() => {
    loadVideoFromS3();
  }, [videoData.s3Key]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && videoUrl) {
      video.volume = volume;
      
      const updateTime = () => setCurrentTime(video.currentTime);
      const updateDuration = () => {
        setDuration(video.duration);
        setLoading(false);
      };
      const handleLoadStart = () => setLoading(true);
      const handleCanPlay = () => setLoading(false);
      const handleError = () => {
        setError('Failed to load video');
        setLoading(false);
      };
      
      video.addEventListener('timeupdate', updateTime);
      video.addEventListener('loadedmetadata', updateDuration);
      video.addEventListener('loadstart', handleLoadStart);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleError);
      
      return () => {
        video.removeEventListener('timeupdate', updateTime);
        video.removeEventListener('loadedmetadata', updateDuration);
        video.removeEventListener('loadstart', handleLoadStart);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
      };
    }
  }, [volume, videoUrl]);

  const loadVideoFromS3 = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading video from S3:', videoData.s3Key);
      
      // Get signed URL from S3
      const urlResult = await getUrl({ 
        path: videoData.s3Key,
        options: {
          expiresIn: 3600 // 1 hour
        }
      });
      
      const signedUrl = urlResult.url.toString();
      setVideoUrl(signedUrl);
      
      console.log('S3 signed URL generated:', signedUrl);
      
    } catch (err) {
      console.error('Error loading video from S3:', err);
      setError('Failed to load video from S3. Please check if the file exists.');
      setLoading(false);
    }
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (video && !loading) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play().catch(err => {
          console.error('Error playing video:', err);
          setError('Failed to play video');
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoClick = () => {
    togglePlayPause();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (video && !loading) {
      const time = parseFloat(e.target.value);
      video.currentTime = time;
      setCurrentTime(time);
    }
  };

  const copyTranscription = () => {
    if (!videoData.transcription) {
      alert('No transcription available for this video.');
      return;
    }
    
    navigator.clipboard.writeText(videoData.transcription);
    alert('Transcription copied to clipboard!');
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="video-viewer">
      <header className="header">
        <div className="header-left">
          <h1 className="logo">🎬 File Uploader</h1>
        </div>
        <div className="header-right">
          <button className="header-btn">Upload</button>
          <button className="header-btn">Upload Videos</button>
          <button className="header-btn" onClick={onExportOptions}>Export Options</button>
        </div>
      </header>

      <main className="viewer-main">
        <div className="video-info-header">
          <h2>{videoData.title}</h2>
          <div className="video-metadata">
            <span>📁 {videoData.s3Key}</span>
            <span>📏 {formatFileSize(videoData.fileSize)}</span>
            <span>🌐 {videoData.language}</span>
            <span>⚡ {videoData.quality}</span>
            <span className={`status-indicator ${videoData.status}`}>
              {videoData.status?.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="viewer-layout">
          {/* Left Side - Video */}
          <div className="video-section">
            <div className="video-container">
              {loading && (
                <div className="video-loading">
                  <div className="loading-spinner">⏳</div>
                  <p>Loading video from S3...</p>
                </div>
              )}
              
              {error && (
                <div className="video-error">
                  <div className="error-icon">❌</div>
                  <p>{error}</p>
                  <button className="retry-btn" onClick={loadVideoFromS3}>
                    Retry
                  </button>
                </div>
              )}
              
              {videoUrl && !error && (
                <video
                  ref={videoRef}
                  className="video-player"
                  onClick={handleVideoClick}
                  controls={false}
                  preload="metadata"
                  style={{ display: loading ? 'none' : 'block' }}
                >
                  <source src={videoUrl} type={videoData.mimeType} />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>

            {/* Video Controls */}
            <div className="video-controls">
              <button 
                className="control-btn play-btn"
                onClick={togglePlayPause}
                disabled={loading || !!error}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              
              <div className="seek-control">
                <span className="time-display">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  className="seek-bar"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  disabled={loading || !!error}
                />
                <span className="time-display">{formatTime(duration)}</span>
              </div>
              
              <div className="volume-control">
                <button className="control-btn volume-btn">
                  🔊
                </button>
                <input
                  type="range"
                  className="volume-slider"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                />
              </div>
            </div>

            {/* S3 Status */}
            <div className="s3-status">
              <div className="s3-info">
                <span className="s3-badge">S3</span>
                <span>Streaming from: file-uploader-demo-rodes-01</span>
              </div>
              <div className="connection-status">
                {loading && <span className="status connecting">⏳ Connecting...</span>}
                {videoUrl && !loading && !error && <span className="status connected">✅ Connected</span>}
                {error && <span className="status error">❌ Error</span>}
              </div>
            </div>
          </div>

          {/* Right Side - Transcription */}
          <div className="transcription-section">
            <div className="transcription-header">
              <h3>Transcription</h3>
              <div className="transcription-status">
                {videoData.transcription ? (
                  <span className="transcription-ready">✅ Ready</span>
                ) : (
                  <span className="transcription-pending">⏳ Processing...</span>
                )}
              </div>
            </div>

            {/* Transcription Content */}
            <div className="transcription-content">
              {videoData.transcription ? (
                <>
                  <div className="time-markers">
                    <div className="time-marker">00:00</div>
                    <div className="time-marker">00:30</div>
                    <div className="time-marker">01:00</div>
                  </div>
                  
                  <div className="transcript-text">
                    <p>{videoData.transcription}</p>
                  </div>
                </>
              ) : (
                <div className="transcription-placeholder">
                  <div className="placeholder-icon">📝</div>
                  <p>Transcription is being processed...</p>
                  <p>This may take a few minutes depending on video length.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="bottom-actions">
          <button className="action-btn back-btn" onClick={onBack}>
            ← Back
          </button>
          <button 
            className="action-btn copy-btn" 
            onClick={copyTranscription}
            disabled={!videoData.transcription}
          >
            📋 Copy Text
          </button>
          <button 
            className="action-btn download-btn" 
            onClick={onDownload}
            disabled={!videoData.transcription}
          >
            💾 Download
          </button>
          <button className="action-btn options-btn" onClick={onExportOptions}>
            ⚙️ Export Options
          </button>
        </div>
      </main>
    </div>
  );
};

export default VideoViewer;