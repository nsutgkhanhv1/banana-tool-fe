import React, { useState } from 'react';

export const PhucCheTab = ({ actionsDisabled, onRequireAuth }) => {
    const [isLoading, setIsLoading] = useState(false);
    
    // Phase 1.5: Frontend States for PhucChe
    const [aspectRatio, setAspectRatio] = useState('Bản Gốc');
    const [size, setSize] = useState('4K');
    const [enhanceFace, setEnhanceFace] = useState(true);
    const [denoise, setDenoise] = useState(true);

    const handleCreate = () => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        setIsLoading(true);

        // Phase 1.5: Gather state into JSON Payload
        const payload = {
            action: 'PhucCheAnh',
            aspectRatio,
            size,
            toggles: {
                enhanceFace,
                denoise
            }
        };

        console.log("=== MOCK API PAYLOAD (Phục Chế Ảnh) ===");
        console.log(JSON.stringify(payload, null, 2));
        console.log("======================================");

        // Simulate API call
        setTimeout(() => setIsLoading(false), 3000);
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
                        <span className="section-label">Tỉ lệ xuất</span>
                        <select className="dropdown" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                            <option value="Bản Gốc">Giữ Nguyên Bản Gốc</option>
                            <option value="1:1">1:1 (Vuông)</option>
                            <option value="3:4">3:4 (Dọc)</option>
                            <option value="16:9">16:9 (Ngang)</option>
                        </select>
                    </div>
                    <div className="flex-col">
                        <span className="section-label">Kích thước</span>
                        <select className="dropdown" value={size} onChange={(e) => setSize(e.target.value)}>
                            <option value="4K">4K (Siêu Nét)</option>
                            <option value="2K">2K (2048px)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="section">
                <div className="section-header">
                    <span className="section-label">Tuỳ chọn Phục chế</span>
                </div>
                
                <div className="switch-row" style={{marginBottom: '10px'}}>
                    <div className="switch-label">Khôi phục chi tiết khuôn mặt</div>
                    <label className="switch">
                        <input type="checkbox" checked={enhanceFace} onChange={(e) => setEnhanceFace(e.target.checked)} />
                        <span className="slider"></span>
                    </label>
                </div>
                
                <div className="switch-row">
                    <div className="switch-label">Giảm nhiễu hạt & Làm mịn</div>
                    <label className="switch">
                        <input type="checkbox" checked={denoise} onChange={(e) => setDenoise(e.target.checked)} />
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
                        <>Bắt Đầu Phục Chế</>
                    )}
                </button>
            </div>
        </div>
    );
};
