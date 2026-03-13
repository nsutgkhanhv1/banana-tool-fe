import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
    buildGeneratedResultState,
    captureInsertContextSafely,
    createResultImageRecord,
    performResultInsert
} from '../../lib/result-insert.js';
import { QUICK_LAYER_MODES, useReferenceImages } from '../../lib/reference-images.js';

const TOOL_KEY = 'phucche';
const MAX_SOURCE_IMAGES = 1;

const RESTORE_PRESETS = [
    { id: 'comprehensive_restore', label: 'Phục chế toàn diện' },
    { id: 'portrait_old', label: 'Chân dung cũ' },
    { id: 'family_photo', label: 'Ảnh gia đình' },
    { id: 'scan_photo', label: 'Ảnh scan' }
];

const RESTORE_MODES = [
    { id: 'comprehensive', label: 'Phục chế toàn diện' },
    { id: 'clarify', label: 'Làm rõ' },
    { id: 'denoise', label: 'Khử nhiễu' },
    { id: 'scratch_repair', label: 'Xóa xước / hư hại' },
    { id: 'colorize', label: 'Tô màu' }
];

const FIDELITY_OPTIONS = [
    { id: 'faithful', label: 'Trung thực' },
    { id: 'enhanced', label: 'Tăng cường' }
];

const INTENSITY_OPTIONS = [
    { id: 'light', label: 'Nhẹ' },
    { id: 'medium', label: 'Vừa' },
    { id: 'strong', label: 'Mạnh' }
];

const COLOR_TONE_OPTIONS = [
    { id: 'natural', label: 'Tự nhiên' },
    { id: 'warm', label: 'Ấm' },
    { id: 'cinematic', label: 'Cinematic' }
];

const PRESET_PROFILES = {
    comprehensive_restore: {
        mode: 'comprehensive',
        enhanceFace: true,
        denoise: true,
        colorize: false,
        fidelityMode: 'faithful',
        restorationIntensity: 'medium',
        colorTone: 'natural'
    },
    portrait_old: {
        mode: 'clarify',
        enhanceFace: true,
        denoise: true,
        colorize: false,
        fidelityMode: 'faithful',
        restorationIntensity: 'medium',
        colorTone: 'natural'
    },
    family_photo: {
        mode: 'comprehensive',
        enhanceFace: true,
        denoise: true,
        colorize: false,
        fidelityMode: 'enhanced',
        restorationIntensity: 'medium',
        colorTone: 'warm'
    },
    scan_photo: {
        mode: 'denoise',
        enhanceFace: false,
        denoise: true,
        colorize: false,
        fidelityMode: 'faithful',
        restorationIntensity: 'light',
        colorTone: 'natural'
    }
};

const mapSourceTypeToApiSource = (sourceType) => {
    if (sourceType === 'quick_layer_canvas') {
        return 'photoshop-composite';
    }

    if (sourceType === 'quick_layer_current') {
        return 'photoshop-layer';
    }

    return 'file';
};

