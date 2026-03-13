import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
    buildGeneratedResultState,
    captureInsertContextSafely,
    createResultImageRecord,
    performResultInsert
} from '../../lib/result-insert.js';
import { QUICK_LAYER_MODES, useReferenceImages } from '../../lib/reference-images.js';

const TOOL_KEY = 'thaynen';
const MAX_REFERENCE_IMAGES = 1;
const BACKGROUND_PRESETS = [
    { id: 'studio', label: 'Studio' },
    { id: 'outdoor', label: 'Outdoor' },
    { id: 'luxury', label: 'Luxury' },
    { id: 'minimal', label: 'Minimal' }
];
const BACKGROUND_PRESET_PROMPTS = {
    studio: 'Nền studio sạch, ánh sáng mềm, cảm giác chuyên nghiệp và cao cấp.',
    outdoor: 'Bối cảnh ngoài trời tự nhiên, ánh sáng buổi sáng, tone ấm và thoáng.',
    luxury: 'Bối cảnh sang trọng, ánh sáng tinh tế, chất liệu cao cấp và nổi bật chủ thể.',
    minimal: 'Nền tối giản, sạch sẽ, ánh sáng dịu, tập trung hoàn toàn vào chủ thể.'
};
const REPLACEMENT_STRENGTH_OPTIONS = [
    { id: 'low', label: 'Thấp' },
    { id: 'medium', label: 'Vừa' },
    { id: 'high', label: 'Mạnh' }
];

const mapSourceTypeToApiSource = (sourceType) => {
    if (sourceType === 'quick_layer_canvas') {
        return 'photoshop-composite';
    }

    if (sourceType === 'quick_layer_current') {
        return 'photoshop-layer';
    }

    return 'file';
};

