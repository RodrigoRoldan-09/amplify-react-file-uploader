// components/UploadScreen.tsx - S3 UPLOAD INTEGRATION
import { useState } from "react";
import { uploadData } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource.ts";

const client = generateClient<Schema>();

interface UploadScreenProps {
  onVideoUpload: (file: File, language: string, quality: string) => void;
  onExportOptions: () => void;
  onVideoManager: () => void;
}

const UploadScreen: React.FC<UploadScreenProps> = ({ onVideoUpload, onExportOptions, onVideoManager }) => {
  const [language, setLanguage] = useState('english');
  const [quality, setQuality] = useState('high');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
    input.accept = 'video/mp4,video/mpeg,video/quicktime,video/x-msvideo';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await handleVideoUpload(file);
      }
    };
    input.click();
  };

  const handleVideoUpload = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('Please select a valid video file.');
      return;
    }

    if (file.size > 500 * 1024 * 1024) { // 500MB limit
      alert('File size must be less than 500MB.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique S3 key
      const timestamp = Date.now();
      const s3Key = `videos/${timestamp}-${file.name}`;

      console.log('Starting upload to S3...', s3Key);

      // Upload to S3
      const uploadResult = await uploadData({
        path: s3Key,
        data: file,
        options: {
          contentType: file.type,
          metadata: {
            originalName: file.name,
            language: language,
            quality: quality,
            uploadedAt: new Date().toISOString()
          },
          onProgress: ({ transferredBytes, totalBytes }) => {
            if (totalBytes) {
              const progress = Math.round((transferredBytes / totalBytes) * 100);
              setUploadProgress(progress);
              console.log(`Upload progress: ${progress}%`);
            }
          }
        }
      }).result;

      console.log('Upload completed:', uploadResult);

      // Create database record
      const videoRecord = await client.models.Video.create({
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
        description: `Uploaded video: ${file.name}`,
        s3Key: s3Key,
        s3Url: uploadResult.path, // S3 path
        language: language,
        quality: quality,
        transcription: '', // Will be populated by transcription service
        duration: 0, // Will be updated after processing
        fileSize: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        status: 'completed'
      });

      console.log('Database record created:', videoRecord);

      // Call parent component
      onVideoUpload(file, language, quality);

    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => file.type.startsWith('video/'));

    if (videoFile) {
      await handleVideoUpload(videoFile);
    } else {
      alert('Please drop a valid video file.');
    }
  };

  return (
    <div className="upload-screen">
      <header className="header">
        <div className="header-left">
          <h1 className="logo">🎬 File Uploader</h1>
        </div>
        <div className="header-right">
          <button 
            className="header-btn primary" 
            onClick={handleFileSelect}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
          <button className="header-btn" onClick={onVideoManager}>Upload Videos</button>
          <button className="header-btn" onClick={onExportOptions}>Export Options</button>
        </div>
      </header>

      <main className="main-content">
        <div className="upload-area">
          <div 
            className={`drop-zone ${isUploading ? 'uploading' : ''}`}
            onClick={!isUploading ? handleFileSelect : undefined}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {isUploading ? (
              <div className="upload-progress">
                <div className="upload-icon">📤</div>
                <p className="upload-text">Uploading to S3...</p>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="progress-text">{uploadProgress}%</p>
              </div>
            ) : (
              <>
                <div className="upload-icon">📁</div>
                <p className="upload-text">Drag and drop video files here</p>
                <p className="upload-or">or</p>
                <button className="select-btn">Select Files</button>
                <p className="upload-info">Supports: MP4, MOV, AVI (Max 500MB)</p>
              </>
            )}
          </div>
        </div>

        <div className="settings-row">
          <div className="setting-group">
            <label className="setting-label">Transcription Language</label>
            <select 
              className="setting-select" 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isUploading}
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
              disabled={isUploading}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {isUploading && (
          <div className="upload-status">
            <h3>Upload Status</h3>
            <p>📤 Uploading to S3 bucket: file-uploader-demo-rodes-01</p>
            <p>💾 Creating database record...</p>
            <p>⚡ Real-time sync enabled</p>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>© 2023 File Uploader. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default UploadScreen;