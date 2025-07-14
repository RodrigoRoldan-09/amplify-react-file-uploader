// components/VideoUploader.tsx - WITH AWS TRANSCRIBE INTEGRATION - CLEAN VERSION
import React, { useState } from 'react';
import { uploadData } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import TranscriptionService from '../services/transcriptionService';

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
  const [currentStep, setCurrentStep] = useState<string>('Ready to upload');
  const [error, setError] = useState<string | null>(null);
  const [enableTranscription, setEnableTranscription] = useState(true);

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

  const testDatabaseConnection = async () => {
    try {
      console.log('🧪 Testing database connection...');
      setError(null);
      
      // Test reading from database
      const listResult = await client.models.Video.list({});
      console.log('✅ Database read test:', listResult);
      
      // Test creating a minimal record
      const testRecord = await client.models.Video.create({
        title: `Test Video ${Date.now()}`,
        s3Key: `test/test-${Date.now()}.mp4`,
        language: 'english',
        quality: 'medium',
        fileSize: 1000,
        mimeType: 'video/mp4',
        uploadedAt: new Date().toISOString(),
        status: 'completed'
      });
      
      console.log('✅ Database create test:', testRecord);
      
      if (testRecord.data) {
        let testId = '';
        if (!Array.isArray(testRecord.data)) {
          testId = (testRecord.data as { id?: string }).id || '';
        } else if (testRecord.data.length > 0) {
          testId = (testRecord.data[0] as { id?: string }).id || '';
        }
        
        if (testId) {
          console.log('✅ Test video created with ID:', testId);
          alert(`Database test successful! Created test video with ID: ${testId}`);
          
          // Clean up test record
          try {
            await client.models.Video.delete({ id: testId });
            console.log('🧹 Test record cleaned up');
          } catch (cleanupError) {
            console.warn('⚠️ Could not clean up test record:', cleanupError);
          }
        } else {
          alert('Database test failed: Could not get ID from created record');
        }
      } else {
        alert('Database test failed: No data returned from create operation');
      }
      
    } catch (error) {
      console.error('❌ Database test failed:', error);
      setError(`Database test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      alert(`Database test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      // Debug: Test DynamoDB connection first
      console.log('🧪 Testing DynamoDB connection...');
      try {
        const testList = await client.models.Video.list({});
        console.log('✅ DynamoDB connection OK. Found videos:', testList.data?.length || 0);
        if (testList.errors && testList.errors.length > 0) {
          console.warn('⚠️ DynamoDB warnings:', testList.errors);
        }
      } catch (dbTestError) {
        console.error('❌ DynamoDB connection test failed:', dbTestError);
        throw new Error(`Database connection failed: ${dbTestError instanceof Error ? dbTestError.message : 'Unknown error'}`);
      }

      // Step 1: Generate unique S3 key
      const timestamp = Date.now();
      const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const s3Key = `videos/${timestamp}_${sanitizedTitle}.mp4`;

      console.log('🚀 Starting upload process...');
      console.log('📁 S3 Key:', s3Key);
      console.log('📊 File size:', file.size, 'bytes');
      console.log('🎤 Transcription enabled:', enableTranscription);

      // Step 2: Upload to S3
      setCurrentStep('Uploading video to S3...');
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
      setCurrentStep('Creating database record...');
      setUploadProgress(100);
      console.log('💾 Creating database record...');
      
      const videoRecord = await client.models.Video.create({
        title: title.trim(),
        description: description.trim() || undefined,
        s3Key: s3Key,
        language: language,
        quality: quality,
        fileSize: file.size,
        mimeType: file.type,
        duration: 0,
        uploadedAt: new Date().toISOString(),
        status: 'completed',
        transcriptionStatus: enableTranscription ? 'not_started' : 'not_started',
        audioConversionStatus: enableTranscription ? 'not_started' : 'not_started'
      });

      console.log('✅ Database record created:', videoRecord);
      console.log('🔍 Video record data:', videoRecord.data);
      console.log('⚠️ Video record errors:', videoRecord.errors);

      // Better error handling for getting video ID
      let videoId: string;
      
      if (videoRecord.errors && videoRecord.errors.length > 0) {
        console.error('❌ DynamoDB creation errors:', videoRecord.errors);
        throw new Error(`Database error: ${videoRecord.errors[0].message}`);
      }
      
      if (videoRecord.data && !Array.isArray(videoRecord.data)) {
        const videoData = videoRecord.data as { id?: string };
        videoId = videoData.id || '';
        console.log('🆔 Extracted video ID:', videoId);
      } else if (Array.isArray(videoRecord.data) && videoRecord.data.length > 0) {
        const videoData = videoRecord.data[0] as { id?: string };
        videoId = videoData.id || '';
        console.log('🆔 Extracted video ID from array:', videoId);
      } else {
        console.error('❌ Unexpected data structure:', videoRecord.data);
        throw new Error('Failed to get video ID from database record - unexpected data structure');
      }
      
      if (!videoId) {
        console.error('❌ No video ID found in response');
        throw new Error('Failed to get video ID from database record - ID is empty');
      }
      
      console.log('✅ Video ID confirmed:', videoId);

      // Step 4: Start transcription process if enabled
      if (enableTranscription) {
        setCurrentStep('Starting transcription process...');
        console.log('🎤 Starting transcription process...');
        
        try {
          const jobName = await TranscriptionService.startTranscription({
            videoId: videoId,
            s3Key: s3Key,
            language: language,
            bucketName: 'file-uploader-demo-rodes-01'
          });
          
          console.log('✅ Transcription job started:', jobName);
          setCurrentStep('Transcription job started successfully!');
          
        } catch (transcriptionError) {
          console.error('⚠️ Transcription failed to start:', transcriptionError);
          setCurrentStep('Video uploaded, but transcription failed to start');
          
          await client.models.Video.update({
            id: videoId,
            transcriptionStatus: 'failed'
          });
        }
      } else {
        setCurrentStep('Upload completed successfully!');
      }

      // Success!
      console.log('🎉 Upload process completed successfully!');
      
      // Reset form
      setFile(null);
      setTitle('');
      setDescription('');
      setLanguage('english');
      setQuality('medium');
      setUploadProgress(0);
      setCurrentStep('Upload completed!');

      // Show success message
      setTimeout(() => {
        alert(`Video uploaded successfully! ${enableTranscription ? 'Transcription is being processed in the background.' : ''}`);
        onUploadComplete();
      }, 1000);

    } catch (err) {
      console.error('❌ Upload failed:', err);
      setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setCurrentStep('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#343a40', color: 'white', padding: '15px 30px', borderBottom: '1px solid #dee2e6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: '24px' }}>🎬 File Uploader</h1>
          <button onClick={onBack} disabled={uploading} style={{ 
            padding: '8px 16px', 
            backgroundColor: uploading ? '#6c757d' : '#dc3545', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: uploading ? 'not-allowed' : 'pointer' 
          }}>
            ← Back to Library
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '30px 20px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '28px', color: '#343a40', textAlign: 'center' }}>Upload New Video</h2>
          <p style={{ textAlign: 'center', color: '#6c757d', marginBottom: '30px' }}>
            Upload MP4 videos to your S3 bucket with automatic transcription powered by AWS Transcribe
          </p>

          {/* File Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#495057' }}>
              Select Video File (MP4) *
            </label>
            <div style={{ 
              border: '2px dashed #dee2e6', 
              borderRadius: '8px', 
              padding: '20px', 
              textAlign: 'center',
              backgroundColor: file ? '#d4edda' : '#f8f9fa',
              transition: 'all 0.3s ease'
            }}>
              <input
                type="file"
                accept="video/mp4,video/*"
                onChange={handleFileSelect}
                disabled={uploading}
                style={{ 
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  backgroundColor: 'white'
                }}
              />
              {file && (
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #c3e6cb' }}>
                  <p style={{ margin: '5px 0', fontWeight: 'bold', color: '#155724' }}>📹 {file.name}</p>
                  <p style={{ margin: '5px 0', color: '#155724' }}>📏 {(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                  <p style={{ margin: '5px 0', color: '#155724' }}>🎭 {file.type}</p>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#495057' }}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter video title..."
              disabled={uploading}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                fontSize: '16px',
                backgroundColor: uploading ? '#e9ecef' : 'white'
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#495057' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter video description (optional)..."
              disabled={uploading}
              rows={3}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                fontSize: '16px',
                backgroundColor: uploading ? '#e9ecef' : 'white',
                minHeight: '100px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Language and Quality */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#495057' }}>
                Language *
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ced4da',
                  borderRadius: '6px',
                  fontSize: '16px',
                  backgroundColor: uploading ? '#e9ecef' : 'white'
                }}
              >
                {languages.map(lang => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#495057' }}>
                Quality *
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ced4da',
                  borderRadius: '6px',
                  fontSize: '16px',
                  backgroundColor: uploading ? '#e9ecef' : 'white'
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Transcription Option */}
          <div style={{ 
            marginBottom: '25px', 
            padding: '20px', 
            backgroundColor: '#e7f3ff', 
            borderRadius: '8px', 
            border: '1px solid #b8daff' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <input
                type="checkbox"
                id="enableTranscription"
                checked={enableTranscription}
                onChange={(e) => setEnableTranscription(e.target.checked)}
                disabled={uploading}
                style={{ marginRight: '10px', transform: 'scale(1.2)' }}
              />
              <label htmlFor="enableTranscription" style={{ fontWeight: 'bold', color: '#0056b3', fontSize: '16px' }}>
                🎤 Enable Automatic Transcription
              </label>
            </div>
            <p style={{ margin: 0, color: '#0056b3', fontSize: '14px', lineHeight: '1.4' }}>
              Automatically generate text transcription from your video using AWS Transcribe. 
              The transcription will be available in the selected language and can be downloaded later.
            </p>
            {enableTranscription && (
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'white', borderRadius: '6px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                  <strong>Selected Language:</strong> {languages.find(l => l.value === language)?.label} 
                  <br />
                  <strong>AWS Transcribe Code:</strong> {TranscriptionService.getAWSLanguageCode(language)}
                </p>
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                padding: '20px', 
                backgroundColor: '#fff3cd', 
                borderRadius: '8px', 
                border: '1px solid #ffeaa7',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
                <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>Processing Upload...</h4>
                <p style={{ margin: '0 0 15px 0', color: '#856404', fontWeight: 'bold' }}>{currentStep}</p>
                
                <div style={{ 
                  width: '100%', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '4px', 
                  overflow: 'hidden',
                  marginBottom: '10px'
                }}>
                  <div 
                    style={{ 
                      width: `${uploadProgress}%`,
                      height: '20px',
                      backgroundColor: uploadProgress === 100 ? '#28a745' : '#007bff',
                      transition: 'width 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {uploadProgress}%
                  </div>
                </div>

                {enableTranscription && uploadProgress === 100 && (
                  <div style={{ marginTop: '15px' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#856404' }}>
                      🎤 Transcription will start automatically after upload completes
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div style={{ 
              marginBottom: '20px',
              padding: '15px',
              backgroundColor: '#f8d7da',
              borderRadius: '6px',
              border: '1px solid #f5c6cb',
              color: '#721c24'
            }}>
              ❌ {error}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={onBack}
              disabled={uploading}
              style={{
                padding: '12px 24px',
                backgroundColor: uploading ? '#e9ecef' : '#6c757d',
                color: uploading ? '#6c757d' : 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '500'
              }}
            >
              Cancel
            </button>
            
            <button
              onClick={testDatabaseConnection}
              disabled={uploading}
              style={{
                padding: '12px 24px',
                backgroundColor: uploading ? '#e9ecef' : '#17a2b8',
                color: uploading ? '#6c757d' : 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '500'
              }}
            >
              🧪 Test DB
            </button>
            
            <button
              onClick={handleUpload}
              disabled={!file || !title.trim() || uploading}
              style={{
                padding: '12px 32px',
                backgroundColor: (!file || !title.trim() || uploading) ? '#e9ecef' : '#007bff',
                color: (!file || !title.trim() || uploading) ? '#6c757d' : 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: (!file || !title.trim() || uploading) ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                minWidth: '180px'
              }}
            >
              {uploading ? '🚀 Uploading...' : '📤 Upload Video'}
            </button>
          </div>

          {/* Info Panel */}
          {!uploading && (
            <div style={{ 
              marginTop: '25px', 
              padding: '15px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>📋 Upload Process:</h4>
              <ol style={{ margin: 0, paddingLeft: '20px', color: '#6c757d', fontSize: '14px' }}>
                <li>Video file will be uploaded to S3 bucket</li>
                <li>Video metadata will be saved to DynamoDB</li>
                {enableTranscription && (
                  <>
                    <li>AWS Transcribe will process the audio automatically</li>
                    <li>Transcription will be available in the video library</li>
                  </>
                )}
                <li>You'll be redirected to the video library when complete</li>
              </ol>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default VideoUploader;