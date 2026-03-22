const DEFAULT_RESULT_MIME_TYPE = "image/png";
const SUPPORTED_REFERENCE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const SUPPORTED_INSERT_MIME_TYPES = ["image/jpeg", "image/png"];
const REFERENCE_ASSET_MIME_TYPE = "image/png";
const REFERENCE_ASSET_FOLDER = "reference-images";
const HISTORY_ASSET_FOLDER = "result-history";

const createError = (message, code) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const appendErrorDetail = (message, error) => {
    const detail = error && error.message ? ` Chi tiết: ${error.message}` : "";
    return `${message}${detail}`.trim();
};

const extractBatchPlayErrorMessage = (result) => {
    const messages = toArray(result)
        .map((item) => {
            if (!item || typeof item !== "object") {
                return "";
            }

            if (item._obj !== "error") {
                return "";
            }

            return item.message || item._message || item.result || item.number || "";
        })
        .filter(Boolean)
        .map((value) => String(value).trim());

    return messages.length > 0 ? messages.join(" | ") : "";
};

const runBatchPlayOrThrow = async ({ action, commands, options, errorMessage, errorCode }) => {
    try {
        const result = await action.batchPlay(commands, options);
        const detail = extractBatchPlayErrorMessage(result);

        if (detail) {
            throw createError(appendErrorDetail(errorMessage, { message: detail }), errorCode);
        }

        return result;
    } catch (error) {
        throw createError(appendErrorDetail(errorMessage, error), errorCode);
    }
};

const getPhotoshopModule = () => {
    try {
        return require("photoshop");
    } catch (error) {
        throw createError("Không thể kết nối Photoshop bridge.", "PHOTOSHOP_UNAVAILABLE");
    }
};

export const getUxpStorage = () => {
    try {
        return require("uxp").storage;
    } catch (error) {
        throw createError("Không thể truy cập storage của UXP.", "UXP_STORAGE_UNAVAILABLE");
    }
};

const ensureFolder = async (parentFolder, folderName) => {
    const entries = await parentFolder.getEntries();
    const existingFolder = entries.find((entry) => entry && entry.isFolder && entry.name === folderName);

    if (existingFolder) {
        return existingFolder;
    }

    return parentFolder.createFolder(folderName);
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
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top)
    };
};

const toArray = (value) => {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : Array.from(value);
};

const normalizeFileSelection = (value) => {
    if (!value) {
        return null;
    }

    if (Array.isArray(value)) {
        return value[0] || null;
    }

    return value;
};

const getActiveLayer = (document) => {
    const activeLayers = toArray(document && document.activeLayers);
    return activeLayers[0] || document.activeLayer || null;
};

const findLayerById = (layers, layerId) => {
    for (const layer of toArray(layers)) {
        if (Number(layer.id) === Number(layerId)) {
            return layer;
        }

        const nested = findLayerById(layer.layers, layerId);
        if (nested) {
            return nested;
        }
    }

    return null;
};

const arrayBufferToBase64 = (buffer) => {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = "";

    for (let index = 0; index < bytes.length; index += 0x8000) {
        const chunk = bytes.subarray(index, index + 0x8000);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
    }

    return btoa(binary);
};

const base64ToUint8Array = (value) => {
    const normalized = value.includes(",") ? value.split(",").pop() : value;
    const binary = atob(normalized || "");
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
};

const getMimeTypeFromDataUrl = (value, fallbackMimeType) => {
    if (!value.startsWith("data:")) {
        return fallbackMimeType;
    }

    const mimeType = value.slice(5, value.indexOf(";"));
    return mimeType || fallbackMimeType;
};

const normalizeResultMimeType = (mimeType) => {
    if (!mimeType) {
        return DEFAULT_RESULT_MIME_TYPE;
    }

    if (SUPPORTED_REFERENCE_MIME_TYPES.includes(mimeType)) {
        return mimeType;
    }

    return DEFAULT_RESULT_MIME_TYPE;
};

const getFileExtensionFromMimeType = (mimeType) => {
    if (mimeType === "image/png") {
        return "png";
    }

    if (mimeType === "image/webp") {
        return "webp";
    }

    if (mimeType === "image/avif") {
        return "avif";
    }

    return "jpg";
};

