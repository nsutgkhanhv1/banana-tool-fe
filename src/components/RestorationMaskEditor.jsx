import React, { useEffect, useRef, useState } from 'react';

const MASK_EXPORT_SIZE = 512;

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
    context.strokeStyle = 'rgba(255, 255, 255, 1)';
    context.fillStyle = 'rgba(255, 255, 255, 1)';
    context.lineWidth = brushSize;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(fromPoint.x, fromPoint.y);
    context.lineTo(toPoint.x, toPoint.y);
    context.stroke();
    context.beginPath();
    context.arc(toPoint.x, toPoint.y, brushSize / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
};

export const RestorationMaskEditor = ({ previewUrl, initialMask, onChange, disabled }) => {
    const imageRef = useRef(null);
    const canvasRef = useRef(null);
    const [tool, setTool] = useState('paint');
    const [brushSize, setBrushSize] = useState(24);
    const [zoom, setZoom] = useState(1);
    const [isPainting, setIsPainting] = useState(false);
    const strokeStateRef = useRef(null);

    const syncCanvasFromMask = () => {
        const canvas = canvasRef.current;
        const image = imageRef.current;

        if (!canvas || !image || !image.clientWidth || !image.clientHeight) {
            return;
        }

        canvas.width = image.clientWidth;
        canvas.height = image.clientHeight;

        const context = canvas.getContext('2d');

        if (!context) {
            return;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);

        if (!initialMask || !initialMask.imageBase64) {
            return;
        }

        const maskImage = new Image();
        maskImage.onload = () => {
            const liveContext = canvas.getContext('2d');

            if (!liveContext) {
                return;
            }

            liveContext.clearRect(0, 0, canvas.width, canvas.height);
            liveContext.drawImage(maskImage, 0, 0, canvas.width, canvas.height);
        };
        maskImage.src = buildMaskDataUrl(initialMask);
    };

    useEffect(() => {
        syncCanvasFromMask();
    }, [initialMask, previewUrl]);

    useEffect(() => {
        if (!isPainting) {
            return undefined;
        }

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

        const handleMouseMove = (event) => {
            const canvas = canvasRef.current;
            const context = canvas ? canvas.getContext('2d') : null;
            const point = getCanvasPoint(event);
            const strokeState = strokeStateRef.current;

            if (!context || !point || !strokeState) {
                return;
            }

            drawStroke(context, strokeState.lastPoint, point, brushSize, tool);
            strokeStateRef.current = {
                ...strokeState,
                lastPoint: point
            };
        };

        const handleMouseUp = () => {
            strokeStateRef.current = null;
            setIsPainting(false);

            const canvas = canvasRef.current;

            if (!canvas) {
                onChange(null);
                return;
            }

            if (!hasVisibleMask(canvas)) {
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

            const dataUrl = exportCanvas.toDataURL('image/png');
            const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';

            onChange(base64 ? {
                imageBase64: base64,
                mimeType: 'image/png',
                width: MASK_EXPORT_SIZE,
                height: MASK_EXPORT_SIZE
            } : null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [brushSize, isPainting, onChange, tool]);

    const handleCanvasMouseDown = (event) => {
        if (disabled || event.button !== 0) {
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
            lastPoint: point
        };
        drawStroke(context, point, point, brushSize, tool);
        setIsPainting(true);
        event.preventDefault();
    };

    const handleReset = () => {
        const canvas = canvasRef.current;
        const context = canvas ? canvas.getContext('2d') : null;

        if (context && canvas) {
            context.clearRect(0, 0, canvas.width, canvas.height);
        }

        strokeStateRef.current = null;
        setIsPainting(false);
        onChange(null);
    };

    return (
        <div className="mask-editor-shell">
            <div className="mask-editor-toolbar">
                <div className="mask-editor-toolset">
                    <button
                        className={`segment-btn ${tool === 'paint' ? 'active' : ''}`}
                        type="button"
                        onClick={() => setTool('paint')}
                        disabled={disabled}
                    >
                        Vẽ mask
                    </button>
                    <button
                        className={`segment-btn ${tool === 'erase' ? 'active' : ''}`}
                        type="button"
                        onClick={() => setTool('erase')}
                        disabled={disabled}
                    >
                        Xóa mask
                    </button>
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
                            onClick={() => setZoom(zoomLevel)}
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
                <div className="mask-editor-zoom-stage" style={{ transform: `scale(${zoom})` }}>
                    <div className="face-region-stage">
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
                            onMouseDown={handleCanvasMouseDown}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
