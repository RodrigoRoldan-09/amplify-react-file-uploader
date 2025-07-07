import React, { useState } from 'react';
import { uploadData } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

const client = generateClient<Schema>();

interface VideoUploadProps {
  onUploadComplete: () => void;
  onBack: () => void;
}

const VideoUploader: React.FC<VideoUploadProps> = ({ onUploadComplete, onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('english');
  const [quality, setQuality] = useState('medium');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.type.startsWith('video/')) {
        setError('Please select a valid video file');
        return;
      }
      
      // Validate file size (100MB limit)
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError('File size must be less than 100MB');
        return;
      }

      setFile(selectedFile);
      setError(null);
      
      // Auto-populate title from filename if empty
      if (!title) {
        const nameWithoutExtension = selectedFile.name.replace(/\.[^/.]+$/, "");
        setTitle(nameWithoutExtension);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      setError('Please select a file and enter a title');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Step 1: Generate unique S3 key
      const timestamp = Date.now();
      const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const s3Key = `videos/${timestamp}_${sanitizedTitle}.mp4`;

      console.log('🚀 Starting upload process...');
      console.log('📁 S3 Key:', s3Key);
      console.log('📊 File size:', file.size, 'bytes');

      // Step 2: Upload to S3
      console.log('☁️ Uploading to S3...');
      const uploadResult = await uploadData({
        path: s3Key,
        data: file,
        options: {
          contentType: file.type,
          onProgress: ({ transferredBytes, totalBytes }) => {
            if (totalBytes) {
              const progress = Math.round((transferredBytes / totalBytes) * 100);
              setUploadProgress(progress);
              console.log(`📤 Upload progress: ${progress}%`);
            }
          }
        }
      }).result;

      console.log('✅ S3 upload completed:', uploadResult);

      // Step 3: Create DynamoDB record
      console.log('💾 Creating database record...');
      const videoRecord = await client.models.Video.create({
        title: title.trim(),
        description: description.trim() || undefined,
        s3Key: s3Key,
        language: language,
        quality: quality,
        fileSize: file.size,
        mimeType: file.type,
        duration: 0, // You could extract this with a video library if needed
        uploadedAt: new Date().toISOString(),
        status: 'completed'
      });

      console.log('✅ Database record created:', videoRecord);

      // Success!
      console.log('🎉 Upload process completed successfully!');
      
      // Reset form
      setFile(null);
      setTitle('');
      setDescription('');
      setLanguage('english');
      setQuality('medium');
      setUploadProgress(0);

      // Navigate back to video list
      onUploadComplete();

    } catch (err) {
      console.error('❌ Upload failed:', err);
      setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="video-upload">
      <div className="upload-header">
        <h2>Upload New Video</h2>
        <p>Upload MP4 videos to your S3 bucket and database</p>
      </div>

      <div className="upload-form">
        {/* File Selection */}
        <div className="form-group">
          <label htmlFor="file-input" className="form-label">
            Select Video File (MP4)
          </label>
          <div className="file-input-container">
            <input
              id="file-input"
              type="file"
              accept="video/mp4,video/*"
              onChange={handleFileSelect}
              disabled={uploading}
              className="file-input"
            />
            {file && (
              <div className="file-info">
                <span className="file-name">📹 {file.name}</span>
                <span className="file-size">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="form-group">
          <label htmlFor="title" className="form-label">
            Title *
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter video title..."
            disabled={uploading}
            className="form-input"
            required
          />
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="description" className="form-label">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter video description (optional)..."
            disabled={uploading}
            className="form-textarea"
            rows={3}
          />
        </div>

        {/* Language and Quality */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="language" className="form-label">
              Language
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={uploading}
              className="form-select"
            >
              {languages.map(lang => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="quality" className="form-label">
              Quality
            </label>
            <select
              id="quality"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              disabled={uploading}
              className="form-select"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="progress-text">
              {uploadProgress < 100 
                ? `Uploading to S3... ${uploadProgress}%`
                : "Saving to database..."
              }
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="form-actions">
          <button
            type="button"
            onClick={onBack}
            disabled={uploading}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || !title.trim() || uploading}
            className="btn-primary"
          >
            {uploading ? 'Uploading...' : 'Upload Video'}
          </button>
        </div>
      </div>


    </div>
  );
};

export default VideoUploader;