const sanitizeFileNameSegment = (value, fallback = "asset") => {
    const normalized = String(value || "")
        .trim()
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    return normalized || fallback;
};

const buildTempInsertFileName = (fileName, mimeType) => {
    const extension = getFileExtensionFromMimeType(mimeType);
    const normalizedBaseName = sanitizeFileNameSegment(fileName, "ai-result");

    return `${normalizedBaseName}.${extension}`;
};

const buildUniqueAssetSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildReferenceAssetName = (prefix) => `${prefix}-${buildUniqueAssetSuffix()}.${getFileExtensionFromMimeType(REFERENCE_ASSET_MIME_TYPE)}`;
const buildManagedImageAssetName = (prefix, mimeType) => `${prefix}-${buildUniqueAssetSuffix()}.${getFileExtensionFromMimeType(mimeType)}`;

const getQuickLayerDisplayName = (mode) => {
    if (mode === "visible_canvas") {
        return `Visible Canvas ${buildTimestamp()}`;
    }

    return `Current Layer ${buildTimestamp()}`;
};

const getBase64Payload = (value) => (value.startsWith("data:") ? value.split(",").pop() || "" : value);

const buildTimestamp = () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");

    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

export const buildImagePreviewUrl = (imageBase64, mimeType = DEFAULT_RESULT_MIME_TYPE) => {
    if (!imageBase64) {
        return "";
    }

    if (imageBase64.startsWith("data:")) {
        return imageBase64;
    }

    return `data:${normalizeResultMimeType(mimeType)};base64,${imageBase64}`;
};

const guessMimeTypeFromName = (name) => {
    const lowerName = name ? name.toLowerCase() : "";

    if (lowerName.endsWith(".png")) {
        return "image/png";
    }

    if (lowerName.endsWith(".webp")) {
        return "image/webp";
    }

    if (lowerName.endsWith(".avif")) {
        return "image/avif";
    }

    return "image/jpeg";
};

const readImageDimensions = (previewUrl, timeoutMs = 1200) => new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;

    const finish = (dimensions) => {
        if (settled) {
            return;
        }

        settled = true;
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        resolve(dimensions);
    };

    const image = typeof document !== "undefined" && typeof document.createElement === "function"
        ? document.createElement("img")
        : new Image();
    const reject = () => {
        finish({
            width: null,
            height: null
        });
    };

    image.onload = () => {
        finish({
            width: image.naturalWidth || null,
            height: image.naturalHeight || null
        });
    };

    image.onerror = () => {
        reject(createError("Không thể đọc kích thước ảnh tham chiếu.", "INVALID_IMAGE_DIMENSIONS"));
    };

    timeoutId = setTimeout(() => {
        finish({
            width: null,
            height: null
        });
    }, timeoutMs);

    image.src = previewUrl;
});

const loadImageElement = (previewUrl) => new Promise((resolve, reject) => {
    if (!previewUrl) {
        reject(createError("Khong co du lieu anh de xu ly.", "INVALID_RESULT_IMAGE"));
        return;
    }

    if (typeof document === "undefined" || typeof document.createElement !== "function") {
        reject(createError("Moi truong hien tai khong ho tro chuan hoa anh ket qua.", "IMAGE_TRANSCODE_UNAVAILABLE"));
        return;
    }

    const image = document.createElement("img");
    image.onload = () => resolve(image);
    image.onerror = () => reject(createError("Khong the doc du lieu anh ket qua de chuan hoa.", "IMAGE_TRANSCODE_FAILED"));
    image.src = previewUrl;
});

const convertResultImageToPngDataUrl = async (imageBase64, mimeType) => {
    const previewUrl = buildImagePreviewUrl(imageBase64, mimeType || DEFAULT_RESULT_MIME_TYPE);
    const image = await loadImageElement(previewUrl);
    const width = image.naturalWidth || image.width || 0;
    const height = image.naturalHeight || image.height || 0;

    if (!width || !height) {
        throw createError("Khong the xac dinh kich thuoc anh ket qua de chuan hoa.", "IMAGE_TRANSCODE_FAILED");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
        throw createError("Khong the tao canvas de chuan hoa anh ket qua.", "IMAGE_TRANSCODE_UNAVAILABLE");
    }

    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL(DEFAULT_RESULT_MIME_TYPE);
};

