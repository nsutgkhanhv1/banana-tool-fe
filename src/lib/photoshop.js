const DEFAULT_RESULT_MIME_TYPE = "image/png";
const SUPPORTED_REFERENCE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const REFERENCE_ASSET_MIME_TYPE = "image/png";
const REFERENCE_ASSET_FOLDER = "reference-images";
const HISTORY_ASSET_FOLDER = "result-history";

const createError = (message, code) => {
    const error = new Error(message);
    error.code = code;
    return error;
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

const toArray = (value) => {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : Array.from(value);
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

    return "jpg";
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

    return "image/jpeg";
};

const readImageDimensions = (previewUrl) => new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
        resolve({
            width: image.naturalWidth,
            height: image.naturalHeight
        });
    };

    image.onerror = () => {
        reject(createError("Không thể đọc kích thước ảnh tham chiếu.", "INVALID_IMAGE_DIMENSIONS"));
    };

    image.src = previewUrl;
});

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
    const dimensions = await readImageDimensions(previewUrl);

    return {
        displayName: overrides.displayName || entry.name || "Reference Image",
        mimeType,
        fileSizeBytes,
        storagePath: overrides.storagePath || entry.nativePath || entry.name || "",
        width: overrides.width || dimensions.width,
        height: overrides.height || dimensions.height,
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
    const file = await storage.localFileSystem.getFileForOpening({
        types: ["png", "jpg", "jpeg", "webp"]
    });

    if (!file) {
        return null;
    }

    const binary = await file.read({ format: storage.formats.binary });
    const imageBase64 = arrayBufferToBase64(binary);
    const lowerName = file.name ? file.name.toLowerCase() : "";
    const mimeType = lowerName.endsWith(".png") ? "image/png" : lowerName.endsWith(".webp") ? "image/webp" : "image/jpeg";

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
    const normalizedMimeType = normalizeResultMimeType(getMimeTypeFromDataUrl(imageBase64, mimeType || DEFAULT_RESULT_MIME_TYPE));
    const fileName = buildManagedImageAssetName(fileNamePrefix, normalizedMimeType);
    const outputEntry = await createManagedImageAssetEntry({
        folderName,
        fileName
    });

    await outputEntry.write(base64ToUint8Array(getBase64Payload(imageBase64)), {
        format: storage.formats.binary
    });

    const imageAsset = await readReferenceImageFromEntry(outputEntry, {
        displayName: displayName || fileName,
        mimeType: normalizedMimeType,
        storagePath: outputEntry.nativePath || fileName
    });

    return {
        ...imageAsset,
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
        const exportDocument = await app.createDocument({
            width: normalizeDimension(sourceDocument.width) || 1,
            height: normalizeDimension(sourceDocument.height) || 1,
            resolution: sourceDocument.resolution || 72,
            fill: constants.DocumentFill.TRANSPARENT,
            mode: constants.NewDocumentMode.RGB,
            profile: "sRGB IEC61966-2.1"
        });

        try {
            if (mode === "visible_canvas") {
                await sourceDocument.duplicateLayers(visibleLayers, exportDocument);
                await exportDocument.mergeVisibleLayers();
            } else {
                await sourceDocument.duplicateLayers([activeLayer], exportDocument);
            }

            await exportDocument.saveAs.png(outputEntry, {
                compression: 6
            }, true);
        } catch (error) {
            throw createError("Photoshop export Lớp nhanh thất bại.", "QUICK_LAYER_EXPORT_FAILED");
        } finally {
            await exportDocument.close(constants.SaveDialogOptions.DONOTSAVECHANGES);
            app.activeDocument = sourceDocument;
        }
    }, {
        commandName: "Export Quick Layer Reference"
    });

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
        documentHeight: normalizeDimension(document.height)
    };
};

export const insertGeneratedImage = async ({ imageBase64, mimeType, context, layerNamePrefix }) => {
    const photoshop = getPhotoshopModule();
    const storage = getUxpStorage();
    const documents = toArray(photoshop.app && photoshop.app.documents);
    const targetDocument = documents.find((item) => Number(item.id) === Number(context.documentId));

    if (!targetDocument) {
        throw createError("Document gốc không còn tồn tại để chèn kết quả.", "INVALID_INSERT_CONTEXT");
    }

    const targetLayer = findLayerById(targetDocument.layers, context.layerId);
    if (!targetLayer) {
        throw createError("Layer gốc không còn tồn tại để chèn kết quả.", "INVALID_INSERT_CONTEXT");
    }

    const tempFolder = await storage.localFileSystem.getTemporaryFolder();
    const normalizedMimeType = normalizeResultMimeType(getMimeTypeFromDataUrl(imageBase64, mimeType || DEFAULT_RESULT_MIME_TYPE));
    const extension = getFileExtensionFromMimeType(normalizedMimeType);
    const tempFile = await tempFolder.createFile(`tu-do-ai-${Date.now()}.${extension}`, { overwrite: true });
    await tempFile.write(base64ToUint8Array(getBase64Payload(imageBase64)), { format: storage.formats.binary });
    const sessionToken = storage.localFileSystem.createSessionToken(tempFile);
    const layerName = `${layerNamePrefix || "AI Result"} - ${buildTimestamp()}`;

    const { action, core } = photoshop;
    let insertedLayerId = null;

    await core.executeAsModal(async () => {
        photoshop.app.activeDocument = targetDocument;

        await action.batchPlay(
            [
                {
                    _obj: "select",
                    _target: [
                        { _ref: "layer", _id: Number(context.layerId) },
                        { _ref: "document", _id: Number(context.documentId) }
                    ],
                    makeVisible: false,
                    layerID: [Number(context.layerId)],
                    _options: {
                        dialogOptions: "dontDisplay"
                    }
                }
            ],
            {
                synchronousExecution: true,
                modalBehavior: "fail"
            }
        );

        await action.batchPlay(
            [
                {
                    _obj: "placeEvent",
                    null: {
                        _path: sessionToken,
                        _kind: "local"
                    },
                    freeTransformCenterState: {
                        _enum: "quadCenterState",
                        _value: "QCSAverage"
                    },
                    offset: {
                        _obj: "offset",
                        horizontal: {
                            _unit: "pixelsUnit",
                            _value: 0
                        },
                        vertical: {
                            _unit: "pixelsUnit",
                            _value: 0
                        }
                    },
                    _options: {
                        dialogOptions: "dontDisplay"
                    }
                },
                {
                    _obj: "rasterizeLayer",
                    _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
                    _options: {
                        dialogOptions: "dontDisplay"
                    }
                }
            ],
            {
                synchronousExecution: true,
                modalBehavior: "fail"
            }
        );

        const insertedLayer = getActiveLayer(photoshop.app.activeDocument);
        if (!insertedLayer) {
            throw createError("Photoshop không trả về layer kết quả sau khi chèn.", "INSERT_FAILED");
        }

        insertedLayer.name = layerName;
        insertedLayerId = Number(insertedLayer.id);
    }, {
        commandName: "Insert AI Result"
    });

    return {
        insertedLayerId,
        insertedLayerName: layerName
    };
};
