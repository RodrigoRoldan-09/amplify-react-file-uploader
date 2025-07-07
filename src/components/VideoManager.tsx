// components/VideoManager.tsx - WITH FULL CRUD
import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import { getUrl, remove, list } from "aws-amplify/storage";
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();

type DatabaseVideo = {
  id: string;
  title?: string | null;
  description?: string | null;
  s3Key: string;
  s3Url?: string | null;
  language?: string | null;
  quality?: string | null;
  transcription?: string | null;
  duration?: number | null;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedAt?: string | null;
  status?: string | null;
};

export interface VideoItem {
  id: string;
  title: string;
  description: string;
  s3Key: string;
  s3Url: string;
  language: string;
  quality: string;
  duration: string;
  fileSize: string;
  uploadedAt: string;
  thumbnail: string;
  status?: string;
}

interface VideoManagerProps {
  onBack: () => void;
  onViewVideo: (video: VideoItem) => void;
  onUploadNew: () => void;
}

const VideoManager: React.FC<VideoManagerProps> = ({ onBack, onViewVideo, onUploadNew }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  // CRUD state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLanguage, setEditLanguage] = useState("");
  const [editQuality, setEditQuality] = useState("");
  const [saving, setSaving] = useState(false);
  
  const videosPerPage = 3;

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

  const addDebugInfo = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const debugMessage = `[${timestamp}] ${message}`;
    console.log(debugMessage);
    setDebugInfo(prev => [...prev.slice(-10), debugMessage]);
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown date';
    }
  };

  const generateThumbnailUrl = (title: string): string => {
    const colors = ['8B5CF6', 'A855F7', '9333EA', '7C3AED', '6D28D9'];
    const color = colors[title.length % colors.length];
    const encodedTitle = encodeURIComponent(title.substring(0, 15));
    return `https://via.placeholder.com/200x120/${color}/ffffff?text=${encodedTitle}`;
  };

  // Test S3 connectivity
  const testS3Connection = useCallback(async () => {
    try {
      addDebugInfo('Testing S3 connectivity...');
      const listResult = await list({ path: 'videos/' });
      addDebugInfo(`S3 List Result: Found ${listResult.items.length} items`);
      
      if (listResult.items.length > 0) {
        const firstItem = listResult.items[0];
        addDebugInfo(`First S3 item: ${firstItem.path}`);
        
        try {
          await getUrl({ path: firstItem.path });
          addDebugInfo(`✅ S3 URL generation successful`);
          return true;
        } catch (urlError) {
          addDebugInfo(`❌ S3 URL generation failed: ${urlError}`);
          return false;
        }
      } else {
        addDebugInfo('No items found in S3 videos/ folder');
        return true;
      }
    } catch (error) {
      addDebugInfo(`❌ S3 connectivity test failed: ${error}`);
      return false;
    }
  }, []);

  // Test DynamoDB connectivity
  const testDynamoDBConnection = useCallback(async () => {
    try {
      addDebugInfo('Testing DynamoDB connectivity...');
      const result = await client.models.Video.list();
      addDebugInfo(`DynamoDB Result: Found ${result.data?.length || 0} records`);
      addDebugInfo(`DynamoDB Errors: ${result.errors?.length || 0} errors`);
      
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((error, index) => {
          addDebugInfo(`DynamoDB Error ${index + 1}: ${error.message}`);
        });
      }
      
      return result;
    } catch (error) {
      addDebugInfo(`❌ DynamoDB connectivity test failed: ${error}`);
      throw error;
    }
  }, []);

  const processVideosData = useCallback(async (dbVideos: DatabaseVideo[]) => {
    addDebugInfo(`Processing ${dbVideos.length} videos from database`);
    
    if (!dbVideos || dbVideos.length === 0) {
      addDebugInfo('No videos to process');
      setVideos([]);
      return;
    }

    const processedVideos = await Promise.all(
      dbVideos.map(async (video, index) => {
        try {
          addDebugInfo(`Processing video ${index + 1}: ${video.s3Key}`);
          
          let signedUrl = '';
          try {
            const urlResult = await getUrl({ path: video.s3Key });
            signedUrl = urlResult.url.toString();
            addDebugInfo(`✅ Got signed URL for ${video.s3Key}`);
          } catch (urlError) {
            addDebugInfo(`❌ Failed to get URL for ${video.s3Key}: ${urlError}`);
            signedUrl = `#error-${video.id}`;
          }

          const processedVideo = {
            id: video.id,
            title: video.title || 'Untitled Video',
            description: video.description || 'No description',
            s3Key: video.s3Key,
            s3Url: signedUrl,
            language: video.language || 'english',
            quality: video.quality || 'medium',
            duration: formatDuration(video.duration || 0),
            fileSize: formatFileSize(video.fileSize || 0),
            uploadedAt: formatDate(video.uploadedAt || new Date().toISOString()),
            thumbnail: generateThumbnailUrl(video.title || 'Video'),
            status: video.status || 'completed'
          } as VideoItem;

          addDebugInfo(`✅ Processed video: ${processedVideo.title}`);
          return processedVideo;
        } catch (error) {
          addDebugInfo(`❌ Error processing video ${video.id}: ${error}`);
          return null;
        }
      })
    );

    const validVideos = processedVideos.filter((video): video is VideoItem => video !== null);
    addDebugInfo(`✅ Successfully processed ${validVideos.length}/${dbVideos.length} videos`);
    setVideos(validVideos);
  }, []);

  const loadVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo([]);
      
      addDebugInfo('=== STARTING VIDEO LOAD PROCESS ===');
      
      // Test S3 first
      const s3Works = await testS3Connection();
      if (!s3Works) {
        setError('S3 connectivity issues detected. Check console for details.');
        return;
      }
      
      // Test DynamoDB
      const result = await testDynamoDBConnection();
      
      if (result.data && result.data.length > 0) {
        addDebugInfo(`Found ${result.data.length} videos in DynamoDB`);
        await processVideosData(result.data as DatabaseVideo[]);
      } else {
        addDebugInfo('No videos found in DynamoDB');
        setVideos([]);
      }
      
      addDebugInfo('=== VIDEO LOAD PROCESS COMPLETE ===');
    } catch (err) {
      const errorMessage = `Failed to load videos: ${err instanceof Error ? err.message : 'Unknown error'}`;
      addDebugInfo(`❌ ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [processVideosData, testS3Connection, testDynamoDBConnection]);

  // CRUD Operations
  const handleEditStart = (video: VideoItem) => {
    console.log('🖊️ Starting edit for video:', video.title);
    setEditingId(video.id);
    setEditTitle(video.title);
    setEditDescription(video.description);
    setEditLanguage(video.language);
    setEditQuality(video.quality);
  };

  const handleEditSave = async (id: string) => {
    if (!editTitle.trim()) {
      alert('Title cannot be empty');
      return;
    }

    setSaving(true);
    try {
      console.log('💾 Saving video updates:', id);
      addDebugInfo(`Updating video ${id} with new data`);
      
      const updateResult = await client.models.Video.update({
        id,
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        language: editLanguage,
        quality: editQuality
      });

      if (updateResult.errors && updateResult.errors.length > 0) {
        throw new Error(updateResult.errors[0].message);
      }

      console.log('✅ Video updated successfully:', updateResult);
      addDebugInfo(`✅ Video ${id} updated successfully`);

      // Update local state immediately
      setVideos(prevVideos =>
        prevVideos.map(video =>
          video.id === id
            ? {
                ...video,
                title: editTitle.trim(),
                description: editDescription.trim() || 'No description',
                language: editLanguage,
                quality: editQuality
              }
            : video
        )
      );

      // Clear editing state
      handleEditCancel();
      
      alert('Video updated successfully!');

    } catch (error) {
      console.error('❌ Error updating video:', error);
      addDebugInfo(`❌ Failed to update video ${id}: ${error}`);
      alert(`Failed to update video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEditCancel = () => {
    console.log('❌ Canceling edit');
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    setEditLanguage("");
    setEditQuality("");
  };

  const handleViewVideo = (video: VideoItem) => {
    console.log('🎥 Opening video viewer for:', video.title);
    addDebugInfo(`Opening video viewer for: ${video.title}`);
    onViewVideo(video);
  };

  // Manual create test video
  const createTestVideo = async () => {
    try {
      addDebugInfo('Creating test video in DynamoDB...');
      
      const testVideo = await client.models.Video.create({
        title: 'Test Video',
        description: 'This is a test video created for debugging',
        s3Key: 'videos/test-video.mp4',
        language: 'english',
        quality: 'high',
        transcription: 'This is a test transcription',
        duration: 120,
        fileSize: 1024 * 1024 * 50, // 50MB
        mimeType: 'video/mp4',
        uploadedAt: new Date().toISOString(),
        status: 'completed'
      });
      
      addDebugInfo(`✅ Test video created: ${testVideo.data?.id}`);
      loadVideos(); // Reload to see the new video
    } catch (error) {
      addDebugInfo(`❌ Failed to create test video: ${error}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this video?")) return;

    try {
      const video = videos.find(v => v.id === id);
      if (!video) return;

      console.log('🗑️ Deleting video:', video.title);
      addDebugInfo(`Deleting video: ${video.title}`);

      // Delete from S3 (optional - file might not exist)
      try {
        await remove({ path: video.s3Key });
        addDebugInfo(`✅ S3 file deleted: ${video.s3Key}`);
      } catch (s3Error) {
        console.warn('⚠️ S3 deletion failed (file may not exist):', s3Error);
        addDebugInfo(`⚠️ S3 deletion failed: ${s3Error}`);
      }

      // Delete from DynamoDB
      await client.models.Video.delete({ id });
      addDebugInfo(`✅ Database record deleted: ${id}`);

      // Update local state
      setVideos(videos.filter(video => video.id !== id));
      setSelectedVideos(selectedVideos.filter(selectedId => selectedId !== id));

      console.log('✅ Video deleted successfully');
      alert('Video deleted successfully!');

    } catch (error) {
      console.error('❌ Error deleting video:', error);
      addDebugInfo(`❌ Failed to delete video: ${error}`);
      alert('Failed to delete video. Please try again.');
    }
  };

  useEffect(() => {
    addDebugInfo('VideoManager component mounted');
    loadVideos();
    
    // Set up real-time subscription
    const subscription = client.models.Video.observeQuery().subscribe({
      next: ({ items }) => {
        addDebugInfo(`🔔 Real-time update: ${items.length} items`);
        if (items && items.length >= 0) {
          processVideosData(items as DatabaseVideo[]);
        }
      },
      error: (err) => {
        addDebugInfo(`🔔 Subscription error: ${err}`);
        setError('Real-time sync failed');
      }
    });

    return () => {
      addDebugInfo('Unsubscribing from real-time updates');
      subscription.unsubscribe();
    };
  }, [loadVideos, processVideosData]);

  const filteredVideos = videos.filter(video =>
    video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredVideos.length / videosPerPage);
  const startIndex = (currentPage - 1) * videosPerPage;
  const endIndex = startIndex + videosPerPage;
  const currentVideos = filteredVideos.slice(startIndex, endIndex);

  const toggleSelectVideo = (id: string) => {
    setSelectedVideos(prev =>
      prev.includes(id) ? prev.filter(vid => vid !== id) : [...prev, id]
    );
  };

  const selectAllVideos = () => {
    setSelectedVideos(currentVideos.map(video => video.id));
  };

  const deselectAllVideos = () => {
    setSelectedVideos([]);
  };

  const handleBulkDelete = async () => {
    if (selectedVideos.length === 0) return;
    if (!window.confirm(`Delete ${selectedVideos.length} selected videos? This will remove them from S3 and the database.`)) return;

    try {
      console.log('🗑️ Bulk deleting videos:', selectedVideos);
      addDebugInfo(`Starting bulk delete of ${selectedVideos.length} videos`);

      await Promise.all(selectedVideos.map(async (videoId) => {
        const video = videos.find(v => v.id === videoId);
        if (!video) return;

        // Delete from S3 (optional - file might not exist)
        try {
          await remove({ path: video.s3Key });
          addDebugInfo(`✅ S3 file deleted: ${video.s3Key}`);
        } catch (s3Error) {
          console.warn(`⚠️ S3 deletion failed for ${video.s3Key}:`, s3Error);
          addDebugInfo(`⚠️ S3 deletion failed: ${s3Error}`);
        }

        // Delete from DynamoDB
        await client.models.Video.delete({ id: videoId });
        addDebugInfo(`✅ Database record deleted: ${videoId}`);
      }));

      // Update local state
      setVideos(videos.filter(video => !selectedVideos.includes(video.id)));
      setSelectedVideos([]);

      console.log('✅ Bulk deletion completed');
      addDebugInfo(`✅ Bulk deletion completed: ${selectedVideos.length} videos deleted`);
      alert(`Successfully deleted ${selectedVideos.length} videos!`);

    } catch (error) {
      console.error('❌ Error during bulk deletion:', error);
      addDebugInfo(`❌ Bulk deletion failed: ${error}`);
      alert('Some videos failed to delete. Please try again.');
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (loading) {
    return (
      <div className="video-manager">
        <header className="header">
          <div className="header-left">
            <h1 className="logo">🎬 File Uploader</h1>
          </div>
        </header>
        <main className="manager-content">
          <div className="loading-state">
            <div className="loading-icon">⏳</div>
            <h3>Loading videos...</h3>
            <p>Running diagnostics...</p>
            
            <div className="debug-info">
              <h4>Debug Log:</h4>
              <div className="debug-messages">
                {debugInfo.map((message, index) => (
                  <div key={index} className="debug-message">{message}</div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-manager">
        <header className="header">
          <div className="header-left">
            <h1 className="logo">🎬 File Uploader</h1>
          </div>
        </header>
        <main className="manager-content">
          <div className="error-state">
            <div className="error-icon">❌</div>
            <h3>Error loading videos</h3>
            <p>{error}</p>
            
            <div className="debug-info">
              <h4>Debug Log:</h4>
              <div className="debug-messages">
                {debugInfo.map((message, index) => (
                  <div key={index} className="debug-message">{message}</div>
                ))}
              </div>
            </div>
            
            <div className="error-actions">
              <button className="action-btn primary" onClick={loadVideos}>
                Retry
              </button>
              <button className="action-btn secondary" onClick={createTestVideo}>
                Create Test Video
              </button>
              <button className="action-btn secondary" onClick={() => {
                setError(null);
                setVideos([]);
              }}>
                Clear Error
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="video-manager">
      <header className="header">
        <div className="header-left">
          <h1 className="logo">🎬 File Uploader</h1>
        </div>
        <div className="header-right">
          <button className="header-btn primary" onClick={onUploadNew}>Upload</button>
          <button className="header-btn">Upload Videos</button>
          <button className="header-btn">Export Options</button>
        </div>
      </header>

      <main className="manager-content">
        <div className="manager-header">
          <div className="manager-title">
            <h2>Video Library</h2>
            <span className="video-count">
              {filteredVideos.length} videos found
            </span>
          </div>
          
          <div className="manager-actions">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search videos..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="search-icon">🔍</span>
            </div>
            
            <button className="action-btn primary" onClick={onUploadNew}>
              + Add New Video
            </button>
          </div>
        </div>

        {/* Debug Panel */}
        <div className="debug-panel">
          <details>
            <summary>🔧 Debug Information ({debugInfo.length} messages)</summary>
            <div className="debug-info">
              <div className="debug-actions">
                <button className="debug-btn" onClick={loadVideos}>Reload Videos</button>
                <button className="debug-btn" onClick={createTestVideo}>Create Test Video</button>
                <button className="debug-btn" onClick={() => setDebugInfo([])}>Clear Log</button>
              </div>
              <div className="debug-messages">
                {debugInfo.map((message, index) => (
                  <div key={index} className="debug-message">{message}</div>
                ))}
              </div>
            </div>
          </details>
        </div>

        {/* Bulk Actions */}
        {selectedVideos.length > 0 && (
          <div className="bulk-actions">
            <span className="selection-count">{selectedVideos.length} videos selected</span>
            <div className="bulk-buttons">
              <button className="bulk-btn secondary" onClick={deselectAllVideos}>
                Deselect All
              </button>
              <button className="bulk-btn danger" onClick={handleBulkDelete}>
                Delete Selected ({selectedVideos.length})
              </button>
            </div>
          </div>
        )}

        {/* Manager Controls */}
        <div className="manager-controls">
          <div className="select-actions">
            <button className="control-btn purple" onClick={selectAllVideos}>
              Select All on Page ({currentVideos.length})
            </button>
            <button className="control-btn purple" onClick={deselectAllVideos}>
              Deselect All
            </button>
          </div>
          
          <div className="pagination-info">
            <span>
              Page {currentPage} of {totalPages} | 
              Showing {currentVideos.length} of {filteredVideos.length} videos
            </span>
          </div>
        </div>

        <div className="videos-table">
          {currentVideos.map((video) => (
            <div key={video.id} className={`video-row ${selectedVideos.includes(video.id) ? 'selected' : ''}`}>
              <div className="video-row-content">
                <div className="video-checkbox-container">
                  <input
                    type="checkbox"
                    className="video-checkbox"
                    checked={selectedVideos.includes(video.id)}
                    onChange={() => toggleSelectVideo(video.id)}
                  />
                </div>

                <div className="video-thumbnail-small" onClick={() => handleViewVideo(video)}>
                  <img src={video.thumbnail} alt={video.title} />
                  <div className="play-overlay-small">
                    <div className="play-button-small">▶</div>
                  </div>
                  <div className="duration-badge-small">{video.duration}</div>
                  <div className="s3-badge">S3</div>
                </div>

                <div className="video-details">
                  {editingId === video.id ? (
                    // EDIT MODE
                    <div className="edit-form-inline">
                      <div className="edit-row">
                        <div className="edit-field">
                          <label>Title:</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="edit-input"
                            disabled={saving}
                            placeholder="Enter video title"
                          />
                        </div>
                        <div className="edit-field">
                          <label>Language:</label>
                          <select
                            value={editLanguage}
                            onChange={(e) => setEditLanguage(e.target.value)}
                            className="edit-select"
                            disabled={saving}
                          >
                            {languages.map(lang => (
                              <option key={lang.value} value={lang.value}>
                                {lang.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="edit-field">
                          <label>Quality:</label>
                          <select
                            value={editQuality}
                            onChange={(e) => setEditQuality(e.target.value)}
                            className="edit-select"
                            disabled={saving}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      </div>
                      <div className="edit-field">
                        <label>Description:</label>
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="edit-textarea"
                          disabled={saving}
                          placeholder="Enter video description"
                          rows={2}
                        />
                      </div>
                      <div className="edit-buttons">
                        <button 
                          className="save-btn" 
                          onClick={() => handleEditSave(video.id)}
                          disabled={saving || !editTitle.trim()}
                        >
                          {saving ? '💾 Saving...' : '💾 Save'}
                        </button>
                        <button 
                          className="cancel-btn" 
                          onClick={handleEditCancel}
                          disabled={saving}
                        >
                          ❌ Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // VIEW MODE
                    <>
                      <h3 className="video-title-row" onClick={() => handleViewVideo(video)}>
                        {video.title}
                        {video.status === 'processing' && <span className="status-badge processing">Processing</span>}
                        {video.status === 'failed' && <span className="status-badge failed">Failed</span>}
                      </h3>
                      <p className="video-description-row">{video.description}</p>
                      <div className="video-meta-row">
                        <span className="meta-item">📅 {video.uploadedAt}</span>
                        <span className="meta-item">📏 {video.fileSize}</span>
                        <span className="meta-item">🌐 {video.language}</span>
                        <span className={`quality-badge ${video.quality}`}>{video.quality.toUpperCase()}</span>
                        <span className="meta-item s3-path">🗂️ {video.s3Key}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="video-actions-row">
                  {editingId !== video.id && (
                    <>
                      <button 
                        className="action-icon-large edit"
                        onClick={() => handleEditStart(video)}
                        title="Edit video metadata"
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        className="action-icon-large view"
                        onClick={() => handleViewVideo(video)}
                        title="View video"
                      >
                        👁️ View
                      </button>
                      <button 
                        className="action-icon-large danger"
                        onClick={() => handleDelete(video.id)}
                        title="Delete video"
                      >
                        🗑️ Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredVideos.length === 0 && !loading && (
          <div className="empty-state">
            <div className="empty-icon">📹</div>
            <h3>No videos found</h3>
            <p>
              {searchTerm 
                ? "Try adjusting your search terms" 
                : "Upload your first video or create a test video"
              }
            </p>
            <div className="empty-actions">
              <button className="action-btn primary" onClick={onUploadNew}>
                Upload Video
              </button>
              <button className="action-btn secondary" onClick={createTestVideo}>
                Create Test Video
              </button>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button 
              className="pagination-btn" 
              onClick={goToPrevPage} 
              disabled={currentPage === 1}
            >
              ← Previous
            </button>
            
            <div className="pagination-numbers">
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                let page;
                if (totalPages <= 10) {
                  page = i + 1;
                } else {
                  // Show pages around current page
                  const start = Math.max(1, currentPage - 4);
                  const end = Math.min(totalPages, start + 9);
                  page = start + i;
                  if (page > end) return null;
                }
                
                return (
                  <button
                    key={page}
                    className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                    onClick={() => goToPage(page)}
                  >
                    {page}
                  </button>
                );
              }).filter(Boolean)}
              
              {totalPages > 10 && currentPage < totalPages - 5 && (
                <>
                  <span className="pagination-ellipsis">...</span>
                  <button
                    className="pagination-number"
                    onClick={() => goToPage(totalPages)}
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>
            
            <button 
              className="pagination-btn" 
              onClick={goToNextPage} 
              disabled={currentPage === totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </main>

      <div className="manager-footer">
        <button className="footer-btn secondary" onClick={onBack}>
          ← Back to Home
        </button>
        <div className="storage-info">
          <span>S3 Bucket: file-uploader-demo-rodes-01 | Debug: {debugInfo.length} logs</span>
        </div>
      </div>
    </div>
  );
};

export default VideoManager;