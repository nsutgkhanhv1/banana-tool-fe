import React, { useState } from 'react';

export const ThayNenTab = () => {
    // For demoing the premium loading state
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = () => {
        setIsLoading(true);
        // Simulate API call
        setTimeout(() => setIsLoading(false), 3000);
    };

    return (
        <div className="tab-pane">
            <div className="section">
                <div className="section-header">
                    <span className="section-title">Chọn tỉ lệ và kích thước</span>
                </div>
                <div className="flex-row">
                    <select className="dropdown" defaultValue="2:3">
                        <option value="2:3">Tỉ lệ: 2:3</option>
                        <option value="1:1">Tỉ lệ: 1:1</option>
                        <option value="3:4">Tỉ lệ: 3:4</option>
                        <option value="16:9">Tỉ lệ: 16:9</option>
                    </select>
                    <select className="dropdown" defaultValue="4K">
                        <option value="4K">4K (4096px) - Pro</option>
                        <option value="2K">2K (2048px)</option>
                        <option value="1K">1K (1024px)</option>
                    </select>
                </div>
            </div>

            <div className="section">
                <div className="section-header">
                    <div style={{display: 'flex', flexDirection: 'column'}}>
                        <span className="section-title">Ảnh tham chiếu</span>
                        <span className="section-subtitle">Đã chọn 1/10 ảnh</span>
                    </div>
                </div>
                
                <div className="reference-grid">
                    <div className="ref-image active" title="Ảnh 1">
                        <div className="ref-delete"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></div>
                        <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=100&h=100" alt="ref" />
                    </div>
                    <div className="ref-add" title="Thêm ảnh">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </div>
                </div>
                
                <div className="flex-row">
                    <button className="btn full-width">Chọn Ảnh</button>
                    <button className="btn full-width">Lớp nhanh</button>
                </div>
            </div>

            <div className="section">
                <div className="switch-row">
                    <div className="switch-label">Giữ chủ thể</div>
                    <label className="switch">
                        <input type="checkbox" defaultChecked />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            <div className="section">
                <div className="section-header">
                    <span className="section-title">Prompt</span>
                </div>
                <div className="prompt-box">
                    <textarea className="textarea" placeholder="Nhập mô tả ánh sáng và nền mới..."></textarea>
                    <div className="prompt-footer">
                        <span className="char-counter">0/500</span>
                    </div>
                </div>
            </div>

            <div className="section">
                <div className="switch-row">
                    <div className="switch-label">Tiền cảnh</div>
                    <label className="switch">
                        <input type="checkbox" />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            <div className="section" style={{marginTop: 'auto'}}>
                <button 
                    className="btn primary full-width" 
                    onClick={handleCreate}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{marginRight: '8px'}}>
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                            </svg>
                            Đang xử lý...
                        </>
                    ) : (
                        <>
                            <svg style={{marginRight: '6px'}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            Thay Nền ✨
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
