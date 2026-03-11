import React, { useMemo, useState } from 'react';

import {
    buildImagePreviewUrl,
    capturePhotoshopContext,
    insertGeneratedImage,
    pickReferenceImageFromDisk
} from '../../lib/photoshop.js';

export const TuDoAITab = ({ actionsDisabled, onRequireAuth, onGenerate }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [insertError, setInsertError] = useState('');
    const [aspectRatio, setAspectRatio] = useState('2:3');
    const [size, setSize] = useState('4K');
    const [images, setImages] = useState([]);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [prompt, setPrompt] = useState('');
    const [autoZoom, setAutoZoom] = useState(true);
    const [creativity, setCreativity] = useState('balanced');
    const [result, setResult] = useState(null);

    const canSubmit = useMemo(() => Boolean(prompt.trim()) || images.length > 0, [images.length, prompt]);

    const createRequestPayload = async () => {
        const trimmedPrompt = prompt.trim();

        if (!trimmedPrompt && images.length === 0) {
            throw new Error('Nhập prompt hoặc thêm ít nhất 1 ảnh tham chiếu trước khi generate.');
        }

        if (images.length > 3) {
            throw new Error('Vertical slice này chỉ hỗ trợ tối đa 3 ảnh tham chiếu.');
        }

        if (images.length > 0 && (activeImageIndex < 0 || activeImageIndex >= images.length)) {
            throw new Error('Ảnh active hiện không hợp lệ. Hãy chọn lại ảnh tham chiếu.');
        }

        const photoshopContext = await capturePhotoshopContext();

        return {
            prompt: trimmedPrompt,
            ratio: aspectRatio,
            size,
            referenceImages: images.map((image) => ({
                imageBase64: image.imageBase64,
                source: image.source,
                name: image.name,
                mimeType: image.mimeType
            })),
            autoZoom,
            creativity,
            photoshopContext,
            clientRequestId: `tu-do-ai-${Date.now()}`,
            appVersion: 'uxp-dev',
            ...(images.length > 0 ? { activeImageIndex } : {})
        };
    };

    const handleCreate = async () => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        setErrorMessage('');
        setInsertError('');
        setIsLoading(true);

        try {
            const payload = await createRequestPayload();
            const response = await onGenerate(payload);

            if (!response || !response.ok || !response.data) {
                setErrorMessage('Không thể generate ảnh Tự Do AI.');
                return;
            }

            const previewUrl = buildImagePreviewUrl(response.data.imageBase64);
            let insertState = {
                status: 'pending',
                insertedLayerId: null,
                insertedLayerName: '',
                error: ''
            };

            try {
                const insertResult = await insertGeneratedImage({
                    imageBase64: response.data.imageBase64,
                    context: payload.photoshopContext,
                    layerNamePrefix: 'Tu Do AI'
                });

                insertState = {
                    status: 'success',
                    insertedLayerId: insertResult.insertedLayerId,
                    insertedLayerName: insertResult.insertedLayerName,
                    error: ''
                };
            } catch (insertFailure) {
                const nextInsertError = insertFailure && insertFailure.message
                    ? insertFailure.message
                    : 'Generate đã thành công nhưng chèn vào Photoshop thất bại.';
                setInsertError(nextInsertError);
                insertState = {
                    status: 'failed',
                    insertedLayerId: null,
                    insertedLayerName: '',
                    error: nextInsertError
                };
            }

            setResult({
                imageBase64: response.data.imageBase64,
                previewUrl,
                requestId: response.data.requestId,
                generatedAt: Date.now(),
                inputSummary: response.data.inputSummary || null,
                insert: insertState
            });
        } catch (error) {
            setErrorMessage(error && error.message ? error.message : 'Không thể chuẩn bị request Tự Do AI.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddDemoImage = async () => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        if (images.length >= 3) {
            setErrorMessage('Vertical slice này chỉ hỗ trợ tối đa 3 ảnh tham chiếu.');
            return;
        }

        setErrorMessage('');

        try {
            const image = await pickReferenceImageFromDisk();
            if (!image) {
                return;
            }

            setImages((prev) => [...prev, image]);
            setActiveImageIndex(images.length);
        } catch (error) {
            setErrorMessage(error && error.message ? error.message : 'Không thể đọc ảnh tham chiếu từ máy.');
        }
    };

    const handleQuickLayer = () => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        setErrorMessage('`Lớp nhanh` chưa được nối trong pass này. Vertical slice hiện chỉ chốt generate thật và auto-insert.');
    };

    const handleRemoveImage = (index, e) => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        e.stopPropagation();
        setErrorMessage('');
        setImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index));

        if (activeImageIndex === index) {
            setActiveImageIndex(0);
        } else if (activeImageIndex > index) {
            setActiveImageIndex((prev) => prev - 1);
        }
    };

    return (
        <div className="tab-pane">
            <div className={`app-overlay ${isLoading ? 'active' : ''}`}>
                <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{color: '#F4B400', width: '24px', height: '24px'}}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                <span className="overlay-text">Đang generate và chuẩn bị chèn vào Photoshop...</span>
            </div>

            <div className="section">
                <div className="flex-row">
                    <div className="flex-col">
                        <span className="section-label">Tỉ lệ</span>
                        <select className="dropdown" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                            <option value="1:1">1:1 (Vuông)</option>
                            <option value="2:3">2:3 (Dọc)</option>
                            <option value="3:4">3:4</option>
                            <option value="4:5">4:5</option>
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
                    <span className="section-subtitle">{images.length}/3</span>
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
                                key={img.id}
                                className={`ref-image ${activeImageIndex === idx ? 'active' : ''}`}
                                title={`Ảnh ${idx + 1}`}
                                onClick={() => setActiveImageIndex(idx)}
                            >
                                <div className="ref-delete" onClick={(e) => handleRemoveImage(idx, e)}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </div>
                                <img src={img.previewUrl} alt="ref" />
                            </div>
                        ))}
                        {images.length < 3 ? (
                            <div className="ref-add" title="Thêm ảnh" onClick={handleAddDemoImage}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </div>
                        ) : null}
                    </div>
                )}

                <div className="flex-row">
                    <button className="btn full-width" onClick={handleAddDemoImage} disabled={actionsDisabled}>Chọn Ảnh</button>
                    <button className="btn full-width" onClick={handleQuickLayer} disabled={actionsDisabled}>Lớp nhanh</button>
                </div>
            </div>

            <div className="section">
                <div className="section-header">
                    <span className="section-label">Prompt</span>
                </div>
                <div className="prompt-box">
                    <textarea
                        className="textarea"
                        placeholder="Mô tả chi tiết nội dung ảnh bạn muốn tạo..."
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
                    <div className="switch-label">Tự động thu phóng</div>
                    <label className="switch">
                        <input type="checkbox" checked={autoZoom} onChange={(e) => setAutoZoom(e.target.checked)} />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            <div className="section">
                <div className="section-header">
                    <span className="section-label">Mức bám input</span>
                </div>
                <div className="segmented-control">
                    {[
                        { id: 'creative', label: 'Sáng tạo' },
                        { id: 'balanced', label: 'Cân bằng' },
                        { id: 'faithful', label: 'Bám sát' }
                    ].map((option) => (
                        <button
                            key={option.id}
                            className={`segment-btn ${creativity === option.id ? 'active' : ''}`}
                            onClick={() => setCreativity(option.id)}
                            type="button"
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {errorMessage ? (
                <div className="section">
                    <div className="status-banner status-banner-error">{errorMessage}</div>
                </div>
            ) : null}

            {result ? (
                <div className="section">
                    <div className="section-header">
                        <span className="section-label">Kết quả gần nhất</span>
                        <span className="section-subtitle">Request {result.requestId}</span>
                    </div>
                    <div className="result-card">
                        <img className="result-preview" src={result.previewUrl} alt="Kết quả Tự Do AI" />
                        <div className="result-meta">
                            <div className={`status-pill ${result.insert.status === 'success' ? 'is-success' : 'is-error'}`}>
                                {result.insert.status === 'success' ? 'Đã chèn vào Photoshop' : 'Generate xong, chèn thất bại'}
                            </div>
                            {result.insert.insertedLayerName ? (
                                <div className="result-detail">Layer mới: {result.insert.insertedLayerName}</div>
                            ) : null}
                            {insertError ? (
                                <div className="result-detail result-detail-error">{insertError}</div>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="section" style={{marginTop: 'auto'}}>
                <button
                    className="btn primary full-width"
                    onClick={handleCreate}
                    disabled={isLoading || actionsDisabled || !canSubmit}
                >
                    {isLoading ? (
                        <>
                            <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{marginRight: '8px'}}>
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                            </svg>
                            Đang xử lý...
                        </>
                    ) : (
                        <>{result ? 'Regenerate' : 'Tạo Ảnh Tự Do'}</>
                    )}
                </button>
            </div>
        </div>
    );
};
