import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Upload, Cpu, AlertTriangle,
  Printer, RefreshCw, X, RotateCcw,
  Eye, Sparkles, Sliders, FileText,
  Move, ArrowRight
} from 'lucide-react';
import './App.css';

const CLASS_CONFIG = {
  Missing_hole: { label: 'Missing Hole', vn: 'Lỗ khuyết', color: '#dc2626' },
  Mouse_bite: { label: 'Mouse Bite', vn: 'Chuột cắn', color: '#ea580c' },
  Open_circuit: { label: 'Open Circuit', vn: 'Hở mạch', color: '#ca8a04' },
  Short: { label: 'Short Circuit', vn: 'Ngắn mạch', color: '#16a34a' },
  Spur: { label: 'Spur', vn: 'Vết gai', color: '#0284c7' },
  Spurious_copper: { label: 'Spurious Copper', vn: 'Đồng thừa', color: '#9333ea' },
};

export default function App() {
  // ── 5 TABS RIÊNG BIỆT (Không gộp chung) ──────────────────────
  // 'home' | 'upload' | 'result' | 'report' | 'pdf'
  const [activeTab, setActiveTab] = useState('home');
  
  // File & Prediction states
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  
  // Backend health status
  const [backendStatus, setBackendStatus] = useState({ online: false, model_ready: false });
  const [modelInfo, setModelInfo] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState('B0');
  const selectedModel = modelInfo?.profiles.find(profile => profile.id === selectedProfile);
  const initialProfileLoaded = useRef(false);
  
  // Webcam state
  const videoRef = useRef(null);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const fileInputRef = useRef(null);

  // ── ZOOM & PAN STATES (Thanh cuộn + / - và Lăn chuột) ────────
  const [zoomLevel, setZoomLevel] = useState(1);       // 0.5 to 4.0 (50% - 400%)
  const [panPos, setPanPos] = useState({ x: 0, y: 0 }); // translation x, y
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const viewportRef = useRef(null);

  // Kiểm tra sức khỏe Backend
  const checkHealth = async () => {
    try {
      const res = await fetch('/api/model-info');
      if (res.ok) {
        const data = await res.json();
        setBackendStatus({ online: true, ...data });
        setModelInfo(data);
        if (!initialProfileLoaded.current) {
          setSelectedProfile(data.default_profile || 'B0');
          initialProfileLoaded.current = true;
        }
      } else {
        setBackendStatus({ online: false, model_ready: false });
      }
    } catch {
      setBackendStatus({ online: false, model_ready: false });
    }
  };

  useEffect(() => {
    const initial = setTimeout(checkHealth, 0);
    const interval = setInterval(checkHealth, 10000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // Chọn file
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setErrorMsg(null);
      resetZoom();
    }
  };

  // Kéo thả file
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setErrorMsg(null);
      resetZoom();
    } else {
      setErrorMsg('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
    }
  };

  // Bật webcam
  const startWebcam = async () => {
    try {
      setIsWebcamOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setErrorMsg('Không thể mở Webcam: ' + err.message);
      setIsWebcamOpen(false);
    }
  };

  // Tắt webcam
  const stopWebcam = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      setIsWebcamOpen(false);
    }
  };

  // Chụp ảnh từ webcam
  const captureWebcam = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `pcb_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setResult(null);
        setErrorMsg(null);
        stopWebcam();
        resetZoom();
      }
    }, 'image/jpeg', 0.95);
  };

  // Gửi ảnh đến FastAPI Backend
  const handleInspect = async () => {
    if (!selectedFile || !selectedModel?.ready || !backendStatus.online || isInspecting) return;
    setIsInspecting(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('profile', selectedProfile);

    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Lỗi máy chủ (${res.status})`);
      }

      const data = await res.json();
      setResult(data);
      setShowOriginal(false);
      resetZoom();
      // Chuyển sang Tab Detection Result sau khi phân tích xong
      setActiveTab('result');
    } catch (err) {
      setErrorMsg(err.message || 'Không thể kết nối đến máy chủ AI.');
    } finally {
      setIsInspecting(false);
    }
  };

  // ── ZOOM & PAN CONTROLS ──────────────────────────────────────
  const resetZoom = () => {
    setZoomLevel(1);
    setPanPos({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(4.0, +(prev + 0.25).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(0.5, +(prev - 0.25).toFixed(2)));
  };

  const handleSliderChange = (e) => {
    setZoomLevel(parseFloat(e.target.value));
  };

  // Lăn chuột để zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomStep = 0.15;
    if (e.deltaY < 0) {
      setZoomLevel(prev => Math.min(4.0, +(prev + zoomStep).toFixed(2)));
    } else {
      setZoomLevel(prev => Math.max(0.5, +(prev - zoomStep).toFixed(2)));
    }
  };

  // Kéo rê chuột để Pan
  const handleMouseDown = (e) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPos.x, y: e.clientY - panPos.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoomLevel > 1) {
      setPanPos({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // In / Xuất file PDF
  const handlePrint = () => {
    window.print();
  };

  // Lấy lỗi phổ biến nhất
  const getMostCommonDefect = () => {
    if (!result || !result.analysis || !result.analysis.distribution) return 'None';
    const entries = Object.entries(result.analysis.distribution);
    if (entries.length === 0) return 'None';
    let maxCls = entries[0][0];
    let maxVal = entries[0][1];
    for (const [cls, count] of entries) {
      if (count > maxVal) {
        maxVal = count;
        maxCls = cls;
      }
    }
    return CLASS_CONFIG[maxCls]?.label || maxCls;
  };

  const changeProfile = (event) => {
    setSelectedProfile(event.target.value);
    setResult(null);
    setErrorMsg(null);
  };

  const decisionLabel = result?.analysis.status === 'DEFECTIVE'
    ? 'DEFECTIVE · Phát hiện vùng nghi lỗi'
    : 'PASS · Không phát hiện ở ngưỡng này';

  return (
    <div className="app-container">
      {/* ── TOP TAB BAR (Thanh điều hướng riêng biệt từng tab) ── */}
      <nav className="top-tab-bar no-print">
        <div className="tab-nav-group">
          {/* Tab 1: Home Page */}
          <button 
            className={`tab-button ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <span>🏠</span> Home Page
          </button>

          {/* Tab 2: Upload PCB Image */}
          <button 
            className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <span>📤</span> Upload PCB Image
            {selectedFile && <span className="tab-badge pass">✓</span>}
          </button>

          {/* Tab 3: Detection Result */}
          <button 
            className={`tab-button ${activeTab === 'result' ? 'active' : ''}`}
            onClick={() => setActiveTab('result')}
          >
            <span>🔍</span> Detection Result
            {result && <span className="tab-badge">{result.detections.length}</span>}
          </button>

          {/* Tab 4: Inspection Report */}
          <button 
            className={`tab-button ${activeTab === 'report' ? 'active' : ''}`}
            onClick={() => setActiveTab('report')}
          >
            <span>📊</span> Inspection Report
          </button>

          {/* Tab 5: Generated PDF Report */}
          <button 
            className={`tab-button ${activeTab === 'pdf' ? 'active' : ''}`}
            onClick={() => setActiveTab('pdf')}
          >
            <span>📄</span> Generated PDF Report
          </button>
        </div>

        {/* Trạng thái kết nối */}
        <div className="tab-status-group">
          <div className="badge-pill">
            <span className={`status-dot ${backendStatus.online ? 'online' : 'offline'}`} />
            <span>FastAPI: {backendStatus.online ? 'Online' : 'Offline'}</span>
          </div>
          <div className="badge-pill">
            <Cpu size={14} color="#2563eb" />
            <span>Model: {selectedModel?.label || 'Chưa chọn cấu hình'}</span>
          </div>
          {result && (
            <button className="btn-blue" style={{ padding: '6px 14px', fontSize: '0.82rem' }} onClick={handlePrint}>
              <Printer size={14} /> Xuất PDF
            </button>
          )}
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════
          TAB 1: 🏠 HOME PAGE (Chỉ hiển thị khi activeTab === 'home')
          ═══════════════════════════════════════════════════════ */}
      {activeTab === 'home' && (
        <div className="tab-content-view">
          {/* Header Bar của Home Page */}
          <div className="view-title-header">
            <div className="view-title-text">
              <span>🏠</span> Home Page
            </div>
          </div>

          <div className="tab-panel-card" style={{ borderTop: 'none' }}>
            {/* Banner Header */}
            <section className="hero-banner">
              <h1>Phát hiện lỗi PCB với YOLOv8s và YOLOv8s-P2</h1>
              <p>Chọn cấu hình B0, B1, B2 hoặc Proposed đã được đánh giá trên bộ dữ liệu PKU.</p>
            </section>

            {/* Upload PCB Image Card */}
            <section className="upload-card-container">
              <h2 className="upload-card-title">
                <Upload size={28} /> Upload PCB Image
              </h2>

              <div 
                className="dropzone-box"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Chọn ảnh PCB để phân tích"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                   accept="image/jpeg,image/png,image/webp" 
                  style={{ display: 'none' }} 
                />
                <Upload className="dropzone-icon" />
                <h4 className="dropzone-heading">Upload PCB Image</h4>
                 <p className="dropzone-sub">Chọn ảnh PCB<br />Hỗ trợ JPG • PNG • WebP (tối đa 12 MB)</p>
                <p className="dropzone-status">
                  {selectedFile ? `Đã chọn: ${selectedFile.name}` : 'No file selected'}
                </p>
              </div>

              <div className="model-selector">
                <label htmlFor="model-profile">Cấu hình suy luận</label>
                <select id="model-profile" value={selectedProfile} onChange={changeProfile} disabled={isInspecting || !modelInfo}>
                  {(modelInfo?.profiles || []).map(profile => (
                    <option key={profile.id} value={profile.id} disabled={!profile.ready}>
                      {profile.label}{profile.ready ? '' : ' · thiếu checkpoint'}
                    </option>
                  ))}
                </select>
                {selectedModel && (
                  <p>
                    Ngưỡng Open circuit / Short: {(selectedModel.critical_confidence * 100).toFixed(0)}% ·
                    {' '}Bốn lớp còn lại: {(selectedModel.regular_confidence * 100).toFixed(0)}%
                  </p>
                )}
                {!selectedModel?.ready && (
                  <p role="alert" className="model-unavailable">
                    {selectedModel?.error || 'Chưa kết nối backend hoặc không có checkpoint cho cấu hình này.'}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                {!isWebcamOpen ? (
                  <button className="btn-blue" onClick={startWebcam}>
                    <Camera size={16} /> Open Webcam
                  </button>
                ) : (
                  <button className="btn-outline" onClick={stopWebcam}>
                    <X size={16} /> Close Webcam
                  </button>
                )}

                {previewUrl && (
                  <button className="btn-blue" onClick={handleInspect} disabled={isInspecting || !selectedModel?.ready || !backendStatus.online}>
                    {isInspecting ? (
                      <><RefreshCw size={16} className="animate-spin" /> Đang Phân Tích...</>
                    ) : (
                      <><Sparkles size={16} /> Bắt đầu Phân tích AI</>
                    )}
                  </button>
                )}
              </div>

              {/* Webcam Live Stream if opened */}
              {isWebcamOpen && (
                <div className="webcam-container">
                  <video ref={videoRef} autoPlay playsInline className="webcam-video" />
                  <button 
                    className="btn-blue" 
                    style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)' }}
                    onClick={captureWebcam}
                  >
                    <Camera size={16} /> Chụp & Phân Tích
                  </button>
                </div>
              )}

              {/* Error Alert */}
              {errorMsg && (
                <div style={{ marginTop: 16, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: '0.88rem' }}>
                  <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  {errorMsg}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 2: 📤 UPLOAD PCB IMAGE (Chỉ hiển thị khi activeTab === 'upload')
          ═══════════════════════════════════════════════════════ */}
      {activeTab === 'upload' && (
        <div className="tab-content-view">
          <div className="view-title-header">
            <div className="view-title-text">
              <span>📤</span> Upload PCB Image
            </div>
            {previewUrl && (
              <button 
                className="btn-outline" 
                style={{ padding: '4px 10px', fontSize: '0.8rem', background: '#334155', color: '#fff', border: 'none' }}
                 onClick={() => {
                   setSelectedFile(null);
                   setPreviewUrl(null);
                   setResult(null);
                   if (fileInputRef.current) fileInputRef.current.value = '';
                 }}
              >
                <X size={13} /> Xóa ảnh
              </button>
            )}
          </div>

          <div className="tab-panel-card">
            {previewUrl ? (
              <div style={{ textAlign: 'center', background: '#000', borderRadius: 8, padding: 16 }}>
                <img 
                  src={previewUrl} 
                  alt="Uploaded PCB Original" 
                  style={{ maxWidth: '100%', maxHeight: '680px', objectFit: 'contain', display: 'block', margin: '0 auto' }} 
                />
              </div>
            ) : (
              <div className="empty-tab-box">
                <Upload size={54} color="#94a3b8" style={{ marginBottom: 16 }} />
                <h3>Chưa có ảnh bo mạch nào được chọn</h3>
                <p style={{ marginBottom: 20 }}>Vui lòng vào tab <strong>Home Page</strong> để chọn hoặc tải ảnh lên.</p>
                <button className="btn-blue" onClick={() => setActiveTab('home')}>
                  <ArrowRight size={16} /> Đến Home Page tải ảnh
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 3: 🔍 DETECTION RESULT (Chỉ hiển thị khi activeTab === 'result')
          ═══════════════════════════════════════════════════════ */}
      {activeTab === 'result' && (
        <div className="tab-content-view">
          <div className="view-title-header">
            <div className="view-title-text">
              <span>🔍</span> Detection Result
            </div>
            {result && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  className="btn-outline"
                  onClick={() => setShowOriginal(false)}
                  style={{ background: !showOriginal ? '#2563eb' : '#334155', color: '#fff', border: 'none', padding: '5px 12px', fontSize: '0.82rem' }}
                >
                  <Eye size={13} /> AI Bounding Box
                </button>
                <button 
                  className="btn-outline"
                  onClick={() => setShowOriginal(true)}
                  style={{ background: showOriginal ? '#2563eb' : '#334155', color: '#fff', border: 'none', padding: '5px 12px', fontSize: '0.82rem' }}
                >
                  Ảnh Gốc
                </button>
              </div>
            )}
          </div>

          <div className="tab-panel-card">
            {result ? (
              <>
                <div className={`inspection-result ${result.analysis.status === 'DEFECTIVE' ? 'has-defect' : 'no-detection'}`}>
                  <strong>{decisionLabel}</strong>
                  <span>{result.model.model} · {result.detections.length} box · {result.model.inference_ms.toFixed(1)} ms xử lý server</span>
                  <small>PASS chỉ có nghĩa không còn box vượt ngưỡng; không chứng nhận bo mạch không lỗi.</small>
                </div>
                {/* ── BỘ ĐIỀU KHIỂN THU PHÓNG (Zoom Slider, -/+, Lăn chuột, Pan) ── */}
                <div className="zoom-toolbar">
                  <div className="zoom-controls-group">
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>Thu phóng:</span>
                    <button className="zoom-btn" onClick={handleZoomOut} title="Thu nhỏ (-)">
                      -
                    </button>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="4.0" 
                      step="0.05"
                      value={zoomLevel} 
                      onChange={handleSliderChange} 
                      className="zoom-slider"
                      title="Kéo thanh trượt để phóng to/thu nhỏ"
                    />
                    <button className="zoom-btn" onClick={handleZoomIn} title="Phóng to (+)">
                      +
                    </button>
                    <button className="zoom-btn" onClick={resetZoom} title="Đặt lại 100% (Reset)">
                      <RotateCcw size={14} />
                    </button>
                    <span className="zoom-percent-text">{Math.round(zoomLevel * 100)}%</span>
                  </div>

                  <div className="zoom-hint">
                    <Move size={14} /> Lăn chuột để Zoom • Giữ chuột trái & kéo rê để soi lỗi vi mạch
                  </div>
                </div>

                {/* ── Khung Canvas Interactive Zoom & Pan ── */}
                <div 
                  ref={viewportRef}
                  className={`zoom-viewport ${zoomLevel > 1 ? 'can-pan' : ''} ${isDragging ? 'is-panning' : ''}`}
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {isInspecting && <div className="scanner-line" />}
                  <img 
                    src={showOriginal ? previewUrl : result.annotated_image_url} 
                    alt="PCB Detection Result" 
                    className="zoomable-image"
                    style={{
                      transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${zoomLevel})`,
                      transition: isDragging ? 'none' : 'transform 0.12s ease-out'
                    }}
                    draggable={false}
                  />
                </div>

                {/* Legend 6 loại lỗi */}
                <div className="legend-bar">
                  {Object.entries(CLASS_CONFIG).map(([cls, cfg]) => {
                    const count = result.analysis.distribution[cls] || 0;
                    return (
                      <div key={cls} className="legend-badge">
                        <span className="legend-color-dot" style={{ backgroundColor: cfg.color }} />
                        <span>{cfg.label}: <strong>{count}</strong></span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="empty-tab-box">
                <Sliders size={54} color="#94a3b8" style={{ marginBottom: 16 }} />
                <h3>Chưa có kết quả phân tích</h3>
                <p style={{ marginBottom: 20 }}>Vui lòng nạp ảnh ở tab <strong>Home Page</strong> và bấm "Bắt đầu Phân tích AI".</p>
                <button className="btn-blue" onClick={() => setActiveTab('home')}>
                  <ArrowRight size={16} /> Đến Home Page
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 4: 📊 INSPECTION REPORT (Chỉ hiển thị khi activeTab === 'report')
          ═══════════════════════════════════════════════════════ */}
      {activeTab === 'report' && (
        <div className="tab-content-view">
          <div className="view-title-header">
            <div className="view-title-text">
              <span>📊</span> Inspection Report
            </div>
            {result && (
              <button className="btn-blue" style={{ padding: '6px 14px', fontSize: '0.82rem' }} onClick={handlePrint}>
                <Printer size={14} /> In Báo Cáo
              </button>
            )}
          </div>

          <div className="tab-panel-card">
            {result ? (
              <>
                <h3 className="report-header-title">📋 PCB Inspection Report</h3>

                {/* 4 Meta Boxes */}
                <div className="report-meta-grid">
                  <div className="meta-box">
                    <p className="meta-box-label">Inspection ID</p>
                    <p className="meta-box-value mono" style={{ color: '#2563eb' }}>{result.analysis.inspection_id}</p>
                  </div>
                  <div className="meta-box">
                    <p className="meta-box-label">Generated On</p>
                    <p className="meta-box-value">
                      {new Date(result.analysis.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(result.analysis.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="meta-box">
                    <p className="meta-box-label">Status</p>
                    <p className="meta-box-value" style={{ color: result.analysis.status === 'DEFECTIVE' ? '#ea580c' : '#16a34a' }}>
                      {result.analysis.status}
                    </p>
                  </div>
                  <div className="meta-box">
                    <p className="meta-box-label">Model</p>
                    <p className="meta-box-value">{result.model.model}</p>
                  </div>
                </div>

                <p className="model-report-note">
                  Ngưỡng Open circuit / Short: {(result.model.critical_confidence * 100).toFixed(0)}% ·
                  {' '}Lớp còn lại: {(result.model.regular_confidence * 100).toFixed(0)}% ·
                  {' '}Ảnh đầu vào: {result.image_width} × {result.image_height}px ·
                  {' '}Thời gian xử lý server: {result.model.inference_ms.toFixed(1)} ms
                </p>

                {/* Summary Section */}
                <h4 className="summary-heading">Summary</h4>
                <div className="summary-cards-grid">
                  <div className="summary-card">
                    <p className="summary-card-title">Total Defects</p>
                    <p className="summary-card-num">{result.detections.length}</p>
                  </div>
                  <div className="summary-card">
                    <p className="summary-card-title">Highest Confidence</p>
                    <p className="summary-card-num">
                      {(result.analysis.highest_confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="summary-card">
                    <p className="summary-card-title">Average Confidence</p>
                    <p className="summary-card-num">
                      {(result.analysis.average_confidence * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="summary-card">
                    <p className="summary-card-title">Most Common Defect</p>
                    <p className="summary-card-num" style={{ fontSize: '1.2rem' }}>
                      {getMostCommonDefect()}
                    </p>
                  </div>
                </div>

                {/* AI Recommendation */}
                <div className="recommendation-container">
                  <h4 className="recommendation-title">AI Recommendation</h4>
                  <div className={`recommendation-box ${result.detections.length === 0 ? 'pass' : ''}`}>
                    {result.analysis.recommendation}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-tab-box">
                <FileText size={54} color="#94a3b8" style={{ marginBottom: 16 }} />
                <h3>Chưa có báo cáo kiểm định</h3>
                <p style={{ marginBottom: 20 }}>Báo cáo sẽ được tạo tự động sau khi phân tích ảnh ở tab <strong>Home Page</strong>.</p>
                <button className="btn-blue" onClick={() => setActiveTab('home')}>
                  <ArrowRight size={16} /> Đến Home Page
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 5: 📄 GENERATED PDF REPORT (Chỉ hiển thị khi activeTab === 'pdf')
          ═══════════════════════════════════════════════════════ */}
      {activeTab === 'pdf' && (
        <div className="tab-content-view">
          <div className="view-title-header">
            <div className="view-title-text">
              <span>📄</span> Generated PDF Report
            </div>
            {result && (
              <button className="btn-blue" onClick={handlePrint} style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
                <Printer size={14} /> In / Xuất File PDF
              </button>
            )}
          </div>

          <div className="tab-panel-card">
            {result ? (
              <>
                <h3 className="pdf-section-title">DETECTION TABLE</h3>

                {/* Detection Table (# | Defect | Confidence) */}
                <div className="detection-table-wrapper">
                  <table className="pdf-table">
                    <thead>
                      <tr>
                        <th style={{ width: '80px' }}>#</th>
                        <th>Defect</th>
                        <th style={{ width: '240px' }}>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.detections.length > 0 ? (
                        result.detections.map((det, idx) => (
                          <tr key={idx}>
                            <td><strong>{idx + 1}</strong></td>
                            <td>
                              <span style={{ fontWeight: 600, color: CLASS_CONFIG[det.class_name]?.color || '#1e293b' }}>
                                {CLASS_CONFIG[det.class_name]?.label || det.class_name}
                              </span>
                            </td>
                            <td>
                              <strong>{(det.confidence * 100).toFixed(2)}%</strong>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" style={{ padding: '24px', color: '#16a34a', fontWeight: 600 }}>
                            Không phát hiện box vượt ngưỡng trên ảnh này.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Annotated PCB Result */}
                <h3 className="pdf-section-title">ANNOTATED PCB RESULT</h3>
                <div className="annotated-meta-block">
                  <p><strong>Inspection Model :</strong> {result.model.model}</p>
                  <p><strong>Ngưỡng Open circuit / Short :</strong> {(result.model.critical_confidence * 100).toFixed(0)}%</p>
                  <p><strong>Ngưỡng lớp còn lại :</strong> {(result.model.regular_confidence * 100).toFixed(0)}%</p>
                  <p><strong>Trạng thái :</strong> {decisionLabel}</p>
                  <p><strong>Image Resolution :</strong> {result.image_width} × {result.image_height}</p>
                </div>

                <div style={{ textAlign: 'center', marginTop: 14 }}>
                  <img 
                    src={result.annotated_image_url} 
                    alt="Annotated PCB Result" 
                    className="annotated-img-preview" 
                  />
                </div>

                <div style={{ textAlign: 'center', marginTop: 24 }}>
                  <button className="btn-blue" onClick={handlePrint}>
                    <Printer size={16} /> Tải Xuống / In Phiếu PDF
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-tab-box">
                <Printer size={54} color="#94a3b8" style={{ marginBottom: 16 }} />
                <h3>Chưa có dữ liệu xuất PDF</h3>
                <p style={{ marginBottom: 20 }}>Vui lòng tải ảnh và phân tích tại tab <strong>Home Page</strong> trước.</p>
                <button className="btn-blue" onClick={() => setActiveTab('home')}>
                  <ArrowRight size={16} /> Đến Home Page
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BẢN IN CHUẨN A4 KHI BẤM XUẤT PDF (ẨN TRÊN MÀN HÌNH, CHỈ HIỆN KHI IN) ── */}
      {result && (
        <div className="print-only print-sheet">
          <div style={{ textAlign: 'center', borderBottom: '2px solid #2563eb', paddingBottom: 12, marginBottom: 20 }}>
            <h1 style={{ fontSize: '1.4rem', color: '#1e3a8a', fontWeight: 800 }}>
              AI POWERED PCB DEFECT DETECTION REPORT
            </h1>
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: 4 }}>
              HỆ THỐNG KIỂM ĐỊNH CHẤT LƯỢNG BO MẠCH ĐIỆN TỬ
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, background: '#f8fafc', padding: 12, border: '1px solid #e2e8f0', borderRadius: 6 }}>
            <div>
              <p><strong>Inspection ID :</strong> {result.analysis.inspection_id}</p>
              <p><strong>Generated On :</strong> {new Date(result.analysis.created_at).toLocaleString('vi-VN')}</p>
              <p><strong>Model :</strong> {result.model.model}</p>
              <p><strong>Critical / regular threshold :</strong> {(result.model.critical_confidence * 100).toFixed(0)}% / {(result.model.regular_confidence * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p><strong>Total Defects :</strong> {result.detections.length}</p>
              <p><strong>Highest Confidence :</strong> {(result.analysis.highest_confidence * 100).toFixed(1)}%</p>
              <p><strong>Status :</strong> {decisionLabel}</p>
              <p><strong>Server processing :</strong> {result.model.inference_ms.toFixed(1)} ms</p>
            </div>
          </div>

          <p style={{ fontSize: '9pt', color: '#475569' }}>PASS = không phát hiện box vượt ngưỡng; kết quả không chứng nhận bo mạch không có lỗi.</p>

          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 10, borderBottom: '1px solid #cbd5e1', paddingBottom: 4 }}>
            DETECTION TABLE
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '10pt', marginBottom: 20 }}>
            <thead>
              <tr style={{ background: '#2563eb', color: '#ffffff' }}>
                <th style={{ padding: '6px 8px', width: '50px' }}>#</th>
                <th style={{ padding: '6px 8px' }}>Defect</th>
                <th style={{ padding: '6px 8px', width: '120px' }}>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {result.detections.map((det, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px' }}>{idx + 1}</td>
                  <td style={{ padding: '6px 8px' }}>{CLASS_CONFIG[det.class_name]?.label || det.class_name}</td>
                  <td style={{ padding: '6px 8px' }}>{(det.confidence * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 10 }}>
            ANNOTATED PCB RESULT
          </h3>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <img 
              src={result.annotated_image_url} 
              alt="Annotated PCB Result" 
              style={{ maxWidth: '100%', maxHeight: '420px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div className="print-signatures-block print-break-inside">
            <div className="signature-line">Kỹ Thuật Viên Vận Hành (Ký tên)</div>
            <div className="signature-line">Trưởng Bộ Phận QA / QC (Ký tên)</div>
          </div>
        </div>
      )}
    </div>
  );
}
