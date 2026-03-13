import {
    getEntryFromPersistentToken,
    readReferenceImageFromEntry,
    writeManagedImageAsset
} from "./photoshop.js";
import { createInsertState, normalizeCapturedContext } from "./result-insert.js";

const HISTORY_STORAGE_KEY_PREFIX = "banana-tool.result-history.v1";

const getBrowserStorage = () => {
    if (typeof window === "undefined" || !window.localStorage) {
        return null;
    }

    return window.localStorage;
};

const sanitizeNamespace = (value) => {
    const rawValue = value || "default";
    return String(rawValue).replace(/[^a-zA-Z0-9_.-]/g, "_");
};

const buildStorageKey = (namespace) => `${HISTORY_STORAGE_KEY_PREFIX}.${sanitizeNamespace(namespace)}`;

const createHistoryId = () => `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createHistoryStoreError = () => new Error("Không thể đọc dữ liệu lịch sử đã lưu trong plugin.");

const readStoredHistoryState = (namespace) => {
    const storage = getBrowserStorage();
    if (!storage) {
        return {
            version: 1,
            items: []
        };
    }

    const rawValue = storage.getItem(buildStorageKey(namespace));
    if (!rawValue) {
        return {
            version: 1,
            items: []
        };
    }

    try {
        const parsed = JSON.parse(rawValue);
        if (!parsed || !Array.isArray(parsed.items)) {
            throw createHistoryStoreError();
        }

        return parsed;
    } catch (error) {
        throw createHistoryStoreError();
    }
};

const writeStoredHistoryState = (namespace, items) => {
    const storage = getBrowserStorage();
    if (!storage) {
        return;
    }

    storage.setItem(buildStorageKey(namespace), JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        items
    }));
};

const serializeCapturedContext = (context) => {
    const normalizedContext = normalizeCapturedContext(context);

    return normalizedContext
        ? {
            ...normalizedContext
        }
        : null;
};

const serializeResultMeta = (resultImage, layerNamePrefix) => ({
    fileName: resultImage && resultImage.fileName ? resultImage.fileName : "",
    displayName: resultImage && resultImage.displayName ? resultImage.displayName : "",
    mimeType: resultImage && resultImage.mimeType ? resultImage.mimeType : "image/png",
    layerNamePrefix: layerNamePrefix || (resultImage && resultImage.layerNamePrefix ? resultImage.layerNamePrefix : "AI Result")
});

const serializeReferenceImages = (referenceImages) => (
    Array.isArray(referenceImages)
        ? referenceImages
            .filter((item) => item && item.persistentToken)
            .map((item) => ({
                id: item.id,
                sourceType: item.sourceType,
                displayName: item.displayName,
                mimeType: item.mimeType,
                storagePath: item.storagePath,
                width: item.width,
                height: item.height,
                createdAt: item.createdAt,
                lastUsedAt: item.lastUsedAt,
                persistentToken: item.persistentToken
            }))
        : []
);

const serializeRehydrationPayload = (payload) => {
    if (!payload || !payload.tabId) {
        return null;
    }

    return {
        ...payload,
        referenceImages: serializeReferenceImages(payload.referenceImages)
    };
};

const buildStoredHistoryItem = async (draft) => {
    const resultAsset = await writeManagedImageAsset({
        imageBase64: draft.resultImage.imageBase64,
        mimeType: draft.resultImage.mimeType,
        displayName: draft.resultImage.displayName || `${draft.featureKey}-result`,
        fileNamePrefix: draft.featureKey || "history-result"
    });

    return {
        historyId: draft.historyId || createHistoryId(),
        featureKey: draft.featureKey,
        featureLabel: draft.featureLabel,
        layerNamePrefix: draft.layerNamePrefix || "AI Result",
        createdAt: draft.createdAt || Date.now(),
        jobStatus: draft.jobStatus || "success",
        requestId: draft.requestId || "",
        promptSnapshot: draft.promptSnapshot || "",
        settingsSnapshot: draft.settingsSnapshot || null,
        summaryLines: Array.isArray(draft.summaryLines) ? draft.summaryLines.filter(Boolean).slice(0, 6) : [],
        errorSummary: draft.errorSummary || "",
        insert: createInsertState(draft.insert),
        capturedContext: serializeCapturedContext(draft.capturedContext),
        resultMeta: serializeResultMeta(draft.resultImage, draft.layerNamePrefix),
        resultAsset: {
            persistentToken: resultAsset.persistentToken,
            displayName: resultAsset.displayName,
            fileName: resultAsset.fileName,
            mimeType: resultAsset.mimeType,
            storagePath: resultAsset.storagePath,
            width: resultAsset.width,
            height: resultAsset.height
        },
        rehydrationPayload: serializeRehydrationPayload(draft.rehydrationPayload)
    };
};

const hydrateResultAsset = async (resultAsset) => {
    if (!resultAsset || !resultAsset.persistentToken) {
        return {
            available: false,
            previewUrl: "",
            error: "Không có asset kết quả cục bộ."
        };
    }

    try {
        const entry = await getEntryFromPersistentToken(resultAsset.persistentToken);
        const restoredAsset = await readReferenceImageFromEntry(entry, {
            displayName: resultAsset.displayName,
            mimeType: resultAsset.mimeType,
            storagePath: resultAsset.storagePath,
            width: resultAsset.width,
            height: resultAsset.height
        });

        return {
            available: true,
            previewUrl: restoredAsset.previewUrl,
            error: "",
            width: restoredAsset.width,
            height: restoredAsset.height
        };
    } catch (error) {
        return {
            available: false,
            previewUrl: "",
            error: error && error.message ? error.message : "Không thể đọc asset kết quả cục bộ."
        };
    }
};

const hydrateHistoryItem = async (item) => {
    const hydratedAsset = await hydrateResultAsset(item.resultAsset);

    return {
        ...item,
        previewUrl: hydratedAsset.previewUrl,
        resultAsset: {
            ...item.resultAsset,
            available: hydratedAsset.available,
            error: hydratedAsset.error,
            width: hydratedAsset.width || item.resultAsset.width,
            height: hydratedAsset.height || item.resultAsset.height
        },
        canReinsert: Boolean(hydratedAsset.available),
        canReload: Boolean(item.rehydrationPayload && item.rehydrationPayload.tabId)
    };
};

export const loadHistoryItems = async (namespace) => {
    const state = readStoredHistoryState(namespace);
    const sortedItems = state.items.slice().sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));

    return Promise.all(sortedItems.map((item) => hydrateHistoryItem(item)));
};

export const appendHistoryItem = async ({ namespace, draft }) => {
    const state = readStoredHistoryState(namespace);
    const storedItem = await buildStoredHistoryItem(draft);
    const nextItems = [storedItem, ...state.items];

    writeStoredHistoryState(namespace, nextItems);

    return loadHistoryItems(namespace);
};

export const updateHistoryItemInsertState = async ({ namespace, historyId, insert }) => {
    const state = readStoredHistoryState(namespace);
    const nextItems = state.items.map((item) => (
        item.historyId === historyId
            ? {
                ...item,
                insert: createInsertState(insert),
                errorSummary: insert && insert.error ? insert.error : ""
            }
            : item
    ));

    writeStoredHistoryState(namespace, nextItems);

    return loadHistoryItems(namespace);
};
