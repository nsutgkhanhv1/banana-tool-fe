const createError = (message, code) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const getPhotoshop = () => {
    try {
        return require("photoshop");
    } catch (error) {
        throw createError("Khong the ket noi Photoshop.", "PHOTOSHOP_UNAVAILABLE");
    }
};

const getStorage = () => {
    try {
        return require("uxp").storage;
    } catch (error) {
        throw createError("Khong the truy cap UXP storage.", "UXP_STORAGE_UNAVAILABLE");
    }
};

const clampNumber = (value, fallback, min, max) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const normalizeDimension = (value) => {
    if (value && typeof value === "object" && typeof value.value === "number") {
        return value.value;
    }
    return typeof value === "number" ? value : null;
};

const normalizeBounds = (bounds) => {
    if (!bounds) {
        return null;
    }

    const left = normalizeDimension(bounds.left);
    const top = normalizeDimension(bounds.top);
    const right = normalizeDimension(bounds.right);
    const bottom = normalizeDimension(bounds.bottom);

    if (![left, top, right, bottom].every(Number.isFinite)) {
        return null;
    }

    return {
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top
    };
};

const sanitizeFileName = (value) => String(value || "image")
    .replace(/\.[^/.]+$/, "")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .trim() || "image";

const getActiveLayer = (document) => (
    document && document.activeLayers && document.activeLayers[0]
        ? document.activeLayers[0]
        : document && document.layers && document.layers[0]
);

export const pickLogoFile = async () => {
    const storage = getStorage();
    const result = await storage.localFileSystem.getFileForOpening({
        types: ["png", "jpg", "jpeg", "psd", "tif", "tiff"]
    });
    return Array.isArray(result) ? result[0] || null : result;
};

const createTextWatermark = async ({ action, text, font, fontSize, opacity, x, y }) => {
    await runActionCommands(action, [{
        _obj: "make",
        _target: [{ _ref: "textLayer" }],
        using: {
            _obj: "textLayer",
            name: "MEKO Text Watermark",
            textKey: text,
            textClickPoint: {
                _obj: "paint",
                horizontal: { _unit: "pixelsUnit", _value: x },
                vertical: { _unit: "pixelsUnit", _value: y }
            },
            textStyleRange: [{
                _obj: "textStyleRange",
                from: 0,
                to: text.length,
                textStyle: {
                    _obj: "textStyle",
                    fontPostScriptName: font,
                    size: { _unit: "pointsUnit", _value: fontSize },
                    color: {
                        _obj: "RGBColor",
                        red: 255,
                        grain: 255,
                        blue: 255
                    }
                }
            }],
            paragraphStyleRange: [{
                _obj: "paragraphStyleRange",
                from: 0,
                to: text.length,
                paragraphStyle: {
                    _obj: "paragraphStyle",
                    align: { _enum: "alignmentType", _value: "left" }
                }
            }]
        },
        _options: { dialogOptions: "dontDisplay" }
    }, {
        _obj: "set",
        _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
        to: {
            _obj: "layer",
            opacity: { _unit: "percentUnit", _value: opacity }
        },
        _options: { dialogOptions: "dontDisplay" }
    }], "Khong tao duoc text watermark.", "TEXT_WATERMARK_FAILED");
};

