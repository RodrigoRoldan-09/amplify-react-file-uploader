// components/VideoManager.tsx - FIXED VIDEO LOADING FROM S3
import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import { getUrl, remove } from "aws-amplify/storage";
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();

// Define proper type for database video record
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLanguage, setEditLanguage] = useState("");
  const [editQuality, setEditQuality] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videosPerPage = 5;

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

  // Helper functions with proper types
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

  // Process videos data with proper typing (useCallback to prevent dependency issues)
  const processVideosData = useCallback(async (dbVideos: DatabaseVideo[]) => {
    console.log('Processing videos from DB:', dbVideos);
    
    if (!dbVideos || dbVideos.length === 0) {
      console.log('No videos found in database');
      setVideos([]);
      return;
    }

    const processedVideos = await Promise.all(
      dbVideos.map(async (video, index) => {
        try {
          console.log(`Processing video ${index + 1}/${dbVideos.length}:`, video.s3Key);
          
          // Get signed URL for video playback
          let signedUrl = '';
          try {
            const urlResult = await getUrl({ path: video.s3Key });
            signedUrl = urlResult.url.toString();
            console.log(`✅ Got URL for ${video.s3Key}`);
          } catch (urlError) {
            console.warn(`❌ Failed to get URL for ${video.s3Key}:`, urlError);
            signedUrl = `#video-${video.id}`; // Fallback
          }

          return {
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
        } catch (error) {
          console.error(`Error processing video ${video.id}:`, error);
          return null;
        }
      })
    );

    // Filter out failed videos
    const validVideos = processedVideos.filter((video): video is VideoItem => video !== null);
    console.log(`✅ Successfully processed ${validVideos.length}/${dbVideos.length} videos`);
    setVideos(validVideos);
  }, []); // Empty dependency array since it doesn't depend on state

  // Load videos from DynamoDB (useCallback to prevent dependency issues)
  const loadVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Loading videos from DynamoDB...');
      const result = await client.models.Video.list();
      
      console.log('📋 DynamoDB response:', result);
      
      if (result.data && result.data.length > 0) {
        console.log(`📹 Found ${result.data.length} videos in database`);
        await processVideosData(result.data as DatabaseVideo[]);
      } else {
        console.log('📭 No videos found in database');
        setVideos([]);
      }
    } catch (err) {
      console.error('❌ Error loading videos:', err);
      setError(`Failed to load videos: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [processVideosData]); // processVideosData is now in dependencies

  // Load videos on component mount with proper dependencies
  useEffect(() => {
    console.log('🚀 VideoManager mounted, loading videos...');
    loadVideos();
    
    // Set up real-time subscription
    console.log('🔔 Setting up real-time subscription...');
    const subscription = client.models.Video.observeQuery().subscribe({
      next: ({ items }) => {
        console.log('🔔 Real-time update received:', items.length, 'items');
        if (items && items.length > 0) {
          processVideosData(items as DatabaseVideo[]);
        }
      },
      error: (err) => {
        console.error('🔔 Subscription error:', err);
        setError('Failed to sync with database');
      }
    });

    return () => {
      console.log('🔌 Unsubscribing from real-time updates');
      subscription.unsubscribe();
    };
  }, [loadVideos, processVideosData]); // Now includes all dependencies

  const filteredVideos = videos.filter(video =>
    video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredVideos.length / videosPerPage);
  const startIndex = (currentPage - 1) * videosPerPage;
  const endIndex = startIndex + videosPerPage;
  const currentVideos = filteredVideos.slice(startIndex, endIndex);

  const handleEditStart = (video: VideoItem) => {
    setEditingId(video.id);
    setEditTitle(video.title);
    setEditDescription(video.description);
    setEditLanguage(video.language);
    setEditQuality(video.quality);
  };

  const handleEditSave = async (id: string) => {
    try {
      console.log('Updating video:', id);
      
      await client.models.Video.update({
        id,
        title: editTitle,
        description: editDescription,
        language: editLanguage,
        quality: editQuality
      });

      console.log('Video updated successfully');
      
      // Update local state
      setVideos(videos.map(video =>
        video.id === id ? { 
          ...video, 
          title: editTitle,
          description: editDescription,
          language: editLanguage,
          quality: editQuality
        } : video
      ));

      // Clear editing state
      setEditingId(null);
      setEditTitle("");
      setEditDescription("");
      setEditLanguage("");
      setEditQuality("");
      
    } catch (error) {
      console.error('Error updating video:', error);
      alert('Failed to update video. Please try again.');
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    setEditLanguage("");
    setEditQuality("");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this video? This will remove it from S3 and the database.")) {
      return;
    }

    try {
      const video = videos.find(v => v.id === id);
      if (!video) return;

      console.log('Deleting video:', id, video.s3Key);

      // Delete from S3
      try {
        await remove({ path: video.s3Key });
        console.log('S3 file deleted');
      } catch (s3Error) {
        console.warn('S3 deletion failed (file may not exist):', s3Error);
      }

      // Delete from DynamoDB
      await client.models.Video.delete({ id });
      console.log('Database record deleted');

      // Update local state
      setVideos(videos.filter(video => video.id !== id));
      setSelectedVideos(selectedVideos.filter(selectedId => selectedId !== id));

      // Adjust current page if necessary
      const newFilteredVideos = videos.filter(video => video.id !== id);
      const newTotalPages = Math.ceil(newFilteredVideos.length / videosPerPage);
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      }

    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Failed to delete video. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedVideos.length === 0) return;
    
    if (!window.confirm(`Delete ${selectedVideos.length} selected videos? This will remove them from S3 and the database.`)) {
      return;
    }

    try {
      console.log('Bulk deleting videos:', selectedVideos);

      // Delete each video
      await Promise.all(selectedVideos.map(async (videoId) => {
        const video = videos.find(v => v.id === videoId);
        if (!video) return;

        // Delete from S3
        try {
          await remove({ path: video.s3Key });
        } catch (s3Error) {
          console.warn(`S3 deletion failed for ${video.s3Key}:`, s3Error);
        }

        // Delete from DynamoDB
        await client.models.Video.delete({ id: videoId });
      }));

      // Update local state
      setVideos(videos.filter(video => !selectedVideos.includes(video.id)));
      setSelectedVideos([]);

      console.log('Bulk deletion completed');

    } catch (error) {
      console.error('Error during bulk deletion:', error);
      alert('Some videos failed to delete. Please try again.');
    }
  };

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
            <h3>Loading videos from S3...</h3>
            <p>Connecting to DynamoDB and generating signed URLs...</p>
            <button className="action-btn secondary" onClick={loadVideos}>
              Retry Loading
            </button>
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
            <div className="error-actions">
              <button className="action-btn primary" onClick={loadVideos}>
                Retry
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
              {filteredVideos.length} videos total 
              {videos.length > 0 && (
                <span className="sync-status">🔄 Synced with S3+DB</span>
              )}
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

        {selectedVideos.length > 0 && (
          <div className="bulk-actions">
            <span className="selection-count">{selectedVideos.length} videos selected</span>
            <div className="bulk-buttons">
              <button className="bulk-btn secondary" onClick={deselectAllVideos}>Deselect All</button>
              <button className="bulk-btn danger" onClick={handleBulkDelete}>Delete Selected</button>
            </div>
          </div>
        )}

        <div className="manager-controls">
          <div className="select-actions">
            <button className="control-btn purple" onClick={selectAllVideos}>Select All on Page</button>
            <button className="control-btn purple" onClick={deselectAllVideos}>Deselect All</button>
          </div>
          
          <div className="pagination-info">
            <span>Page {currentPage} of {totalPages} | Showing {currentVideos.length} of {filteredVideos.length} videos</span>
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

                <div className="video-thumbnail-small" onClick={() => onViewVideo(video)}>
                  <img src={video.thumbnail} alt={video.title} />
                  <div className="play-overlay-small">
                    <div className="play-button-small">▶</div>
                  </div>
                  <div className="duration-badge-small">{video.duration}</div>
                  <div className="s3-badge">S3</div>
                </div>

                <div className="video-details">
                  {editingId === video.id ? (
                    <div className="edit-form-inline">
                      <div className="edit-row-inline">
                        <div className="edit-field-inline">
                          <label>Title:</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="edit-input-inline"
                          />
                        </div>
                        <div className="edit-field-inline">
                          <label>Language:</label>
                          <select
                            value={editLanguage}
                            onChange={(e) => setEditLanguage(e.target.value)}
                            className="edit-select-inline"
                          >
                            {languages.map(lang => (
                              <option key={lang.value} value={lang.value}>{lang.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="edit-field-inline">
                          <label>Quality:</label>
                          <select
                            value={editQuality}
                            onChange={(e) => setEditQuality(e.target.value)}
                            className="edit-select-inline"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      </div>
                      <div className="edit-field-inline">
                        <label>Description:</label>
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="edit-textarea-inline"
                          rows={2}
                        />
                      </div>
                      <div className="edit-buttons-inline">
                        <button className="save-btn-inline" onClick={() => handleEditSave(video.id)}>
                          Save to DB
                        </button>
                        <button className="cancel-btn-inline" onClick={handleEditCancel}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="video-title-row" onClick={() => onViewVideo(video)}>
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
                  <button 
                    className="action-icon-large"
                    onClick={() => handleEditStart(video)}
                    title="Edit video metadata"
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    className="action-icon-large danger"
                    onClick={() => handleDelete(video.id)}
                    title="Delete from S3 + DB"
                  >
                    🗑️ Delete
                  </button>
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
                : "Upload your first video to S3 to get started"
              }
            </p>
            <div className="empty-actions">
              <button className="action-btn primary" onClick={onUploadNew}>
                Upload Video to S3
              </button>
              <button className="action-btn secondary" onClick={loadVideos}>
                Refresh List
              </button>
            </div>
          </div>
        )}

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
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </button>
              ))}
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
          <span>S3 Bucket: file-uploader-demo-rodes-01 | Page {currentPage} of {totalPages}</span>
        </div>
      </div>
    </div>
  );
};

export default VideoManager;