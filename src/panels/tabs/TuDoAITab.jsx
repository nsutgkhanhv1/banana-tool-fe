import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
    buildGeneratedResultState,
    captureInsertContextSafely,
    createResultImageRecord,
    performResultInsert
} from '../../lib/result-insert.js';
import { QUICK_LAYER_MODES, useReferenceImages } from '../../lib/reference-images.js';

const TOOL_KEY = 'tudoai';
const MAX_REFERENCE_IMAGES = 3;

const mapSourceTypeToApiSource = (sourceType) => {
    if (sourceType === 'quick_layer_canvas') {
        return 'photoshop-composite';
    }

    if (sourceType === 'quick_layer_current') {
        return 'photoshop-layer';
    }

    return 'file';
};

export const TuDoAITab = ({ actionsDisabled, onRequireAuth, onGenerate, onRecordHistory, historyRestoreRequest }) => {
    const rootRef = useRef(null);
    const handledRestoreIdRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [historyNotice, setHistoryNotice] = useState('');
    const [aspectRatio, setAspectRatio] = useState('2:3');
    const [size, setSize] = useState('4K');
    const [prompt, setPrompt] = useState('');
    const [autoZoom, setAutoZoom] = useState(true);
    const [creativity, setCreativity] = useState('balanced');
    const [result, setResult] = useState(null);
    const [showQuickLayerOptions, setShowQuickLayerOptions] = useState(false);
    const {
        items,
        activeImageId,
        activeImageIndex,
        canAddMore,
        restoreStatus,
        restoreNotice,
        addFromFileEntry,
        addFromClipboard,
        addFromQuickLayer,
        removeImage,
        selectActiveImage,
        touchAllImages,
        restoreFromSnapshots
    } = useReferenceImages({
        toolKey: TOOL_KEY,
        maxItems: MAX_REFERENCE_IMAGES
    });

    const canSubmit = useMemo(() => Boolean(prompt.trim()) || items.length > 0, [items.length, prompt]);

    useEffect(() => {
        const handlePaste = async (event) => {
            if (actionsDisabled || !canAddMore) {
                return;
            }

            const rootElement = rootRef.current;
            const activeElement = document.activeElement;
            const isWithinTab = rootElement && activeElement && rootElement.contains(activeElement);

            if (!isWithinTab) {
                return;
            }

            try {
                await addFromClipboard();
                setErrorMessage('');
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }
            } catch (error) {
                if (error && (error.code === 'CLIPBOARD_EMPTY' || error.code === 'CLIPBOARD_NO_IMAGE')) {
                    return;
                }

                setErrorMessage(error && error.message ? error.message : 'Không thể nhập ảnh từ clipboard.');
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => {
            document.removeEventListener('paste', handlePaste);
        };
    }, [actionsDisabled, addFromClipboard, canAddMore]);

    useEffect(() => {
        if (!historyRestoreRequest || !historyRestoreRequest.id || handledRestoreIdRef.current === historyRestoreRequest.id) {
            return;
        }

        if (!historyRestoreRequest.payload || historyRestoreRequest.payload.tabId !== TOOL_KEY) {
            return;
        }

        handledRestoreIdRef.current = historyRestoreRequest.id;
        let cancelled = false;

        const applyHistoryRestore = async () => {
            const payload = historyRestoreRequest.payload;

            setIsLoading(false);
            setErrorMessage('');
            setResult(null);
            setHistoryNotice(`Đã nạp cấu hình từ lịch sử cho ${historyRestoreRequest.featureLabel}.`);
            setAspectRatio(payload.aspectRatio || '2:3');
            setSize(payload.size || '4K');
            setPrompt(payload.prompt || '');
            setAutoZoom(typeof payload.autoZoom === 'boolean' ? payload.autoZoom : true);
            setCreativity(payload.creativity || 'balanced');
            setShowQuickLayerOptions(false);

            const restored = await restoreFromSnapshots({
                snapshots: payload.referenceImages || [],
                nextActiveImageId: payload.activeImageId || null
            });

            if (!cancelled && payload.referenceImages && payload.referenceImages.length > 0 && !restored.items.length) {
                setErrorMessage('Không thể khôi phục ảnh tham chiếu từ history item này.');
            }
        };

        applyHistoryRestore();

        return () => {
            cancelled = true;
        };
    }, [historyRestoreRequest, restoreFromSnapshots]);

    const createGeneratePayload = () => {
        const trimmedPrompt = prompt.trim();

        if (!trimmedPrompt && items.length === 0) {
            throw new Error('Nhập prompt hoặc thêm ít nhất 1 ảnh tham chiếu trước khi generate.');
        }

        if (items.length > 0 && activeImageIndex < 0) {
            throw new Error('Ảnh active hiện không hợp lệ. Hãy chọn lại ảnh tham chiếu.');
        }

        touchAllImages();

        return {
            prompt: trimmedPrompt,
            ratio: aspectRatio,
            size,
            referenceImages: items.map((image) => ({
                imageBase64: image.imageBase64,
                source: mapSourceTypeToApiSource(image.sourceType),
                name: image.displayName,
                mimeType: image.mimeType
            })),
            autoZoom,
            creativity,
            clientRequestId: `tu-do-ai-${Date.now()}`,
            appVersion: 'uxp-dev',
            ...(items.length > 0 ? { activeImageIndex } : {})
        };
    };

    const handleCreate = async () => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        setErrorMessage('');
        setHistoryNotice('');
        setIsLoading(true);

        try {
            const payload = createGeneratePayload();
            const insertContext = await captureInsertContextSafely({
                fallbackMessage: 'Không thể capture Photoshop context tại thời điểm submit.'
            });

            const response = await onGenerate(payload);

            if (!response || !response.ok || !response.data) {
                setErrorMessage('Không thể generate ảnh Tự Do AI.');
                return;
            }

            const generatedAt = Date.now();
            const resultImage = createResultImageRecord({
                imageBase64: response.data.imageBase64,
                mimeType: response.data.mimeType,
                featureKey: TOOL_KEY,
                requestId: response.data.requestId || generatedAt,
                fileName: `tu-do-ai-${response.data.requestId || generatedAt}`,
                displayName: `tu-do-ai-${response.data.requestId || generatedAt}`,
                layerNamePrefix: 'Tu Do AI'
            });
            const insertState = await performResultInsert({
                resultImage,
                context: insertContext.context,
                mode: 'auto',
                missingContextError: insertContext.error,
                missingContextErrorCode: insertContext.errorCode,
                fallbackFailureMessage: 'Generate đã thành công nhưng chèn vào Photoshop thất bại.'
            });
            const nextResult = buildGeneratedResultState({
                resultImage,
                responseData: response.data,
                featureKey: TOOL_KEY,
                featureLabel: 'Tự Do AI',
                layerNamePrefix: 'Tu Do AI',
                capturedContext: insertContext.context,
                insert: insertState,
                generatedAt
            });

            setResult(nextResult);

            if (onRecordHistory) {
                await onRecordHistory({
                    featureKey: TOOL_KEY,
                    featureLabel: 'Tự Do AI',
                    layerNamePrefix: 'Tu Do AI',
                    requestId: response.data.requestId,
                    createdAt: nextResult.generatedAt,
                    promptSnapshot: payload.prompt,
                    settingsSnapshot: {
                        aspectRatio: payload.ratio,
                        size: payload.size,
                        autoZoom: payload.autoZoom,
                        creativity: payload.creativity,
                        referenceImageCount: items.length,
                        activeImageIndex
                    },
                    summaryLines: [
                        `Prompt: ${payload.prompt ? `${payload.prompt.slice(0, 80)}${payload.prompt.length > 80 ? '...' : ''}` : 'Không dùng prompt.'}`,
                        `Ảnh tham chiếu: ${items.length}`,
                        `Tỉ lệ: ${payload.ratio}`,
                        `Kích thước: ${payload.size}`,
                        `Mức bám input: ${payload.creativity === 'creative' ? 'Sáng tạo' : payload.creativity === 'faithful' ? 'Bám sát' : 'Cân bằng'}`,
                        `Tự động thu phóng: ${payload.autoZoom ? 'Bật' : 'Tắt'}`
                    ],
                    errorSummary: insertState.error || '',
                    capturedContext: insertContext.context,
                    insert: insertState,
                    resultImage: {
                        imageBase64: resultImage.imageBase64,
                        mimeType: resultImage.mimeType,
                        displayName: resultImage.displayName,
                        fileName: resultImage.fileName,
                        layerNamePrefix: resultImage.layerNamePrefix
                    },
                    rehydrationPayload: {
                        tabId: TOOL_KEY,
                        prompt: payload.prompt,
                        aspectRatio: payload.ratio,
                        size: payload.size,
                        autoZoom: payload.autoZoom,
                        creativity: payload.creativity,
                        activeImageId,
                        referenceImages: items.map((image) => ({
                            id: image.id,
                            sourceType: image.sourceType,
                            displayName: image.displayName,
                            mimeType: image.mimeType,
                            storagePath: image.storagePath,
                            width: image.width,
                            height: image.height,
                            createdAt: image.createdAt,
                            lastUsedAt: image.lastUsedAt,
                            persistentToken: image.persistentToken
                        }))
                    }
                });
            }
        } catch (error) {
            setErrorMessage(error && error.message ? error.message : 'Không thể chuẩn bị request Tự Do AI.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddImage = async () => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        setErrorMessage('');
        setShowQuickLayerOptions(false);

        try {
            await addFromFileEntry();
        } catch (error) {
            setErrorMessage(error && error.message ? error.message : 'Không thể đọc ảnh tham chiếu từ máy.');
        }
    };

    const handleQuickLayerImport = async (mode) => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        setErrorMessage('');

        try {
            await addFromQuickLayer(mode);
            setShowQuickLayerOptions(false);
        } catch (error) {
            setErrorMessage(error && error.message ? error.message : 'Không thể lấy ảnh từ Photoshop.');
        }
    };

    const handleQuickLayerToggle = () => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        setShowQuickLayerOptions((current) => !current);
    };

    const handleRemoveImage = (imageId, e) => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        e.stopPropagation();
        setErrorMessage('');
        removeImage(imageId);
    };

    return (
        <div className="tab-pane" ref={rootRef} tabIndex={0}>
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
                    <span className="section-subtitle">
                        {restoreStatus === 'restoring' ? 'Đang khôi phục...' : `${items.length}/${MAX_REFERENCE_IMAGES}`}
                    </span>
                </div>

                {items.length === 0 ? (
                    <div className="empty-state">
                        <svg className="empty-state-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        <span>Chưa có ảnh</span>
                    </div>
                ) : (
                    <div className="reference-grid">
                        {items.map((image) => (
                            <div
                                key={image.id}
                                className={`ref-image ${activeImageId === image.id ? 'active' : ''}`}
                                title={image.displayName}
                                onClick={() => selectActiveImage(image.id)}
                            >
                                <div className="ref-delete" onClick={(e) => handleRemoveImage(image.id, e)}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </div>
                                <img src={image.previewUrl} alt={image.displayName} />
                            </div>
                        ))}
                        {canAddMore ? (
                            <div className="ref-add" title="Thêm ảnh" onClick={handleAddImage}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </div>
                        ) : null}
                    </div>
                )}

                <div className="flex-row">
                    <button className="btn full-width" onClick={handleAddImage} disabled={actionsDisabled || !canAddMore}>Chọn Ảnh</button>
                    <button className="btn full-width" onClick={() => handleQuickLayerImport(QUICK_LAYER_MODES.CURRENT_LAYER)} disabled={actionsDisabled || !canAddMore}>Layer hiện tại</button>
                </div>

                <div className="quick-layer-inline-actions">
                    <button className="btn subtle quick-layer-secondary" onClick={() => handleQuickLayerImport(QUICK_LAYER_MODES.VISIBLE_CANVAS)} disabled={actionsDisabled || !canAddMore}>
                        Dùng toàn bộ canvas đang hiển thị
                    </button>
                </div>

                {restoreNotice ? (
                    <div className="reference-note">{restoreNotice}</div>
                ) : null}

                <div className="reference-note">Dán ảnh từ clipboard bằng `Cmd/Ctrl + V` khi tab đang focus.</div>
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

            {historyNotice ? (
                <div className="section">
                    <div className="success-banner">{historyNotice}</div>
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
                            {result.insert.error ? (
                                <div className="result-detail result-detail-error">{result.insert.error}</div>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="section" style={{marginTop: 'auto'}}>
                <button
                    className="btn primary full-width"
                    onClick={handleCreate}
                    disabled={isLoading || actionsDisabled || !canSubmit || restoreStatus === 'restoring'}
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
