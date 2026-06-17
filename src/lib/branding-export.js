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

export const addLogoToDocument = async ({
    logoFile,
    position = "bottomRight",
    sizePercent = 18,
    marginPercent = 3,
    opacity = 100
} = {}) => {
    if (!logoFile || !logoFile.isFile) {
        throw createError("Hay chon file logo.", "MISSING_LOGO_FILE");
    }

    const photoshop = getPhotoshop();
    const { app, core, constants } = photoshop;
    const targetDocument = app.activeDocument;

    if (!targetDocument) {
        throw createError("Hay mo document can chen logo.", "NO_ACTIVE_DOCUMENT");
    }

    const resolvedPosition = ["topLeft", "topRight", "bottomLeft", "bottomRight", "center"].includes(position)
        ? position
        : "bottomRight";
    const resolvedSize = clampNumber(sizePercent, 18, 1, 100);
    const resolvedMargin = clampNumber(marginPercent, 3, 0, 25);
    const resolvedOpacity = clampNumber(opacity, 100, 1, 100);
    let insertedLayerName = "MEKO Logo";

    await core.executeAsModal(async () => {
        let logoDocument = null;

        try {
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
            const documentWidth = normalizeDimension(targetDocument.width);
            const documentHeight = normalizeDimension(targetDocument.height);
            let bounds = normalizeBounds(logoLayer.boundsNoEffects || logoLayer.bounds);

            if (!documentWidth || !documentHeight || !bounds || bounds.width <= 0 || bounds.height <= 0) {
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

const resizeDocument = async ({ action, width, height }) => {
    const results = await action.batchPlay([{
        _obj: "imageSize",
        width: { _unit: "pixelsUnit", _value: width },
        height: { _unit: "pixelsUnit", _value: height },
        scaleStyles: true,
        constrainProportions: true,
        interpolation: {
            _enum: "interpolationType",
            _value: "bicubicAutomatic"
        },
        _options: { dialogOptions: "dontDisplay" }
    }], {
        synchronousExecution: false,
        modalBehavior: "execute"
    });
    const failed = results && results.find((result) => result && result._obj === "error");
    if (failed) {
        throw createError(failed.message || "Khong resize duoc anh.", "FACEBOOK_RESIZE_FAILED");
    }
};

export const exportFacebookImage = async ({
    destinationFolder,
    longEdge = "2048",
    quality = 10,
    overwrite = false
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

    const resolvedLongEdge = Math.round(clampNumber(longEdge, 2048, 640, 8192));
    const resolvedQuality = Math.round(clampNumber(quality, 10, 1, 12));
    const outputName = `${sanitizeFileName(sourceDocument.title || sourceDocument.name)}_facebook.jpg`;
    let outputFile = null;

    await core.executeAsModal(async () => {
        let exportDocument = null;

        try {
            exportDocument = await sourceDocument.duplicate(`${sanitizeFileName(sourceDocument.title)} Facebook Export`);
            app.activeDocument = exportDocument;

            const width = normalizeDimension(exportDocument.width);
            const height = normalizeDimension(exportDocument.height);
            if (!width || !height) {
                throw createError("Khong doc duoc kich thuoc document.", "INVALID_EXPORT_DIMENSIONS");
            }

            const currentLongEdge = Math.max(width, height);
            if (currentLongEdge > resolvedLongEdge) {
                const ratio = resolvedLongEdge / currentLongEdge;
                await resizeDocument({
                    action,
                    width: Math.max(1, Math.round(width * ratio)),
                    height: Math.max(1, Math.round(height * ratio))
                });
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

    return `Da xuat ${outputName} voi canh dai toi da ${resolvedLongEdge}px.`;
};
