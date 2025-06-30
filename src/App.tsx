// App.tsx
import { useState } from "react";
import UploadScreen from "./components/UploadScreen";
import VideoViewer from "./components/VideoViewer";
import ExportOptions from "./components/ExportOptions";
import VideoManager from "./components/VideoManager";
import type { VideoItem } from "./components/VideoManager";
import "./App.css";

export type VideoData = {
  file: File | null;
  url: string;
  language: string;
  quality: string;
  transcription: string;
};

export type ExportSettings = {
  format: 'txt' | 'pdf' | 'docx';
  includeTimestamps: boolean;
  includePageNumbers: boolean;
};

function App() {
  const [currentScreen, setCurrentScreen] = useState<'upload' | 'viewer' | 'export' | 'manager'>('upload');
  const [videoData, setVideoData] = useState<VideoData>({
    file: null,
    url: '',
    language: 'english',
    quality: 'high',
    transcription: ''
  });
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: 'pdf',
    includeTimestamps: true,
    includePageNumbers: false
  });

  const handleVideoUpload = (file: File, language: string, quality: string) => {
    // Demo: usando video de YouTube como placeholder
    const demoTranscription = `Welcome to the lecture on transcription editing. In this session, we will...
At the thirty-second mark, we discuss the features of the editor...
One minute in, we look at advanced editing techniques...
This demonstrates how the transcription would appear after processing the uploaded video.
The system analyzes the audio track and converts speech to text using advanced AI algorithms.
Multiple speakers can be identified and their dialogue separated for clarity.
Technical terms and proper nouns are recognized and formatted appropriately.
Timestamps are automatically generated to sync with the video playback.`;

    setVideoData({
      file,
      url: 'https://youtube.com/shorts/CHxJtdXHOU4?si=bLtC4WVXVvkjSqqu',
      language,
      quality,
      transcription: demoTranscription
    });
    setCurrentScreen('viewer');
  };

  const handleBack = () => {
    setCurrentScreen('upload');
  };

  const handleExportOptions = () => {
    setCurrentScreen('export');
  };

  const handleSaveSettings = () => {
    // Regresar a la pantalla anterior
    if (currentScreen === 'export') {
      setCurrentScreen(videoData.file ? 'viewer' : 'upload');
    }
  };

  const handleDownload = () => {
    // Simular descarga
    const blob = new Blob([videoData.transcription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription.${exportSettings.format}`;
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
    setVideoData({
      file: null, // We don't have the original file in manager
      url: video.s3Url,
      language: video.language,
      quality: video.quality,
      transcription: `Transcription for "${video.title}"\n\n${video.description}\n\nThis is a demo transcription that would normally be generated from the actual video content. The transcription would include timestamps and formatted text based on the audio analysis.`
    });
    setCurrentScreen('viewer');
  };

  const handleUploadFromManager = () => {
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
      {currentScreen === 'viewer' && (
        <VideoViewer 
          videoData={videoData}
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