// components/VideoViewer.tsx
import { useState, useRef, useEffect } from "react";
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
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume;
      
      const updateTime = () => setCurrentTime(video.currentTime);
      const updateDuration = () => setDuration(video.duration);
      
      video.addEventListener('timeupdate', updateTime);
      video.addEventListener('loadedmetadata', updateDuration);
      
      return () => {
        video.removeEventListener('timeupdate', updateTime);
        video.removeEventListener('loadedmetadata', updateDuration);
      };
    }
  }, [volume]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoClick = () => {
    togglePlayPause();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (video) {
      const time = parseFloat(e.target.value);
      video.currentTime = time;
      setCurrentTime(time);
    }
  };

  const copyTranscription = () => {
    navigator.clipboard.writeText(videoData.transcription);
    alert('Transcription copied to clipboard!');
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="video-viewer">
      <header className="header">
        <div className="header-left">
          <h1 className="logo">🎬 File Uploader</h1>
        </div>
        <div className="header-right">
          <button className="header-btn">Upload</button>
          <button className="header-btn">Transcription Editor</button>
          <button className="header-btn" onClick={onExportOptions}>Export Options</button>
        </div>
      </header>

      <main className="viewer-content">
        <div className="video-section">
          <div className="video-container">
            <video
              ref={videoRef}
              className="video-player"
              onClick={handleVideoClick}
              controls={false}
              poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23000'/%3E%3Ctext x='50%25' y='50%25' fill='white' text-anchor='middle' dy='.3em'%3EDemo Video%3C/text%3E%3C/svg%3E"
            >
              <source src="https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            
            <div className="video-overlay">
              <div className="time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>

          <div className="video-controls">
            <button 
              className="control-btn"
              onClick={togglePlayPause}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            
            <input
              type="range"
              className="seek-bar"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
            />
            
            <div className="volume-control">
              <span>🔊</span>
              <input
                type="range"
                className="volume-bar"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="transcription-section">
          <div className="transcription-content">
            <div className="time-marker">00:00</div>
            <div className="transcript-text">
              {videoData.transcription}
            </div>
          </div>
        </div>
      </main>

      <div className="action-buttons">
        <button className="action-btn secondary" onClick={onBack}>
          Back
        </button>
        <button className="action-btn secondary" onClick={copyTranscription}>
          Copy Text
        </button>
        <button className="action-btn primary" onClick={onDownload}>
          Download
        </button>
        <button className="action-btn secondary" onClick={onExportOptions}>
          More Options
        </button>
      </div>
    </div>
  );
};

export default VideoViewer;