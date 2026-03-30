import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
    buildGeneratedResultState,
    captureDocumentInsertContextSafely,
    createResultImageRecord,
    performResultInsert
} from '../../lib/result-insert.js';
import { QUICK_LAYER_MODES, useReferenceImages } from '../../lib/reference-images.js';

const TOOL_KEY = 'tudoai';
const MAX_REFERENCE_IMAGES = 3;
const FUNCTION_CATEGORIES = [
    {
        id: 'portrait-edit',
        label: 'Chỉnh sửa ảnh - chân dung',
        options: [
            {
                id: 'remove-fence',
                label: 'Xóa hàng rào',
                promptText: 'Loại bỏ hàng rào hoặc vật cản phía trước, làm sạch khung hình và giữ lại bối cảnh tự nhiên.'
            },
            {
                id: 'change-head-direction',
                label: 'Đổi hướng đầu',
                promptText: 'Điều chỉnh hướng đầu và ánh nhìn của nhân vật tự nhiên hơn, giữ nguyên gương mặt và thần thái.'
            },
            {
                id: 'change-body-pose',
                label: 'Đổi tư thế cơ thể',
                promptText: 'Thay đổi tư thế cơ thể cho cân đối, tự nhiên và phù hợp bố cục tổng thể.'
            },
            {
                id: 'enhance-details',
                label: 'Thêm chi tiết (nâng cao)',
                promptText: 'Bổ sung thêm chi tiết nâng cao cho ảnh, tăng độ sắc nét, chiều sâu và độ hoàn thiện tổng thể.'
            },
            {
                id: 'colorful-fireworks',
                label: 'Pháo hoa đủ màu',
                promptText: 'Thêm pháo hoa rực rỡ nhiều màu sắc ở hậu cảnh, nổi bật nhưng vẫn hài hòa với chủ thể.'
            },
            {
                id: 'sparkle-fireworks',
                label: 'Pháo Kim Tuyến',
                promptText: 'Thêm hiệu ứng pháo kim tuyến lấp lánh, sang trọng và bắt mắt quanh khung hình.'
            },
            {
                id: 'red-carpet',
                label: 'Thảm đỏ',
                promptText: 'Bổ sung thảm đỏ hoặc không khí sự kiện sang trọng, tạo cảm giác nổi bật như tại lễ trao giải.',
                fullWidth: true
            }
        ]
    },
    {
        id: 'beauty-fashion',
        label: 'Làm đẹp - thời trang',
        options: [
            {
                id: 'luxury-makeup',
                label: 'Makeup cao cấp',
                promptText: 'Tăng cảm giác makeup cao cấp, lớp nền sạch, ánh sáng đẹp trên da và tổng thể chỉn chu như ảnh beauty campaign.'
            },
            {
                id: 'hair-volume',
                label: 'Tăng độ bồng tóc',
                promptText: 'Làm tóc bồng, gọn, có độ bay tự nhiên và giữ chi tiết sợi tóc chân thực.'
            },
            {
                id: 'dress-enhance',
                label: 'Nâng chất outfit',
                promptText: 'Tinh chỉnh trang phục sang hơn, form gọn hơn và chất liệu hiển thị rõ, cao cấp hơn.'
            },
            {
                id: 'skin-premium',
                label: 'Da mịn cao cấp',
                promptText: 'Tối ưu bề mặt da mịn, sạch, sáng khỏe nhưng vẫn giữ texture tự nhiên và không bị nhựa.'
            },
            {
                id: 'jewelry-shine',
                label: 'Tăng sáng trang sức',
                promptText: 'Làm trang sức bắt sáng hơn, tinh tế hơn và có điểm nhấn sang trọng.'
            },
            {
                id: 'fashion-editorial',
                label: 'Editorial fashion',
                promptText: 'Đẩy tổng thể theo hướng editorial fashion, thần thái thời trang hơn, bố cục gọn và hiện đại hơn.'
            }
        ]
    },
    {
        id: 'background-effects',
        label: 'Hiệu ứng nền - không khí',
        options: [
            {
                id: 'sunset-glow',
                label: 'Hoàng hôn phát sáng',
                promptText: 'Thêm không khí hoàng hôn ấm, ánh sáng viền đẹp và cảm giác cinematic nhẹ.'
            },
            {
                id: 'city-bokeh',
                label: 'Bokeh phố đêm',
                promptText: 'Tạo bokeh đèn phố đêm mềm ở hậu cảnh, hiện đại và sang hơn.'
            },
            {
                id: 'soft-fog',
                label: 'Sương mỏng',
                promptText: 'Bổ sung lớp sương mỏng nhẹ để tăng chiều sâu không gian và cảm giác điện ảnh.'
            },
            {
                id: 'light-streaks',
                label: 'Vệt sáng nghệ thuật',
                promptText: 'Thêm các vệt sáng nghệ thuật tinh tế để ảnh sống động và có năng lượng hơn.'
            },
            {
                id: 'premium-stage',
                label: 'Sân khấu premium',
                promptText: 'Tạo cảm giác như chụp tại sân khấu hoặc event premium, ánh sáng nổi bật và có chiều sâu.'
            },
            {
                id: 'confetti-luxe',
                label: 'Confetti sang trọng',
                promptText: 'Thêm confetti hoặc hạt lấp lánh nhẹ, cao cấp và hài hòa với nhân vật chính.'
            }
        ]
    },
    {
        id: 'commercial-photo',
        label: 'Ảnh quảng cáo - sản phẩm',
        options: [
            {
                id: 'clean-ad-light',
                label: 'Ánh sáng quảng cáo',
                promptText: 'Tối ưu ánh sáng theo phong cách ảnh quảng cáo sạch, rõ chủ thể, sắc nét và chuyên nghiệp.'
            },
            {
                id: 'brand-color-tone',
                label: 'Tone màu thương hiệu',
                promptText: 'Đồng bộ màu sắc theo hướng thương hiệu hiện đại, nhất quán và dễ dùng cho quảng cáo.'
            },
            {
                id: 'premium-detail',
                label: 'Chi tiết premium',
                promptText: 'Nâng độ hoàn thiện chi tiết để ảnh có cảm giác premium, rõ chất liệu và sắc sảo hơn.'
            },
            {
                id: 'hero-shot',
                label: 'Hero shot',
                promptText: 'Đẩy bố cục và điểm nhìn theo kiểu hero shot, nhân vật/chủ thể nổi bật rõ ràng và có sức hút thương mại.'
            }
        ]
    }
];

