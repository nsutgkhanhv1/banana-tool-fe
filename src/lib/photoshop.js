const DEFAULT_RESULT_MIME_TYPE = "image/png";
const SUPPORTED_REFERENCE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

    return `data:${mimeType};base64,${imageBase64}`;
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

export const importReferenceFromQuickLayer = async ({ mode }) => {
    const suffix = mode === "visible_canvas" ? "canvas đang hiển thị" : "layer hiện tại";
    throw createError(`Bridge Photoshop cho Lớp nhanh (${suffix}) chưa sẵn sàng trong pass này.`, "QUICK_LAYER_UNAVAILABLE");
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

export const insertGeneratedImage = async ({ imageBase64, context, layerNamePrefix }) => {
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
    const mimeType = getMimeTypeFromDataUrl(imageBase64, DEFAULT_RESULT_MIME_TYPE);
    const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
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