const prepareResultImageAsset = async ({ imageBase64, mimeType }) => {
    const resolvedMimeType = normalizeResultMimeType(
        getMimeTypeFromDataUrl(imageBase64, mimeType || DEFAULT_RESULT_MIME_TYPE)
    );

    if (SUPPORTED_INSERT_MIME_TYPES.includes(resolvedMimeType)) {
        return {
            imageBase64: getBase64Payload(imageBase64),
            mimeType: resolvedMimeType
        };
    }

    const normalizedDataUrl = await convertResultImageToPngDataUrl(imageBase64, resolvedMimeType);

    return {
        imageBase64: getBase64Payload(normalizedDataUrl),
        mimeType: DEFAULT_RESULT_MIME_TYPE
    };
};

export const createPersistentTokenForEntry = async (entry) => {
    const storage = getUxpStorage();
    return storage.localFileSystem.createPersistentToken(entry);
};

export const getEntryFromPersistentToken = async (persistentToken) => {
    const storage = getUxpStorage();
    return storage.localFileSystem.getEntryForPersistentToken(persistentToken);
};

export const readReferenceImageFromEntry = async (entry, overrides = {}) => {
    const storage = getUxpStorage();
    const binary = await entry.read({ format: storage.formats.binary });
    const fileSizeBytes = binary.byteLength ?? binary.length ?? 0;
    const mimeType = overrides.mimeType || guessMimeTypeFromName(overrides.displayName || entry.name || "");
    const imageBase64 = arrayBufferToBase64(binary);
    const previewUrl = buildImagePreviewUrl(imageBase64, mimeType);
    const dimensions = (typeof overrides.width === "number" && typeof overrides.height === "number")
        ? {
            width: overrides.width,
            height: overrides.height
        }
        : await readImageDimensions(previewUrl);

    return {
        displayName: overrides.displayName || entry.name || "Reference Image",
        mimeType,
        fileSizeBytes,
        storagePath: overrides.storagePath || entry.nativePath || entry.name || "",
        width: overrides.width ?? dimensions.width,
        height: overrides.height ?? dimensions.height,
        imageBase64,
        previewUrl
    };
};

export const createManagedReferenceAssetEntry = async (fileName) => {
    const storage = getUxpStorage();
    const dataFolder = await storage.localFileSystem.getDataFolder();
    const assetsFolder = await ensureFolder(dataFolder, REFERENCE_ASSET_FOLDER);

    return assetsFolder.createFile(fileName, { overwrite: true });
};

const createManagedImageAssetEntry = async ({ folderName, fileName }) => {
    const storage = getUxpStorage();
    const dataFolder = await storage.localFileSystem.getDataFolder();
    const assetsFolder = await ensureFolder(dataFolder, folderName);

    return assetsFolder.createFile(fileName, { overwrite: true });
};

const blobToUint8Array = async (blob) => {
    if (blob && typeof blob.arrayBuffer === "function") {
        return new Uint8Array(await blob.arrayBuffer());
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(new Uint8Array(reader.result));
        };
        reader.onerror = () => {
            reject(createError("Không thể đọc dữ liệu clipboard.", "CLIPBOARD_READ_FAILED"));
        };
        reader.readAsArrayBuffer(blob);
    });
};

export const pickReferenceImageFromDisk = async () => {
    const storage = getUxpStorage();
    const file = normalizeFileSelection(await storage.localFileSystem.getFileForOpening({
        types: ["png", "jpg", "jpeg", "webp", "avif"]
    }));

    if (!file) {
        return null;
    }

    const binary = await file.read({ format: storage.formats.binary });
    const imageBase64 = arrayBufferToBase64(binary);
    const lowerName = file.name ? file.name.toLowerCase() : "";
    const mimeType = lowerName.endsWith(".png")
        ? "image/png"
        : lowerName.endsWith(".webp")
            ? "image/webp"
            : lowerName.endsWith(".avif")
                ? "image/avif"
                : "image/jpeg";

    return {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        source: "file",
        name: file.name,
        mimeType,
        imageBase64,
        previewUrl: buildImagePreviewUrl(imageBase64, mimeType)
    };
};

