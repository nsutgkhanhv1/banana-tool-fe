import React, { useState } from 'react';

export const ThayNenTab = ({ actionsDisabled, onRequireAuth }) => {
    // For demoing the premium loading state
    const [isLoading, setIsLoading] = useState(false);
    
    // Phase 1.5: Frontend States
    const [aspectRatio, setAspectRatio] = useState('2:3');
    const [size, setSize] = useState('4K');
    const [images, setImages] = useState([]);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [prompt, setPrompt] = useState('');
    const [keepSubject, setKeepSubject] = useState(true);
    const [foreground, setForeground] = useState(false);

    const handleCreate = () => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        setIsLoading(true);

        // Phase 1.5: Gather state into JSON Payload
        const payload = {
            action: 'ThayNen',
            aspectRatio,
            size,
            referenceImages: images,
            activeImageIndex,
            prompt,
            toggles: {
                keepSubject,
                foreground
            }
        };

        console.log("=== MOCK API PAYLOAD (Thay Nền) ===");
        console.log(JSON.stringify(payload, null, 2));
        console.log("===================================");

        // Simulate API call
        setTimeout(() => setIsLoading(false), 3000);
    };

    const handleAddDemoImage = () => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        if (images.length >= 10) return;
        setImages(prev => [...prev, 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=100&h=100']);
        setActiveImageIndex(images.length);
    };

    const handleQuickLayer = () => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        console.log("Mocking Photoshop UXP Action: Saving current layer to temp file...");
        if (images.length >= 10) return;
        
        // Mock pushing image to Reference Frame
        const mockLayerImg = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=100&h=100';
        setImages(prev => [...prev, mockLayerImg]);
        setActiveImageIndex(images.length);
    };

    const handleRemoveImage = (index, e) => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        e.stopPropagation();
        setImages(prev => prev.filter((_, i) => i !== index));
        if (activeImageIndex === index) {
            setActiveImageIndex(0);
        } else if (activeImageIndex > index) {
            setActiveImageIndex(prev => prev - 1);
        }
    };

    return (
        <div className="tab-pane">
            <div className={`app-overlay ${isLoading ? 'active' : ''}`}>
                <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{color: '#F4B400', width: '24px', height: '24px'}}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                <span className="overlay-text">Đang phân tích ảnh...</span>
            </div>

            <div className="section">
                <div className="flex-row">
                    <div className="flex-col">
                        <span className="section-label">Tỉ lệ</span>
                        <select className="dropdown" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                            <option value="2:3">2:3 (Dọc)</option>
                            <option value="1:1">1:1 (Vuông)</option>
                            <option value="3:4">3:4</option>
                            <option value="16:9">16:9 (Ngang)</option>
                        </select>
                    </div>
                    <div className="flex-col">
                        <span className="section-label">Kích thước</span>
                        <select className="dropdown" value={size} onChange={(e) => setSize(e.target.value)}>
                            <option value="4K">4K (4096px)</option>
                            <option value="2K">2K (2048px)</option>
                            <option value="1K">1K (1024px)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="section">
                <div className="section-header">
                    <span className="section-label">Ảnh tham chiếu</span>
                    <span className="section-subtitle">{images.length}/10</span>
                </div>
                
                {images.length === 0 ? (
                    <div className="empty-state">
                        <svg className="empty-state-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        <span>Chưa có ảnh</span>
                    </div>
                ) : (
                    <div className="reference-grid">
                        {images.map((img, idx) => (
                            <div 
                                key={idx} 
                                className={`ref-image ${activeImageIndex === idx ? 'active' : ''}`} 
                                title={`Ảnh ${idx + 1}`}
                                onClick={() => setActiveImageIndex(idx)}
                            >
                                <div className="ref-delete" onClick={(e) => handleRemoveImage(idx, e)}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </div>
                                <img src={img} alt="ref" />
                            </div>
                        ))}
                        {images.length < 10 && (
                            <div className="ref-add" title="Thêm ảnh" onClick={handleAddDemoImage}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </div>
                        )}
                    </div>
                )}
                
                <div className="flex-row">
                    <button className="btn full-width" onClick={handleAddDemoImage} disabled={actionsDisabled}>Chọn Ảnh</button>
                    <button className="btn full-width" onClick={handleQuickLayer} disabled={actionsDisabled}>Lớp nhanh</button>
                </div>
            </div>

            <div className="section">
                <div className="switch-row">
                    <div className="switch-label">Giữ chủ thể</div>
                    <label className="switch">
                        <input type="checkbox" checked={keepSubject} onChange={(e) => setKeepSubject(e.target.checked)} />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            <div className="section">
                <div className="section-header">
                    <span className="section-label">Prompt</span>
                </div>
                <div className="prompt-box">
                    <textarea 
                        className="textarea" 
                        placeholder="Nhập mô tả ánh sáng và nền mới..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        maxLength={500}
                    ></textarea>
                    <div className="prompt-footer">
                        <span className="char-counter">{prompt.length}/500</span>
                    </div>
                </div>
            </div>

            <div className="section">
                <div className="switch-row">
                    <div className="switch-label">Tiền cảnh</div>
                    <label className="switch">
                        <input type="checkbox" checked={foreground} onChange={(e) => setForeground(e.target.checked)} />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            <div className="section" style={{marginTop: 'auto'}}>
                <button 
                    className="btn primary full-width" 
                    onClick={handleCreate}
                    disabled={isLoading || actionsDisabled}
                >
                    {isLoading ? (
                        <>
                            <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{marginRight: '8px'}}>
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                            </svg>
                            Đang xử lý...
                        </>
                    ) : (
                        <>Thay Nền</>
                    )}
                </button>
            </div>
        </div>
    );
};