export const addLogoToDocument = async ({
    logoFile,
    watermarkType = "logo",
    watermarkText = "© Mekomedia.vn",
    font = "ArialMT",
    fontSize = 40,
    position = "bottomRight",
    sizePercent = 20,
    marginPercent = 3,
    opacity = 80
} = {}) => {
    const resolvedType = watermarkType === "text" ? "text" : "logo";
    if (resolvedType === "logo" && (!logoFile || !logoFile.isFile)) {
        throw createError("Hay chon file logo.", "MISSING_LOGO_FILE");
    }

    const photoshop = getPhotoshop();
    const { app, core, constants, action } = photoshop;
    const targetDocument = app.activeDocument;

    if (!targetDocument) {
        throw createError("Hay mo document can chen logo.", "NO_ACTIVE_DOCUMENT");
    }

    const resolvedPosition = ["topLeft", "topRight", "bottomLeft", "bottomRight", "center"].includes(position)
        ? position
        : "bottomRight";
    const resolvedSize = clampNumber(sizePercent, 20, 1, 100);
    const resolvedMargin = clampNumber(marginPercent, 3, 0, 25);
    const resolvedOpacity = clampNumber(opacity, 80, 1, 100);
    const resolvedFontSize = clampNumber(fontSize, 40, 6, 300);
    let insertedLayerName = resolvedType === "text" ? "MEKO Text Watermark" : "MEKO Logo";

    await core.executeAsModal(async () => {
        let logoDocument = null;

        try {
            const documentWidth = normalizeDimension(targetDocument.width);
            const documentHeight = normalizeDimension(targetDocument.height);
            if (!documentWidth || !documentHeight) {
                throw createError("Khong doc duoc kich thuoc document.", "INVALID_WATERMARK_DIMENSIONS");
            }

            if (resolvedType === "text") {
                const margin = Math.min(documentWidth, documentHeight) * (resolvedMargin / 100);
                const text = String(watermarkText || "© Mekomedia.vn");
                const estimatedWidth = Math.max(120, text.length * resolvedFontSize * 0.55);
                const targetX = resolvedPosition.endsWith("Right")
                    ? documentWidth - margin - estimatedWidth
                    : resolvedPosition.endsWith("Left") ? margin : documentWidth / 2;
                const targetY = resolvedPosition.startsWith("bottom")
                    ? documentHeight - margin
                    : resolvedPosition.startsWith("top") ? margin + resolvedFontSize : documentHeight / 2;
                await createTextWatermark({
                    action,
                    text,
                    font,
                    fontSize: resolvedFontSize,
                    opacity: resolvedOpacity,
                    x: targetX,
                    y: targetY
                });
                return;
            }

            logoDocument = await app.open(logoFile);
            const sourceLayer = getActiveLayer(logoDocument);
            if (!sourceLayer) {
                throw createError("File logo khong co layer hop le.", "INVALID_LOGO_FILE");
            }

            const duplicated = await logoDocument.duplicateLayers([sourceLayer], targetDocument);
            const logoLayer = duplicated && duplicated[0];
            if (!logoLayer) {
                throw createError("Photoshop khong chen duoc logo.", "LOGO_INSERT_FAILED");
            }

            app.activeDocument = targetDocument;
            let bounds = normalizeBounds(logoLayer.boundsNoEffects || logoLayer.bounds);

            if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
                throw createError("Khong doc duoc kich thuoc logo/document.", "INVALID_LOGO_DIMENSIONS");
            }

            const targetLogoWidth = documentWidth * (resolvedSize / 100);
            const scalePercent = (targetLogoWidth / bounds.width) * 100;
            await logoLayer.scale(scalePercent, scalePercent);
            bounds = normalizeBounds(logoLayer.boundsNoEffects || logoLayer.bounds);

            const margin = Math.min(documentWidth, documentHeight) * (resolvedMargin / 100);
            const targetLeft = resolvedPosition.endsWith("Right")
                ? documentWidth - margin - bounds.width
                : resolvedPosition.endsWith("Left") ? margin : (documentWidth - bounds.width) / 2;
            const targetTop = resolvedPosition.startsWith("bottom")
                ? documentHeight - margin - bounds.height
                : resolvedPosition.startsWith("top") ? margin : (documentHeight - bounds.height) / 2;

            await logoLayer.translate(targetLeft - bounds.left, targetTop - bounds.top);
            logoLayer.opacity = resolvedOpacity;
            logoLayer.name = "MEKO Logo";
            insertedLayerName = logoLayer.name;
        } finally {
            if (logoDocument) {
                try {
                    app.activeDocument = logoDocument;
                    await logoDocument.close(constants.SaveDialogOptions.DONOTSAVECHANGES);
                } catch (closeError) {
                    // Keep the target result even if cleanup fails.
                }
            }
            app.activeDocument = targetDocument;
        }
    }, {
        commandName: "MEKO Add Logo",
        timeOut: 5000
    });

    return `Da chen ${insertedLayerName} vao document.`;
};

const runActionCommands = async (action, commands, errorMessage, errorCode) => {
    const results = await action.batchPlay(commands, {
        synchronousExecution: false,
        modalBehavior: "execute"
    });
    const failed = results && results.find((result) => result && result._obj === "error");
    if (failed) {
        throw createError(failed.message || errorMessage, errorCode);
    }
};

const resizeDocument = async ({ action, width, height, interpolation = "bicubicAutomatic", constrainProportions = true }) => {
    await runActionCommands(action, [{
        _obj: "imageSize",
        width: { _unit: "pixelsUnit", _value: width },
        height: { _unit: "pixelsUnit", _value: height },
        scaleStyles: true,
        constrainProportions,
        interpolation: {
            _enum: "interpolationType",
            _value: interpolation
        },
        _options: { dialogOptions: "dontDisplay" }
    }], "Khong resize duoc anh.", "FACEBOOK_RESIZE_FAILED");
};

const flattenDocument = async (action) => runActionCommands(action, [{
    _obj: "flattenImage",
    _options: { dialogOptions: "dontDisplay" }
}], "Khong flatten duoc document.", "FACEBOOK_FLATTEN_FAILED");

