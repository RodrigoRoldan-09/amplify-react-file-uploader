// components/ExportOptions.tsx - FIXED LAYOUT
import { ExportSettings } from "../App";

interface ExportOptionsProps {
  settings: ExportSettings;
  onSettingsChange: (settings: ExportSettings) => void;
  onSave: () => void;
}

const ExportOptions: React.FC<ExportOptionsProps> = ({ 
  settings, 
  onSettingsChange, 
  onSave 
}) => {
  const handleFormatChange = (format: 'txt' | 'pdf' | 'docx') => {
    onSettingsChange({ ...settings, format });
  };

  const handleTimestampsChange = (includeTimestamps: boolean) => {
    onSettingsChange({ ...settings, includeTimestamps });
  };

  const handlePageNumbersChange = (includePageNumbers: boolean) => {
    onSettingsChange({ ...settings, includePageNumbers });
  };

  return (
    <div className="export-options">
      <header className="header">
        <div className="header-left">
          <h1 className="logo">🎬 File Uploader</h1>
        </div>
        <div className="header-right">
          <button className="header-btn active">Export Options</button>
        </div>
      </header>

      <main className="export-content">
        <div className="export-grid">
          <div className="export-card">
            <h3 className="card-title">Choose Format</h3>
            <div className="format-options">
              <label className="format-option">
                <input
                  type="radio"
                  name="format"
                  checked={settings.format === 'txt'}
                  onChange={() => handleFormatChange('txt')}
                />
                <span className="format-text">Text (.txt)</span>
              </label>
              <label className="format-option">
                <input
                  type="radio"
                  name="format"
                  checked={settings.format === 'pdf'}
                  onChange={() => handleFormatChange('pdf')}
                />
                <span className="format-text">PDF (.pdf)</span>
              </label>
              <label className="format-option">
                <input
                  type="radio"
                  name="format"
                  checked={settings.format === 'docx'}
                  onChange={() => handleFormatChange('docx')}
                />
                <span className="format-text">Word (.docx)</span>
              </label>
            </div>
          </div>

          <div className="export-card">
            <h3 className="card-title">Settings</h3>
            <div className="settings-options">
              <label className="setting-option">
                <input
                  type="checkbox"
                  checked={settings.includeTimestamps}
                  onChange={(e) => handleTimestampsChange(e.target.checked)}
                />
                <span className="setting-text">Include Timestamps</span>
              </label>
              <label className="setting-option">
                <input
                  type="checkbox"
                  checked={settings.includePageNumbers}
                  onChange={(e) => handlePageNumbersChange(e.target.checked)}
                />
                <span className="setting-text">Include Page Numbers</span>
              </label>
            </div>

            <div className="action-buttons-export">
              <button className="export-save-btn" onClick={onSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ExportOptions;