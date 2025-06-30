// components/VideoViewer.tsx - CLEAN VERSION (NO UNUSED VARIABLES)
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
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume;
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

  const copyTranscription = () => {
    navigator.clipboard.writeText(videoData.transcription);
    alert('Transcription copied to clipboard!');
  };

  return (
    <div className="video-viewer">
      <header className="header">
        <div className="header-left">
          <h1 className="logo">🎬 TranscribeX</h1>
        </div>
        <div className="header-right">
          <button className="header-btn">Upload</button>
          <button className="header-btn">Transcription Editor</button>
          <button className="header-btn" onClick={onExportOptions}>Export Options</button>
        </div>
      </header>

      <main className="viewer-main">
        <div className="viewer-layout">
          {/* Left Side - Video */}
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
            </div>

            {/* Video Controls */}
            <div className="video-controls">
              <button 
                className="control-btn play-btn"
                onClick={togglePlayPause}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              
              <button 
                className="control-btn pause-btn"
                onClick={() => {
                  const video = videoRef.current;
                  if (video) {
                    video.pause();
                    setIsPlaying(false);
                  }
                }}
              >
                Pause
              </button>
              
              <div className="volume-control">
                <button className="control-btn volume-btn">
                  Volume
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
          </div>

          {/* Right Side - Transcription */}
          <div className="transcription-section">
            {/* Format Buttons */}
            <div className="format-buttons">
              <button className="format-btn">Bold</button>
              <button className="format-btn">Italic</button>
              <button className="format-btn">Underline</button>
            </div>

            {/* Transcription Content */}
            <div className="transcription-content">
              <div className="time-markers">
                <div className="time-marker">00:00</div>
                <div className="time-marker">00:30</div>
                <div className="time-marker">01:00</div>
              </div>
              
              <div className="transcript-text">
                <p>Welcome to the lecture on transcription editing. In this session, we will...</p>
                <p>At the thirty-second mark, we discuss the features of the editor...</p>
                <p>One minute in, we look at advanced editing techniques...</p>
                <p>{videoData.transcription}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="bottom-actions">
          <button className="action-btn back-btn" onClick={onBack}>
            Back
          </button>
          <button className="action-btn copy-btn" onClick={copyTranscription}>
            Copy Text
          </button>
          <button className="action-btn download-btn" onClick={onDownload}>
            Download
          </button>
          <button className="action-btn options-btn" onClick={onExportOptions}>
            More Options
          </button>
        </div>
      </main>
    </div>
  );
};

export default VideoViewer;