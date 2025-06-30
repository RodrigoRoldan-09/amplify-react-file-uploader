// components/UploadScreen.tsx
import { useState } from "react";

interface UploadScreenProps {
  onVideoUpload: (file: File, language: string, quality: string) => void;
  onExportOptions: () => void;
  onVideoManager: () => void;
}

const UploadScreen: React.FC<UploadScreenProps> = ({ onVideoUpload, onExportOptions, onVideoManager }) => {
  const [language, setLanguage] = useState('english');
  const [quality, setQuality] = useState('high');

  const languages = [
    { value: 'english', label: 'English' },
    { value: 'spanish', label: 'Spanish' },
    { value: 'french', label: 'French' },
    { value: 'german', label: 'German' },
    { value: 'italian', label: 'Italian' },
    { value: 'portuguese', label: 'Portuguese' },
    { value: 'russian', label: 'Russian' },
    { value: 'chinese', label: 'Chinese' },
    { value: 'japanese', label: 'Japanese' },
    { value: 'arabic', label: 'Arabic' }
  ];

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        onVideoUpload(file, language, quality);
      }
    };
    input.click();
  };

  return (
    <div className="upload-screen">
      <header className="header">
        <div className="header-left">
          <h1 className="logo">🎬 File Uploader</h1>
        </div>
        <div className="header-right">
          <button className="header-btn primary" onClick={handleFileSelect}>Upload</button>
          <button className="header-btn" onClick={onVideoManager}>Upload Videos</button>
          <button className="header-btn" onClick={onExportOptions}>Export Options</button>
        </div>
      </header>

      <main className="main-content">
        <div className="upload-area">
          <div className="drop-zone" onClick={handleFileSelect}>
            <div className="upload-icon">📁</div>
            <p className="upload-text">Drag and drop files here</p>
            <p className="upload-or">or</p>
            <button className="select-btn">Select Files</button>
          </div>
        </div>

        <div className="settings-row">
          <div className="setting-group">
            <label className="setting-label">Transcription Language</label>
            <select 
              className="setting-select" 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
            >
              {languages.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </div>

          <div className="setting-group">
            <label className="setting-label">Quality Level</label>
            <select 
              className="setting-select" 
              value={quality} 
              onChange={(e) => setQuality(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>© 2023 File Uploader. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default UploadScreen;