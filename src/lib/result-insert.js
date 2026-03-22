import {
    buildImagePreviewUrl,
    capturePhotoshopContext,
    capturePhotoshopDocumentContext,
    insertGeneratedImage
} from "./photoshop.js";

const DEFAULT_RESULT_MIME_TYPE = "image/png";

const getFileExtensionFromMimeType = (mimeType) => {
    if (mimeType === "image/png") {
        return "png";
    }

    if (mimeType === "image/webp") {
        return "webp";
    }

    return "jpg";
};

const sanitizeNameSegment = (value, fallback = "ai-result") => {
    const normalized = String(value || "")
        .trim()
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    return normalized || fallback;
};

const resolveErrorMessage = (error, fallbackMessage) => {
    if (!error) {
        return fallbackMessage;
    }

    if (typeof error === "string") {
        return error;
    }

    if (error.message) {
        return error.message;
    }

    if (error.reason) {
        return String(error.reason);
    }

    if (error.number || error.code) {
        const label = [error.code, error.number].filter(Boolean).join(" / ");
        return label ? `${fallbackMessage} (${label})` : fallbackMessage;
    }

    try {
        const serialized = JSON.stringify(error);
        return serialized && serialized !== "{}" ? `${fallbackMessage} (${serialized})` : fallbackMessage;
    } catch (serializationError) {
        return fallbackMessage;
    }
};

const resolveErrorCode = (error, fallbackCode) => (
    error && error.code ? error.code : fallbackCode
);

const normalizeMimeType = (mimeType) => (
    mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp"
        ? mimeType
        : DEFAULT_RESULT_MIME_TYPE
);

export const normalizeCapturedContext = (context) => {
    if (!context || typeof context.documentId === "undefined") {
        return null;
    }

    return {
        documentId: Number(context.documentId),
        layerId: typeof context.layerId === "undefined" || context.layerId === null ? null : Number(context.layerId),
        documentName: context.documentName || "",
        layerName: context.layerName || "",
        documentWidth: typeof context.documentWidth === "number" ? context.documentWidth : null,
        documentHeight: typeof context.documentHeight === "number" ? context.documentHeight : null,
        capturedAt: context.capturedAt || Date.now()
    };
};

export const createInsertState = (insert) => {
    const targetContext = normalizeCapturedContext(insert && insert.targetContext ? insert.targetContext : insert);
    const insertMode = insert && (insert.mode === "reinsert" || insert.mode === "manual") ? insert.mode : "auto";

    return {
        status: insert && insert.status === "success" ? "success" : "failed",
        insertedLayerId: insert && typeof insert.insertedLayerId !== "undefined" ? insert.insertedLayerId : null,
        insertedLayerName: insert && insert.insertedLayerName ? insert.insertedLayerName : "",
        error: insert && insert.error ? insert.error : "",
        errorCode: insert && insert.errorCode ? insert.errorCode : "",
        mode: insertMode,
        updatedAt: insert && insert.updatedAt ? insert.updatedAt : Date.now(),
        targetDocumentId: targetContext ? targetContext.documentId : null,
        targetLayerId: targetContext ? targetContext.layerId : null,
        targetDocumentName: targetContext ? targetContext.documentName : "",
        targetLayerName: targetContext ? targetContext.layerName : ""
    };
};

export const createResultImageRecord = ({
    imageBase64,
    mimeType,
    featureKey,
    requestId,
    fileName,
    displayName,
    layerNamePrefix
}) => {
    const normalizedMimeType = normalizeMimeType(mimeType);
    const normalizedBaseName = fileName
        ? sanitizeNameSegment(fileName, "ai-result")
        : [
            sanitizeNameSegment(featureKey, "ai-result"),
            sanitizeNameSegment(requestId || Date.now(), "result")
        ].join("-");
    const resolvedFileName = `${normalizedBaseName}.${getFileExtensionFromMimeType(normalizedMimeType)}`;

    return {
        imageBase64,
        mimeType: normalizedMimeType,
        previewUrl: buildImagePreviewUrl(imageBase64, normalizedMimeType),
        fileName: resolvedFileName,
        displayName: displayName || resolvedFileName,
        layerNamePrefix: layerNamePrefix || "AI Result"
    };
};