export const ThayNenTab = ({ actionsDisabled, onRequireAuth, onGenerate, onRecordHistory, historyRestoreRequest }) => {
    const rootRef = useRef(null);
    const handledRestoreIdRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [historyNotice, setHistoryNotice] = useState('');
    const [aspectRatio, setAspectRatio] = useState('3:4');
    const [size, setSize] = useState('4K');
    const [backgroundPreset, setBackgroundPreset] = useState('studio');
    const [prompt, setPrompt] = useState('');
    const [keepSubject, setKeepSubject] = useState(true);
    const [matchLighting, setMatchLighting] = useState(true);
    const [replacementStrength, setReplacementStrength] = useState('medium');
    const [result, setResult] = useState(null);
    const [showQuickLayerOptions, setShowQuickLayerOptions] = useState(false);
    const {
        items,
        activeImageId,
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

    const activeImage = useMemo(() => items.find((image) => image.id === activeImageId) || null, [activeImageId, items]);
    const canSubmit = Boolean(activeImage);

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

                setErrorMessage(error && error.message ? error.message : 'Không thể nhập ảnh đầu vào từ clipboard.');
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
            setAspectRatio(payload.aspectRatio || '3:4');
            setSize(payload.size || '4K');
            setBackgroundPreset(payload.backgroundPreset || 'studio');
            setPrompt(payload.prompt || '');
            setKeepSubject(typeof payload.keepSubject === 'boolean' ? payload.keepSubject : true);
            setMatchLighting(typeof payload.matchLighting === 'boolean' ? payload.matchLighting : true);
            setReplacementStrength(payload.replacementStrength || 'medium');
            setShowQuickLayerOptions(false);

            const restored = await restoreFromSnapshots({
                snapshots: payload.referenceImages || [],
                nextActiveImageId: payload.activeImageId || null
            });

            if (!cancelled && payload.referenceImages && payload.referenceImages.length > 0 && !restored.items.length) {
                setErrorMessage('Không thể khôi phục ảnh đầu vào từ history item này.');
            }
        };

        applyHistoryRestore();

        return () => {
            cancelled = true;
        };
    }, [historyRestoreRequest, restoreFromSnapshots]);

    const createGeneratePayload = () => {
        if (!activeImage) {
            throw new Error('Cần ít nhất 1 ảnh đầu vào để chạy Thay Nền.');
        }

        touchAllImages();

        return {
            sourceImage: {
                imageBase64: activeImage.imageBase64,
                source: mapSourceTypeToApiSource(activeImage.sourceType),
                name: activeImage.displayName,
                mimeType: activeImage.mimeType
            },
            ratio: aspectRatio,
            size,
            preset: backgroundPreset,
            prompt: prompt.trim(),
            keepSubject,
            matchLighting,
            replacementStrength,
            clientRequestId: `thay-nen-${Date.now()}`,
            appVersion: 'uxp-dev'
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
                setErrorMessage('Không thể generate ảnh Thay Nền.');
                return;
            }

            const generatedAt = Date.now();
            const resultImage = createResultImageRecord({
                imageBase64: response.data.imageBase64,
                mimeType: response.data.mimeType,
                featureKey: TOOL_KEY,
                requestId: response.data.requestId || generatedAt,
                fileName: `thay-nen-${response.data.requestId || generatedAt}`,
                displayName: `thay-nen-${response.data.requestId || generatedAt}`,
                layerNamePrefix: 'Thay Nen'
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
                featureLabel: 'Thay Nền',
                layerNamePrefix: 'Thay Nen',
                capturedContext: insertContext.context,
                insert: insertState,
                generatedAt
            });

            setResult(nextResult);

            if (onRecordHistory) {
                await onRecordHistory({
                    featureKey: TOOL_KEY,
                    featureLabel: 'Thay Nền',
                    layerNamePrefix: 'Thay Nen',
                    requestId: response.data.requestId,
                    createdAt: nextResult.generatedAt,
                    promptSnapshot: payload.prompt,
                    settingsSnapshot: {
                        aspectRatio: payload.ratio,
                        size: payload.size,
                        preset: payload.preset,
                        keepSubject: payload.keepSubject,
                        matchLighting: payload.matchLighting,
                        replacementStrength: payload.replacementStrength
                    },
                    summaryLines: [
                        `Preset: ${BACKGROUND_PRESETS.find((preset) => preset.id === payload.preset)?.label || payload.preset}`,
                        `Tỉ lệ: ${payload.ratio}`,
                        `Kích thước: ${payload.size}`,
                        `Giữ chủ thể: ${payload.keepSubject ? 'Bật' : 'Tắt'}`,
                        `Khớp ánh sáng: ${payload.matchLighting ? 'Bật' : 'Tắt'}`,
                        `Độ mạnh thay nền: ${REPLACEMENT_STRENGTH_OPTIONS.find((option) => option.id === payload.replacementStrength)?.label || payload.replacementStrength}`
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
                        aspectRatio: payload.ratio,
                        size: payload.size,
                        backgroundPreset: payload.preset,
                        prompt: payload.prompt,
                        keepSubject: payload.keepSubject,
                        matchLighting: payload.matchLighting,
                        replacementStrength: payload.replacementStrength,
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
            setErrorMessage(error && error.message ? error.message : 'Không thể chuẩn bị request Thay Nền.');
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
            setErrorMessage(error && error.message ? error.message : 'Không thể đọc ảnh đầu vào từ máy.');
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

    const handlePresetChange = (presetId) => {
        setBackgroundPreset(presetId);
        setPrompt(BACKGROUND_PRESET_PROMPTS[presetId] || '');
    };

    const handleRemoveImage = (imageId, event) => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        event.stopPropagation();
        setErrorMessage('');
        removeImage(imageId);
    };

    return (
        <div className="tab-pane" ref={rootRef} tabIndex={0}>
            <div className={`app-overlay ${isLoading ? 'active' : ''}`}>
                <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{color: '#F4B400', width: '24px', height: '24px'}}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                <span className="overlay-text">Đang thay nền và chuẩn bị chèn vào Photoshop...</span>
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
                    <span className="section-label">Ảnh đầu vào</span>
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
                                <div className="ref-delete" onClick={(event) => handleRemoveImage(image.id, event)}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </div>
                                <img src={image.previewUrl} alt={image.displayName} />
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex-row">
                    <button className="btn full-width" onClick={handleAddImage} disabled={actionsDisabled || !canAddMore}>Chọn Ảnh</button>
                    <button className="btn full-width" onClick={handleQuickLayerToggle} disabled={actionsDisabled || !canAddMore}>Lớp nhanh</button>
                </div>

                {showQuickLayerOptions ? (
                    <div className="quick-layer-panel">
                        <button className="btn full-width" onClick={() => handleQuickLayerImport(QUICK_LAYER_MODES.CURRENT_LAYER)} disabled={actionsDisabled}>
                            Layer hiện tại
                        </button>
                        <button className="btn full-width" onClick={() => handleQuickLayerImport(QUICK_LAYER_MODES.VISIBLE_CANVAS)} disabled={actionsDisabled}>
                            Toàn bộ canvas đang hiển thị
                        </button>
                    </div>
                ) : null}

                {restoreNotice ? (
                    <div className="reference-note">{restoreNotice}</div>
                ) : null}

                <div className="reference-note">Dán ảnh từ clipboard bằng `Cmd/Ctrl + V` khi tab đang focus.</div>
            </div>

            <div className="section">
                <div className="section-header">
                    <span className="section-label">Preset nền</span>
                </div>
                <div className="segmented-control">
                    {BACKGROUND_PRESETS.map((preset) => (
                        <button
                            key={preset.id}
                            className={`segment-btn ${backgroundPreset === preset.id ? 'active' : ''}`}
                            onClick={() => handlePresetChange(preset.id)}
                            type="button"
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="section">
                <div className="switch-row" style={{marginBottom: '10px'}}>
                    <div className="switch-label">Giữ chủ thể</div>
                    <label className="switch">
                        <input type="checkbox" checked={keepSubject} onChange={(e) => setKeepSubject(e.target.checked)} />
                        <span className="slider"></span>
                    </label>
                </div>

                <div className="switch-row">
                    <div className="switch-label">Khớp ánh sáng / tone</div>
                    <label className="switch">
                        <input type="checkbox" checked={matchLighting} onChange={(e) => setMatchLighting(e.target.checked)} />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            <div className="section">
                <div className="section-header">
                    <span className="section-label">Độ mạnh thay nền</span>
                </div>
                <div className="segmented-control">
                    {REPLACEMENT_STRENGTH_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            className={`segment-btn ${replacementStrength === option.id ? 'active' : ''}`}
                            onClick={() => setReplacementStrength(option.id)}
                            type="button"
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="section">
                <div className="section-header">
                    <span className="section-label">Prompt</span>
                </div>
                <div className="prompt-box">
                    <textarea
                        className="textarea"
                        placeholder="Mô tả nền mới, ánh sáng, mood hoặc tone màu mong muốn..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        maxLength={500}
                    ></textarea>
                    <div className="prompt-footer">
                        <span className="char-counter">{prompt.length}/500</span>
                    </div>
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
                        <img className="result-preview" src={result.previewUrl} alt="Kết quả Thay Nền" />
                        <div className="result-meta">
                            <div className={`status-pill ${result.insert.status === 'success' ? 'is-success' : 'is-error'}`}>
                                {result.insert.status === 'success' ? 'Đã chèn vào Photoshop' : 'Generate xong, chèn thất bại'}
                            </div>
                            {result.inputSummary && result.inputSummary.preset ? (
                                <div className="result-detail">Preset: {BACKGROUND_PRESETS.find((preset) => preset.id === result.inputSummary.preset)?.label || result.inputSummary.preset}</div>
                            ) : null}
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
                        <>{result ? 'Regenerate' : 'Thay Nền'}</>
                    )}
                </button>
            </div>
        </div>
    );
};
