import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
    buildGeneratedResultState,
    captureInsertContextSafely,
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

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const roundRegionValue = (value) => Math.round(value * 10000) / 10000;

const createFaceRegionId = () => `face-region-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const sanitizeFacePriorityRegions = (regions) => (
    Array.isArray(regions)
        ? regions
            .map((region) => {
                const rawX = Number(region && region.x);
                const rawY = Number(region && region.y);
                const rawWidth = Number(region && region.width);
                const rawHeight = Number(region && region.height);

                if (![rawX, rawY, rawWidth, rawHeight].every(Number.isFinite)) {
                    return null;
                }

                const nextX = clamp(rawX, 0, 1);
                const nextY = clamp(rawY, 0, 1);
                const nextWidth = clamp(rawWidth, 0, 1 - nextX);
                const nextHeight = clamp(rawHeight, 0, 1 - nextY);

                if (nextWidth < FACE_REGION_MIN_SIZE || nextHeight < FACE_REGION_MIN_SIZE) {
                    return null;
                }

                return {
                    id: region && region.id ? String(region.id) : createFaceRegionId(),
                    x: roundRegionValue(nextX),
                    y: roundRegionValue(nextY),
                    width: roundRegionValue(nextWidth),
                    height: roundRegionValue(nextHeight)
                };
            })
            .filter(Boolean)
            .slice(0, FACE_REGION_MAX_ITEMS)
        : []
);

const validateFacePriorityRegions = (regions) => {
    if (!Array.isArray(regions)) {
        return 'Dữ liệu vùng mặt ưu tiên không hợp lệ.';
    }

    if (regions.length > FACE_REGION_MAX_ITEMS) {
        return `Chỉ hỗ trợ tối đa ${FACE_REGION_MAX_ITEMS} vùng mặt ưu tiên trong phiên bản hiện tại.`;
    }

    for (const region of regions) {
        const x = Number(region && region.x);
        const y = Number(region && region.y);
        const width = Number(region && region.width);
        const height = Number(region && region.height);

        if (![x, y, width, height].every(Number.isFinite)) {
            return 'Có vùng mặt ưu tiên chứa tọa độ không hợp lệ.';
        }

        if (x < 0 || y < 0 || width < FACE_REGION_MIN_SIZE || height < FACE_REGION_MIN_SIZE) {
            return 'Mỗi vùng mặt ưu tiên phải có kích thước đủ lớn để sử dụng.';
        }

        if (x + width > 1 || y + height > 1) {
            return 'Vùng mặt ưu tiên phải nằm hoàn toàn trong ảnh xem trước.';
        }
    }

    return '';
};

const resizeFaceRegion = (region, point, handle) => {
    let left = region.x;
    let top = region.y;
    let right = region.x + region.width;
    let bottom = region.y + region.height;

    if (handle.includes('n')) {
        top = clamp(point.y, 0, bottom - FACE_REGION_MIN_SIZE);
    }

    if (handle.includes('s')) {
        bottom = clamp(point.y, top + FACE_REGION_MIN_SIZE, 1);
    }

    if (handle.includes('w')) {
        left = clamp(point.x, 0, right - FACE_REGION_MIN_SIZE);
    }

    if (handle.includes('e')) {
        right = clamp(point.x, left + FACE_REGION_MIN_SIZE, 1);
    }

    return {
        x: roundRegionValue(left),
        y: roundRegionValue(top),
        width: roundRegionValue(right - left),
        height: roundRegionValue(bottom - top)
    };
};

const sanitizeRepairMask = (mask) => {
    if (!mask || typeof mask !== 'object') {
        return null;
    }

    const width = Number(mask.width);
    const height = Number(mask.height);

    if (!mask.imageBase64 || typeof mask.imageBase64 !== 'string' || !mask.imageBase64.trim()) {
        return null;
    }

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
    }

    return {
        imageBase64: mask.imageBase64,
        mimeType: mask.mimeType || 'image/png',
        width,
        height
    };
};

const validateRepairMask = (mask) => {
    if (!mask) {
        return '';
    }

    if (!mask.imageBase64 || typeof mask.imageBase64 !== 'string') {
        return 'Dữ liệu repair mask không hợp lệ.';
    }

    if (!Number.isFinite(Number(mask.width)) || !Number.isFinite(Number(mask.height))) {
        return 'Kích thước repair mask không hợp lệ.';
    }

    return '';
};

const FaceRegionEditor = ({
    previewUrl,
    regions,
    selectedRegionId,
    onSelectRegion,
    onChangeRegions,
    disabled
}) => {
    const overlayRef = useRef(null);
    const [draftRegion, setDraftRegion] = useState(null);
    const [draftRegionId, setDraftRegionId] = useState(null);
    const [dragSession, setDragSession] = useState(null);

    const getNormalizedPoint = (event) => {
        const bounds = overlayRef.current ? overlayRef.current.getBoundingClientRect() : null;

        if (!bounds || !bounds.width || !bounds.height) {
            return null;
        }

        return {
            x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
            y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1)
        };
    };

    useEffect(() => {
        if (!dragSession) {
            return undefined;
        }

        const handleMouseMove = (event) => {
            const point = getNormalizedPoint(event);

            if (!point) {
                return;
            }

            if (dragSession.type === 'draw') {
                setDraftRegion({
                    x: Math.min(dragSession.originPoint.x, point.x),
                    y: Math.min(dragSession.originPoint.y, point.y),
                    width: Math.abs(point.x - dragSession.originPoint.x),
                    height: Math.abs(point.y - dragSession.originPoint.y)
                });
                return;
            }

            if (dragSession.type === 'move') {
                setDraftRegion({
                    x: roundRegionValue(clamp(dragSession.originRegion.x + (point.x - dragSession.originPoint.x), 0, 1 - dragSession.originRegion.width)),
                    y: roundRegionValue(clamp(dragSession.originRegion.y + (point.y - dragSession.originPoint.y), 0, 1 - dragSession.originRegion.height)),
                    width: dragSession.originRegion.width,
                    height: dragSession.originRegion.height
                });
                return;
            }

            setDraftRegion(resizeFaceRegion(dragSession.originRegion, point, dragSession.handle));
        };

        const handleMouseUp = () => {
            if (dragSession.type === 'draw') {
                if (draftRegion && draftRegion.width >= FACE_REGION_MIN_SIZE && draftRegion.height >= FACE_REGION_MIN_SIZE) {
                    const nextRegion = {
                        id: createFaceRegionId(),
                        x: roundRegionValue(draftRegion.x),
                        y: roundRegionValue(draftRegion.y),
                        width: roundRegionValue(draftRegion.width),
                        height: roundRegionValue(draftRegion.height)
                    };

                    onChangeRegions([...regions, nextRegion].slice(0, FACE_REGION_MAX_ITEMS));
                    onSelectRegion(nextRegion.id);
                }
            } else if (dragSession.regionId && draftRegion) {
                onChangeRegions(regions.map((region) => (
                    region.id === dragSession.regionId
                        ? {
                            ...region,
                            ...draftRegion
                        }
                        : region
                )));
                onSelectRegion(dragSession.regionId);
            }

            setDragSession(null);
            setDraftRegion(null);
            setDraftRegionId(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragSession, draftRegion, onChangeRegions, onSelectRegion, regions]);

    const handleCanvasMouseDown = (event) => {
        if (disabled || regions.length >= FACE_REGION_MAX_ITEMS || event.button !== 0) {
            return;
        }

        const point = getNormalizedPoint(event);

        if (!point) {
            return;
        }

        setDragSession({
            type: 'draw',
            originPoint: point
        });
        setDraftRegion({
            x: point.x,
            y: point.y,
            width: 0,
            height: 0
        });
        setDraftRegionId(null);
        onSelectRegion(null);
        event.preventDefault();
    };

    const handleRegionMoveStart = (region, event) => {
        if (disabled || event.button !== 0) {
            return;
        }

        const point = getNormalizedPoint(event);

        if (!point) {
            return;
        }

        setDragSession({
            type: 'move',
            regionId: region.id,
            originPoint: point,
            originRegion: region
        });
        setDraftRegion({
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height
        });
        setDraftRegionId(region.id);
        onSelectRegion(region.id);
        event.stopPropagation();
        event.preventDefault();
    };

    const handleRegionResizeStart = (region, handle, event) => {
        if (disabled || event.button !== 0) {
            return;
        }

        const point = getNormalizedPoint(event);

        if (!point) {
            return;
        }

        setDragSession({
            type: 'resize',
            regionId: region.id,
            handle,
            originPoint: point,
            originRegion: region
        });
        setDraftRegion({
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height
        });
        setDraftRegionId(region.id);
        onSelectRegion(region.id);
        event.stopPropagation();
        event.preventDefault();
    };

    const displayedRegions = regions.map((region) => (
        draftRegion && draftRegionId === region.id
            ? {
                ...region,
                ...draftRegion
            }
            : region
    ));

    return (
        <div className="face-region-stage">
            <img className="face-region-image" src={previewUrl} alt="Face priority preview" />
            <div
                ref={overlayRef}
                className={`face-region-overlay ${disabled ? 'is-disabled' : ''}`}
                onMouseDown={handleCanvasMouseDown}
            >
                {displayedRegions.map((region, index) => (
                    <div
                        key={region.id}
                        className={`face-region-box ${selectedRegionId === region.id ? 'is-selected' : ''}`}
                        style={{
                            left: `${region.x * 100}%`,
                            top: `${region.y * 100}%`,
                            width: `${region.width * 100}%`,
                            height: `${region.height * 100}%`
                        }}
                        onMouseDown={(event) => handleRegionMoveStart(region, event)}
                        onClick={(event) => {
                            event.stopPropagation();
                            onSelectRegion(region.id);
                        }}
                    >
                        <span className="face-region-index">{index + 1}</span>
                        {selectedRegionId === region.id ? (
                            <>
                                {['nw', 'ne', 'sw', 'se'].map((handle) => (
                                    <span
                                        key={handle}
                                        className={`face-region-handle face-region-handle-${handle}`}
                                        onMouseDown={(event) => handleRegionResizeStart(region, handle, event)}
                                    />
                                ))}
                            </>
                        ) : null}
                    </div>
                ))}
                {draftRegion && !draftRegionId ? (
                    <div
                        className="face-region-box is-draft"
                        style={{
                            left: `${draftRegion.x * 100}%`,
                            top: `${draftRegion.y * 100}%`,
                            width: `${draftRegion.width * 100}%`,
                            height: `${draftRegion.height * 100}%`
                        }}
                    />
                ) : null}
            </div>
        </div>
    );
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

            <div className="section">
                <div className="section-header">
                    <span className="section-label">Vùng ưu tiên khuôn mặt</span>
                    <button
                        className="btn"
                        type="button"
                        onClick={() => setShowFaceRegionEditor((current) => !current)}
                        disabled={!activeImage}
                    >
                        {showFaceRegionEditor ? 'Ẩn editor' : 'Mở editor'}
                    </button>
                </div>

                {activeImage ? (
                    <>
                        <div className="face-region-summary">
                            <span>{facePriorityRegions.length === 0 ? 'Chưa có vùng ưu tiên nào.' : `Đã chọn ${facePriorityRegions.length}/${FACE_REGION_MAX_ITEMS} vùng ưu tiên.`}</span>
                            <span>Kéo trực tiếp trên preview để thêm vùng.</span>
                        </div>

                        {showFaceRegionEditor ? (
                            <>
                                <FaceRegionEditor
                                    previewUrl={activeImage.previewUrl}
                                    regions={facePriorityRegions}
                                    selectedRegionId={selectedFaceRegionId}
                                    onSelectRegion={setSelectedFaceRegionId}
                                    onChangeRegions={setFacePriorityRegions}
                                    disabled={actionsDisabled}
                                />
                                <div className="face-region-toolbar">
                                    <button
                                        className="btn"
                                        type="button"
                                        onClick={handleDeleteSelectedFaceRegion}
                                        disabled={!selectedFaceRegion}
                                    >
                                        Xóa vùng đang chọn
                                    </button>
                                    <button
                                        className="btn"
                                        type="button"
                                        onClick={handleResetFaceRegions}
                                        disabled={facePriorityRegions.length === 0}
                                    >
                                        Reset vùng mặt
                                    </button>
                                </div>
                            </>
                        ) : null}

                        {facePriorityRegions.length > 0 ? (
                            <div className="face-region-chip-list">
                                {facePriorityRegions.map((region, index) => (
                                    <button
                                        key={region.id}
                                        className={`face-region-chip ${selectedFaceRegionId === region.id ? 'is-active' : ''}`}
                                        type="button"
                                        onClick={() => {
                                            setSelectedFaceRegionId(region.id);
                                            setShowFaceRegionEditor(true);
                                        }}
                                    >
                                        {`Vùng ${index + 1}`}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </>
                ) : (
                    <div className="reference-note">Thêm ảnh đầu vào trước để mở editor vùng khuôn mặt.</div>
                )}
            </div>

            <div className="section">
                <div className="section-header">
                    <span className="section-label">Mask vùng hư hại</span>
                    <button
                        className="btn"
                        type="button"
                        onClick={() => setShowMaskEditor((current) => !current)}
                        disabled={!activeImage}
                    >
                        {showMaskEditor ? 'Ẩn editor' : 'Mở editor'}
                    </button>
                </div>

                {activeImage ? (
                    <>
                        <div className="face-region-summary">
                            <span>{repairMask ? 'Đã có repair mask cho ảnh hiện tại.' : 'Chưa có repair mask nào.'}</span>
                            <span>Dùng brush để tô vùng cần phục chế mạnh hơn, chuyển sang xóa khi cần chỉnh lại.</span>
                        </div>

                        {showMaskEditor ? (
                            <RestorationMaskEditor
                                previewUrl={activeImage.previewUrl}
                                initialMask={repairMask}
                                onChange={setRepairMask}
                                disabled={actionsDisabled}
                            />
                        ) : null}
                    </>
                ) : (
                    <div className="reference-note">Thêm ảnh đầu vào trước để mở mask editor.</div>
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
                    Face region và mask editor hiện đều hỗ trợ editor cơ bản trên preview ảnh. History hiện hỗ trợ lưu kết quả, reinsert và nạp lại cấu hình cơ bản.
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
