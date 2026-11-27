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
  // 'home' | 'upload' | 'result' | 'history' | 'report' | 'pdf'
  const [activeTab, setActiveTab] = useState('home');

  // Inspection History (persisted in localStorage)
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pcb_inspection_history') || '[]');
    } catch {
      return [];
    }
  });
  const [historyIdSearch, setHistoryIdSearch] = useState('');
  const [historyImageSearch, setHistoryImageSearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [historyModelFilter, setHistoryModelFilter] = useState('ALL');
  const [historyDateFilter, setHistoryDateFilter] = useState('7D');

  // Model Comparison states
  const [compareModelA, setCompareModelA] = useState('B0');
  const [compareModelB, setCompareModelB] = useState('Proposed');
  const [compareResultA, setCompareResultA] = useState(null);
  const [compareResultB, setCompareResultB] = useState(null);
  const [isComparing, setIsComparing] = useState(false);

  const runComparison = async () => {
    if (!selectedFile) {
      alert('Vui lòng chọn ảnh PCB ở tab New Inspection trước khi so sánh.');
      return;
    }
    setIsComparing(true);
    try {
      const callPredict = async (profile) => {
        const t0 = performance.now();
        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('profile', profile);
        const r = await fetch('/api/predict', { method: 'POST', body: fd });
        if (!r.ok) throw new Error('Lỗi suy luận');
        const json = await r.json();
        json._clientTimeSec = ((performance.now() - t0) / 1000).toFixed(2);
        return json;
      };
      const [resA, resB] = await Promise.all([callPredict(compareModelA), callPredict(compareModelB)]);
      setCompareResultA(resA);
      setCompareResultB(resB);
    } catch (e) {
      alert(e.message || 'Không thể chạy so sánh.');
    } finally {
      setIsComparing(false);
    }
  };
  
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

      const newRecord = {
        id: data.image_id || `img_${Date.now().toString(36)}`,
        imageName: selectedFile?.name || 'pcb_capture.jpg',
        date: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now(),
        modelLabel: selectedModel?.label || selectedProfile,
        defectCount: data.detections?.length ?? 0,
        status: data.analysis?.status || 'PASS',
        result: data,
      };
      setHistory((prev) => {
        const updated = [newRecord, ...prev].slice(0, 50);
        try {
          localStorage.setItem('pcb_inspection_history', JSON.stringify(updated));
        } catch {}
        return updated;
      });

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

  const tabTitles = {
    home: 'Dashboard',
    upload: 'New Inspection',
    result: 'Inspection Results',
    history: 'Inspection History',
    report: 'Analytics & Comparison',
    pdf: 'Report Preview',
  };

  return (
    <div className="app-shell">
      {/* ── SIDEBAR TỐI MÀU (Figma Redesign) ── */}
      <aside className="sidebar no-print">
        <div>
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">
              <Cpu size={20} />
            </div>
            <div>
              <div className="sidebar-brand-title">PCB INSPECT AI</div>
              <div className="sidebar-brand-sub">AI Quality Inspection</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`sidebar-btn ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
            >
              <span className="sidebar-btn-left"><span>🏠</span> Dashboard</span>
            </button>

            <button
              className={`sidebar-btn ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <span className="sidebar-btn-left"><span>📤</span> New Inspection</span>
              {selectedFile && <span className="tab-badge pass">✓</span>}
            </button>

            <button
              className={`sidebar-btn ${activeTab === 'result' ? 'active' : ''}`}
              onClick={() => setActiveTab('result')}
            >
              <span className="sidebar-btn-left"><span>🔍</span> Inspection Results</span>
              {result && <span className="tab-badge">{result.detections.length}</span>}
            </button>

            <button
              className={`sidebar-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <span className="sidebar-btn-left"><span>🕒</span> Inspection History</span>
              {history.length > 0 && <span className="tab-badge pass">{history.length}</span>}
            </button>

            <button
              className={`sidebar-btn ${activeTab === 'report' ? 'active' : ''}`}
              onClick={() => setActiveTab('report')}
            >
              <span className="sidebar-btn-left"><span>📊</span> Analytics</span>
            </button>

            <button
              className={`sidebar-btn ${activeTab === 'pdf' ? 'active' : ''}`}
              onClick={() => setActiveTab('pdf')}
            >
              <span className="sidebar-btn-left"><span>📄</span> Reports</span>
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-status-row">
            <span>Backend</span>
            <span style={{ color: backendStatus.online ? '#10b981' : '#ef4444', fontWeight: 600 }}>
              ● {backendStatus.online ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="sidebar-status-row">
            <span>Model</span>
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
              {selectedModel?.label?.split(' ')[0] || 'Ready'}
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>
            v1.0.0 · YOLOv8 · FastAPI
          </div>
        </div>
      </aside>

      {/* ── MAIN WORKSPACE ── */}
      <div className="main-workspace">
        <header className="top-header-bar no-print">
          <div className="header-breadcrumb">
            Dashboard &rsaquo; <strong>{tabTitles[activeTab] || 'Inspection'}</strong>
          </div>

          <div className="tab-status-group">
            <div className="badge-pill">
              <span className={`status-dot ${backendStatus.online ? 'online' : 'offline'}`} />
              <span>Backend {backendStatus.online ? 'Online' : 'Offline'}</span>
            </div>
            <div className="badge-pill">
              <Cpu size={14} color="#2563eb" />
              <span>{selectedModel?.label || 'Chưa chọn cấu hình'}</span>
            </div>
            <button
              className="btn-blue"
              style={{ padding: '7px 14px', fontSize: '0.82rem' }}
              onClick={() => setActiveTab('upload')}
            >
              + New Inspection
            </button>
            {result && (
              <button
                className="btn-blue"
                style={{ padding: '7px 14px', fontSize: '0.82rem', background: '#0f172a' }}
                onClick={handlePrint}
              >
                <Printer size={14} /> Export PDF
              </button>
            )}
          </div>
        </header>

        <div className="app-container">

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
                  multiple
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
          {result && (() => {
            const dets = result.detections || [];
            const total = dets.length;
            const maxConf = total ? Math.max(...dets.map(d => d.confidence || 0)) : null;
            const avgConf = total ? (dets.reduce((s, d) => s + (d.confidence || 0), 0) / total) : null;
            const counts = dets.reduce((acc, d) => { acc[d.class_name] = (acc[d.class_name] || 0) + 1; return acc; }, {});
            const topClass = total ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : 'None';
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Total Detected Defects</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: total > 0 ? '#dc2626' : '#059669', marginTop: 4 }}>{total}</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Highest Confidence</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{maxConf !== null ? `${Math.round(maxConf * 100)}%` : '—'}</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Average Confidence</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{avgConf !== null ? `${Math.round(avgConf * 100)}%` : '—'}</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Most Common Defect</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: 8 }}>{topClass}</div>
                </div>
              </div>
            );
          })()}
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
          TAB: 🕒 INSPECTION HISTORY
      ════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div className="tab-content-view">
          <div className="view-title-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#0f172a' }}>Inspection History</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#64748b' }}>Review and revisit previous PCB inspections.</p>
            </div>
            <button className="btn-blue" onClick={() => setActiveTab('upload')}>
              + New Inspection
            </button>
          </div>

          {history.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '56px 24px', background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>🕒</div>
              <h3 style={{ margin: '0 0 6px', color: '#0f172a' }}>No inspection records yet</h3>
              <p style={{ margin: '0 0 18px', color: '#64748b', fontSize: '0.9rem' }}>Start your first PCB inspection.</p>
              <button className="btn-blue" onClick={() => setActiveTab('upload')}>+ New Inspection</button>
            </div>
          ) : (
            <div className="card" style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Inspection ID</div>
                  <input
                    type="text"
                    placeholder="Search Inspection ID"
                    value={historyIdSearch}
                    onChange={(e) => setHistoryIdSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Image name</div>
                  <input
                    type="text"
                    placeholder="Search image name"
                    value={historyImageSearch}
                    onChange={(e) => setHistoryImageSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Status</div>
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#fff' }}
                  >
                    <option value="ALL">All statuses</option>
                    <option value="PASS">PASS</option>
                    <option value="DEFECTIVE">DEFECTIVE</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Model</div>
                  <select
                    value={historyModelFilter}
                    onChange={(e) => setHistoryModelFilter(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#fff' }}
                  >
                    <option value="ALL">All models</option>
                    <option value="B0">B0</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="Proposed">Proposed</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Date range</div>
                  <select
                    value={historyDateFilter}
                    onChange={(e) => setHistoryDateFilter(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#fff' }}
                  >
                    <option value="7D">Last 7 days</option>
                    <option value="1D">Today</option>
                    <option value="30D">Last 30 days</option>
                    <option value="ALL">All time</option>
                  </select>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px' }}>Inspection ID</th>
                      <th style={{ padding: '10px 12px' }}>Image Name</th>
                      <th style={{ padding: '10px 12px' }}>Inspection Date</th>
                      <th style={{ padding: '10px 12px' }}>Model</th>
                      <th style={{ padding: '10px 12px' }}>Defect Count</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history
                      .filter((item) => {
                        const qId = historyIdSearch.trim().toLowerCase();
                        const qImg = historyImageSearch.trim().toLowerCase();
                        const matchId = !qId || item.id.toLowerCase().includes(qId);
                        const matchImg = !qImg || item.imageName.toLowerCase().includes(qImg);
                        const matchStatus = historyStatusFilter === 'ALL' || item.status === historyStatusFilter;
                        const matchModel = historyModelFilter === 'ALL' || (item.modelLabel || '').includes(historyModelFilter);
                        let matchDate = true;
                        if (historyDateFilter !== 'ALL' && item.timestamp) {
                          const ageDays = (Date.now() - item.timestamp) / (1000 * 60 * 60 * 24);
                          if (historyDateFilter === '1D') matchDate = ageDays <= 1;
                          else if (historyDateFilter === '7D') matchDate = ageDays <= 7;
                          else if (historyDateFilter === '30D') matchDate = ageDays <= 30;
                        }
                        return matchId && matchImg && matchStatus && matchModel && matchDate;
                      })
                      .map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{item.id}</td>
                          <td style={{ padding: '10px 12px', color: '#334155' }}>{item.imageName}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{item.date}</td>
                          <td style={{ padding: '10px 12px', color: '#334155' }}>{item.modelLabel}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.defectCount}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: 9999,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: item.status === 'DEFECTIVE' ? '#fef2f2' : '#ecfdf5',
                              color: item.status === 'DEFECTIVE' ? '#dc2626' : '#059669',
                            }}>
                              ● {item.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', display: 'flex', gap: 8 }}>
                            <button
                              className="btn-blue"
                              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                              onClick={() => {
                                setResult(item.result);
                                setShowOriginal(false);
                                resetZoom();
                                setActiveTab('result');
                              }}
                            >
                              View
                            </button>
                            <button
                              style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#dc2626', cursor: 'pointer' }}
                              onClick={() => {
                                setHistory((prev) => {
                                  const updated = prev.filter((x) => x.id !== item.id);
                                  try {
                                    localStorage.setItem('pcb_inspection_history', JSON.stringify(updated));
                                  } catch {}
                                  return updated;
                                });
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 4: 📊 INSPECTION REPORT (Chỉ hiển thị khi activeTab === 'report')
          ═══════════════════════════════════════════════════════ */}
      {activeTab === 'report' && (
        <div className="tab-content-view">
          {/* ── MODEL COMPARISON (Figma Analytics) ── */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>Model Comparison</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>Compare inspection results across different AI model profiles.</p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={compareModelA} onChange={(e) => setCompareModelA(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                  {(modelInfo?.profiles || [{ id: 'B0', label: 'B0 · YOLOv8s' }, { id: 'B1', label: 'B1 · YOLOv8s-P2' }, { id: 'B2', label: 'B2 · YOLOv8s + CT' }, { id: 'Proposed', label: 'Proposed · YOLOv8s-P2 + CT' }]).map(p => (
                    <option key={p.id} value={p.id}>Model A: {p.label}</option>
                  ))}
                </select>
                <select value={compareModelB} onChange={(e) => setCompareModelB(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                  {(modelInfo?.profiles || [{ id: 'B0', label: 'B0 · YOLOv8s' }, { id: 'B1', label: 'B1 · YOLOv8s-P2' }, { id: 'B2', label: 'B2 · YOLOv8s + CT' }, { id: 'Proposed', label: 'Proposed · YOLOv8s-P2 + CT' }]).map(p => (
                    <option key={p.id} value={p.id}>Model B: {p.label}</option>
                  ))}
                </select>
                <button className="btn-blue" onClick={runComparison} disabled={isComparing || !selectedFile}>
                  {isComparing ? 'Running...' : 'Run Comparison'}
                </button>
              </div>
            </div>

            {compareResultA && compareResultB && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#0f172a', color: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.85rem', fontWeight: 600 }}>
                      <span>Model A: {compareModelA}</span>
                      <span>{compareResultA.detections?.length || 0} detections</span>
                    </div>
                    <img src={compareResultA.annotated_image_url} alt="Model A" style={{ width: '100%', borderRadius: 6 }} />
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#0f172a', color: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.85rem', fontWeight: 600 }}>
                      <span>Model B: {compareModelB}</span>
                      <span>{compareResultB.detections?.length || 0} detections</span>
                    </div>
                    <img src={compareResultB.annotated_image_url} alt="Model B" style={{ width: '100%', borderRadius: 6 }} />
                  </div>
                </div>

                {(() => {
                  const detA = compareResultA.detections || [];
                  const detB = compareResultB.detections || [];
                  const clsA = new Set(detA.map(d => d.class_name)).size;
                  const clsB = new Set(detB.map(d => d.class_name)).size;
                  const avgA = detA.length ? `${(detA.reduce((s, d) => s + (d.confidence || 0), 0) / detA.length * 100).toFixed(1)}%` : '—';
                  const avgB = detB.length ? `${(detB.reduce((s, d) => s + (d.confidence || 0), 0) / detB.length * 100).toFixed(1)}%` : '—';
                  const timeA = compareResultA._clientTimeSec ? `${compareResultA._clientTimeSec} s` : '—';
                  const timeB = compareResultB._clientTimeSec ? `${compareResultB._clientTimeSec} s` : '—';
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 6 }}>Total detections</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600, marginBottom: 2 }}>
                          <span style={{ color: '#2563eb' }}>Model A ({compareModelA})</span>
                          <span style={{ color: '#059669' }}>Model B ({compareModelB})</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.15rem' }}>
                          <span style={{ color: '#2563eb' }}>{detA.length}</span>
                          <span style={{ color: '#059669' }}>{detB.length}</span>
                        </div>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 6 }}>Detection distribution</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600, marginBottom: 2 }}>
                          <span style={{ color: '#2563eb' }}>Model A ({compareModelA})</span>
                          <span style={{ color: '#059669' }}>Model B ({compareModelB})</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem' }}>
                          <span style={{ color: '#2563eb' }}>{clsA} classes</span>
                          <span style={{ color: '#059669' }}>{clsB} classes</span>
                        </div>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 6 }}>Average confidence</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600, marginBottom: 2 }}>
                          <span style={{ color: '#2563eb' }}>Model A ({compareModelA})</span>
                          <span style={{ color: '#059669' }}>Model B ({compareModelB})</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem' }}>
                          <span style={{ color: '#2563eb' }}>{avgA}</span>
                          <span style={{ color: '#059669' }}>{avgB}</span>
                        </div>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 6 }}>Inference time</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600, marginBottom: 2 }}>
                          <span style={{ color: '#2563eb' }}>Model A ({compareModelA})</span>
                          <span style={{ color: '#059669' }}>Model B ({compareModelB})</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem' }}>
                          <span style={{ color: '#2563eb' }}>{timeA}</span>
                          <span style={{ color: '#059669' }}>{timeB}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Class</th>
                      <th style={{ padding: '8px 10px' }}>Model A ({compareModelA})</th>
                      <th style={{ padding: '8px 10px' }}>Model B ({compareModelB})</th>
                      <th style={{ padding: '8px 10px' }}>Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['Missing_hole', 'Mouse_bite', 'Open_circuit', 'Short', 'Spur', 'Spurious_copper'].map(cls => {
                      const cA = (compareResultA.detections || []).filter(d => d.class_name === cls).length;
                      const cB = (compareResultB.detections || []).filter(d => d.class_name === cls).length;
                      const diff = cB - cA;
                      return (
                        <tr key={cls} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{cls}</td>
                          <td style={{ padding: '8px 10px' }}>{cA}</td>
                          <td style={{ padding: '8px 10px' }}>{cB}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: diff > 0 ? '#059669' : diff < 0 ? '#dc2626' : '#64748b' }}>
                            {diff > 0 ? `+${diff}` : diff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
      </div>
    </div>
  );
}