export const getSupportedReferenceMimeTypes = () => SUPPORTED_REFERENCE_MIME_TYPES.slice();

export const importReferenceFromClipboard = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard || typeof navigator.clipboard.read !== "function") {
        throw createError("Clipboard image chưa được hỗ trợ trong môi trường hiện tại.", "CLIPBOARD_UNAVAILABLE");
    }

    const clipboardItems = await navigator.clipboard.read();
    if (!Array.isArray(clipboardItems) || clipboardItems.length === 0) {
        throw createError("Clipboard hiện không có dữ liệu ảnh hợp lệ.", "CLIPBOARD_EMPTY");
    }

    for (const item of clipboardItems) {
        const imageType = (item.types || []).find((type) => SUPPORTED_REFERENCE_MIME_TYPES.includes(type));
        if (!imageType) {
            continue;
        }

        const blob = await item.getType(imageType);
        const bytes = await blobToUint8Array(blob);
        const outputEntry = await createManagedReferenceAssetEntry(
            `clipboard-${buildUniqueAssetSuffix()}.${getFileExtensionFromMimeType(imageType)}`
        );
        const storage = getUxpStorage();
        await outputEntry.write(bytes, { format: storage.formats.binary });

        return {
            entry: outputEntry,
            displayName: `Clipboard ${buildTimestamp()}`,
            mimeType: imageType
        };
    }

    throw createError("Clipboard hiện không có dữ liệu ảnh hợp lệ.", "CLIPBOARD_NO_IMAGE");
};

export const writeManagedImageAsset = async ({
    imageBase64,
    mimeType,
    displayName,
    folderName = HISTORY_ASSET_FOLDER,
    fileNamePrefix = "history-result"
}) => {
    const storage = getUxpStorage();
    const preparedAsset = await prepareResultImageAsset({ imageBase64, mimeType });
    const fileName = buildManagedImageAssetName(fileNamePrefix, preparedAsset.mimeType);
    const outputEntry = await createManagedImageAssetEntry({
        folderName,
        fileName
    });

    await outputEntry.write(base64ToUint8Array(preparedAsset.imageBase64), {
        format: storage.formats.binary
    });

    const imageAsset = await readReferenceImageFromEntry(outputEntry, {
        displayName: displayName || fileName,
        mimeType: preparedAsset.mimeType,
        storagePath: outputEntry.nativePath || fileName
    });

    return {
        ...imageAsset,
        fileName,
        persistentToken: await createPersistentTokenForEntry(outputEntry)
    };
};

export const importReferenceFromQuickLayer = async ({ mode }) => {
    const photoshop = getPhotoshopModule();
    const { app, core, constants } = photoshop;
    const sourceDocument = app && app.activeDocument;

    if (!sourceDocument) {
        throw createError("Chưa mở document Photoshop.", "NO_ACTIVE_DOCUMENT");
    }

    const activeLayer = getActiveLayer(sourceDocument);
    if (mode === "current_layer" && !activeLayer) {
        throw createError("Không có layer đang chọn để lấy Lớp nhanh.", "NO_ACTIVE_LAYER");
    }

    const visibleLayers = toArray(sourceDocument.layers).filter((layer) => layer.visible !== false);
    if (mode === "visible_canvas" && visibleLayers.length === 0) {
        throw createError("Không có layer hiển thị nào để xuất canvas.", "NO_VISIBLE_LAYERS");
    }

    const outputEntry = await createManagedReferenceAssetEntry(
        buildReferenceAssetName(mode === "visible_canvas" ? "visible-canvas" : "current-layer")
    );
    await core.executeAsModal(async () => {
        let exportDocument = null;
        const exportViaTemporaryDocument = async () => {
            exportDocument = await app.createDocument({
                width: normalizeDimension(sourceDocument.width) || 1,
                height: normalizeDimension(sourceDocument.height) || 1,
                resolution: sourceDocument.resolution || 72,
                fill: constants.DocumentFill.TRANSPARENT,
                mode: constants.NewDocumentMode.RGB,
                profile: "sRGB IEC61966-2.1"
            });

            if (mode === "visible_canvas") {
                await sourceDocument.duplicateLayers(visibleLayers, exportDocument);
                await exportDocument.mergeVisibleLayers();
            } else {
                await sourceDocument.duplicateLayers([activeLayer], exportDocument);
            }

            await exportDocument.saveAs.png(outputEntry, {
                compression: 6
            }, true);
        };

        try {
            await exportViaTemporaryDocument();
        } catch (error) {
            const detail = error && error.message ? ` ${error.message}` : "";
            throw createError(`Photoshop export Lớp nhanh thất bại.${detail}`.trim(), "QUICK_LAYER_EXPORT_FAILED");
        } finally {
            if (exportDocument) {
                try {
                    app.activeDocument = exportDocument;
                    await exportDocument.close(constants.SaveDialogOptions.DONOTSAVECHANGES);
                } catch (closeError) {
                    // Ignore cleanup errors so we can still restore focus to the source document.
                }
            }
            app.activeDocument = sourceDocument;
        }
    }, {
        commandName: "Export Quick Layer Reference"
    });

    const storage = getUxpStorage();
    const exportedBinary = await outputEntry.read({ format: storage.formats.binary });
    const exportedSize = exportedBinary.byteLength ?? exportedBinary.length ?? 0;
    if (!exportedSize) {
        throw createError("Photoshop khong xuat duoc du lieu anh tu layer hien tai.", "QUICK_LAYER_EXPORT_EMPTY");
    }

    return {
        entry: outputEntry,
        displayName: getQuickLayerDisplayName(mode)
    };
};

