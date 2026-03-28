import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
    buildGeneratedResultState,
    captureDocumentInsertContextSafely,
    createResultImageRecord,
    performResultInsert
} from '../../lib/result-insert.js';
import { RestorationMaskEditor } from '../../components/RestorationMaskEditor.jsx';
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

const PROMPT_ENHANCER_GROUPS = [
    {
        id: 'concept',
        label: 'Gợi ý concept',
        options: [
            {
                id: 'editorial-luxury',
                label: 'Editorial luxury',
                promptText: 'Concept editorial luxury, tối giản nhưng cao cấp, bố cục gọn gàng, cảm giác như ảnh campaign cho thương hiệu premium.'
            },
            {
                id: 'quiet-luxury',
                label: 'Quiet luxury',
                promptText: 'Concept quiet luxury đang phổ biến, tinh tế, vật liệu sang trọng, ít chi tiết thừa, nhấn vào cảm giác đắt giá và thanh lịch.'
            },
            {
                id: 'lifestyle-social',
                label: 'Lifestyle social',
                promptText: 'Concept lifestyle hiện đại kiểu social content, bối cảnh đời sống được dàn dựng đẹp mắt, tự nhiên nhưng vẫn có chủ đích thương mại.'
            },
            {
                id: 'neo-futuristic',
                label: 'Neo futuristic',
                promptText: 'Concept neo futuristic, không gian sạch, hơi hướng công nghệ, bề mặt phản xạ nhẹ, hiện đại và nổi bật chủ thể.'
            },
            {
                id: 'seasonal-campaign',
                label: 'Seasonal campaign',
                promptText: 'Concept campaign theo mùa đang thịnh hành, bắt mắt, hợp xu hướng thị giác mạng xã hội nhưng vẫn giữ cảm giác chuyên nghiệp.'
            }
        ]
    },
    {
        id: 'lighting',
        label: 'Ánh sáng',
        options: [
            {
                id: 'soft-studio',
                label: 'Soft studio',
                promptText: 'Ánh sáng studio mềm, đều, chuyển sáng mượt, sạch và tôn chi tiết chủ thể một cách tự nhiên.'
            },
            {
                id: 'golden-hour',
                label: 'Golden hour',
                promptText: 'Ánh sáng golden hour ấm áp, dịu, có chiều sâu, tạo cảm giác dễ chịu và cao cấp.'
            },
            {
                id: 'high-key',
                label: 'High-key clean',
                promptText: 'Ánh sáng high-key sáng sạch, nền thoáng, độ tương phản vừa phải, cảm giác tươi và thương mại.'
            },
            {
                id: 'cinematic-moody',
                label: 'Cinematic moody',
                promptText: 'Ánh sáng cinematic moody, tương phản có kiểm soát, tạo chiều sâu và điểm nhấn thị giác rõ ràng.'
            },
            {
                id: 'rim-light',
                label: 'Rim light',
                promptText: 'Bổ sung rim light nhẹ để tách chủ thể khỏi nền, tăng độ nổi bật mà vẫn tự nhiên.'
            }
        ]
    },
    {
        id: 'camera',
        label: 'Góc chụp, khẩu độ',
        options: [
            {
                id: 'eye-level-50mm',
                label: 'Chính diện 50mm',
                promptText: 'Góc chụp chính diện hoặc ngang tầm mắt, cảm giác cân đối, mô phỏng ống kính 50mm với chiều sâu tự nhiên.'
            },
            {
                id: 'hero-45deg',
                label: 'Hero 45 độ',
                promptText: 'Góc hero 45 độ, tôn khối chủ thể, bố cục quảng cáo rõ ràng, độ sâu trường ảnh vừa phải.'
            },
            {
                id: 'low-angle-35mm',
                label: 'Low angle 35mm',
                promptText: 'Góc chụp thấp nhẹ kiểu 35mm để chủ thể trông nổi bật hơn, có chiều sâu và cảm giác mạnh mẽ.'
            },
            {
                id: 'top-down-f8',
                label: 'Top-down f/8',
                promptText: 'Góc chụp từ trên xuống gọn gàng, bố cục rõ, khẩu độ kiểu f/8 để giữ nhiều chi tiết sắc nét trong khung.'
            },
            {
                id: 'closeup-f28',
                label: 'Cận cảnh f/2.8',
                promptText: 'Góc cận cảnh với độ sâu trường ảnh nông kiểu f/2.8, hậu cảnh mềm, nhấn mạnh chủ thể chính.'
            }
        ]
    },
    {
        id: 'foreground',
        label: 'Thêm tiền cảnh',
        options: [
            {
                id: 'soft-bokeh',
                label: 'Bokeh mềm',
                promptText: 'Thêm lớp tiền cảnh mờ nhẹ dạng bokeh để khung hình có chiều sâu nhưng không che chủ thể.'
            },
            {
                id: 'leaf-blur',
                label: 'Lá mờ tự nhiên',
                promptText: 'Thêm tiền cảnh lá hoặc nhánh cây out-focus rất nhẹ, tạo cảm giác tự nhiên và sống động.'
            },
            {
                id: 'glass-reflection',
                label: 'Phản xạ kính',
                promptText: 'Thêm tiền cảnh phản xạ kính hoặc lớp flare rất nhẹ để ảnh hiện đại và có chiều sâu thị giác.'
            },
            {
                id: 'mist-layer',
                label: 'Sương mỏng',
                promptText: 'Thêm lớp sương mỏng hoặc haze nhẹ ở tiền cảnh để ảnh mềm hơn và có cảm giác không gian.'
            },
            {
                id: 'minimal-props',
                label: 'Đạo cụ tối giản',
                promptText: 'Thêm vài đạo cụ tối giản ở tiền cảnh, bố trí tiết chế, hỗ trợ kể câu chuyện mà không làm rối ảnh.'
            }
        ]
    },
    {
        id: 'color',
        label: 'Đồng bộ màu sắc',
        options: [
            {
                id: 'warm-neutral',
                label: 'Warm neutral',
                promptText: 'Đồng bộ màu theo tone warm neutral, hài hòa, dễ dùng, sạch và hiện đại.'
            },
            {
                id: 'beige-premium',
                label: 'Beige premium',
                promptText: 'Đồng bộ màu be kem cao cấp, dịu mắt, sang trọng, phù hợp phong cách premium.'
            },
            {
                id: 'fresh-natural',
                label: 'Fresh natural',
                promptText: 'Đồng bộ màu tự nhiên tươi sáng, cân bằng xanh lá và trung tính, tạo cảm giác trong trẻo.'
            },
            {
                id: 'cinematic-subtle',
                label: 'Cinematic subtle',
                promptText: 'Đồng bộ màu cinematic nhẹ, có tương phản màu tinh tế, ấn tượng nhưng không gắt.'
            },
            {
                id: 'monochrome-luxe',
                label: 'Monochrome luxe',
                promptText: 'Đồng bộ màu đơn sắc cao cấp theo dải xám hoặc than chì, sang và gọn.'
            }
        ]
    }
];
const PROMPT_ENHANCER_GROUP_MAP = PROMPT_ENHANCER_GROUPS.reduce((map, group) => {
    map[group.id] = group;
    return map;
}, {});

