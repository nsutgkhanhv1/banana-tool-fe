import React, { useEffect, useRef, useState } from 'react';

const MASK_EXPORT_SIZE = 512;
const MASK_PREVIEW_COLOR = 'rgba(255, 179, 0, 0.9)';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const buildMaskDataUrl = (mask) => {
    if (!mask || !mask.imageBase64) {
        return '';
    }

    return `data:${mask.mimeType || 'image/png'};base64,${mask.imageBase64}`;
};

const hasVisibleMask = (canvas) => {
    const context = canvas.getContext('2d');

    if (!context) {
        return false;
    }

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

    for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 0) {
            return true;
        }
    }

    return false;
};

const drawStroke = (context, fromPoint, toPoint, brushSize, tool) => {
    context.save();
    context.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
    context.strokeStyle = MASK_PREVIEW_COLOR;
    context.fillStyle = MASK_PREVIEW_COLOR;
    context.lineWidth = brushSize;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.shadowColor = 'rgba(255, 179, 0, 0.35)';
    context.shadowBlur = tool === 'erase' ? 0 : 4;
    context.beginPath();
    context.moveTo(fromPoint.x, fromPoint.y);
    context.lineTo(toPoint.x, toPoint.y);
    context.stroke();
    context.beginPath();
    context.arc(toPoint.x, toPoint.y, brushSize / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
};

const drawMaskImageToCanvas = (canvas, maskDataUrl, onDraw) => {
    if (!canvas || !maskDataUrl) {
        return;
    }

    const maskImage = new Image();
    maskImage.onload = () => {
        const context = canvas.getContext('2d');

        if (!context) {
            return;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(maskImage, 0, 0, canvas.width, canvas.height);
        if (typeof onDraw === 'function') {
            onDraw();
        }
    };
    maskImage.src = maskDataUrl;
};

export const RestorationMaskEditor = ({ previewUrl, initialMask, onChange, disabled }) => {
    const imageRef = useRef(null);
    const canvasRef = useRef(null);
    const [tool, setTool] = useState('paint');
    const [brushSize, setBrushSize] = useState(24);
    const [zoom, setZoom] = useState(1);
    const [isDrawModeEnabled, setIsDrawModeEnabled] = useState(true);
    const [isPainting, setIsPainting] = useState(false);
    const [hasMaskContent, setHasMaskContent] = useState(Boolean(initialMask && initialMask.imageBase64));
    const strokeStateRef = useRef(null);

    const getCanvasPoint = (event) => {
        const canvas = canvasRef.current;

        if (!canvas) {
            return null;
        }

        const bounds = canvas.getBoundingClientRect();

        if (!bounds.width || !bounds.height) {
            return null;
        }

        return {
            x: clamp(((event.clientX - bounds.left) / bounds.width) * canvas.width, 0, canvas.width),
            y: clamp(((event.clientY - bounds.top) / bounds.height) * canvas.height, 0, canvas.height)
        };
    };

    const syncCanvasFromMask = ({ preserveExisting = false } = {}) => {
        const canvas = canvasRef.current;
        const image = imageRef.current;

        if (!canvas || !image || !image.clientWidth || !image.clientHeight) {
            return;
        }

        const currentMaskDataUrl = preserveExisting && canvas.width > 0 && canvas.height > 0 && hasVisibleMask(canvas)
            ? canvas.toDataURL('image/png')
            : '';
        const nextMaskDataUrl = currentMaskDataUrl || buildMaskDataUrl(initialMask);

        canvas.width = image.clientWidth;
        canvas.height = image.clientHeight;

        const context = canvas.getContext('2d');

        if (!context) {
            return;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);

        if (!nextMaskDataUrl) {
            setHasMaskContent(false);
            return;
        }

        setHasMaskContent(true);
        drawMaskImageToCanvas(canvas, nextMaskDataUrl, () => setHasMaskContent(true));
    };

    useEffect(() => {
        syncCanvasFromMask();
    }, [initialMask, previewUrl]);

    useEffect(() => {
        setHasMaskContent(Boolean(initialMask && initialMask.imageBase64));
    }, [initialMask]);

    useEffect(() => {
        const image = imageRef.current;

        if (!image || typeof ResizeObserver === 'undefined') {
            return undefined;
        }

        const observer = new ResizeObserver(() => {
            syncCanvasFromMask({ preserveExisting: true });
        });

        observer.observe(image);

        return () => {
            observer.disconnect();
        };
    }, [zoom, initialMask]);

    const commitCanvasMask = () => {
        const canvas = canvasRef.current;

        if (!canvas) {
            setHasMaskContent(false);
            onChange(null);
            return;
        }

        if (!hasVisibleMask(canvas)) {
            setHasMaskContent(false);
            onChange(null);
            return;
        }

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = MASK_EXPORT_SIZE;
        exportCanvas.height = MASK_EXPORT_SIZE;
        const exportContext = exportCanvas.getContext('2d');

        if (!exportContext) {
            return;
        }

        exportContext.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
        exportContext.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);

        const imageData = exportContext.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
        const pixels = imageData.data;

        for (let index = 0; index < pixels.length; index += 4) {
            const alpha = pixels[index + 3];
            pixels[index] = 255;
            pixels[index + 1] = 255;
            pixels[index + 2] = 255;
            pixels[index + 3] = alpha;
        }

        exportContext.putImageData(imageData, 0, 0);

        const dataUrl = exportCanvas.toDataURL('image/png');
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';

        setHasMaskContent(Boolean(base64));
        onChange(base64 ? {
            imageBase64: base64,
            mimeType: 'image/png',
            width: MASK_EXPORT_SIZE,
            height: MASK_EXPORT_SIZE
        } : null);
    };

    useEffect(() => {
        if (!isPainting) {
            return undefined;
        }

        const handlePointerMove = (event) => {
            const canvas = canvasRef.current;
            const context = canvas ? canvas.getContext('2d') : null;
            const point = getCanvasPoint(event);
            const strokeState = strokeStateRef.current;

            if (!context || !point || !strokeState || strokeState.pointerId !== event.pointerId) {
                return;
            }

            drawStroke(context, strokeState.lastPoint, point, brushSize, tool);
            strokeStateRef.current = {
                ...strokeState,
                lastPoint: point
            };
        };

        const handleMouseMove = (event) => {
            const canvas = canvasRef.current;
            const context = canvas ? canvas.getContext('2d') : null;
            const point = getCanvasPoint(event);
            const strokeState = strokeStateRef.current;

            if (!context || !point || !strokeState || strokeState.inputType !== 'mouse') {
                return;
            }

            drawStroke(context, strokeState.lastPoint, point, brushSize, tool);
            strokeStateRef.current = {
                ...strokeState,
                lastPoint: point
            };
        };

        const handlePointerUp = (event) => {
            const strokeState = strokeStateRef.current;

            if (!strokeState || strokeState.pointerId !== event.pointerId) {
                return;
            }

            strokeStateRef.current = null;
            setIsPainting(false);
            commitCanvasMask();
        };

        const handleMouseUp = () => {
            const strokeState = strokeStateRef.current;

            if (!strokeState || strokeState.inputType !== 'mouse') {
                return;
            }

            strokeStateRef.current = null;
            setIsPainting(false);
            commitCanvasMask();
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [brushSize, isPainting, onChange, tool]);

    const handleCanvasPointerDown = (event) => {
        if (!isDrawModeEnabled || disabled || (typeof event.button === 'number' && event.button !== 0)) {
            return;
        }

        const canvas = canvasRef.current;
        const context = canvas ? canvas.getContext('2d') : null;

        if (!canvas || !context) {
            return;
        }

        const bounds = canvas.getBoundingClientRect();
        const point = {
            x: clamp(((event.clientX - bounds.left) / bounds.width) * canvas.width, 0, canvas.width),
            y: clamp(((event.clientY - bounds.top) / bounds.height) * canvas.height, 0, canvas.height)
        };

        strokeStateRef.current = {
            lastPoint: point,
            pointerId: event.pointerId,
            inputType: 'pointer'
        };
        drawStroke(context, point, point, brushSize, tool);
        if (tool !== 'erase') {
            setHasMaskContent(true);
        }
        setIsPainting(true);
        if (typeof canvas.setPointerCapture === 'function') {
            canvas.setPointerCapture(event.pointerId);
        }
        event.preventDefault();
    };

    const handleCanvasMouseDown = (event) => {
        if (!isDrawModeEnabled || disabled || (typeof event.button === 'number' && event.button !== 0)) {
            return;
        }

        const canvas = canvasRef.current;
        const context = canvas ? canvas.getContext('2d') : null;
        const point = getCanvasPoint(event);

        if (!canvas || !context || !point) {
            return;
        }

        strokeStateRef.current = {
            lastPoint: point,
            pointerId: null,
            inputType: 'mouse'
        };
        drawStroke(context, point, point, brushSize, tool);
        if (tool !== 'erase') {
            setHasMaskContent(true);
        }
        setIsPainting(true);
        event.preventDefault();
    };

    const handleInteractionPointerMove = (event) => {
        const canvas = canvasRef.current;
        const context = canvas ? canvas.getContext('2d') : null;
        const point = getCanvasPoint(event);
        const strokeState = strokeStateRef.current;

        if (!isPainting || !context || !point || !strokeState || strokeState.inputType !== 'pointer' || strokeState.pointerId !== event.pointerId) {
            return;
        }

        drawStroke(context, strokeState.lastPoint, point, brushSize, tool);
        strokeStateRef.current = {
            ...strokeState,
            lastPoint: point
        };
    };

    const handleInteractionMouseMove = (event) => {
        const canvas = canvasRef.current;
        const context = canvas ? canvas.getContext('2d') : null;
        const point = getCanvasPoint(event);
        const strokeState = strokeStateRef.current;

        if (!isPainting || !context || !point || !strokeState || strokeState.inputType !== 'mouse') {
            return;
        }

        drawStroke(context, strokeState.lastPoint, point, brushSize, tool);
        strokeStateRef.current = {
            ...strokeState,
            lastPoint: point
        };
    };

    const finishPaintingSession = () => {
        if (!strokeStateRef.current) {
            return;
        }

        strokeStateRef.current = null;
        setIsPainting(false);
        commitCanvasMask();
    };

    const handleInteractionPointerUp = () => {
        finishPaintingSession();
    };

    const handleInteractionMouseUp = () => {
        finishPaintingSession();
    };

    const handleInteractionMouseLeave = () => {
        if (isPainting) {
            finishPaintingSession();
        }
    };

    const handleZoomChange = (nextZoom) => {
        if (nextZoom === zoom) {
            return;
        }

        if (canvasRef.current && hasVisibleMask(canvasRef.current)) {
            commitCanvasMask();
        }

        setZoom(nextZoom);
    };

    const handleReset = () => {
        const canvas = canvasRef.current;
        const context = canvas ? canvas.getContext('2d') : null;

        if (context && canvas) {
            context.clearRect(0, 0, canvas.width, canvas.height);
        }

        strokeStateRef.current = null;
        setIsPainting(false);
        setHasMaskContent(false);
        onChange(null);
    };

    const handleSelectTool = (nextTool) => {
        if (disabled) {
            return;
        }

        setTool(nextTool);
        setIsDrawModeEnabled(true);
    };

    const drawModeTitle = disabled
        ? 'Editor đang bị khóa'
        : isDrawModeEnabled
            ? tool === 'erase'
                ? 'Cọ đang bật: chế độ xóa'
                : 'Cọ đang bật: chế độ vẽ'
            : 'Cọ đang tắt';
    const drawModeDescription = disabled
        ? 'Tạm thời chưa thể chỉnh mask khi hành động bị khóa.'
        : isDrawModeEnabled
            ? tool === 'erase'
                ? 'Kéo chuột trên ảnh để xóa phần mask dư.'
                : 'Kéo chuột trên ảnh để tô vùng cần phục chế mạnh hơn.'
            : 'Bấm nút bật cọ để bắt đầu vẽ mask trên ảnh.';
    const maskPresenceLabel = hasMaskContent ? 'Đã có mask' : 'Chưa có mask';

    return (
        <div className="mask-editor-shell">
            <div className="mask-editor-toolbar">
                <div className="mask-editor-toolset">
                    <button
                        className={`segment-btn ${tool === 'paint' ? 'active' : ''}`}
                        type="button"
                        onClick={() => handleSelectTool('paint')}
                        disabled={disabled}
                    >
                        Vẽ mask
                    </button>
                    <button
                        className={`segment-btn ${tool === 'erase' ? 'active' : ''}`}
                        type="button"
                        onClick={() => handleSelectTool('erase')}
                        disabled={disabled}
                    >
                        Xóa mask
                    </button>
                    <button
                        className={`segment-btn ${isDrawModeEnabled ? 'active' : ''}`}
                        type="button"
                        onClick={() => setIsDrawModeEnabled((current) => !current)}
                        disabled={disabled}
                    >
                        {isDrawModeEnabled ? 'Tắt cọ' : 'Bật cọ'}
                    </button>
                </div>
                <div className={`mask-editor-status-card ${isDrawModeEnabled ? 'is-armed' : 'is-idle'} ${hasMaskContent ? 'has-mask' : 'is-empty'}`}>
                    <div className="mask-editor-status-head">
                        <strong>{drawModeTitle}</strong>
                        <span className={`mask-editor-status-pill ${hasMaskContent ? 'has-mask' : 'is-empty'}`}>{maskPresenceLabel}</span>
                    </div>
                    <span>{drawModeDescription}</span>
                </div>
                <div className="mask-editor-slider-group">
                    <label className="mask-editor-slider-label" htmlFor="repair-mask-brush">
                        Cỡ cọ {brushSize}px
                    </label>
                    <input
                        id="repair-mask-brush"
                        className="mask-editor-slider"
                        type="range"
                        min="8"
                        max="56"
                        step="2"
                        value={brushSize}
                        onChange={(event) => setBrushSize(Number(event.target.value))}
                        disabled={disabled}
                    />
                </div>
                <div className="mask-editor-zoom-group">
                    {[1, 1.5, 2].map((zoomLevel) => (
                        <button
                            key={zoomLevel}
                            className={`btn ${zoom === zoomLevel ? 'primary' : ''}`}
                            type="button"
                            onClick={() => handleZoomChange(zoomLevel)}
                            disabled={disabled}
                        >
                            {`${zoomLevel}x`}
                        </button>
                    ))}
                    <button className="btn" type="button" onClick={handleReset} disabled={disabled}>
                        Reset mask
                    </button>
                </div>
            </div>

            <div className="mask-editor-scroll">
                <div className="mask-editor-zoom-stage" style={{ width: `${zoom * 100}%` }}>
                    <div className="face-region-stage">
                        <div className={`mask-editor-stage-badge ${isDrawModeEnabled ? 'is-armed' : 'is-idle'}`}>
                            {isDrawModeEnabled ? (tool === 'erase' ? 'Đang xóa mask' : 'Đang vẽ mask') : 'Cọ đang tắt'}
                        </div>
                        <img
                            ref={imageRef}
                            className="face-region-image"
                            src={previewUrl}
                            alt="Repair mask preview"
                            onLoad={syncCanvasFromMask}
                        />
                        <canvas
                            ref={canvasRef}
                            className={`mask-editor-canvas ${disabled ? 'is-disabled' : ''}`}
                        />
                        <div
                            className={`mask-editor-interaction-layer ${disabled ? 'is-disabled' : ''} ${isDrawModeEnabled ? 'is-armed' : ''} ${tool === 'erase' ? 'is-erase' : ''}`}
                            onPointerDown={handleCanvasPointerDown}
                            onMouseDown={handleCanvasMouseDown}
                            onPointerMove={handleInteractionPointerMove}
                            onMouseMove={handleInteractionMouseMove}
                            onPointerUp={handleInteractionPointerUp}
                            onMouseUp={handleInteractionMouseUp}
                            onMouseLeave={handleInteractionMouseLeave}
                        />
                        <div className={`mask-editor-stage-hint ${isDrawModeEnabled ? 'is-active' : 'is-idle'}`}>
                            <strong>{maskPresenceLabel}</strong>
                            <span>{drawModeDescription}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