export const capturePhotoshopContext = async () => {
    const photoshop = getPhotoshopModule();
    const document = photoshop.app && photoshop.app.activeDocument;

    if (!document) {
        throw createError("Không có document Photoshop đang mở.", "NO_ACTIVE_DOCUMENT");
    }

    const layer = getActiveLayer(document);
    if (!layer) {
        throw createError("Không có layer nào đang được chọn.", "NO_ACTIVE_LAYER");
    }

    return {
        documentId: Number(document.id),
        layerId: Number(layer.id),
        documentName: document.title || document.name || "",
        layerName: layer.name || "",
        documentWidth: normalizeDimension(document.width),
        documentHeight: normalizeDimension(document.height),
        capturedAt: Date.now()
    };
};

export const capturePhotoshopDocumentContext = async () => {
    const photoshop = getPhotoshopModule();
    const document = photoshop.app && photoshop.app.activeDocument;

    if (!document) {
        throw createError("Không có document Photoshop đang mở.", "NO_ACTIVE_DOCUMENT");
    }

    const layer = getActiveLayer(document);

    return {
        documentId: Number(document.id),
        layerId: layer ? Number(layer.id) : null,
        documentName: document.title || document.name || "",
        layerName: layer && layer.name ? layer.name : "",
        documentWidth: normalizeDimension(document.width),
        documentHeight: normalizeDimension(document.height),
        capturedAt: Date.now()
    };
};