const createEmptyPromptEnhancers = () =>
    PROMPT_ENHANCER_GROUPS.reduce((state, group) => {
        state[group.id] = '';
        return state;
    }, {});

const createInitialAccordionState = () =>
    PROMPT_ENHANCER_GROUPS.reduce((state, group, index) => {
        state[group.id] = index === 0;
        return state;
    }, {});

const normalizePromptEnhancers = (value) => {
    const normalized = createEmptyPromptEnhancers();

    if (!value || typeof value !== 'object') {
        return normalized;
    }

    PROMPT_ENHANCER_GROUPS.forEach((group) => {
        const nextValue = typeof value[group.id] === 'string' ? value[group.id] : '';
        normalized[group.id] = group.options.some((option) => option.id === nextValue) ? nextValue : '';
    });

    return normalized;
};

const normalizeSavedPrompt = (entry) => ({
    name: entry?.name || entry?.memo || '',
    prompt: entry?.prompt || entry?.text || '',
    allowFreeZoom: Boolean(entry?.allowFreeZoom),
    promptEnhancers: normalizePromptEnhancers(entry?.promptEnhancers)
});

const getPromptEnhancerOption = (groupId, optionId) => {
    if (!groupId || !optionId) {
        return null;
    }

    return PROMPT_ENHANCER_GROUP_MAP[groupId]?.options.find((option) => option.id === optionId) || null;
};

