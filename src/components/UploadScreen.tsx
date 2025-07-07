// components/UploadScreen.tsx - UPDATED WITH DIRECT UPLOAD BUTTON
import { useState } from "react";
import { uploadData } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();

interface UploadScreenProps {
  onVideoUpload: (file: File, language: string, quality: string) => void;
  onExportOptions: () => void;
  onVideoManager: () => void;
  onDirectUpload: () => void; // NEW: Direct upload option
}

const UploadScreen: React.FC<UploadScreenProps> = ({ 
  onVideoUpload, 
  onExportOptions, 
  onVideoManager, 
  onDirectUpload 
}) => {
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

      console.log('🚀 Starting upload to S3...', s3Key);

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
              console.log(`📊 Upload progress: ${progress}%`);
            }
          }
        }
      }).result;

      console.log('✅ S3 upload completed:', uploadResult);

      // Create database record
      try {
        const videoRecord = await client.models.Video.create({
          title: file.name.replace(/\.[^/.]+$/, ""),
          description: `Uploaded video: ${file.name}`,
          s3Key: s3Key,
          language: language,
          quality: quality,
          transcription: `Auto-generated transcription for ${file.name}. This would normally be processed by an AI transcription service like AWS Transcribe.`,
          duration: 0,
          fileSize: file.size,
          mimeType: file.type,
          uploadedAt: new Date().toISOString(),
          status: 'completed'
        });

        console.log('✅ Database record created successfully:', videoRecord);

        // Success notification
        alert(`Video uploaded successfully!\n\nFile: ${file.name}\nSize: ${(file.size / 1024 / 1024).toFixed(1)} MB\nStored in: ${s3Key}`);

        // Call parent component to navigate to viewer
        onVideoUpload(file, language, quality);

      } catch (dbError) {
        console.error('❌ Database creation failed:', dbError);
        alert(`Upload to S3 succeeded, but database record failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
      }

    } catch (error) {
      console.error('❌ Upload failed:', error);
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
            {isUploading ? 'Uploading...' : 'Quick Upload'}
          </button>
          <button 
            className="header-btn secondary" 
            onClick={onDirectUpload}
            disabled={isUploading}
          >
            📤 Full Upload
          </button>
          <button className="header-btn" onClick={onVideoManager}>
            📂 Video Library
          </button>
          <button className="header-btn" onClick={onExportOptions}>
            ⚙️ Export Options
          </button>
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
                <p className="upload-status-text">
                  {uploadProgress < 100 ? 'Uploading to S3...' : 'Creating database record...'}
                </p>
              </div>
            ) : (
              <>
                <div className="upload-icon">📁</div>
                <p className="upload-text">Drag and drop video files here</p>
                <p className="upload-or">or</p>
                <div className="upload-buttons">
                  <button className="select-btn primary" onClick={handleFileSelect}>
                    Quick Upload
                  </button>
                  <button className="select-btn secondary" onClick={onDirectUpload}>
                    Full Upload Form
                  </button>
                </div>
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

        {/* Feature Explanation */}
        <div className="feature-explanation">
          <div className="feature-card">
            <h3>📤 Quick Upload</h3>
            <p>Fast upload with basic settings. Great for testing and quick uploads.</p>
          </div>
          <div className="feature-card">
            <h3>📝 Full Upload Form</h3>
            <p>Complete form with title, description, and metadata. Recommended for production.</p>
          </div>
          <div className="feature-card">
            <h3>📂 Video Library</h3>
            <p>View and manage all your uploaded videos. Search, edit, and organize your content.</p>
          </div>
        </div>

        {isUploading && (
          <div className="upload-status">
            <h3>Upload Status</h3>
            <div className="status-steps">
              <p className={uploadProgress > 0 ? 'step-completed' : 'step-active'}>
                📤 {uploadProgress < 100 ? 'Uploading to S3...' : '✅ Uploaded to S3'}
              </p>
              <p className={uploadProgress === 100 ? 'step-active' : 'step-pending'}>
                💾 {uploadProgress === 100 ? 'Creating database record...' : 'Waiting for upload...'}
              </p>
              <p className="step-pending">⚡ Setting up real-time sync...</p>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>© 2024 File Uploader. Upload videos to S3 and manage with DynamoDB.</p>
      </footer>
    </div>
  );
};

export default UploadScreen;