export const insertGeneratedImage = async ({ imageBase64, mimeType, context, layerNamePrefix, fileName }) => {
    const base64Payload = getBase64Payload(imageBase64 || "");

    if (!base64Payload) {
        throw createError("Kh?ng c? ?nh k?t qu? h?p l? ?? ch?n v?o Photoshop.", "INVALID_RESULT_IMAGE");
    }

    if (!context || typeof context.documentId === "undefined" || context.documentId === null) {
        throw createError("Thi?u Photoshop context ?? ch?n k?t qu?.", "INVALID_INSERT_CONTEXT");
    }

    const photoshop = getPhotoshopModule();
    const storage = getUxpStorage();
    const preparedAsset = await prepareResultImageAsset({ imageBase64, mimeType });
    const documents = toArray(photoshop.app && photoshop.app.documents);
    const targetDocument = documents.find((item) => Number(item.id) === Number(context.documentId));
    const hasTargetLayer = typeof context.layerId !== "undefined" && context.layerId !== null;

    if (!targetDocument) {
        const documentLabel = context.documentName ? `Document "${context.documentName}"` : "Document g?c";
        throw createError(`${documentLabel} kh?ng c?n t?n t?i ?? ch?n k?t qu?.`, "INVALID_INSERT_CONTEXT");
    }

    const targetLayer = hasTargetLayer ? findLayerById(targetDocument.layers, context.layerId) : null;
    if (hasTargetLayer && !targetLayer) {
        const layerLabel = context.layerName ? `Layer "${context.layerName}"` : "Layer g?c";
        throw createError(`${layerLabel} kh?ng c?n t?n t?i ?? ch?n k?t qu?.`, "INVALID_INSERT_CONTEXT");
    }

    const tempFolder = await storage.localFileSystem.getTemporaryFolder();
    let tempFile = null;

    try {
        tempFile = await tempFolder.createFile(
            buildTempInsertFileName(fileName || `${layerNamePrefix || "ai-result"}-${buildUniqueAssetSuffix()}`, preparedAsset.mimeType),
            { overwrite: true }
        );
        await tempFile.write(base64ToUint8Array(preparedAsset.imageBase64), { format: storage.formats.binary });
    } catch (error) {
        throw createError("Kh?ng th? chu?n b? file t?m ?? ch?n k?t qu? v?o Photoshop.", "INSERT_FILE_PREP_FAILED");
    }

    const layerName = `${layerNamePrefix || "AI Result"} - ${buildTimestamp()}`;

    const { app, core, constants } = photoshop;
    let insertedLayerId = null;
    let insertedLayerName = "";

    await core.executeAsModal(async () => {
        app.activeDocument = targetDocument;
        let openedDocument = null;
        try {
            openedDocument = await app.open(tempFile);

            const sourceLayers = toArray(openedDocument.layers);
            const sourceLayer = getActiveLayer(openedDocument) || sourceLayers[0] || null;
            if (!sourceLayer) {
                throw createError("Photoshop khong mo duoc layer tam de chen ket qua.", "INSERT_FAILED");
            }

            const duplicatedLayers = await openedDocument.duplicateLayers([sourceLayer], targetDocument);
            const insertedLayer = toArray(duplicatedLayers)[0] || null;

            if (!insertedLayer) {
                throw createError("Photoshop khong tao duoc layer moi trong document hien tai.", "INSERT_FAILED");
            }

            insertedLayerId = Number(insertedLayer.id);

            const targetWidth = normalizeDimension(targetDocument.width) || context.documentWidth || 0;
            const targetHeight = normalizeDimension(targetDocument.height) || context.documentHeight || 0;
            let insertedBounds = normalizeBounds(insertedLayer.boundsNoEffects || insertedLayer.bounds);

            if (insertedBounds && insertedBounds.width > 0 && insertedBounds.height > 0 && targetWidth > 0 && targetHeight > 0) {
                const scaleRatio = Math.min(targetWidth / insertedBounds.width, targetHeight / insertedBounds.height);

                if (Number.isFinite(scaleRatio) && scaleRatio > 0) {
                    const scalePercent = scaleRatio * 100;

                    if (Math.abs(scalePercent - 100) > 0.1) {
                        await insertedLayer.scale(scalePercent, scalePercent);
                        insertedBounds = normalizeBounds(insertedLayer.boundsNoEffects || insertedLayer.bounds);
                    }

                    if (insertedBounds && insertedBounds.width > 0 && insertedBounds.height > 0) {
                        const deltaX = ((targetWidth - insertedBounds.width) / 2) - insertedBounds.left;
                        const deltaY = ((targetHeight - insertedBounds.height) / 2) - insertedBounds.top;

                        if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
                            await insertedLayer.translate(deltaX, deltaY);
                        }
                    }
                }
            }

            try {
                insertedLayer.name = layerName;
                insertedLayerName = layerName;
            } catch (renameError) {
                insertedLayerName = insertedLayer.name || "";
            }
        } finally {
            if (openedDocument) {
                try {
                    app.activeDocument = openedDocument;
                    await openedDocument.close(constants.SaveDialogOptions.DONOTSAVECHANGES);
                } catch (closeError) {
                    // Ignore cleanup errors so a successful insert still succeeds.
                }
            }

            app.activeDocument = targetDocument;
        }
    }, {
        commandName: "Insert AI Result",
        timeOut: 3000
    });

    return {
        insertedLayerId,
        insertedLayerName
    };
};