const buildPromptEnhancerFragments = ({ allowFreeZoom, promptEnhancers }) => {
    const fragments = [];

    if (allowFreeZoom) {
        fragments.push('Cho phép tự do thu phóng và crop lại bố cục khi cần để cân đối khung hình, ưu tiên giữ chủ thể nổi bật và tự nhiên.');
    }

    PROMPT_ENHANCER_GROUPS.forEach((group) => {
        const selectedOption = getPromptEnhancerOption(group.id, promptEnhancers[group.id]);
        if (selectedOption?.promptText) {
            fragments.push(selectedOption.promptText);
        }
    });

    return fragments;
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
        return 'Dữ liệu mask chủ thể không hợp lệ.';
    }

    if (!Number.isFinite(Number(mask.width)) || !Number.isFinite(Number(mask.height))) {
        return 'Kích thước mask chủ thể không hợp lệ.';
    }

    return '';
};

export const ThayNenTab = ({
    actionsDisabled,
    onRequireAuth,
    onGenerate,
    onOptimizePrompt,
    onRecordHistory,
    historyRestoreRequest
}) => {
    const rootRef = useRef(null);
    const handledRestoreIdRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [historyNotice, setHistoryNotice] = useState('');
    const [aspectRatio, setAspectRatio] = useState('3:4');
    const [size, setSize] = useState('1K');
    const [backgroundPreset, setBackgroundPreset] = useState('studio');
    const [prompt, setPrompt] = useState('');
    const [allowFreeZoom, setAllowFreeZoom] = useState(false);
    const [promptEnhancers, setPromptEnhancers] = useState(() => createEmptyPromptEnhancers());
    const [openPromptSections, setOpenPromptSections] = useState(() => createInitialAccordionState());
    const [keepSubject, setKeepSubject] = useState(true);
    const [matchLighting, setMatchLighting] = useState(true);
    const [replacementStrength, setReplacementStrength] = useState('medium');
    const [result, setResult] = useState(null);
    const [isManualInsertLoading, setIsManualInsertLoading] = useState(false);
    const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
    const [showQuickLayerOptions, setShowQuickLayerOptions] = useState(false);
    const [isQuickLayerImporting, setIsQuickLayerImporting] = useState(false);
    const [showMaskEditor, setShowMaskEditor] = useState(false);
    const [repairMask, setRepairMask] = useState(null);
    const [memoName, setMemoName] = useState('');
    const [savedPrompts, setSavedPrompts] = useState(() => {
        try {
            const savedNew = localStorage.getItem('banana_saved_prompts_thaynen');
            if (savedNew) {
                return JSON.parse(savedNew).map(normalizeSavedPrompt).filter((item) => item.name);
            }
            
            const savedOld = localStorage.getItem('banana_saved_prompts');
            if (savedOld) {
                const migrated = JSON.parse(savedOld)
                    .map(normalizeSavedPrompt)
                    .filter((item) => item.name);
                localStorage.setItem('banana_saved_prompts_thaynen', JSON.stringify(migrated));
                return migrated;
            }
            return [];
        } catch (e) {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('banana_saved_prompts_thaynen', JSON.stringify(savedPrompts));
    }, [savedPrompts]);
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
    const promptEnhancerFragments = useMemo(
        () => buildPromptEnhancerFragments({ allowFreeZoom, promptEnhancers }),
        [allowFreeZoom, promptEnhancers]
    );
    const finalPrompt = useMemo(
        () => [prompt.trim(), ...promptEnhancerFragments].filter(Boolean).join('\n'),
        [prompt, promptEnhancerFragments]
    );
    const selectedPromptEnhancerSummaries = useMemo(
        () =>
            PROMPT_ENHANCER_GROUPS.map((group) => {
                const selectedOption = getPromptEnhancerOption(group.id, promptEnhancers[group.id]);
                if (!selectedOption) {
                    return null;
                }

                return {
                    groupId: group.id,
                    groupLabel: group.label,
                    optionLabel: selectedOption.label
                };
            }).filter(Boolean),
        [promptEnhancers]
    );

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
            setHistoryNotice(`Đã nạp cấu hình từ lịch sử cho ${historyRestoreRequest.featureLabel}.`);
            setAspectRatio(payload.aspectRatio || '3:4');
            setSize(payload.size || '1K');
            setBackgroundPreset(payload.backgroundPreset || 'studio');
            setPrompt(payload.prompt || '');
            setAllowFreeZoom(Boolean(payload.allowFreeZoom));
            setPromptEnhancers(normalizePromptEnhancers(payload.promptEnhancers));
            setKeepSubject(typeof payload.keepSubject === 'boolean' ? payload.keepSubject : true);
            setMatchLighting(typeof payload.matchLighting === 'boolean' ? payload.matchLighting : true);
            setReplacementStrength(payload.replacementStrength || 'medium');
            setShowQuickLayerOptions(false);
            setOpenPromptSections(createInitialAccordionState());

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
            prompt: finalPrompt.trim(),
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
            const insertContext = await captureDocumentInsertContextSafely({
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
                        allowFreeZoom,
                        promptEnhancers,
                        keepSubject: payload.keepSubject,
                        matchLighting: payload.matchLighting,
                        replacementStrength: payload.replacementStrength
                    },
                    summaryLines: [
                        ...(allowFreeZoom ? ['Tự do thu phóng: Bật'] : []),
                        ...selectedPromptEnhancerSummaries.map((item) => `${item.groupLabel}: ${item.optionLabel}`),
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
                        prompt,
                        allowFreeZoom,
                        promptEnhancers,
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
                    layerNamePrefix: result.layerNamePrefix || 'Thay Nen'
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
        } catch (error) {
            setErrorMessage(error && error.message ? error.message : 'KhÃ´ng thá»ƒ Ä‘á»c áº£nh Ä‘áº§u vÃ o tá»« mÃ¡y.');
        }
    };

    const handleQuickLayerImport = async (mode) => {
        if (actionsDisabled) {
            onRequireAuth();
            return;
        }

        if (isQuickLayerImporting) {
            return;
        }

        setErrorMessage('');
        setIsQuickLayerImporting(true);

        try {
            await addFromQuickLayer(mode);
            setShowQuickLayerOptions(false);
        } catch (error) {
            setErrorMessage(error && error.message ? error.message : 'KhÃ´ng thá»ƒ láº¥y áº£nh tá»« Photoshop.');
        } finally {
            setIsQuickLayerImporting(false);
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

    const handleSavePrompt = () => {
        if (!prompt.trim() && !promptEnhancerFragments.length) {
            setErrorMessage('Vui lòng nhập prompt trước khi lưu.');
            return;
        }
        const name = memoName.trim() || `Prompt ${new Date().toLocaleString()}`;
        const newSaved = [
            ...savedPrompts.filter((p) => p.name !== name),
            {
                name,
                prompt: prompt.trim(),
                allowFreeZoom,
                promptEnhancers
            }
        ];
        setSavedPrompts(newSaved);
        setMemoName(name);
        setHistoryNotice('Đã lưu cấu hình prompt thành công.');
    };

    const handleDeletePrompt = (name) => {
        const newSaved = savedPrompts.filter(p => p.name !== name);
        setSavedPrompts(newSaved);
        if (memoName === name) setMemoName('');
        setHistoryNotice('Đã xóa prompt đã lưu.');
    };

    const handleLoadSavedPrompt = (name) => {
        const selected = savedPrompts.find((p) => p.name === name);
        if (selected) {
            setPrompt(selected.prompt);
            setMemoName(selected.name);
            setAllowFreeZoom(Boolean(selected.allowFreeZoom));
            setPromptEnhancers(normalizePromptEnhancers(selected.promptEnhancers));
        } else {
            setMemoName(name);
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
                feature: 'thay-nen',
                prompt: trimmedPrompt,
                context: {
                    preset: backgroundPreset,
                    ratio: aspectRatio,
                    size,
                    allowFreeZoom,
                    promptEnhancers,
                    finalPrompt,
                    keepSubject,
                    matchLighting,
                    replacementStrength
                },
                clientRequestId: `thay-nen-optimize-${Date.now()}`,
                appVersion: 'uxp-dev'
            });

            if (!response || !response.ok || !response.data || !response.data.optimizedPrompt) {
                setErrorMessage('Không thể tối ưu prompt AI.');
                return;
            }

            setPrompt(response.data.optimizedPrompt);
            setHistoryNotice('Đã tối ưu prompt AI và giữ nguyên ý đồ của bạn. Bạn có thể chỉnh lại trước khi generate.');
        } finally {
            setIsOptimizingPrompt(false);
        }
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

    const handleTogglePromptSection = (groupId) => {
        setOpenPromptSections((current) => ({
            ...current,
            [groupId]: !current[groupId]
        }));
    };

    const handleSelectPromptEnhancer = (groupId, optionId) => {
        setPromptEnhancers((current) => ({
            ...current,
            [groupId]: current[groupId] === optionId ? '' : optionId
        }));
    };

    return (
        <div className="tab-pane" ref={rootRef} tabIndex={0}>
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
                <select className="dropdown" value={replacementStrength} onChange={(event) => setReplacementStrength(event.target.value)}>
                    {REPLACEMENT_STRENGTH_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                </select>
            </div>
            <div className="section">
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
                            placeholder="Mô tả nền mới, ánh sáng, mood hoặc tone màu mong muốn..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            maxLength={500}
                        ></textarea>
                        <div className="prompt-char-count">{prompt.length}/500</div>
                    </div>

                    <div className="prompt-enhancer-stack">
                        <div className="switch-row prompt-enhancer-zoom-row">
                            <div>
                                <div className="switch-label">Tự do thu phóng</div>
                                <div className="prompt-enhancer-helper">
                                    Cho phép AI crop và zoom linh hoạt để nền mới cân đối hơn mà vẫn giữ chủ thể tự nhiên.
                                </div>
                            </div>
                            <label className="switch">
                                <input type="checkbox" checked={allowFreeZoom} onChange={(e) => setAllowFreeZoom(e.target.checked)} />
                                <span className="slider"></span>
                            </label>
                        </div>

                        {PROMPT_ENHANCER_GROUPS.map((group) => {
                            const isOpen = Boolean(openPromptSections[group.id]);
                            const selectedOption = getPromptEnhancerOption(group.id, promptEnhancers[group.id]);

                            // Icon mapping
                            const GroupIcon = () => {
                                switch (group.id) {
                                    case 'concept':
                                        return (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path>
                                                <path d="M9 18h6"></path>
                                                <path d="M10 22h4"></path>
                                            </svg>
                                        );
                                    case 'lighting':
                                        return (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path>
                                                <path d="M9 18h6"></path>
                                                <path d="M10 22h4"></path>
                                            </svg>
                                        );
                                    case 'camera':
                                        return (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A0A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                                <circle cx="12" cy="10" r="3"></circle>
                                                <path d="M7 2h10"></path>
                                            </svg>
                                        );
                                    case 'foreground':
                                        return (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8h-5.07A7 7 0 0 1 11 20z"></path>
                                                <path d="M11 20c-1 0-2 0-3-1l-3-3a10 10 0 0 1 11-13"></path>
                                            </svg>
                                        );
                                    case 'color':
                                        return (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="13.5" cy="6.5" r=".5"></circle>
                                                <circle cx="17.5" cy="10.5" r=".5"></circle>
                                                <circle cx="8.5" cy="7.5" r=".5"></circle>
                                                <circle cx="6.5" cy="12.5" r=".5"></circle>
                                                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.92 0 1.7-.72 1.7-1.6 0-.44-.18-.84-.44-1.15-.27-.31-.44-.72-.44-1.15 0-.93.75-1.7 1.68-1.7H16c2.21 0 4-1.79 4-4 0-5.52-4.48-10-8-10z"></path>
                                            </svg>
                                        );
                                    default:
                                        return null;
                                }
                            };

                            return (
                                <div key={group.id} className={`prompt-accordion ${isOpen ? 'open' : ''}`}>
                                    <button
                                        className="prompt-accordion-trigger"
                                        type="button"
                                        onClick={() => handleTogglePromptSection(group.id)}
                                    >
                                        <div className="prompt-accordion-copy">
                                            <span className="prompt-accordion-title">{group.label}</span>
                                        </div>
                                    </button>

                                    {isOpen ? (
                                        <div className="prompt-accordion-panel">
                                            <div className="prompt-option-grid">
                                                {group.options.map((option) => (
                                                    <button
                                                        key={option.id}
                                                        type="button"
                                                        className={`prompt-option-chip ${selectedOption?.id === option.id ? 'active' : ''}`}
                                                        onClick={() => handleSelectPromptEnhancer(group.id, option.id)}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="prompt-option-note">
                                                {selectedOption
                                                    ? selectedOption.promptText
                                                    : 'Chọn một option để hệ thống tự thêm mô tả phù hợp vào prompt khi generate.'}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}

                        {(allowFreeZoom || selectedPromptEnhancerSummaries.length > 0) ? (
                            <div className="prompt-assembly-note">
                                Prompt gửi AI sẽ tự ghép các lựa chọn này khi generate để mô tả rõ hơn về concept, ánh sáng, góc chụp và màu sắc.
                            </div>
                        ) : null}
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
            </div>

            {false ? (
                <div className="section">
                    <div className="section-header">
                        <span className="section-label">Mask chủ thể</span>
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
                                <span>{repairMask ? 'Đã có mask chỉnh tay cho ảnh hiện tại.' : 'Chưa có mask chỉnh tay nào.'}</span>
                                <span>Dùng brush để giữ lại chủ thể chính xác hơn trước khi thay nền.</span>
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
            ) : null}

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
                {isLoading ? (
                    <div className="cta-status-panel" role="status" aria-live="polite">
                        <div className="cta-status-panel-icon" aria-hidden="true">
                            <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                            </svg>
                        </div>
                        <div className="cta-status-panel-content">
                            <strong>Đang thay nền</strong>
                            <span>Hệ thống đang generate và chuẩn bị chèn kết quả vào Photoshop.</span>
                        </div>
                    </div>
                ) : null}

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
                            Đang thay nền...
                        </>
                    ) : (
                        <>{result ? 'Regenerate' : 'Thay Nền'}</>
                    )}
                </button>
            </div>
        </div>
    );
};