export const buildGeneratedResultState = ({
    resultImage,
    responseData,
    featureKey,
    featureLabel,
    layerNamePrefix,
    capturedContext,
    insert,
    generatedAt,
    extraFields
}) => {
    const normalizedInsert = createInsertState(insert);

    return {
        imageBase64: resultImage.imageBase64,
        mimeType: resultImage.mimeType,
        previewUrl: resultImage.previewUrl,
        filename: resultImage.fileName,
        displayName: resultImage.displayName,
        requestId: responseData && responseData.requestId ? responseData.requestId : "",
        generatedAt: generatedAt || Date.now(),
        inputSummary: responseData && responseData.inputSummary ? responseData.inputSummary : null,
        featureKey: featureKey || "",
        featureLabel: featureLabel || "",
        generationStatus: "success",
        layerNamePrefix: layerNamePrefix || resultImage.layerNamePrefix || "AI Result",
        capturedContext: normalizeCapturedContext(capturedContext),
        insert: normalizedInsert,
        ...(extraFields || {})
    };
};

export const captureInsertContextSafely = async ({ fallbackMessage } = {}) => {
    try {
        return {
            context: normalizeCapturedContext(await capturePhotoshopContext()),
            error: "",
            errorCode: ""
        };
    } catch (error) {
        return {
            context: null,
            error: resolveErrorMessage(error, fallbackMessage || "Không thể capture Photoshop context tại thời điểm submit."),
            errorCode: resolveErrorCode(error, "INVALID_INSERT_CONTEXT")
        };
    }
};

export const captureDocumentInsertContextSafely = async ({ fallbackMessage } = {}) => {
    try {
        return {
            context: normalizeCapturedContext(await capturePhotoshopDocumentContext()),
            error: "",
            errorCode: ""
        };
    } catch (error) {
        return {
            context: null,
            error: resolveErrorMessage(error, fallbackMessage || "Không thể xác định document Photoshop hiện tại."),
            errorCode: resolveErrorCode(error, "INVALID_INSERT_CONTEXT")
        };
    }
};

export const performResultInsert = async ({
    resultImage,
    context,
    mode = "auto",
    missingContextError,
    missingContextErrorCode,
    fallbackFailureMessage
}) => {
    const targetContext = normalizeCapturedContext(context);

    if (!resultImage || !resultImage.imageBase64) {
        return createInsertState({
            status: "failed",
            error: "Không có ảnh kết quả hợp lệ để chèn vào Photoshop.",
            errorCode: "INVALID_RESULT_IMAGE",
            mode,
            targetContext
        });
    }

    if (!targetContext) {
        return createInsertState({
            status: "failed",
            error: missingContextError || "Không có Photoshop context phù hợp để chèn kết quả.",
            errorCode: missingContextErrorCode || "INVALID_INSERT_CONTEXT",
            mode
        });
    }

    try {
        const insertResult = await insertGeneratedImage({
            imageBase64: resultImage.imageBase64,
            mimeType: resultImage.mimeType,
            context: targetContext,
            layerNamePrefix: resultImage.layerNamePrefix,
            fileName: resultImage.fileName
        });

        return createInsertState({
            status: "success",
            insertedLayerId: insertResult.insertedLayerId,
            insertedLayerName: insertResult.insertedLayerName,
            error: "",
            errorCode: "",
            mode,
            targetContext
        });
    } catch (error) {
        return createInsertState({
            status: "failed",
            insertedLayerId: null,
            insertedLayerName: "",
            error: resolveErrorMessage(
                error,
                fallbackFailureMessage || "Generate đã thành công nhưng chèn vào Photoshop thất bại."
            ),
            errorCode: resolveErrorCode(error, "INSERT_FAILED"),
            mode,
            targetContext
        });
    }
};