const convertToSrgb = async (action) => runActionCommands(action, [{
    _obj: "convertToProfile",
    destinationProfile: "sRGB IEC61966-2.1",
    intent: {
        _enum: "intent",
        _value: "perceptual"
    },
    blackPointCompensation: true,
    dither: true,
    _options: { dialogOptions: "dontDisplay" }
}], "Khong convert duoc profile sRGB.", "FACEBOOK_SRGB_FAILED");

const applyExportSharpen = async (action) => runActionCommands(action, [{
    _obj: "unsharpMask",
    amount: { _unit: "percentUnit", _value: 40 },
    radius: { _unit: "pixelsUnit", _value: 0.5 },
    threshold: 0,
    _options: { dialogOptions: "dontDisplay" }
}], "Khong sharpen duoc anh export.", "FACEBOOK_SHARPEN_FAILED");

export const exportFacebookImage = async ({
    destinationFolder,
    exportMode = "longEdge",
    longEdge = "2048",
    quality = 10,
    overwrite = false,
    convertSrgb = true,
    flatten = true,
    sharpen = true
} = {}) => {
    if (!destinationFolder || !destinationFolder.isFolder) {
        throw createError("Hay chon thu muc xuat anh.", "MISSING_EXPORT_FOLDER");
    }

    const photoshop = getPhotoshop();
    const { app, core, constants, action } = photoshop;
    const sourceDocument = app.activeDocument;

    if (!sourceDocument) {
        throw createError("Hay mo document can xuat.", "NO_ACTIVE_DOCUMENT");
    }

    const resolvedMode = ["longEdge", "facebookLandscape", "facebookPortrait"].includes(exportMode)
        ? exportMode
        : "longEdge";
    const resolvedLongEdge = Math.round(clampNumber(longEdge, 2048, 640, 8192));
    const resolvedQuality = Math.round(clampNumber(quality, 10, 1, 12));
    const preset = resolvedMode === "facebookLandscape"
        ? { width: 2048, height: 1072, suffix: "_FB_Ngang" }
        : resolvedMode === "facebookPortrait"
            ? { width: 1350, height: 1688, suffix: "_FB_Dung" }
            : { width: null, height: null, suffix: "_facebook" };
    const outputName = `${sanitizeFileName(sourceDocument.title || sourceDocument.name)}${preset.suffix}.jpg`;
    let outputFile = null;

    await core.executeAsModal(async () => {
        let exportDocument = null;

        try {
            exportDocument = await sourceDocument.duplicate(`${sanitizeFileName(sourceDocument.title)} Facebook Export`);
            app.activeDocument = exportDocument;

            if (flatten) {
                await flattenDocument(action);
            }

            if (convertSrgb) {
                try {
                    await convertToSrgb(action);
                } catch (profileError) {
                    // Some Photoshop/Profile setups reject convertToProfile in UXP; keep exporting like legacy fallback.
                }
            }

            const width = normalizeDimension(exportDocument.width);
            const height = normalizeDimension(exportDocument.height);
            if (!width || !height) {
                throw createError("Khong doc duoc kich thuoc document.", "INVALID_EXPORT_DIMENSIONS");
            }

            if (preset.width && preset.height) {
                await resizeDocument({
                    action,
                    width: preset.width,
                    height: preset.height,
                    interpolation: "bicubicSharper",
                    constrainProportions: false
                });
            } else {
                const currentLongEdge = Math.max(width, height);
                if (currentLongEdge > resolvedLongEdge) {
                    const ratio = resolvedLongEdge / currentLongEdge;
                    await resizeDocument({
                        action,
                        width: Math.max(1, Math.round(width * ratio)),
                        height: Math.max(1, Math.round(height * ratio)),
                        interpolation: "bicubicSharper"
                    });
                }
            }

            if (sharpen) {
                try {
                    await applyExportSharpen(action);
                } catch (sharpenError) {
                    // Export should still complete if sharpening is not supported in the current context.
                }
            }

            outputFile = await destinationFolder.createFile(outputName, {
                overwrite: Boolean(overwrite)
            });
            await exportDocument.saveAs.jpg(outputFile, {
                quality: resolvedQuality,
                embedColorProfile: true
            }, true);
        } finally {
            if (exportDocument) {
                try {
                    app.activeDocument = exportDocument;
                    await exportDocument.close(constants.SaveDialogOptions.DONOTSAVECHANGES);
                } catch (closeError) {
                    // Restore the source document even if cleanup fails.
                }
            }
            app.activeDocument = sourceDocument;
        }
    }, {
        commandName: "MEKO Export Facebook",
        timeOut: 10000
    });

    if (preset.width && preset.height) {
        return `Da xuat ${outputName} theo preset ${preset.width}x${preset.height}.`;
    }

    return `Da xuat ${outputName} voi canh dai toi da ${resolvedLongEdge}px.`;
};
