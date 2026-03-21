import { useCallback, useEffect, useMemo, useState } from "react";

import {
    createPersistentTokenForEntry,
    getEntryFromPersistentToken,
    getSupportedReferenceMimeTypes,
    getUxpStorage,
    importReferenceFromClipboard,
    importReferenceFromQuickLayer,
    readReferenceImageFromEntry
} from "./photoshop.js";

const STORAGE_KEY_PREFIX = "banana-tool.reference-images.v1";
const DEFAULT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export const QUICK_LAYER_MODES = {
    CURRENT_LAYER: "current_layer",
    VISIBLE_CANVAS: "visible_canvas"
};

const buildStorageKey = (toolKey) => `${STORAGE_KEY_PREFIX}.${toolKey}`;

const getBrowserStorage = () => {
    if (typeof window === "undefined" || !window.localStorage) {
        return null;
    }

    return window.localStorage;
};

const createReferenceImageError = (message, code) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const serializeReferenceState = (items, activeImageId) => ({
    version: 1,
    updatedAt: Date.now(),
    activeImageId,
    items: items.map((item) => ({
        id: item.id,
        toolKey: item.toolKey,
        sourceType: item.sourceType,
        displayName: item.displayName,
        mimeType: item.mimeType,
        fileSizeBytes: item.fileSizeBytes,
        storagePath: item.storagePath,
        width: item.width,
        height: item.height,
        createdAt: item.createdAt,
        lastUsedAt: item.lastUsedAt,
        persistentToken: item.persistentToken
    }))
});

const readPersistedReferenceState = (toolKey) => {
    const storage = getBrowserStorage();
    if (!storage) {
        return null;
    }

    const rawValue = storage.getItem(buildStorageKey(toolKey));
    if (!rawValue) {
        return null;
    }

    try {
        return JSON.parse(rawValue);
    } catch (error) {
        return null;
    }
};

const writePersistedReferenceState = (toolKey, items, activeImageId) => {
    const storage = getBrowserStorage();
    if (!storage) {
        return;
    }

    if (!items.length) {
        storage.removeItem(buildStorageKey(toolKey));
        return;
    }

    storage.setItem(buildStorageKey(toolKey), JSON.stringify(serializeReferenceState(items, activeImageId)));
};

const ensureSupportedMimeType = (mimeType) => {
    const allowedMimeTypes = getSupportedReferenceMimeTypes();

    if (!allowedMimeTypes.includes(mimeType)) {
        throw createReferenceImageError("File không đúng định dạng hỗ trợ.", "REFERENCE_UNSUPPORTED_MIME");
    }
};

const ensureFileSizeLimit = (fileSizeBytes, maxFileSizeBytes) => {
    if (fileSizeBytes > maxFileSizeBytes) {
        throw createReferenceImageError("File vượt quá dung lượng cho phép.", "REFERENCE_FILE_TOO_LARGE");
    }
};