const FUNCTION_CATEGORY_MAP = FUNCTION_CATEGORIES.reduce((map, category) => {
    map[category.id] = category;
    return map;
}, {});

const getFunctionOption = (categoryId, optionId) => {
    if (!categoryId || !optionId) {
        return null;
    }

    return FUNCTION_CATEGORY_MAP[categoryId]?.options.find((option) => option.id === optionId) || null;
};

const normalizeSavedPrompt = (entry) => {
    const categoryId = FUNCTION_CATEGORY_MAP[entry?.functionCategoryId] ? entry.functionCategoryId : FUNCTION_CATEGORIES[0].id;
    const selectedOption = getFunctionOption(categoryId, entry?.selectedFunctionId);

    return {
        name: entry?.name || '',
        prompt: entry?.prompt || '',
        functionCategoryId: categoryId,
        selectedFunctionId: selectedOption?.id || '',
        preserveSubject: typeof entry?.preserveSubject === 'boolean' ? entry.preserveSubject : true,
        fixImage: Boolean(entry?.fixImage)
    };
};

const buildPromptFragments = ({ selectedFunctionId, functionCategoryId, preserveSubject, fixImage }) => {
    const fragments = [];
    const selectedFunction = getFunctionOption(functionCategoryId, selectedFunctionId);

    if (selectedFunction?.promptText) {
        fragments.push(selectedFunction.promptText);
    }

    if (preserveSubject) {
        fragments.push('Giữ nguyên nhân vật chính, gương mặt, nhận diện, trang phục và thần thái tổng thể.');
    }

    if (fixImage) {
        fragments.push('Tự động sửa lỗi ảnh, làm sạch chi tiết thừa, cải thiện ánh sáng và tối ưu chất lượng tổng thể.');
    }

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

export const TuDoAITab = ({
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
    const [aspectRatio, setAspectRatio] = useState('2:3');
    const [size, setSize] = useState('1K');
    const [prompt, setPrompt] = useState('');
    const [memoName, setMemoName] = useState('');
    const [savedPrompts, setSavedPrompts] = useState(() => {
        try {
            const saved = localStorage.getItem('banana_saved_prompts_tudoai');
            return saved ? JSON.parse(saved).map(normalizeSavedPrompt).filter((item) => item.name) : [];
        } catch (e) {
            return [];
        }
    });
    const [functionCategoryId, setFunctionCategoryId] = useState(FUNCTION_CATEGORIES[0].id);
    const [selectedFunctionId, setSelectedFunctionId] = useState('');
    const [preserveSubject, setPreserveSubject] = useState(true);
    const [fixImage, setFixImage] = useState(false);
    const [isFunctionAccordionOpen, setIsFunctionAccordionOpen] = useState(false);
    const [autoZoom, setAutoZoom] = useState(true);
    const [creativity, setCreativity] = useState('balanced');
    const [result, setResult] = useState(null);
    const [isManualInsertLoading, setIsManualInsertLoading] = useState(false);
    const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
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

    const promptFragments = useMemo(
        () => buildPromptFragments({ selectedFunctionId, functionCategoryId, preserveSubject, fixImage }),
        [selectedFunctionId, functionCategoryId, preserveSubject, fixImage]
    );
    const finalPrompt = useMemo(
        () => [prompt.trim(), ...promptFragments].filter(Boolean).join('\n'),
        [prompt, promptFragments]
    );
    const canSubmit = useMemo(() => Boolean(finalPrompt.trim()) || items.length > 0, [finalPrompt, items.length]);
    const selectedFunction = useMemo(
        () => getFunctionOption(functionCategoryId, selectedFunctionId),
        [functionCategoryId, selectedFunctionId]
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
            setSize(payload.size || '1K');
            setPrompt(payload.prompt || '');
            setFunctionCategoryId(FUNCTION_CATEGORY_MAP[payload.functionCategoryId] ? payload.functionCategoryId : FUNCTION_CATEGORIES[0].id);
            setSelectedFunctionId(getFunctionOption(payload.functionCategoryId, payload.selectedFunctionId)?.id || '');
            setPreserveSubject(typeof payload.preserveSubject === 'boolean' ? payload.preserveSubject : true);
            setFixImage(Boolean(payload.fixImage));
            setIsFunctionAccordionOpen(false);
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
        const trimmedPrompt = finalPrompt.trim();

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

    const handleSavePrompt = () => {
        if (!prompt.trim() && !selectedFunctionId && !fixImage && preserveSubject) return;
        const name = memoName.trim() || `Prompt ${new Date().toLocaleString()}`;
        const newSaved = [
            ...savedPrompts.filter((p) => p.name !== name),
            {
                name,
                prompt: prompt.trim(),
                functionCategoryId,
                selectedFunctionId,
                preserveSubject,
                fixImage
            }
        ];
        setSavedPrompts(newSaved);
        localStorage.setItem('banana_saved_prompts_tudoai', JSON.stringify(newSaved));
        setMemoName(name);
    };

    const handleDeletePrompt = (name) => {
        const newSaved = savedPrompts.filter(p => p.name !== name);
        setSavedPrompts(newSaved);
        localStorage.setItem('banana_saved_prompts_tudoai', JSON.stringify(newSaved));
        if (memoName === name) setMemoName('');
    };

    const handleLoadSavedPrompt = (name) => {
        const selected = savedPrompts.find(p => p.name === name);
        if (selected) {
            setPrompt(selected.prompt);
            setMemoName(selected.name);
            setFunctionCategoryId(selected.functionCategoryId || FUNCTION_CATEGORIES[0].id);
            setSelectedFunctionId(selected.selectedFunctionId || '');
            setPreserveSubject(typeof selected.preserveSubject === 'boolean' ? selected.preserveSubject : true);
            setFixImage(Boolean(selected.fixImage));
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
                feature: 'tu-do-ai',
                prompt: prompt.trim(),
                context: {
                    ratio: aspectRatio,
                    size,
                    referenceImageCount: items.length,
                    autoZoom,
                    creativity,
                    functionCategoryId,
                    selectedFunctionId,
                    selectedFunctionLabel: selectedFunction?.label || '',
                    preserveSubject,
                    fixImage,
                    finalPrompt
                },
                clientRequestId: `tu-do-ai-optimize-${Date.now()}`,
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
                        functionCategoryId,
                        selectedFunctionId,
                        preserveSubject,
                        fixImage,
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
                        `Chức năng: ${selectedFunction?.label || 'Không chọn'}`,
                        `Giữ nhân vật: ${preserveSubject ? 'Bật' : 'Tắt'}`,
                        `Fix ảnh: ${fixImage ? 'Bật' : 'Tắt'}`,
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
                        prompt: prompt.trim(),
                        aspectRatio: payload.ratio,
                        size: payload.size,
                        functionCategoryId,
                        selectedFunctionId,
                        preserveSubject,
                        fixImage,
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
                    layerNamePrefix: result.layerNamePrefix || 'Tu Do AI'
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

    const handleSelectFunction = (optionId) => {
        setSelectedFunctionId((current) => (current === optionId ? '' : optionId));
    };

    const handleToggleFunctionAccordion = () => {
        setIsFunctionAccordionOpen((current) => !current);
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

                {restoreNotice ? (
                    <div className="reference-note">{restoreNotice}</div>
                ) : null}

                <div className="reference-note">Dán ảnh từ clipboard bằng `Cmd/Ctrl + V` khi tab đang focus.</div>
            </div>

            <div className="section">
                <div className="section-header">
                    <span className="section-label">Prompt</span>
                </div>
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
                            placeholder="Mô tả chi tiết nội dung ảnh bạn muốn tạo..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            maxLength={500}
                        ></textarea>
                        <div className="prompt-char-count">{prompt.length}/500</div>
                    </div>

                    <div className="prompt-footer-row">
                        <div className="prompt-field-group" style={{flex: 1}}>
                            <input
                                type="text"
                                className="prompt-memo-input"
                                placeholder="Đặt tên gợi nhớ..."
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
                <select className="dropdown" value={creativity} onChange={(event) => setCreativity(event.target.value)}>
                    {[
                        { id: 'creative', label: 'Sáng tạo' },
                        { id: 'balanced', label: 'Cân bằng' },
                        { id: 'faithful', label: 'Bám sát' }
                    ].map((option) => (
                        <option
                            key={option.id}
                            value={option.id}
                        >
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

                                <div className="prompt-function-box">
                        <div className="prompt-function-accordion-list">
                            <div className={`function-accordion-item ${isFunctionAccordionOpen ? 'open' : ''}`}>
                                <button
                                    type="button"
                                    className="function-accordion-header"
                                    onClick={handleToggleFunctionAccordion}
                                >
                                    <span className="function-accordion-title">Chức năng sẵn có</span>
                                    <span className={`function-accordion-chevron ${isFunctionAccordionOpen ? 'open' : ''}`}></span>
                                </button>

                                <div
                                    className="function-accordion-body"
                                    style={{ display: isFunctionAccordionOpen ? 'block' : 'none' }}
                                >
                                    <div className="prompt-function-body-stack">
                                        <select
                                            className="dropdown prompt-function-select"
                                            value={functionCategoryId}
                                            onChange={(event) => {
                                                setFunctionCategoryId(event.target.value);
                                                setSelectedFunctionId('');
                                            }}
                                        >
                                            {FUNCTION_CATEGORIES.map((category) => (
                                                <option key={category.id} value={category.id}>{category.label}</option>
                                            ))}
                                        </select>

                                        <div className="prompt-function-button-list">
                                            {(FUNCTION_CATEGORY_MAP[functionCategoryId]?.options || []).map((option) => (
                                                <div
                                                    key={option.id}
                                                    className={`prompt-function-cell ${option.fullWidth ? 'full-span' : ''}`}
                                                >
                                                    <button
                                                        type="button"
                                                        className={`prompt-function-button ${selectedFunctionId === option.id ? 'active' : ''}`}
                                                        onClick={() => {
                                                            setFunctionCategoryId(functionCategoryId);
                                                            handleSelectFunction(option.id);
                                                        }}
                                                    >
                                                        {option.label}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="prompt-function-toggle-row">
                            <div className="switch-row prompt-function-switch">
                                <div className="switch-label">Giữ nhân vật</div>
                                <label className="switch">
                                    <input type="checkbox" checked={preserveSubject} onChange={(event) => setPreserveSubject(event.target.checked)} />
                                    <span className="slider"></span>
                                </label>
                            </div>

                            <div className="switch-row prompt-function-switch">
                                <div className="switch-label">Fix ảnh</div>
                                <label className="switch">
                                    <input type="checkbox" checked={fixImage} onChange={(event) => setFixImage(event.target.checked)} />
                                    <span className="slider"></span>
                                </label>
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
                        <>{result ? 'Regenerate' : 'Tạo Ảnh Tự Do'}</>
                    )}
                </button>
            </div>
        </div>
    );
};
