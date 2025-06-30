// App.tsx
import { useState } from "react";
import UploadScreen from "./components/UploadScreen";
import VideoViewer from "./components/VideoViewer";
import ExportOptions from "./components/ExportOptions";
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
  const [currentScreen, setCurrentScreen] = useState<'upload' | 'viewer' | 'export'>('upload');
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

  return (
    <div className="app">
      {currentScreen === 'upload' && (
        <UploadScreen 
          onVideoUpload={handleVideoUpload}
          onExportOptions={handleExportOptions}
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
    </div>
  );
}

export default App;