export const PhucCheTab = ({ actionsDisabled, onRequireAuth, onGenerate, onRecordHistory, historyRestoreRequest }) => {
    const defaultPresetProfile = PRESET_PROFILES.comprehensive_restore;
    const rootRef = useRef(null);
    const handledRestoreIdRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [historyNotice, setHistoryNotice] = useState('');
    const [size, setSize] = useState('4K');
    const [preset, setPreset] = useState('comprehensive_restore');
    const [mode, setMode] = useState(defaultPresetProfile.mode);
    const [enhanceFace, setEnhanceFace] = useState(defaultPresetProfile.enhanceFace);
    const [denoise, setDenoise] = useState(defaultPresetProfile.denoise);
    const [colorize, setColorize] = useState(defaultPresetProfile.colorize);
    const [fidelityMode, setFidelityMode] = useState(defaultPresetProfile.fidelityMode);
    const [restorationIntensity, setRestorationIntensity] = useState(defaultPresetProfile.restorationIntensity);
    const [colorTone, setColorTone] = useState(defaultPresetProfile.colorTone);
    const [prompt, setPrompt] = useState('');
    const [result, setResult] = useState(null);
    const [showQuickLayerOptions, setShowQuickLayerOptions] = useState(false);
    const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);
    const [compareView, setCompareView] = useState('after');
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
        maxItems: MAX_SOURCE_IMAGES
    });

    const activeImage = useMemo(() => items.find((image) => image.id === activeImageId) || null, [activeImageId, items]);
    const canSubmit = Boolean(activeImage);
    const comparePreviewUrl = compareView === 'before' && result && result.sourcePreviewUrl
        ? result.sourcePreviewUrl
        : result
            ? result.previewUrl
            : '';

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
            setCompareView('after');
            setHistoryNotice(`Đã nạp cấu hình từ lịch sử cho ${historyRestoreRequest.featureLabel}.`);
            setSize(payload.size || '4K');
            setPreset(payload.preset || 'comprehensive_restore');
            setMode(payload.mode || defaultPresetProfile.mode);
            setEnhanceFace(typeof payload.enhanceFace === 'boolean' ? payload.enhanceFace : defaultPresetProfile.enhanceFace);
            setDenoise(typeof payload.denoise === 'boolean' ? payload.denoise : defaultPresetProfile.denoise);
            setColorize(typeof payload.colorize === 'boolean' ? payload.colorize : defaultPresetProfile.colorize);
            setFidelityMode(payload.fidelityMode || defaultPresetProfile.fidelityMode);
            setRestorationIntensity(payload.restorationIntensity || defaultPresetProfile.restorationIntensity);
            setColorTone(payload.colorTone || defaultPresetProfile.colorTone);
            setPrompt(payload.prompt || '');
            setShowAdvancedPrompt(Boolean(payload.prompt));
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
    }, [defaultPresetProfile.colorTone, defaultPresetProfile.denoise, defaultPresetProfile.enhanceFace, defaultPresetProfile.fidelityMode, defaultPresetProfile.mode, defaultPresetProfile.restorationIntensity, historyRestoreRequest, restoreFromSnapshots]);

    const createGeneratePayload = () => {
        if (!activeImage) {
            throw new Error('Cần ít nhất 1 ảnh đầu vào để chạy Phục Chế Ảnh.');
        }

        touchAllImages();

        return {
            sourceImage: {
                imageBase64: activeImage.imageBase64,
                source: mapSourceTypeToApiSource(activeImage.sourceType),
                name: activeImage.displayName,
                mimeType: activeImage.mimeType
            },
            size,
            preset,
            mode,
            prompt: prompt.trim(),
            enhanceFace,
            denoise,
            colorize,
            fidelityMode,
            restorationIntensity,
            ...(colorize ? { colorTone } : {}),
            clientRequestId: `phuc-che-anh-${Date.now()}`,
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
            const sourcePreviewUrl = activeImage ? activeImage.previewUrl : '';
            const sourceDisplayName = activeImage ? activeImage.displayName : '';
            const insertContext = await captureInsertContextSafely({
                fallbackMessage: 'Không thể capture Photoshop context tại thời điểm submit.'
            });

            const response = await onGenerate(payload);

            if (!response || !response.ok || !response.data) {
                setErrorMessage('Không thể generate ảnh Phục Chế.');
                return;
            }

            const generatedAt = Date.now();
            const resultImage = createResultImageRecord({
                imageBase64: response.data.imageBase64,
                mimeType: response.data.mimeType,
                featureKey: TOOL_KEY,
                requestId: response.data.requestId || generatedAt,
                fileName: `phuc-che-${response.data.requestId || generatedAt}`,
                displayName: `phuc-che-${response.data.requestId || generatedAt}`,
                layerNamePrefix: 'Phuc Che'
            });
            const insertState = await performResultInsert({
                resultImage,
                context: insertContext.context,
                mode: 'auto',
                missingContextError: insertContext.error,
                missingContextErrorCode: insertContext.errorCode,
                fallbackFailureMessage: 'Generate đã thành công nhưng chèn vào Photoshop thất bại.'
            });

            setCompareView('after');
            const nextResult = buildGeneratedResultState({
                resultImage,
                responseData: response.data,
                featureKey: TOOL_KEY,
                featureLabel: 'Phục Chế Ảnh',
                layerNamePrefix: 'Phuc Che',
                capturedContext: insertContext.context,
                insert: insertState,
                generatedAt,
                extraFields: {
                    sourcePreviewUrl,
                    sourceDisplayName
                }
            });

            setResult(nextResult);

            if (onRecordHistory) {
                await onRecordHistory({
                    featureKey: TOOL_KEY,
                    featureLabel: 'Phục Chế Ảnh',
                    layerNamePrefix: 'Phuc Che',
                    requestId: response.data.requestId,
                    createdAt: nextResult.generatedAt,
                    promptSnapshot: payload.prompt,
                    settingsSnapshot: {
                        size: payload.size,
                        preset: payload.preset,
                        mode: payload.mode,
                        enhanceFace: payload.enhanceFace,
                        denoise: payload.denoise,
                        colorize: payload.colorize,
                        fidelityMode: payload.fidelityMode,
                        restorationIntensity: payload.restorationIntensity,
                        colorTone: payload.colorTone || null
                    },
                    summaryLines: [
                        `Preset: ${RESTORE_PRESETS.find((option) => option.id === payload.preset)?.label || payload.preset}`,
                        `Mode: ${RESTORE_MODES.find((option) => option.id === payload.mode)?.label || payload.mode}`,
                        `Kích thước: ${payload.size}`,
                        `Khôi phục mặt: ${payload.enhanceFace ? 'Bật' : 'Tắt'}`,
                        `Khử nhiễu: ${payload.denoise ? 'Bật' : 'Tắt'}`,
                        `Tô màu: ${payload.colorize ? `Bật${payload.colorTone ? ` (${COLOR_TONE_OPTIONS.find((option) => option.id === payload.colorTone)?.label || payload.colorTone})` : ''}` : 'Tắt'}`
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
                        size: payload.size,
                        preset: payload.preset,
                        mode: payload.mode,
                        prompt: payload.prompt,
                        enhanceFace: payload.enhanceFace,
                        denoise: payload.denoise,
                        colorize: payload.colorize,
                        fidelityMode: payload.fidelityMode,
                        restorationIntensity: payload.restorationIntensity,
                        colorTone: payload.colorTone || '',
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
            setErrorMessage(error && error.message ? error.message : 'Không thể chuẩn bị request Phục Chế Ảnh.');
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

    const handleQuickLayerImport = async (quickLayerMode) => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        setErrorMessage('');

        try {
            await addFromQuickLayer(quickLayerMode);
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

    const handleRemoveImage = (imageId, event) => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        event.stopPropagation();
        setErrorMessage('');
        removeImage(imageId);
    };

    const handlePresetChange = (nextPreset) => {
        const presetProfile = PRESET_PROFILES[nextPreset];

        setPreset(nextPreset);

        if (!presetProfile) {
            return;
        }

        setMode(presetProfile.mode);
        setEnhanceFace(presetProfile.enhanceFace);
        setDenoise(presetProfile.denoise);
        setColorize(presetProfile.colorize);
        setFidelityMode(presetProfile.fidelityMode);
        setRestorationIntensity(presetProfile.restorationIntensity);
        setColorTone(presetProfile.colorTone);
    };

    return (
        <div className="tab-pane" ref={rootRef} tabIndex={0}>
            <div className={`app-overlay ${isLoading ? 'active' : ''}`}>
                <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{color: '#F4B400', width: '24px', height: '24px'}}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                <span className="overlay-text">Đang phục chế ảnh và chuẩn bị chèn vào Photoshop...</span>
            </div>

            <div className="section">
                <div className="flex-col">
                    <span className="section-label">Kích thước</span>
                    <select className="dropdown" value={size} onChange={(event) => setSize(event.target.value)}>
                        <option value="4K">4K (Ưu tiên tối đa)</option>
                        <option value="2K">2K (2048px)</option>
                        <option value="original">Giữ nguyên</option>
                    </select>
                </div>
            </div>

            <div className="section">
                <div className="section-header">
                    <span className="section-label">Ảnh đầu vào</span>
                    <span className="section-subtitle">
                        {restoreStatus === 'restoring' ? 'Đang khôi phục...' : `${items.length}/${MAX_SOURCE_IMAGES}`}
                    </span>
                </div>

                {items.length === 0 ? (
                    <div className="empty-state">
                        <svg className="empty-state-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        <span>Chưa có ảnh phục chế</span>
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
                <div className="flex-row">
                    <div className="flex-col">
                        <span className="section-label">Preset</span>
                        <select className="dropdown" value={preset} onChange={(event) => handlePresetChange(event.target.value)}>
                            {RESTORE_PRESETS.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-col">
                        <span className="section-label">Mode phục chế</span>
                        <select className="dropdown" value={mode} onChange={(event) => setMode(event.target.value)}>
                            {RESTORE_MODES.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="section">
                <div className="switch-row" style={{marginBottom: '10px'}}>
                    <div className="switch-label">Khôi phục chi tiết khuôn mặt</div>
                    <label className="switch">
                        <input type="checkbox" checked={enhanceFace} onChange={(event) => setEnhanceFace(event.target.checked)} />
                        <span className="slider"></span>
                    </label>
                </div>

                <div className="switch-row" style={{marginBottom: '10px'}}>
                    <div className="switch-label">Giảm nhiễu hạt</div>
                    <label className="switch">
                        <input type="checkbox" checked={denoise} onChange={(event) => setDenoise(event.target.checked)} />
                        <span className="slider"></span>
                    </label>
                </div>

                <div className="switch-row">
                    <div className="switch-label">Tô màu ảnh</div>
                    <label className="switch">
                        <input type="checkbox" checked={colorize} onChange={(event) => setColorize(event.target.checked)} />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            <div className="section">
                <div className="section-header">
                    <span className="section-label">Mức can thiệp</span>
                </div>
                <div className="segmented-control">
                    {FIDELITY_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            className={`segment-btn ${fidelityMode === option.id ? 'active' : ''}`}
                            onClick={() => setFidelityMode(option.id)}
                            type="button"
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <div className="section-header" style={{marginTop: '12px'}}>
                    <span className="section-label">Mức phục chế</span>
                </div>
                <div className="segmented-control">
                    {INTENSITY_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            className={`segment-btn ${restorationIntensity === option.id ? 'active' : ''}`}
                            onClick={() => setRestorationIntensity(option.id)}
                            type="button"
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {colorize ? (
                    <>
                        <div className="section-header" style={{marginTop: '12px'}}>
                            <span className="section-label">Tone màu</span>
                        </div>
                        <select className="dropdown" value={colorTone} onChange={(event) => setColorTone(event.target.value)}>
                            {COLOR_TONE_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </>
                ) : null}
            </div>

            <div className="section">
                <div className="section-header">
                    <span className="section-label">Prompt nâng cao</span>
                    <button className="btn" type="button" onClick={() => setShowAdvancedPrompt((current) => !current)}>
                        {showAdvancedPrompt ? 'Ẩn' : 'Mở'}
                    </button>
                </div>

                {showAdvancedPrompt ? (
                    <div className="prompt-box">
                        <textarea
                            className="textarea"
                            placeholder="Gợi ý thêm về tone màu, mức giữ nguyên ảnh gốc, hoặc vùng cần ưu tiên..."
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            maxLength={500}
                        ></textarea>
                        <div className="prompt-footer">
                            <span className="char-counter">{prompt.length}/500</span>
                        </div>
                    </div>
                ) : (
                    <div className="reference-note">Để trống nếu bạn chỉ muốn chạy theo preset và các toggle hiện tại.</div>
                )}
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

                    <div className="segmented-control" style={{marginBottom: '12px'}}>
                        <button
                            className={`segment-btn ${compareView === 'before' ? 'active' : ''}`}
                            onClick={() => setCompareView('before')}
                            type="button"
                        >
                            Trước
                        </button>
                        <button
                            className={`segment-btn ${compareView === 'after' ? 'active' : ''}`}
                            onClick={() => setCompareView('after')}
                            type="button"
                        >
                            Sau
                        </button>
                    </div>

                    <div className="result-card">
                        <img
                            className="result-preview"
                            src={comparePreviewUrl}
                            alt={compareView === 'before' ? 'Ảnh trước khi phục chế' : 'Kết quả Phục Chế Ảnh'}
                        />
                        <div className="result-meta">
                            <div className={`status-pill ${result.insert.status === 'success' ? 'is-success' : 'is-error'}`}>
                                {result.insert.status === 'success' ? 'Đã chèn vào Photoshop' : 'Generate xong, chèn thất bại'}
                            </div>
                            {result.sourceDisplayName ? (
                                <div className="result-detail">Nguồn: {result.sourceDisplayName}</div>
                            ) : null}
                            {result.inputSummary ? (
                                <div className="result-detail">
                                    Mode: {RESTORE_MODES.find((option) => option.id === result.inputSummary.mode)?.label || result.inputSummary.mode}
                                </div>
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

            <div className="section">
                <div className="reference-note">
                    Mask editor, face region và history chưa được mở trong slice này. Fallback hiện tại là dùng preset, mode và toggle để chạy end-to-end an toàn.
                </div>
            </div>

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
                        <>{result ? 'Regenerate' : 'Phục Chế Ảnh'}</>
                    )}
                </button>
            </div>
        </div>
    );
};
