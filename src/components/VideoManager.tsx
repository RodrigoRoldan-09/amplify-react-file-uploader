// components/VideoManager.tsx - 5 VIDEOS PER PAGE
import { useState } from "react";

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
  const videosPerPage = 5; // CHANGED FROM 12 TO 5

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

  // Demo videos data - easily removable later
  const [videos, setVideos] = useState<VideoItem[]>([
    {
      id: "1",
      title: "Marketing Presentation Q1 2024",
      description: "Quarterly marketing results and strategy overview",
      s3Key: "videos/marketing-q1-2024.mp4",
      s3Url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
      language: "english",
      quality: "high",
      duration: "12:34",
      fileSize: "45.2 MB",
      uploadedAt: "2024-01-15",
      thumbnail: "https://via.placeholder.com/200x120/8B5CF6/ffffff?text=Marketing+Q1"
    },
    {
      id: "2", 
      title: "Product Demo - New Features",
      description: "Demonstration of latest product capabilities",
      s3Key: "videos/product-demo-2024.mp4",
      s3Url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4",
      language: "english",
      quality: "high",
      duration: "8:45",
      fileSize: "32.1 MB",
      uploadedAt: "2024-01-20",
      thumbnail: "https://via.placeholder.com/200x120/A855F7/ffffff?text=Product+Demo"
    },
    {
      id: "3",
      title: "Team Meeting - Project Alpha",
      description: "Weekly sync meeting for Project Alpha development",
      s3Key: "videos/team-meeting-alpha.mp4", 
      s3Url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_5mb.mp4",
      language: "english",
      quality: "medium",
      duration: "45:12",
      fileSize: "128.7 MB",
      uploadedAt: "2024-01-22",
      thumbnail: "https://via.placeholder.com/200x120/9333EA/ffffff?text=Team+Meeting"
    },
    {
      id: "4",
      title: "Training Session - Security Protocols",
      description: "Mandatory security training for all employees",
      s3Key: "videos/security-training.mp4",
      s3Url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
      language: "spanish",
      quality: "high", 
      duration: "25:30",
      fileSize: "89.4 MB",
      uploadedAt: "2024-01-25",
      thumbnail: "https://via.placeholder.com/200x120/7C3AED/ffffff?text=Security+Training"
    },
    {
      id: "5",
      title: "Customer Testimonials Compilation",
      description: "Collection of customer feedback and success stories",
      s3Key: "videos/testimonials-2024.mp4",
      s3Url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4", 
      language: "english",
      quality: "high",
      duration: "15:20",
      fileSize: "67.8 MB",
      uploadedAt: "2024-01-28",
      thumbnail: "https://via.placeholder.com/200x120/6D28D9/ffffff?text=Testimonials"
    },
    // Adding more demo videos to test pagination
    {
      id: "6",
      title: "Sales Training Workshop",
      description: "Advanced sales techniques and customer engagement",
      s3Key: "videos/sales-training.mp4",
      s3Url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
      language: "english",
      quality: "high",
      duration: "32:15",
      fileSize: "95.3 MB",
      uploadedAt: "2024-02-01",
      thumbnail: "https://via.placeholder.com/200x120/8B5CF6/ffffff?text=Sales+Training"
    },
    {
      id: "7",
      title: "Technical Architecture Review",
      description: "System architecture and scalability discussion",
      s3Key: "videos/tech-review.mp4",
      s3Url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4",
      language: "english",
      quality: "medium",
      duration: "18:42",
      fileSize: "52.7 MB",
      uploadedAt: "2024-02-03",
      thumbnail: "https://via.placeholder.com/200x120/A855F7/ffffff?text=Tech+Review"
    },
    {
      id: "8",
      title: "Company All-Hands Meeting",
      description: "Quarterly company updates and announcements",
      s3Key: "videos/all-hands.mp4",
      s3Url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_5mb.mp4",
      language: "english",
      quality: "high",
      duration: "58:30",
      fileSize: "164.2 MB",
      uploadedAt: "2024-02-05",
      thumbnail: "https://via.placeholder.com/200x120/9333EA/ffffff?text=All+Hands"
    },
    {
      id: "9",
      title: "UX Design Workshop",
      description: "User experience design principles and best practices",
      s3Key: "videos/ux-workshop.mp4",
      s3Url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
      language: "english",
      quality: "high",
      duration: "41:18",
      fileSize: "118.6 MB",
      uploadedAt: "2024-02-08",
      thumbnail: "https://via.placeholder.com/200x120/7C3AED/ffffff?text=UX+Workshop"
    },
    {
      id: "10",
      title: "Financial Planning Session",
      description: "Budget planning and financial projections for Q2",
      s3Key: "videos/financial-planning.mp4",
      s3Url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4",
      language: "english",
      quality: "medium",
      duration: "29:45",
      fileSize: "78.9 MB",
      uploadedAt: "2024-02-10",
      thumbnail: "https://via.placeholder.com/200x120/6D28D9/ffffff?text=Financial+Planning"
    },
    {
      id: "11",
      title: "DevOps Best Practices",
      description: "CI/CD pipelines and deployment strategies",
      s3Key: "videos/devops-practices.mp4",
      s3Url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
      language: "english",
      quality: "high",
      duration: "36:22",
      fileSize: "102.4 MB",
      uploadedAt: "2024-02-12",
      thumbnail: "https://via.placeholder.com/200x120/8B5CF6/ffffff?text=DevOps"
    },
    {
      id: "12",
      title: "Marketing Strategy Review",
      description: "Q1 marketing performance and Q2 strategy planning",
      s3Key: "videos/marketing-strategy.mp4",
      s3Url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_5mb.mp4",
      language: "english",
      quality: "high",
      duration: "44:55",
      fileSize: "134.8 MB",
      uploadedAt: "2024-02-15",
      thumbnail: "https://via.placeholder.com/200x120/A855F7/ffffff?text=Marketing+Strategy"
    },
    {
      id: "13",
      title: "HR Policy Updates",
      description: "New employee policies and benefits overview",
      s3Key: "videos/hr-updates.mp4",
      s3Url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
      language: "english",
      quality: "medium",
      duration: "22:10",
      fileSize: "61.5 MB",
      uploadedAt: "2024-02-18",
      thumbnail: "https://via.placeholder.com/200x120/9333EA/ffffff?text=HR+Updates"
    }
  ]);

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

  const handleEditSave = (id: string) => {
    setVideos(videos.map(video =>
      video.id === id ? { 
        ...video, 
        title: editTitle,
        description: editDescription,
        language: editLanguage,
        quality: editQuality
      } : video
    ));
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    setEditLanguage("");
    setEditQuality("");
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    setEditLanguage("");
    setEditQuality("");
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this video?")) {
      setVideos(videos.filter(video => video.id !== id));
      setSelectedVideos(selectedVideos.filter(selectedId => selectedId !== id));
      
      // Adjust current page if necessary
      const newFilteredVideos = videos.filter(video => video.id !== id).filter(video =>
        video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        video.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      const newTotalPages = Math.ceil(newFilteredVideos.length / videosPerPage);
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      }
    }
  };

  const handleBulkDelete = () => {
    if (selectedVideos.length > 0 && window.confirm(`Delete ${selectedVideos.length} selected videos?`)) {
      setVideos(videos.filter(video => !selectedVideos.includes(video.id)));
      setSelectedVideos([]);
      
      // Adjust current page if necessary
      const newFilteredVideos = videos.filter(video => !selectedVideos.includes(video.id)).filter(video =>
        video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        video.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      const newTotalPages = Math.ceil(newFilteredVideos.length / videosPerPage);
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      }
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
            <span className="video-count">{filteredVideos.length} videos total</span>
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
                          Save
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
                      </h3>
                      <p className="video-description-row">{video.description}</p>
                      <div className="video-meta-row">
                        <span className="meta-item">📅 {video.uploadedAt}</span>
                        <span className="meta-item">📏 {video.fileSize}</span>
                        <span className="meta-item">🌐 {video.language}</span>
                        <span className={`quality-badge ${video.quality}`}>{video.quality.toUpperCase()}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="video-actions-row">
                  <button 
                    className="action-icon-large"
                    onClick={() => handleEditStart(video)}
                    title="Edit video"
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    className="action-icon-large"
                    onClick={() => handleDelete(video.id)}
                    title="Delete video"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredVideos.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📹</div>
            <h3>No videos found</h3>
            <p>
              {searchTerm 
                ? "Try adjusting your search terms" 
                : "Upload your first video to get started"
              }
            </p>
            <button className="action-btn primary" onClick={onUploadNew}>
              Upload Video
            </button>
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
          <span>Storage used: 1.2 GB / 5 GB | Page {currentPage} of {totalPages}</span>
        </div>
      </div>
    </div>
  );
};

export default VideoManager;