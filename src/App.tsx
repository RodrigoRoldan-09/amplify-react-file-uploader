// App.tsx - FIXED COMPLETE INTEGRATION
import { useState } from "react";
import UploadScreen from "./components/UploadScreen";
import VideoViewer from "./components/VideoViewer";
import ExportOptions from "./components/ExportOptions";
import VideoManager from "./components/VideoManager";
import VideoUploader from "./components/VideoUploader"; // NEW: Direct uploader
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
  const [currentScreen, setCurrentScreen] = useState<'upload' | 'viewer' | 'export' | 'manager' | 'direct-upload'>('upload');
  const [currentVideo, setCurrentVideo] = useState<VideoData | null>(null);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: 'pdf',
    includeTimestamps: true,
    includePageNumbers: false
  });

  // Handle video upload from UploadScreen (legacy path)
  const handleVideoUpload = async (file: File, language: string, quality: string) => {
    try {
      console.log('🎬 Video uploaded via UploadScreen:', file.name);
      
      // Create video data object
      const videoData: VideoData = {
        title: file.name.replace(/\.[^/.]+$/, ""),
        description: `Uploaded video: ${file.name}`,
        s3Key: `videos/${Date.now()}-${file.name}`,
        s3Url: '',
        language,
        quality,
        transcription: `Auto-generated transcription for "${file.name}". This would normally be processed by an AI transcription service.`,
        duration: 0,
        fileSize: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        status: 'completed'
      };

      setCurrentVideo(videoData);
      setCurrentScreen('viewer');
      console.log('✅ Navigating to viewer with video:', videoData.title);
    } catch (error) {
      console.error('❌ Error handling video upload:', error);
      alert('Error processing video. Please try again.');
    }
  };

  // Handle navigation to direct uploader
  const handleDirectUpload = () => {
    console.log('🚀 Navigating to direct uploader');
    setCurrentVideo(null);
    setCurrentScreen('direct-upload');
  };

  // Handle successful upload completion from VideoUploader
  const handleUploadComplete = () => {
    console.log('✅ Upload completed, navigating to manager');
    setCurrentScreen('manager');
  };

  const handleBack = () => {
    console.log('🔙 Navigating back to upload');
    setCurrentScreen('upload');
    setCurrentVideo(null);
  };

  const handleExportOptions = () => {
    console.log('⚙️ Opening export options');
    setCurrentScreen('export');
  };

  const handleSaveSettings = () => {
    console.log('💾 Saving export settings');
    if (currentScreen === 'export') {
      setCurrentScreen(currentVideo ? 'viewer' : 'upload');
    }
  };

  const handleDownload = () => {
    if (!currentVideo?.transcription) {
      alert('No transcription available for download.');
      return;
    }

    console.log('📥 Downloading transcription for:', currentVideo.title);

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
    console.log('📂 Opening video manager');
    setCurrentVideo(null);
    setCurrentScreen('manager');
  };

  const handleViewVideoFromManager = (video: VideoItem) => {
    console.log('🎥 Opening video from manager:', video.title);
    
    // Convert VideoItem to VideoData format
    const videoData: VideoData = {
      id: video.id,
      title: video.title,
      description: video.description,
      s3Key: video.s3Key,
      s3Url: video.s3Url,
      language: video.language,
      quality: video.quality,
      transcription: `Auto-generated transcription for "${video.title}"\n\n${video.description}\n\nThis is a demo transcription that would be generated from the actual video content using AI transcription services.`,
      duration: parseFloat(video.duration.replace(':', '.')) * 60,
      fileSize: parseInt(video.fileSize.replace(/[^\d]/g, '')) * 1024 * 1024,
      mimeType: 'video/mp4',
      uploadedAt: video.uploadedAt,
      status: 'completed'
    };

    setCurrentVideo(videoData);
    setCurrentScreen('viewer');
    console.log('✅ Set current video and navigating to viewer');
  };

  const handleUploadFromManager = () => {
    console.log('📤 Navigating to uploader from manager');
    handleDirectUpload(); // Use direct uploader
  };

  console.log(`🔄 App render - Screen: ${currentScreen}, Video: ${currentVideo?.title || 'none'}`);

  return (
    <div className="app">
      {currentScreen === 'upload' && (
        <UploadScreen 
          onVideoUpload={handleVideoUpload}
          onExportOptions={handleExportOptions}
          onVideoManager={handleVideoManager}
          onDirectUpload={handleDirectUpload} // NEW: Direct upload option
        />
      )}

      {currentScreen === 'direct-upload' && (
        <VideoUploader 
          onUploadComplete={handleUploadComplete}
          onBack={handleBack}
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
          onUploadNew={handleUploadFromManager} // This will go to VideoUploader
        />
      )}

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          top: 10,
          right: 10,
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 9999
        }}>
          Screen: {currentScreen}<br/>
          Video: {currentVideo?.title || 'none'}
        </div>
      )}
    </div>
  );
}

export default App;