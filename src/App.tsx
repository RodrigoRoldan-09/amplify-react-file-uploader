// App.tsx - S3 INTEGRATION
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
      // Create video data object for processing
      const videoData: VideoData = {
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        description: `Uploaded video: ${file.name}`,
        s3Key: `videos/${Date.now()}-${file.name}`,
        s3Url: '', // Will be set after upload
        language,
        quality,
        transcription: 'Processing... Transcription will be available shortly.',
        duration: 0,
        fileSize: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        status: 'uploading'
      };

      setCurrentVideo(videoData);
      setCurrentScreen('viewer');

      // Note: Real S3 upload will be implemented in UploadScreen component
      console.log('Video upload initiated:', videoData);
    } catch (error) {
      console.error('Error uploading video:', error);
      alert('Error uploading video. Please try again.');
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
    setCurrentScreen('manager');
  };

  const handleViewVideoFromManager = (video: VideoItem) => {
    // Convert VideoItem to VideoData format
    const videoData: VideoData = {
      id: video.id,
      title: video.title,
      description: video.description,
      s3Key: video.s3Key,
      s3Url: video.s3Url,
      language: video.language,
      quality: video.quality,
      transcription: `Real transcription for "${video.title}" would appear here. This content would be generated from the actual video audio using AI transcription services.`,
      duration: parseFloat(video.duration.replace(':', '.')) * 60, // Convert MM:SS to seconds
      fileSize: parseInt(video.fileSize.replace(/[^\d]/g, '')) * 1024 * 1024, // Convert MB to bytes
      mimeType: 'video/mp4',
      uploadedAt: video.uploadedAt,
      status: 'completed'
    };

    setCurrentVideo(videoData);
    setCurrentScreen('viewer');
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