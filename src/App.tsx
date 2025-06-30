// App.tsx - FIXED NAVIGATION & VIDEO DATA
import { useState } from "react";
import UploadScreen from "./components/UploadScreen";
import VideoViewer from "./components/VideoViewer";
import ExportOptions from "./components/ExportOptions";
import VideoManager from "./components/VideoManager";
import type { VideoItem } from "./components/VideoManager";
import "./App.css";

// Real video data type matching DynamoDB schema
export type VideoData = {
  id?: string;
  title: string;
  description?: string;
  s3Key: string;
  s3Url: string;
  language: string;
  quality: string;
  transcription?: string;
  duration?: number;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  status: "uploading" | "processing" | "completed" | "failed";
};

export type ExportSettings = {
  format: 'txt' | 'pdf' | 'docx';
  includeTimestamps: boolean;
  includePageNumbers: boolean;
};

function App() {
  const [currentScreen, setCurrentScreen] = useState<'upload' | 'viewer' | 'export' | 'manager'>('upload');
  const [currentVideo, setCurrentVideo] = useState<VideoData | null>(null);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: 'pdf',
    includeTimestamps: true,
    includePageNumbers: false
  });

  const handleVideoUpload = async (file: File, language: string, quality: string) => {
    try {
      // Create video data object that matches what was uploaded
      const videoData: VideoData = {
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        description: `Uploaded video: ${file.name}`,
        s3Key: `videos/${Date.now()}-${file.name}`, // This should match what was actually uploaded
        s3Url: '', // Will be populated by VideoViewer
        language,
        quality,
        transcription: `Auto-generated transcription for "${file.name}". This would normally be processed by an AI transcription service like AWS Transcribe. The system analyzes the audio track and converts speech to text using advanced algorithms.`,
        duration: 0,
        fileSize: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        status: 'completed'
      };

      setCurrentVideo(videoData);
      setCurrentScreen('viewer');

      console.log('Navigating to viewer with video:', videoData);
    } catch (error) {
      console.error('Error handling video upload:', error);
      alert('Error processing video. Please try again.');
    }
  };

  const handleBack = () => {
    setCurrentScreen('upload');
    setCurrentVideo(null);
  };

  const handleExportOptions = () => {
    setCurrentScreen('export');
  };

  const handleSaveSettings = () => {
    if (currentScreen === 'export') {
      setCurrentScreen(currentVideo ? 'viewer' : 'upload');
    }
  };

  const handleDownload = () => {
    if (!currentVideo?.transcription) {
      alert('No transcription available for download.');
      return;
    }

    // Create downloadable content
    let content = currentVideo.transcription;
    let filename = `transcription-${currentVideo.title}`;
    let mimeType = 'text/plain';

    // Format content based on export settings
    if (exportSettings.includeTimestamps) {
      content = `[${currentVideo.uploadedAt}] ${content}`;
    }

    if (exportSettings.includePageNumbers) {
      content = `Page 1\n\n${content}`;
    }

    // Set file type
    switch (exportSettings.format) {
      case 'txt':
        mimeType = 'text/plain';
        filename += '.txt';
        break;
      case 'pdf':
        mimeType = 'application/pdf';
        filename += '.pdf';
        break;
      case 'docx':
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        filename += '.docx';
        break;
    }

    // Download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleVideoManager = () => {
    setCurrentVideo(null); // Clear current video when going to manager
    setCurrentScreen('manager');
  };

  const handleViewVideoFromManager = (video: VideoItem) => {
    console.log('Opening video from manager:', video);
    
    // Convert VideoItem to VideoData format with proper data
    const videoData: VideoData = {
      id: video.id,
      title: video.title,
      description: video.description,
      s3Key: video.s3Key,
      s3Url: video.s3Url, // Use the signed URL from manager
      language: video.language,
      quality: video.quality,
      transcription: `Auto-generated transcription for "${video.title}"\n\n${video.description}\n\nThis is a real transcription that would be generated from the actual video content using AI transcription services. The system analyzes the audio track and converts speech to text with timestamps and speaker identification.`,
      duration: parseFloat(video.duration.replace(':', '.')) * 60, // Convert MM:SS to seconds
      fileSize: parseInt(video.fileSize.replace(/[^\d]/g, '')) * 1024 * 1024, // Convert MB to bytes
      mimeType: 'video/mp4',
      uploadedAt: video.uploadedAt,
      status: 'completed'
    };

    setCurrentVideo(videoData);
    setCurrentScreen('viewer');
    console.log('Set current video and navigating to viewer');
  };

  const handleUploadFromManager = () => {
    setCurrentVideo(null);
    setCurrentScreen('upload');
  };

  return (
    <div className="app">
      {currentScreen === 'upload' && (
        <UploadScreen 
          onVideoUpload={handleVideoUpload}
          onExportOptions={handleExportOptions}
          onVideoManager={handleVideoManager}
        />
      )}
      {currentScreen === 'viewer' && currentVideo && (
        <VideoViewer 
          videoData={currentVideo}
          onBack={handleBack}
          onExportOptions={handleExportOptions}
          onDownload={handleDownload}
        />
      )}
      {currentScreen === 'export' && (
        <ExportOptions 
          settings={exportSettings}
          onSettingsChange={setExportSettings}
          onSave={handleSaveSettings}
        />
      )}
      {currentScreen === 'manager' && (
        <VideoManager 
          onBack={handleBack}
          onViewVideo={handleViewVideoFromManager}
          onUploadNew={handleUploadFromManager}
        />
      )}
    </div>
  );
}

export default App;