import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
    buildGeneratedResultState,
    captureDocumentInsertContextSafely,
    createResultImageRecord,
    performResultInsert
} from '../../lib/result-insert.js';
import { RestorationMaskEditor } from '../../components/RestorationMaskEditor.jsx';
import { QUICK_LAYER_MODES, useReferenceImages } from '../../lib/reference-images.js';

const TOOL_KEY = 'phucche';
const MAX_SOURCE_IMAGES = 1;
const FACE_REGION_MAX_ITEMS = 5;
const FACE_REGION_MIN_SIZE = 0.04;

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

export const PhucCheTab = ({
    actionsDisabled,
    onRequireAuth,
    onGenerate,
    onOptimizePrompt,
    onRecordHistory,
    historyRestoreRequest
}) => {
    const defaultPresetProfile = PRESET_PROFILES.comprehensive_restore;
    const rootRef = useRef(null);
    const handledRestoreIdRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [historyNotice, setHistoryNotice] = useState('');
    const [size, setSize] = useState('original');
    const [preset, setPreset] = useState('comprehensive_restore');
    const [mode, setMode] = useState(defaultPresetProfile.mode);
    const [enhanceFace, setEnhanceFace] = useState(defaultPresetProfile.enhanceFace);
    const [denoise, setDenoise] = useState(defaultPresetProfile.denoise);
    const [colorize, setColorize] = useState(defaultPresetProfile.colorize);
    const [fidelityMode, setFidelityMode] = useState(defaultPresetProfile.fidelityMode);
    const [restorationIntensity, setRestorationIntensity] = useState(defaultPresetProfile.restorationIntensity);
    const [colorTone, setColorTone] = useState(defaultPresetProfile.colorTone);
    const [prompt, setPrompt] = useState('');
    const [memoName, setMemoName] = useState('');
    const [savedPrompts, setSavedPrompts] = useState(() => {
        try {
            const saved = localStorage.getItem('banana_saved_prompts_phucche');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });
    const [result, setResult] = useState(null);
    const [isManualInsertLoading, setIsManualInsertLoading] = useState(false);
    const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
    const [showQuickLayerOptions, setShowQuickLayerOptions] = useState(false);
    const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);
    const [showFaceRegionEditor, setShowFaceRegionEditor] = useState(false);
    const [showMaskEditor, setShowMaskEditor] = useState(false);
    const [facePriorityRegions, setFacePriorityRegions] = useState([]);
    const [selectedFaceRegionId, setSelectedFaceRegionId] = useState(null);
    const [repairMask, setRepairMask] = useState(null);
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
    const selectedFaceRegion = useMemo(
        () => facePriorityRegions.find((region) => region.id === selectedFaceRegionId) || null,
        [facePriorityRegions, selectedFaceRegionId]
    );
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
                setFacePriorityRegions([]);
                setSelectedFaceRegionId(null);
                setShowFaceRegionEditor(false);
                setRepairMask(null);
                setShowMaskEditor(false);
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
            setSize(payload.size || 'original');
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
            const restoredFaceRegions = sanitizeFacePriorityRegions(payload.facePriorityRegions);
            setFacePriorityRegions(restoredFaceRegions);
            setSelectedFaceRegionId(restoredFaceRegions[0] ? restoredFaceRegions[0].id : null);
            setShowFaceRegionEditor(restoredFaceRegions.length > 0);
            const restoredRepairMask = sanitizeRepairMask(payload.repairMask);
            setRepairMask(restoredRepairMask);
            setShowMaskEditor(Boolean(restoredRepairMask));

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
            ...(facePriorityRegions.length ? {
                facePriorityRegions: facePriorityRegions.map((region) => ({
                    x: region.x,
                    y: region.y,
                    width: region.width,
                    height: region.height
                }))
            } : {}),
            ...(repairMask ? { repairMask } : {}),
            ...(colorize ? { colorTone } : {}),
            clientRequestId: `phuc-che-anh-${Date.now()}`,
            appVersion: 'uxp-dev'
        };
    };

    const handleSavePrompt = () => {
        if (!prompt.trim()) return;
        const name = memoName.trim() || `Prompt ${new Date().toLocaleString()}`;
        const newSaved = [...savedPrompts.filter(p => p.name !== name), { name, prompt: prompt.trim() }];
        setSavedPrompts(newSaved);
        localStorage.setItem('banana_saved_prompts_phucche', JSON.stringify(newSaved));
        setMemoName(name);
    };

    const handleDeletePrompt = (name) => {
        const newSaved = savedPrompts.filter(p => p.name !== name);
        setSavedPrompts(newSaved);
        localStorage.setItem('banana_saved_prompts_phucche', JSON.stringify(newSaved));
        if (memoName === name) setMemoName('');
    };

    const handleLoadSavedPrompt = (name) => {
        const selected = savedPrompts.find(p => p.name === name);
        if (selected) {
            setPrompt(selected.prompt);
            setMemoName(selected.name);
        }
    };

    const handleOptimizePrompt = async () => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt) {
            setErrorMessage('Vui lòng nhập prompt trước khi tối ưu.');
            return;
        }

        if (typeof onOptimizePrompt !== 'function') {
            setErrorMessage('Tính năng tối ưu prompt AI chưa sẵn sàng.');
            return;
        }

        setErrorMessage('');
        setHistoryNotice('');
        setIsOptimizingPrompt(true);

        try {
            const response = await onOptimizePrompt({
                feature: 'phuc-che-anh',
                prompt: trimmedPrompt,
                context: {
                    preset,
                    mode,
                    size,
                    enhanceFace,
                    denoise,
                    colorize,
                    fidelityMode,
                    restorationIntensity,
                    colorTone: colorize ? colorTone : '',
                    facePriorityRegionCount: facePriorityRegions.length,
                    hasRepairMask: Boolean(repairMask)
                },
                clientRequestId: `phuc-che-anh-optimize-${Date.now()}`,
                appVersion: 'uxp-dev'
            });

            if (!response || !response.ok || !response.data || !response.data.optimizedPrompt) {
                setErrorMessage('Không thể tối ưu prompt AI.');
                return;
            }

            setPrompt(response.data.optimizedPrompt);
            setShowAdvancedPrompt(true);
            setHistoryNotice('Đã tối ưu prompt AI và giữ nguyên ý đồ phục chế của bạn. Bạn có thể chỉnh lại trước khi generate.');
        } finally {
            setIsOptimizingPrompt(false);
        }
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
            const faceRegionError = validateFacePriorityRegions(facePriorityRegions);
            const repairMaskError = validateRepairMask(repairMask);

            if (faceRegionError) {
                throw new Error(faceRegionError);
            }

            if (repairMaskError) {
                throw new Error(repairMaskError);
            }

            const payload = createGeneratePayload();
            const sourcePreviewUrl = activeImage ? activeImage.previewUrl : '';
            const sourceDisplayName = activeImage ? activeImage.displayName : '';
            const insertContext = await captureDocumentInsertContextSafely({
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
                        colorTone: payload.colorTone || null,
                        facePriorityRegions: payload.facePriorityRegions || [],
                        repairMask: payload.repairMask || null
                    },
                    summaryLines: [
                        `Preset: ${RESTORE_PRESETS.find((option) => option.id === payload.preset)?.label || payload.preset}`,
                        `Mode: ${RESTORE_MODES.find((option) => option.id === payload.mode)?.label || payload.mode}`,
                        `Kích thước: ${payload.size}`,
                        `Vùng mặt ưu tiên: ${payload.facePriorityRegions && payload.facePriorityRegions.length ? `${payload.facePriorityRegions.length} vùng` : 'Auto'}`,
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
                        facePriorityRegions: payload.facePriorityRegions || [],
                        repairMask: payload.repairMask || null,
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

    const handleManualInsert = async () => {
        if (!result || isManualInsertLoading) {
            return;
        }

        setErrorMessage('');
        setHistoryNotice('');
        setIsManualInsertLoading(true);

        try {
            const insertContext = await captureDocumentInsertContextSafely({
                fallbackMessage: 'Không có document Photoshop đang mở để chèn thủ công.'
            });
            const insertState = await performResultInsert({
                resultImage: {
                    imageBase64: result.imageBase64,
                    mimeType: result.mimeType,
                    fileName: result.filename,
                    displayName: result.displayName,
                    layerNamePrefix: result.layerNamePrefix || 'Phuc Che'
                },
                context: insertContext.context,
                mode: 'manual',
                missingContextError: insertContext.error,
                missingContextErrorCode: insertContext.errorCode,
                fallbackFailureMessage: 'Không thể chèn thủ công vào Photoshop.'
            });

            setResult((current) => {
                if (!current) {
                    return current;
                }

                return {
                    ...current,
                    capturedContext: insertContext.context || current.capturedContext,
                    insert: insertState
                };
            });

            if (insertState.status === 'success') {
                setHistoryNotice('Đã chèn thủ công ảnh vào Photoshop dưới dạng layer mới trong document hiện tại.');
            }
        } finally {
            setIsManualInsertLoading(false);
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
            setFacePriorityRegions([]);
            setSelectedFaceRegionId(null);
            setShowFaceRegionEditor(false);
            setRepairMask(null);
            setShowMaskEditor(false);
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
            setFacePriorityRegions([]);
            setSelectedFaceRegionId(null);
            setShowFaceRegionEditor(false);
            setRepairMask(null);
            setShowMaskEditor(false);
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
        setFacePriorityRegions([]);
        setSelectedFaceRegionId(null);
        setShowFaceRegionEditor(false);
        setRepairMask(null);
        setShowMaskEditor(false);
    };

    const handleDeleteSelectedFaceRegion = () => {
        if (!selectedFaceRegion) {
            return;
        }

        const nextRegions = facePriorityRegions.filter((region) => region.id !== selectedFaceRegion.id);
        setFacePriorityRegions(nextRegions);
        setSelectedFaceRegionId(nextRegions[0] ? nextRegions[0].id : null);
    };

    const handleResetFaceRegions = () => {
        setFacePriorityRegions([]);
        setSelectedFaceRegionId(null);
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
                <select className="dropdown" value={fidelityMode} onChange={(event) => setFidelityMode(event.target.value)}>
                    {FIDELITY_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                </select>

                <div className="section-header" style={{marginTop: '12px'}}>
                    <span className="section-label">Mức phục chế</span>
                </div>
                <select className="dropdown" value={restorationIntensity} onChange={(event) => setRestorationIntensity(event.target.value)}>
                    {INTENSITY_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                </select>

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
                    <>
                    <div className="prompt-toolbar">
                        <div className="prompt-toolbar-left">
                            <span className="prompt-label">Prompt</span>
                            <div className="prompt-icon-wrapper">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="22" y1="12" x2="18" y2="12"></line>
                                    <line x1="6" y1="12" x2="2" y2="12"></line>
                                    <line x1="12" y1="6" x2="12" y2="2"></line>
                                    <line x1="12" y1="22" x2="12" y2="18"></line>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </div>
                        </div>
                        <div className="prompt-toolbar-actions">
                            <button
                                className="btn-action primary-action"
                                onClick={handleOptimizePrompt}
                                disabled={actionsDisabled || isLoading || isOptimizingPrompt || !prompt.trim()}
                                title="Tối ưu prompt AI"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                                </svg>
                                <span>{isOptimizingPrompt ? 'Đang tối ưu...' : 'Tối ưu prompt AI'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="prompt-content-box">
                        <div className="prompt-secondary-row">
                            <div className="prompt-field-group" style={{flex: 1}}>
                                <span className="prompt-field-label">Cấu hình đã lưu:</span>
                                <select 
                                    className="dropdown prompt-select" 
                                    value={memoName} 
                                    onChange={(e) => handleLoadSavedPrompt(e.target.value)}
                                >
                                    <option value="">--- Chọn prompt đã lưu ---</option>
                                    {savedPrompts.map(p => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="prompt-field-group">
                            <span className="prompt-field-label">vào prompt:</span>
                            <textarea
                                className="prompt-textarea"
                                placeholder="Gợi ý thêm về tone màu, mức giữ nguyên ảnh gốc, hoặc vùng cần ưu tiên..."
                                value={prompt}
                                onChange={(event) => setPrompt(event.target.value)}
                                maxLength={500}
                            ></textarea>
                            <div className="prompt-char-count">{prompt.length}/500</div>
                        </div>
                        
                        <div className="prompt-footer-row">
                            <div className="prompt-field-group" style={{flex: 1}}>
                                <input
                                    type="text"
                                    className="prompt-memo-input"
                                    placeholder="Đặt tên gợi nhớ (tùy chọn)..."
                                    value={memoName}
                                    onChange={(e) => setMemoName(e.target.value)}
                                />
                            </div>
                            <div className="prompt-footer-actions">
                                <button className="btn-footer-action primary" onClick={handleSavePrompt} title="Lưu">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                        <polyline points="7 3 7 8 15 8"></polyline>
                                    </svg>
                                    <span>Lưu</span>
                                </button>
                                <button 
                                    className="btn-footer-action" 
                                    onClick={() => handleDeletePrompt(memoName)} 
                                    disabled={!memoName || !savedPrompts.some(p => p.name === memoName)} 
                                    title="Xóa"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                    <span>Xóa</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    </>
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
                            {result.insert.status !== 'success' ? (
                                <>
                                    <button
                                        className="btn"
                                        style={{ width: '100%' }}
                                        onClick={handleManualInsert}
                                        disabled={isLoading || isManualInsertLoading}
                                    >
                                        {isManualInsertLoading ? 'Đang chèn thủ công...' : 'Chèn thủ công'}
                                    </button>
                                    <div className="result-detail">
                                        Đóng mọi hộp thoại hoặc chế độ chỉnh sửa trong Photoshop rồi bấm Chèn thủ công.
                                        Ảnh sẽ được thêm thành layer mới trong document hiện tại.
                                    </div>
                                </>
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
                        <>{result ? 'Regenerate' : 'Phục Chế Ảnh'}</>
                    )}
                </button>
            </div>
        </div>
    );
};