const createReferenceImageItem = async ({
    toolKey,
    sourceType,
    entry,
    displayName,
    persistentToken,
    createdAt,
    lastUsedAt,
    id,
    storagePath,
    mimeType,
    width,
    height,
    maxFileSizeBytes
}) => {
    const imageAsset = await readReferenceImageFromEntry(entry, {
        displayName,
        storagePath,
        mimeType,
        width,
        height
    });

    ensureSupportedMimeType(imageAsset.mimeType);
    ensureFileSizeLimit(imageAsset.fileSizeBytes, maxFileSizeBytes);

    return {
        id: id || `${toolKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        toolKey,
        sourceType,
        displayName: imageAsset.displayName,
        mimeType: imageAsset.mimeType,
        fileSizeBytes: imageAsset.fileSizeBytes,
        storagePath: imageAsset.storagePath,
        width: imageAsset.width,
        height: imageAsset.height,
        createdAt: createdAt || Date.now(),
        lastUsedAt: lastUsedAt || Date.now(),
        persistentToken: persistentToken || await createPersistentTokenForEntry(entry),
        imageBase64: imageAsset.imageBase64,
        previewUrl: imageAsset.previewUrl
    };
};

const resolveRestoredActiveImageId = (items, persistedActiveImageId) => {
    if (!items.length) {
        return null;
    }

    if (persistedActiveImageId && items.some((item) => item.id === persistedActiveImageId)) {
        return persistedActiveImageId;
    }

    return items[0].id;
};

const restoreReferenceItemsFromSnapshots = async ({
    toolKey,
    snapshots,
    maxItems,
    maxFileSizeBytes
}) => {
    const restoredItems = [];
    let missingCount = 0;

    for (const item of (snapshots || []).slice(0, maxItems)) {
        try {
            const entry = await getEntryFromPersistentToken(item.persistentToken);
            const restoredItem = await createReferenceImageItem({
                toolKey,
                sourceType: item.sourceType,
                entry,
                displayName: item.displayName,
                persistentToken: item.persistentToken,
                createdAt: item.createdAt,
                lastUsedAt: item.lastUsedAt,
                id: item.id,
                storagePath: item.storagePath,
                mimeType: item.mimeType,
                width: item.width,
                height: item.height,
                maxFileSizeBytes
            });
            restoredItems.push(restoredItem);
        } catch (error) {
            missingCount += 1;
        }
    }

    return {
        items: restoredItems,
        missingCount
    };
};

export const useReferenceImages = ({ toolKey, maxItems, maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES }) => {
    const [items, setItems] = useState([]);
    const [activeImageId, setActiveImageId] = useState(null);
    const [restoreStatus, setRestoreStatus] = useState("restoring");
    const [restoreNotice, setRestoreNotice] = useState("");

    useEffect(() => {
        let cancelled = false;

        const restore = async () => {
            setRestoreStatus("restoring");
            setRestoreNotice("");

            const persistedState = readPersistedReferenceState(toolKey);
            if (!persistedState || !Array.isArray(persistedState.items) || !persistedState.items.length) {
                if (!cancelled) {
                    setItems([]);
                    setActiveImageId(null);
                    setRestoreStatus("ready");
                }
                return;
            }

            const restored = await restoreReferenceItemsFromSnapshots({
                toolKey,
                snapshots: persistedState.items,
                maxItems,
                maxFileSizeBytes
            });

            if (cancelled) {
                return;
            }

            const nextActiveImageId = resolveRestoredActiveImageId(restored.items, persistedState.activeImageId);
            setItems(restored.items);
            setActiveImageId(nextActiveImageId);
            setRestoreStatus("ready");

            if (restored.missingCount > 0) {
                setRestoreNotice("Một số ảnh tham chiếu cũ không còn khả dụng và đã bị bỏ qua.");
            }
        };

        restore();

        return () => {
            cancelled = true;
        };
    }, [maxFileSizeBytes, maxItems, toolKey]);

    useEffect(() => {
        if (restoreStatus === "restoring") {
            return;
        }

        writePersistedReferenceState(toolKey, items, activeImageId);
    }, [activeImageId, items, restoreStatus, toolKey]);

    const activeImageIndex = useMemo(() => {
        if (!items.length || !activeImageId) {
            return -1;
        }

        return items.findIndex((item) => item.id === activeImageId);
    }, [activeImageId, items]);

    const canAddMore = items.length < maxItems;

    const addEntry = useCallback(async ({ entry, sourceType, displayName }) => {
        if (items.length >= maxItems) {
            throw createReferenceImageError("Đã đạt giới hạn số lượng ảnh tham chiếu.", "REFERENCE_LIMIT_REACHED");
        }

        const nextItem = await createReferenceImageItem({
            toolKey,
            sourceType,
            entry,
            displayName,
            maxFileSizeBytes
        });

        setItems((currentItems) => [...currentItems, nextItem]);
        setActiveImageId(nextItem.id);
        setRestoreNotice("");

        return nextItem;
    }, [items.length, maxFileSizeBytes, maxItems, toolKey]);

    const addFromFileEntry = useCallback(async () => {
        const storage = getUxpStorage();
        const uxpFile = await storage.localFileSystem.getFileForOpening({
            types: ["png", "jpg", "jpeg", "webp", "avif"]
        });

        if (!uxpFile) {
            return null;
        }

        return addEntry({
            entry: uxpFile,
            sourceType: "file_picker",
            displayName: uxpFile.name
        });
    }, [addEntry]);

    const addFromQuickLayer = useCallback(async (mode) => {
        if (items.length >= maxItems) {
            throw createReferenceImageError("Đã đạt giới hạn số lượng ảnh tham chiếu.", "REFERENCE_LIMIT_REACHED");
        }

        const referenceExport = await importReferenceFromQuickLayer({ mode });

        return addEntry({
            entry: referenceExport.entry,
            sourceType: mode === QUICK_LAYER_MODES.VISIBLE_CANVAS ? "quick_layer_canvas" : "quick_layer_current",
            displayName: referenceExport.displayName
        });
    }, [addEntry, items.length, maxItems]);

    const addFromClipboard = useCallback(async () => {
        if (items.length >= maxItems) {
            throw createReferenceImageError("Đã đạt giới hạn số lượng ảnh tham chiếu.", "REFERENCE_LIMIT_REACHED");
        }

        const clipboardAsset = await importReferenceFromClipboard();

        return addEntry({
            entry: clipboardAsset.entry,
            sourceType: "clipboard",
            displayName: clipboardAsset.displayName
        });
    }, [addEntry, items.length, maxItems]);

    const removeImage = useCallback((imageId) => {
        setItems((currentItems) => {
            const removedIndex = currentItems.findIndex((item) => item.id === imageId);
            if (removedIndex === -1) {
                return currentItems;
            }

            const nextItems = currentItems.filter((item) => item.id !== imageId);

            setActiveImageId((currentActiveImageId) => {
                if (!nextItems.length) {
                    return null;
                }

                if (currentActiveImageId !== imageId) {
                    return currentActiveImageId;
                }

                const fallbackIndex = Math.max(0, removedIndex - 1);
                return nextItems[fallbackIndex] ? nextItems[fallbackIndex].id : nextItems[0].id;
            });

            return nextItems;
        });
    }, []);

    const selectActiveImage = useCallback((imageId) => {
        setActiveImageId(imageId);
    }, []);

    const touchAllImages = useCallback(() => {
        const now = Date.now();

        setItems((currentItems) => currentItems.map((item) => ({
            ...item,
            lastUsedAt: now
        })));
    }, []);

    const restoreFromSnapshots = useCallback(async ({ snapshots, nextActiveImageId }) => {
        setRestoreStatus("restoring");
        setRestoreNotice("");

        const restored = await restoreReferenceItemsFromSnapshots({
            toolKey,
            snapshots,
            maxItems,
            maxFileSizeBytes
        });

        const resolvedActiveImageId = resolveRestoredActiveImageId(restored.items, nextActiveImageId);
        setItems(restored.items);
        setActiveImageId(resolvedActiveImageId);
        setRestoreStatus("ready");

        if (restored.missingCount > 0) {
            setRestoreNotice("Một số ảnh tham chiếu trong lịch sử không còn khả dụng và đã bị bỏ qua.");
        }

        return {
            items: restored.items,
            missingCount: restored.missingCount,
            activeImageId: resolvedActiveImageId
        };
    }, [maxFileSizeBytes, maxItems, toolKey]);

    return {
        items,
        activeImageId,
        activeImageIndex,
        maxItems,
        canAddMore,
        hasImages: items.length > 0,
        restoreStatus,
        restoreNotice,
        addFromFileEntry,
        addFromClipboard,
        addFromQuickLayer,
        removeImage,
        selectActiveImage,
        touchAllImages,
        restoreFromSnapshots
    };
};
