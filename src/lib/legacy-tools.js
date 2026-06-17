const createError = (message, code) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const getPhotoshopModule = () => {
    try {
        return require("photoshop");
    } catch (error) {
        throw createError("Khong the ket noi Photoshop.", "PHOTOSHOP_UNAVAILABLE");
    }
};

const getActionModule = () => getPhotoshopModule().action;

const buildLayerTarget = () => [{
    _ref: "layer",
    _enum: "ordinal",
    _value: "targetEnum"
}];

const buildNoDialogOptions = () => ({
    synchronousExecution: false,
    modalBehavior: "execute"
});

const runBatchPlay = async (commands) => {
    const action = getActionModule();
    const results = await action.batchPlay(commands, buildNoDialogOptions());
    const failedResult = Array.isArray(results)
        ? results.find((result) => result && result._obj === "error")
        : null;

    if (failedResult) {
        throw createError(
            failedResult.message || failedResult._message || "Photoshop khong the thuc hien lenh nay.",
            "BATCH_PLAY_FAILED"
        );
    }

    return results;
};

const executeLegacyTool = async (commandName, task) => {
    const photoshop = getPhotoshopModule();
    const { app, core } = photoshop;

    if (!app || !app.activeDocument) {
        throw createError("Hay mo mot document Photoshop truoc khi chay tool.", "NO_ACTIVE_DOCUMENT");
    }

    return core.executeAsModal(task, {
        commandName,
        timeOut: 5000
    });
};

const makeLayer = ({ name, mode = "normal", opacity = 100 }) => ({
    _obj: "make",
    _target: [{
        _ref: "layer"
    }],
    using: {
        _obj: "layer",
        name,
        mode: {
            _enum: "blendMode",
            _value: mode
        },
        opacity: {
            _unit: "percentUnit",
            _value: opacity
        }
    },
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const setActiveLayerOptions = ({ name, mode, opacity, visible }) => {
    const layerOptions = {
        _obj: "layer"
    };

    if (name) {
        layerOptions.name = name;
    }

    if (mode) {
        layerOptions.mode = {
            _enum: "blendMode",
            _value: mode
        };
    }

    if (typeof opacity === "number") {
        layerOptions.opacity = {
            _unit: "percentUnit",
            _value: opacity
        };
    }

    if (typeof visible === "boolean") {
        layerOptions.visible = visible;
    }

    return {
        _obj: "set",
        _target: buildLayerTarget(),
        to: layerOptions,
        _options: {
            dialogOptions: "dontDisplay"
        }
    };
};

const duplicateActiveLayer = (name) => ({
    _obj: "duplicate",
    _target: buildLayerTarget(),
    name,
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const duplicateLayerById = (layerId, name) => ({
    _obj: "duplicate",
    _target: [{
        _ref: "layer",
        _id: layerId
    }],
    name,
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const deleteLayerById = (layerId) => ({
    _obj: "delete",
    _target: [{
        _ref: "layer",
        _id: layerId
    }],
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const fillWithRgb = ({ red, green, blue, opacity = 100 }) => ({
    _obj: "fill",
    using: {
        _enum: "fillContents",
        _value: "color"
    },
    color: {
        _obj: "RGBColor",
        red,
        grain: green,
        blue
    },
    opacity: {
        _unit: "percentUnit",
        _value: opacity
    },
    mode: {
        _enum: "blendMode",
        _value: "normal"
    },
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const fillWithGray = () => fillWithRgb({
    red: 128,
    green: 128,
    blue: 128
});

const highPass = (radius) => ({
    _obj: "highPass",
    radius: {
        _unit: "pixelsUnit",
        _value: radius
    },
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const unsharpMask = ({ amount, radius, threshold }) => ({
    _obj: "unsharpMask",
    amount: {
        _unit: "percentUnit",
        _value: amount
    },
    radius: {
        _unit: "pixelsUnit",
        _value: radius
    },
    threshold,
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const addBlackLayerMask = () => ({
    _obj: "make",
    new: {
        _class: "channel"
    },
    at: {
        _ref: "channel",
        _enum: "channel",
        _value: "mask"
    },
    using: {
        _enum: "userMaskEnabled",
        _value: "hideAll"
    },
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const addSelectionLayerMask = () => ({
    _obj: "make",
    new: {
        _class: "channel"
    },
    at: {
        _ref: "channel",
        _enum: "channel",
        _value: "mask"
    },
    using: {
        _enum: "userMaskEnabled",
        _value: "revealSelection"
    },
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const makeCurvesLayerWithPoints = ({ name, points }) => ({
    _obj: "make",
    _target: [{
        _ref: "adjustmentLayer"
    }],
    using: {
        _obj: "adjustmentLayer",
        name,
        type: {
            _obj: "curves",
            adjustment: [{
                _obj: "curvesAdjustment",
                channel: {
                    _ref: "channel",
                    _enum: "channel",
                    _value: "composite"
                },
                curve: points.map(([horizontal, vertical]) => ({
                    _obj: "paint",
                    horizontal,
                    vertical
                }))
            }]
        }
    },
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const makeCurvesLayer = ({ name, midpoint }) => makeCurvesLayerWithPoints({
    name,
    points: [
        [0, 0],
        [128, midpoint],
        [255, 255]
    ]
});

const makeSolidColorLayer = ({ name, red, green, blue }) => ({
    _obj: "make",
    _target: [{
        _ref: "contentLayer"
    }],
    using: {
        _obj: "contentLayer",
        name,
        type: {
            _obj: "solidColorLayer",
            color: {
                _obj: "RGBColor",
                red,
                grain: green,
                blue
            }
        }
    },
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const makeGradientMapLayer = ({ name }) => ({
    _obj: "make",
    _target: [{
        _ref: "adjustmentLayer"
    }],
    using: {
        _obj: "adjustmentLayer",
        name,
        type: {
            _obj: "gradientMapClass",
            gradientsInterpolationMethod: {
                _enum: "gradientInterpolationMethodType",
                _value: "perceptual"
            },
            gradient: {
                _obj: "gradientClassEvent",
                name: "Foreground to Background",
                gradientForm: {
                    _enum: "gradientForm",
                    _value: "customStops"
                },
                interfaceIconFrameDimmed: 4096,
                colors: [
                    {
                        _obj: "colorStop",
                        color: {
                            _obj: "RGBColor",
                            red: 0,
                            grain: 0,
                            blue: 0
                        },
                        type: {
                            _enum: "colorStopType",
                            _value: "userStop"
                        },
                        location: 0,
                        midpoint: 50
                    },
                    {
                        _obj: "colorStop",
                        color: {
                            _obj: "RGBColor",
                            red: 255,
                            grain: 255,
                            blue: 255
                        },
                        type: {
                            _enum: "colorStopType",
                            _value: "userStop"
                        },
                        location: 4096,
                        midpoint: 50
                    }
                ],
                transparency: [
                    {
                        _obj: "transferSpec",
                        opacity: {
                            _unit: "percentUnit",
                            _value: 100
                        },
                        location: 0,
                        midpoint: 50
                    },
                    {
                        _obj: "transferSpec",
                        opacity: {
                            _unit: "percentUnit",
                            _value: 100
                        },
                        location: 4096,
                        midpoint: 50
                    }
                ]
            }
        }
    },
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const makeHueSaturationLayer = ({ name, saturation, hue = 0, lightness = 0, channel }) => ({
    _obj: "make",
    _target: [{
        _ref: "adjustmentLayer"
    }],
    using: {
        _obj: "adjustmentLayer",
        name,
        type: {
            _obj: "hueSaturation",
            presetKind: {
                _enum: "presetKindType",
                _value: "presetKindCustom"
            },
            colorize: false,
            adjustment: [{
                _obj: "hueSatAdjustmentV2",
                ...(channel ? {
                    channel: {
                        _enum: "channel",
                        _value: channel
                    }
                } : {}),
                hue,
                saturation,
                lightness
            }]
        }
    },
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const makeColorBalanceLayer = ({
    name,
    shadowLevels,
    midtoneLevels,
    highlightLevels,
    preserveLuminosity
}) => ({
    _obj: "make",
    _target: [{
        _ref: "adjustmentLayer"
    }],
    using: {
        _obj: "adjustmentLayer",
        name,
        type: {
            _obj: "colorBalance",
            shadowLevels,
            midtoneLevels,
            highlightLevels,
            preserveLuminosity: Boolean(preserveLuminosity)
        }
    },
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const invertActiveChannel = () => ({
    _obj: "invert",
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const desaturate = () => ({
    _obj: "desaturate",
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const gaussianBlur = (radius) => ({
    _obj: "gaussianBlur",
    radius: {
        _unit: "pixelsUnit",
        _value: radius
    },
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const getDocumentDepth = () => ({
    _obj: "get",
    _target: [
        { _property: "depth" },
        { _ref: "document", _enum: "ordinal", _value: "targetEnum" }
    ],
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const applyFrequencySeparation = ({ lowLayerId, bitDepth }) => {
    const isSixteenBit = bitDepth === 16;

    return {
        _obj: "applyImageEvent",
        with: {
            _obj: "calculation",
            to: {
                _ref: "channel",
                _enum: "channel",
                _value: "RGB"
            },
            source: {
                _ref: [
                    { _ref: "channel", _enum: "channel", _value: "RGB" },
                    { _ref: "layer", _id: lowLayerId }
                ]
            },
            ...(isSixteenBit ? { invert: true } : {}),
            calculation: {
                _enum: "calculationType",
                _value: isSixteenBit ? "add" : "subtract"
            },
            scale: 2,
            offset: isSixteenBit ? 0 : 128
        },
        _options: {
            dialogOptions: "dontDisplay"
        }
    };
};

const selectLayerById = (layerId, addToSelection = false) => ({
    _obj: "select",
    _target: [{
        _ref: "layer",
        _id: layerId
    }],
    ...(addToSelection ? {
        selectionModifier: {
            _enum: "selectionModifierType",
            _value: "addToSelection"
        }
    } : {}),
    makeVisible: false,
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const groupSelectedLayers = (name) => ({
    _obj: "make",
    _target: [{
        _ref: "layerSection"
    }],
    from: {
        _ref: "layer",
        _enum: "ordinal",
        _value: "targetEnum"
    },
    using: {
        _obj: "layerSection",
        name
    },
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const buildChannelTarget = (channelName) => (
    channelName === "RGB"
        ? { _ref: "channel", _enum: "channel", _value: "RGB" }
        : { _ref: "channel", _name: channelName }
);

const loadCompositeAsSelection = (intersect = false) => ({
    _obj: "set",
    _target: [{
        _ref: "channel",
        _property: "selection"
    }],
    to: buildChannelTarget("RGB"),
    ...(intersect ? {
        selectionModifier: {
            _enum: "selectionModifierType",
            _value: "intersectWith"
        }
    } : {}),
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const clearSelection = () => ({
    _obj: "set",
    _target: [{
        _ref: "channel",
        _property: "selection"
    }],
    to: {
        _enum: "ordinal",
        _value: "none"
    },
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const duplicateChannel = (sourceName, targetName) => ({
    _obj: "duplicate",
    _target: [buildChannelTarget(sourceName)],
    name: targetName,
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const loadChannelAsSelection = (channelName) => ({
    _obj: "set",
    _target: [{
        _ref: "channel",
        _property: "selection"
    }],
    to: buildChannelTarget(channelName),
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const deleteChannel = (channelName) => ({
    _obj: "delete",
    _target: [buildChannelTarget(channelName)],
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const multiplyActiveChannel = (sourceName) => ({
    _obj: "applyImageEvent",
    with: {
        _obj: "calculation",
        to: {
            _ref: "channel",
            _enum: "ordinal",
            _value: "targetEnum"
        },
        source: {
            _ref: [buildChannelTarget(sourceName)]
        },
        calculation: {
            _enum: "calculationType",
            _value: "multiply"
        },
        scale: 1,
        offset: 0
    },
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const selectCompositeChannel = () => ({
    _obj: "select",
    _target: [buildChannelTarget("RGB")],
    makeVisible: true,
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const buildMaskRunSuffix = () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");

    return `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const addNoise = ({ amount, gaussian, monochromatic }) => ({
    _obj: "addNoise",
    amount: {
        _unit: "percentUnit",
        _value: amount
    },
    distribution: {
        _enum: "distribution",
        _value: gaussian ? "gaussian" : "uniform"
    },
    monochromatic: Boolean(monochromatic),
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const surfaceBlur = ({ radius, threshold }) => ({
    _obj: "surfaceBlur",
    radius: {
        _unit: "pixelsUnit",
        _value: radius
    },
    threshold,
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const brightnessContrast = ({ brightness = 0, contrast = 0 }) => ({
    _obj: "brightnessEvent",
    brightness: Math.round(brightness),
    center: Math.round(contrast),
    useLegacy: false,
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const resizeImage = ({ width, height, interpolation = "bicubicAutomatic" }) => ({
    _obj: "imageSize",
    width: {
        _unit: "pixelsUnit",
        _value: width
    },
    height: {
        _unit: "pixelsUnit",
        _value: height
    },
    scaleStyles: true,
    constrainProportions: true,
    interpolation: {
        _enum: "interpolationType",
        _value: interpolation
    },
    _options: {
        dialogOptions: "dontDisplay"
    }
});

const normalizeDimension = (value) => {
    if (value && typeof value === "object" && typeof value.value === "number") {
        return value.value;
    }

    return typeof value === "number" ? value : null;
};

const clampNumber = (value, fallback, min, max) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return fallback;
    }

    return Math.min(max, Math.max(min, number));
};

export const runDodgeBurnGrayLayer = async ({ opacity = 100, blendMode = "overlay" } = {}) => {
    const resolvedOpacity = clampNumber(opacity, 100, 1, 100);
    const resolvedBlendMode = blendMode === "softLight" ? "softLight" : "overlay";

    await executeLegacyTool("MEKO D&B 50 Gray", async () => {
        await runBatchPlay([
            makeLayer({
                name: "D&B 50% Gray | Mekomedia.vn",
                mode: resolvedBlendMode,
                opacity: resolvedOpacity
            }),
            fillWithGray()
        ]);
    });

    return "Da tao layer D&B 50% Gray legacy.";
};

export const runDodgeBurnCurves = async ({ strength = 32, legacyMode = true } = {}) => {
    const resolvedStrength = Math.round(clampNumber(strength, 32, 5, 100));
    const dodgeMidpoint = Math.min(228, 128 + resolvedStrength);
    const burnMidpoint = Math.max(27, 128 - resolvedStrength);
    const burnPoints = legacyMode
        ? [[0, 0], [165, 125], [255, 255]]
        : [[0, 0], [128, burnMidpoint], [255, 255]];
    const dodgePoints = legacyMode
        ? [[0, 0], [85, 125], [255, 255]]
        : [[0, 0], [128, dodgeMidpoint], [255, 255]];

    await executeLegacyTool("MEKO D&B Curves", async () => {
        await runBatchPlay([
            makeCurvesLayerWithPoints({
                name: legacyMode ? "Burn" : "MEKO D&B Burn",
                points: burnPoints
            }),
            invertActiveChannel(),
            selectCompositeChannel(),
            makeCurvesLayerWithPoints({
                name: legacyMode ? "Dodge" : "MEKO D&B Dodge",
                points: dodgePoints
            }),
            invertActiveChannel(),
            selectCompositeChannel()
        ]);
    });

    return legacyMode
        ? "Da tao cap Curves Dodge/Burn theo recipe legacy."
        : "Da tao cap Curves Dodge/Burn voi mask den.";
};

export const runDodgeBurnMaster = async ({ mode = "standard", strength = 32, opacity = 100, checkMode = "bw" } = {}) => {
    const resolvedStrength = Math.round(clampNumber(strength, 32, 5, 100));
    const resolvedOpacity = clampNumber(opacity, 100, 1, 100);
    const resolvedCheckMode = checkMode === "solar" || checkMode === "none" ? checkMode : "bw";
    const resolvedMode = [
        "standard",
        "softLight",
        "contour",
        "overlay",
        "screen",
        "contourRa",
        "multiply",
        "sangAi",
        "khoiAi",
        "toiAi",
        "sangAiPlus",
        "khoiAiPlus",
        "toiAiPlus"
    ].includes(mode) ? mode : "standard";
    const dodgeMidpoint = Math.min(228, 128 + resolvedStrength);
    const burnMidpoint = Math.max(27, 128 - resolvedStrength);
    const layerIds = [];

    await executeLegacyTool("MEKO D&B Master", async () => {
        const photoshop = getPhotoshopModule();
        const document = photoshop.app.activeDocument;
        const captureLayer = () => {
            const layer = document.activeLayers && document.activeLayers[0];
            if (!layer) {
                throw createError("Khong tao duoc D&B Master layer.", "DODGE_BURN_MASTER_FAILED");
            }
            layerIds.push(Number(layer.id));
        };
        const addGrayPaintLayer = async ({ name, blend }) => {
            await runBatchPlay([
                makeLayer({ name, mode: blend, opacity: resolvedOpacity }),
                fillWithGray()
            ]);
            captureLayer();
        };
        const addPaintLayer = async ({ name, blend }) => {
            await runBatchPlay([
                makeLayer({ name, mode: blend, opacity: resolvedOpacity })
            ]);
            captureLayer();
        };
        const addMaskedCurve = async ({ name, midpoint, blend = "luminosity" }) => {
            await runBatchPlay([
                makeCurvesLayer({ name, midpoint }),
                invertActiveChannel(),
                selectCompositeChannel(),
                setActiveLayerOptions({ mode: blend, opacity: resolvedOpacity })
            ]);
            captureLayer();
        };
        const addSupportChecks = async () => {
            await runBatchPlay([
                makeSolidColorLayer({
                    name: "Hỗ trợ - B&W Check",
                    red: 0,
                    green: 0,
                    blue: 0
                }),
                setActiveLayerOptions({
                    mode: "color",
                    visible: resolvedCheckMode === "bw"
                })
            ]);
            captureLayer();

            await runBatchPlay([
                makeCurvesLayerWithPoints({
                    name: "Hỗ trợ - Solar Check",
                    points: [
                        [0, 0], [32, 255], [64, 0], [96, 255], [128, 0],
                        [160, 255], [192, 0], [224, 255], [255, 0]
                    ]
                }),
                setActiveLayerOptions({
                    mode: "luminosity",
                    visible: resolvedCheckMode === "solar"
                })
            ]);
            captureLayer();
        };

        if (resolvedMode === "softLight") {
            await addGrayPaintLayer({ name: "Đánh Khối Soft Light", blend: "softLight" });
        } else if (resolvedMode === "overlay") {
            await addGrayPaintLayer({ name: "Đánh Khối Overlay", blend: "overlay" });
        } else if (resolvedMode === "screen") {
            await addPaintLayer({ name: "Screen", blend: "screen" });
        } else if (resolvedMode === "multiply") {
            await addPaintLayer({ name: "Multiply", blend: "multiply" });
        } else if (resolvedMode === "contour" || resolvedMode === "contourRa") {
            await addMaskedCurve({ name: "Khối Tối", midpoint: burnMidpoint });
            await addMaskedCurve({ name: "Khối Sáng", midpoint: dodgeMidpoint });
            await addSupportChecks();
        } else if (resolvedMode === "sangAi") {
            await addMaskedCurve({ name: "Đánh sáng AI", midpoint: dodgeMidpoint, blend: "screen" });
            await addSupportChecks();
        } else if (resolvedMode === "toiAi") {
            await addMaskedCurve({ name: "Đánh tối AI", midpoint: burnMidpoint, blend: "multiply" });
            await addSupportChecks();
        } else if (resolvedMode === "khoiAi") {
            await addMaskedCurve({ name: "Tối", midpoint: burnMidpoint, blend: "multiply" });
            await addMaskedCurve({ name: "Sáng", midpoint: dodgeMidpoint, blend: "screen" });
            await addSupportChecks();
        } else if (resolvedMode === "sangAiPlus") {
            await addPaintLayer({ name: "Sáng", blend: "screen" });
            await addMaskedCurve({ name: "Đánh sáng AI", midpoint: dodgeMidpoint, blend: "screen" });
            await addSupportChecks();
        } else if (resolvedMode === "toiAiPlus") {
            await addPaintLayer({ name: "Đánh tối AI", blend: "multiply" });
            await addMaskedCurve({ name: "Đánh tối AI", midpoint: burnMidpoint, blend: "multiply" });
            await addSupportChecks();
        } else if (resolvedMode === "khoiAiPlus") {
            await addPaintLayer({ name: "Đánh tối", blend: "multiply" });
            await addPaintLayer({ name: "Đánh sáng", blend: "screen" });
            await addMaskedCurve({ name: "Đánh khối AI", midpoint: burnMidpoint });
            await addSupportChecks();
        } else {
            await addMaskedCurve({ name: "MEKO D&B Master - Burn", midpoint: burnMidpoint });
            await addMaskedCurve({ name: "MEKO D&B Master - Dodge", midpoint: dodgeMidpoint });
            await addSupportChecks();
        }

        if (layerIds.length > 1) {
            await runBatchPlay([
                selectLayerById(layerIds[0]),
                ...layerIds.slice(1).map((layerId) => selectLayerById(layerId, true)),
                groupSelectedLayers(resolvedMode === "standard" ? "MEKO D&B Master" : "Đánh Khối Master | MEKO")
            ]);
        }
    });

    const checkLabel = resolvedCheckMode === "bw"
        ? "B&W Check"
        : resolvedCheckMode === "solar" ? "Solar Check" : "khong bat Check layer";
    return `Da tao D&B Master mode ${resolvedMode}, dang bat ${checkLabel}.`;
};

export const runColorCorrectionPro = async ({ hueShift = 25, saturationShift = 25, gradientOpacity = 0 } = {}) => {
    const resolvedHueShift = Math.round(clampNumber(hueShift, 25, 1, 180));
    const resolvedSaturationShift = Math.round(clampNumber(saturationShift, 25, 1, 100));
    const resolvedGradientOpacity = clampNumber(gradientOpacity, 0, 0, 100);

    await executeLegacyTool("MEKO Color Correction Pro", async () => {
        const photoshop = getPhotoshopModule();
        const document = photoshop.app.activeDocument;
        const hueLayerIds = [];
        const saturationLayerIds = [];
        const groupIds = [];
        const captureLayerId = (target) => {
            const layer = document.activeLayers && document.activeLayers[0];
            if (!layer) {
                throw createError("Khong tao duoc layer Color Correction Pro.", "COLOR_CORRECTION_PRO_FAILED");
            }
            target.push(Number(layer.id));
        };

        await runBatchPlay([
            makeGradientMapLayer({
                name: "Gradient skin - Hue fix"
            }),
            setActiveLayerOptions({
                mode: "color",
                opacity: resolvedGradientOpacity
            }),
            selectCompositeChannel()
        ]);
        captureLayerId(hueLayerIds);

        await runBatchPlay([
            makeHueSaturationLayer({
                name: "Dark - Hue fix",
                hue: resolvedHueShift,
                saturation: 0,
                lightness: 0
            }),
            invertActiveChannel(),
            selectCompositeChannel()
        ]);
        captureLayerId(hueLayerIds);

        await runBatchPlay([
            makeHueSaturationLayer({
                name: "Light - Hue fix",
                hue: -resolvedHueShift,
                saturation: 0,
                lightness: 0
            }),
            invertActiveChannel(),
            selectCompositeChannel()
        ]);
        captureLayerId(hueLayerIds);

        await runBatchPlay([
            selectLayerById(hueLayerIds[0]),
            ...hueLayerIds.slice(1).map((layerId) => selectLayerById(layerId, true)),
            groupSelectedLayers("Hue correction - Color correction")
        ]);
        captureLayerId(groupIds);

        await runBatchPlay([
            makeHueSaturationLayer({
                name: "+ Saturation fix",
                hue: 0,
                saturation: resolvedSaturationShift,
                lightness: 0
            }),
            invertActiveChannel(),
            selectCompositeChannel()
        ]);
        captureLayerId(saturationLayerIds);

        await runBatchPlay([
            makeHueSaturationLayer({
                name: "- Saturation fix",
                hue: 0,
                saturation: -resolvedSaturationShift,
                lightness: 0
            }),
            invertActiveChannel(),
            selectCompositeChannel()
        ]);
        captureLayerId(saturationLayerIds);

        await runBatchPlay([
            selectLayerById(saturationLayerIds[0]),
            selectLayerById(saturationLayerIds[1], true),
            groupSelectedLayers("Saturation correction - Color correction")
        ]);
        captureLayerId(groupIds);

        await runBatchPlay([
            selectLayerById(groupIds[0]),
            selectLayerById(groupIds[1], true),
            groupSelectedLayers("Color correction - Meko media")
        ]);
    });

    return "Da tao group Color Correction Pro theo legacy.";
};

export const runColorRetouchLayer = async ({ opacity = 100 } = {}) => {
    const resolvedOpacity = clampNumber(opacity, 100, 1, 100);

    await executeLegacyTool("MEKO Color Layer", async () => {
        await runBatchPlay([
            makeLayer({
                name: "MEKO Color Retouch",
                mode: "color",
                opacity: resolvedOpacity
            })
        ]);
    });

    return "Da tao layer Color Retouch.";
};

export const runHighPassSharpen = async ({ radius = 2, opacity = 70, blendMode = "linearLight" } = {}) => {
    const resolvedRadius = clampNumber(radius, 2, 0.1, 250);
    const resolvedOpacity = clampNumber(opacity, 70, 1, 100);
    const resolvedBlendMode = blendMode === "overlay" || blendMode === "softLight" ? blendMode : "linearLight";

    await executeLegacyTool("MEKO High Pass", async () => {
        await runBatchPlay([
            duplicateActiveLayer("MEKO High Pass"),
            highPass(resolvedRadius),
            setActiveLayerOptions({
                mode: resolvedBlendMode,
                opacity: resolvedOpacity
            })
        ]);
    });

    return "Da tao layer High Pass.";
};

export const runAddNoiseLayer = async ({
    amount = 25.98,
    blurRadius = 1.1,
    opacity = 100,
    gaussian = false,
    monochromatic = false,
    legacyMode = true
} = {}) => {
    const resolvedAmount = clampNumber(amount, 25.98, 0.1, 400);
    const resolvedBlurRadius = clampNumber(blurRadius, 1.1, 0, 100);
    const resolvedOpacity = clampNumber(opacity, 100, 1, 100);

    await executeLegacyTool("MEKO Add Noise", async () => {
        if (!legacyMode) {
            await runBatchPlay([
                duplicateActiveLayer("MEKO Add Noise"),
                addNoise({
                    amount: resolvedAmount,
                    gaussian,
                    monochromatic
                })
            ]);
            return;
        }

        const commands = [
            makeLayer({
                name: "Add Noise|Mekomedia.vn",
                mode: "normal",
                opacity: 100
            }),
            fillWithRgb({
                red: 154,
                green: 154,
                blue: 154
            }),
            addNoise({
                amount: resolvedAmount,
                gaussian,
                monochromatic
            })
        ];

        if (resolvedBlurRadius > 0) {
            commands.push(gaussianBlur(resolvedBlurRadius));
        }

        commands.push(setActiveLayerOptions({
            mode: "softLight",
            opacity: resolvedOpacity
        }));

        await runBatchPlay(commands);
    });

    return legacyMode
        ? "Da tao layer Add Noise kieu legacy: fill mau, noise, blur va Soft Light."
        : "Da tao layer Add Noise tu layer hien tai.";
};

export const runDreamyBlur = async ({ blurRadius = 100, screenOpacity = 47, groupOpacity = 100 } = {}) => {
    const resolvedBlurRadius = clampNumber(blurRadius, 100, 0.1, 250);
    const resolvedScreenOpacity = clampNumber(screenOpacity, 47, 1, 100);
    const resolvedGroupOpacity = clampNumber(groupOpacity, 100, 1, 100);

    await executeLegacyTool("MEKO Mo Ao Nang Tho", async () => {
        const photoshop = getPhotoshopModule();
        const document = photoshop.app.activeDocument;
        const sourceLayer = document.activeLayers && document.activeLayers[0];

        if (!sourceLayer) {
            throw createError("Hay chon mot layer anh truoc khi chay Mo Ao.", "NO_ACTIVE_LAYER");
        }

        await runBatchPlay([
            duplicateLayerById(Number(sourceLayer.id), "MEKO Nang Tho - Soft Light"),
            gaussianBlur(resolvedBlurRadius),
            setActiveLayerOptions({
                mode: "softLight"
            })
        ]);
        const softLayer = document.activeLayers && document.activeLayers[0];

        if (!softLayer) {
            throw createError("Khong tao duoc layer Mo Ao Soft Light.", "DREAMY_BLUR_FAILED");
        }

        await runBatchPlay([
            duplicateLayerById(Number(softLayer.id), "MEKO Nang Tho - Screen"),
            setActiveLayerOptions({
                mode: "screen",
                opacity: resolvedScreenOpacity
            })
        ]);
        const screenLayer = document.activeLayers && document.activeLayers[0];

        if (!screenLayer) {
            throw createError("Khong tao duoc layer Mo Ao Screen.", "DREAMY_BLUR_FAILED");
        }

        await runBatchPlay([
            selectLayerById(Number(softLayer.id)),
            selectLayerById(Number(screenLayer.id), true),
            groupSelectedLayers("Meko - hieu ung nang tho"),
            setActiveLayerOptions({
                opacity: resolvedGroupOpacity
            })
        ]);
    });

    return "Da tao hieu ung Mo Ao / Nang Tho.";
};

export const runHighlightBoost = async ({ brightness = 55, range = 45, blurDivisor = 10 } = {}) => {
    const resolvedBrightness = clampNumber(brightness, 55, 1, 100);
    const resolvedRange = clampNumber(range, 45, 1, 100);
    const resolvedBlur = Math.max(0.1, resolvedRange / clampNumber(blurDivisor, 10, 1, 50));

    await executeLegacyTool("MEKO Highlight Boost", async () => {
        await runBatchPlay([
            duplicateActiveLayer("MEKO Highlight Boost"),
            setActiveLayerOptions({
                mode: "screen",
                opacity: resolvedBrightness
            }),
            gaussianBlur(resolvedBlur)
        ]);
    });

    return "Da tao layer Highlight Boost.";
};

export const runDarkBoost = async ({ strength = 35, range = 40, contrast = null } = {}) => {
    const resolvedStrength = clampNumber(strength, 35, 1, 100);
    const resolvedRange = clampNumber(range, 40, 1, 100);
    const resolvedContrast = contrast === null || contrast === undefined
        ? resolvedRange / 2
        : clampNumber(contrast, resolvedRange / 2, -100, 100);

    await executeLegacyTool("MEKO Dark Boost", async () => {
        await runBatchPlay([
            duplicateActiveLayer("MEKO Dark Boost"),
            setActiveLayerOptions({
                mode: "multiply",
                opacity: resolvedStrength
            }),
            gaussianBlur(Math.max(0.1, resolvedRange / 12)),
            brightnessContrast({
                brightness: 0,
                contrast: resolvedContrast
            })
        ]);
    });

    return "Da tao layer Dark Boost.";
};

export const runUpscalePro = async ({ scale = 2, method = "preserveDetailsUpscale", sharpen = true } = {}) => {
    const resolvedScale = clampNumber(scale, 2, 1, 4);
    const interpolationMap = {
        preserveDetailsUpscale: "preserveDetailsUpscale",
        smooth: "bicubicSmoother",
        automatic: "bicubicAutomatic"
    };
    const resolvedInterpolation = interpolationMap[method] || interpolationMap.preserveDetailsUpscale;

    await executeLegacyTool("MEKO Upscale Pro", async () => {
        const photoshop = getPhotoshopModule();
        const document = photoshop.app.activeDocument;
        const width = normalizeDimension(document && document.width);
        const height = normalizeDimension(document && document.height);

        if (!width || !height) {
            throw createError("Khong doc duoc kich thuoc document de upscale.", "INVALID_UPSCALE_DIMENSIONS");
        }

        const commands = [resizeImage({
            width: Math.max(1, Math.round(width * resolvedScale)),
            height: Math.max(1, Math.round(height * resolvedScale)),
            interpolation: resolvedInterpolation
        })];

        if (sharpen) {
            commands.push(unsharpMask({
                amount: 80,
                radius: 0.8,
                threshold: 2
            }));
        }

        await runBatchPlay(commands);
    });

    return `Da upscale anh ${resolvedScale}x${sharpen ? " va sharpen nhe" : ""}.`;
};

export const runSmoothNoiseLayer = async ({ radius = 3, threshold = 12, opacity = 100 } = {}) => {
    const resolvedRadius = clampNumber(radius, 3, 1, 100);
    const resolvedThreshold = Math.round(clampNumber(threshold, 12, 1, 255));
    const resolvedOpacity = clampNumber(opacity, 100, 1, 100);

    await executeLegacyTool("MEKO Smooth Noise", async () => {
        await runBatchPlay([
            duplicateActiveLayer("MEKO Smooth Noise"),
            surfaceBlur({
                radius: resolvedRadius,
                threshold: resolvedThreshold
            }),
            setActiveLayerOptions({
                opacity: resolvedOpacity
            })
        ]);
    });

    return "Da tao layer Smooth Noise.";
};

export const runCheckTextureLegacy = async ({ includeDodgeBurn = true, activeView = "skinBlemish" } = {}) => {
    const validViews = new Set(["skinBlemish", "solarize", "blackWhite", "invert", "all"]);
    const resolvedView = validViews.has(activeView) ? activeView : "skinBlemish";

    await executeLegacyTool("MEKO Check Texture", async () => {
        const photoshop = getPhotoshopModule();
        const document = photoshop.app.activeDocument;
        const layerIds = [];
        const captureLayer = () => {
            const layer = document.activeLayers && document.activeLayers[0];
            if (!layer) {
                throw createError("Khong tao duoc Check Texture layer.", "CHECK_TEXTURE_FAILED");
            }
            layerIds.push(Number(layer.id));
        };

        if (includeDodgeBurn) {
            await runBatchPlay([
                makeLayer({
                    name: "D&B",
                    mode: "softLight",
                    opacity: 100
                }),
                fillWithGray()
            ]);
            captureLayer();
        }

        await runBatchPlay([
            makeCurvesLayerWithPoints({
                name: "Skin Blemish",
                points: [[0, 0], [56, 92], [128, 128], [200, 164], [255, 255]]
            }),
            setActiveLayerOptions({
                visible: resolvedView === "skinBlemish" || resolvedView === "all"
            })
        ]);
        captureLayer();

        await runBatchPlay([
            makeCurvesLayerWithPoints({
                name: "Solarize",
                points: [[0, 0], [64, 255], [128, 0], [192, 255], [255, 0]]
            }),
            setActiveLayerOptions({
                visible: resolvedView === "solarize" || resolvedView === "all"
            })
        ]);
        captureLayer();

        await runBatchPlay([
            makeHueSaturationLayer({
                name: "Black/White",
                saturation: -100
            }),
            setActiveLayerOptions({
                visible: resolvedView === "blackWhite" || resolvedView === "all"
            })
        ]);
        captureLayer();

        await runBatchPlay([
            makeCurvesLayerWithPoints({
                name: "Invert",
                points: [[0, 255], [255, 0]]
            }),
            setActiveLayerOptions({
                visible: resolvedView === "invert" || resolvedView === "all"
            })
        ]);
        captureLayer();

        await runBatchPlay([
            selectLayerById(layerIds[0]),
            ...layerIds.slice(1).map((layerId) => selectLayerById(layerId, true)),
            groupSelectedLayers("Check Layer")
        ]);
    });

    return "Da tao group Check Texture theo legacy.";
};

export const runCheckTextureProLegacy = async ({ activeView = "skinBlemish" } = {}) => {
    const validViews = new Set(["saturation", "color", "hue", "luminosity", "negative", "contract", "testColor", "skinBlemish", "desaturate", "invert", "all"]);
    const resolvedView = validViews.has(activeView) ? activeView : "skinBlemish";
    const isVisible = (view) => resolvedView === view || resolvedView === "all";

    await executeLegacyTool("MEKO Check Texture Pro", async () => {
        const photoshop = getPhotoshopModule();
        const document = photoshop.app.activeDocument;
        const layerIds = [];
        const captureLayer = () => {
            const layer = document.activeLayers && document.activeLayers[0];
            if (!layer) {
                throw createError("Khong tao duoc Check Texture Pro layer.", "CHECK_TEXTURE_PRO_FAILED");
            }
            layerIds.push(Number(layer.id));
        };

        await runBatchPlay([
            makeHueSaturationLayer({ name: "Saturation", saturation: 60 }),
            setActiveLayerOptions({ mode: "luminosity", visible: isVisible("saturation") })
        ]);
        captureLayer();

        await runBatchPlay([
            makeHueSaturationLayer({ name: "Color", saturation: 100 }),
            setActiveLayerOptions({ mode: "color", visible: isVisible("color") })
        ]);
        captureLayer();

        await runBatchPlay([
            makeHueSaturationLayer({ name: "Hue", hue: 15, saturation: 0 }),
            setActiveLayerOptions({ mode: "hue", visible: isVisible("hue") })
        ]);
        captureLayer();

        await runBatchPlay([
            makeHueSaturationLayer({ name: "Luminosity", saturation: -100 }),
            setActiveLayerOptions({ mode: "luminosity", visible: isVisible("luminosity") })
        ]);
        captureLayer();

        await runBatchPlay([
            makeCurvesLayerWithPoints({ name: "Negative", points: [[0, 255], [255, 0]] }),
            setActiveLayerOptions({ visible: isVisible("negative") })
        ]);
        captureLayer();

        await runBatchPlay([
            makeCurvesLayerWithPoints({ name: "Contract", points: [[0, 0], [96, 64], [160, 192], [255, 255]] }),
            setActiveLayerOptions({ visible: isVisible("contract") })
        ]);
        captureLayer();

        await runBatchPlay([
            makeSolidColorLayer({ name: "Test Color", red: 128, green: 80, blue: 45 }),
            setActiveLayerOptions({ mode: "color", visible: isVisible("testColor") })
        ]);
        captureLayer();

        await runBatchPlay([
            makeCurvesLayerWithPoints({ name: "Skin Blemish", points: [[0, 0], [48, 96], [128, 128], [208, 160], [255, 255]] }),
            setActiveLayerOptions({ visible: isVisible("skinBlemish") })
        ]);
        captureLayer();

        await runBatchPlay([
            makeHueSaturationLayer({ name: "Desaturate", saturation: -100 }),
            setActiveLayerOptions({ visible: isVisible("desaturate") })
        ]);
        captureLayer();

        await runBatchPlay([
            makeCurvesLayerWithPoints({ name: "Invert ", points: [[0, 255], [255, 0]] }),
            setActiveLayerOptions({ visible: isVisible("invert") })
        ]);
        captureLayer();

        await runBatchPlay([
            makeCurvesLayerWithPoints({ name: "Toi", points: [[0, 0], [128, 92], [255, 255]] }),
            setActiveLayerOptions({ mode: "multiply", visible: false })
        ]);
        captureLayer();

        await runBatchPlay([
            makeCurvesLayerWithPoints({ name: "Sang", points: [[0, 0], [128, 164], [255, 255]] }),
            setActiveLayerOptions({ mode: "screen", visible: false })
        ]);
        captureLayer();

        await runBatchPlay([
            selectLayerById(layerIds[0]),
            ...layerIds.slice(1).map((layerId) => selectLayerById(layerId, true)),
            groupSelectedLayers("Help")
        ]);
    });

    return "Da tao group Check Texture Pro theo legacy.";
};

export const runTextureLayer = async ({ radius = 4, opacity = 45, blendMode = "overlay", monochromatic = true } = {}) => {
    const resolvedRadius = clampNumber(radius, 4, 0.1, 250);
    const resolvedOpacity = clampNumber(opacity, 45, 1, 100);
    const resolvedBlendMode = blendMode === "softLight" || blendMode === "linearLight" ? blendMode : "overlay";
    const commands = [
        duplicateActiveLayer("MEKO Texture")
    ];

    if (monochromatic) {
        commands.push(desaturate());
    }

    commands.push(
        highPass(resolvedRadius),
        setActiveLayerOptions({
            mode: resolvedBlendMode,
            opacity: resolvedOpacity
        })
    );

    await executeLegacyTool("MEKO Texture", async () => {
        await runBatchPlay(commands);
    });

    return "Da tao layer Texture.";
};

export const runSharpenLayer = async ({ amount = 120, radius = 1.2, threshold = 2, opacity = 80 } = {}) => {
    const resolvedAmount = clampNumber(amount, 120, 1, 500);
    const resolvedRadius = clampNumber(radius, 1.2, 0.1, 250);
    const resolvedThreshold = Math.round(clampNumber(threshold, 2, 0, 255));
    const resolvedOpacity = clampNumber(opacity, 80, 1, 100);

    await executeLegacyTool("MEKO Sharpen", async () => {
        await runBatchPlay([
            duplicateActiveLayer("MEKO Tang Net"),
            unsharpMask({
                amount: resolvedAmount,
                radius: resolvedRadius,
                threshold: resolvedThreshold
            }),
            setActiveLayerOptions({
                mode: "luminosity",
                opacity: resolvedOpacity
            })
        ]);
    });

    return "Da tao layer Tang Net.";
};

export const runSkinHighPass = async ({ highPassRadius = 10, blurRadius = 3, opacity = 55 } = {}) => {
    const resolvedHighPassRadius = clampNumber(highPassRadius, 10, 0.1, 250);
    const resolvedBlurRadius = clampNumber(blurRadius, 3, 0.1, 250);
    const resolvedOpacity = clampNumber(opacity, 55, 1, 100);

    await executeLegacyTool("MEKO Skin High Pass", async () => {
        await runBatchPlay([
            duplicateActiveLayer("MEKO Da Highpass"),
            highPass(resolvedHighPassRadius),
            gaussianBlur(resolvedBlurRadius),
            invertActiveChannel(),
            setActiveLayerOptions({
                mode: "linearLight",
                opacity: resolvedOpacity
            }),
            addBlackLayerMask()
        ]);
    });

    return "Da tao Da Highpass voi mask den. To trang tren mask de lam min da.";
};

export const runTexturePro = async ({ fineRadius = 2, coarseRadius = 8, opacity = 55, monochromatic = true } = {}) => {
    const resolvedFineRadius = clampNumber(fineRadius, 2, 0.1, 250);
    const resolvedCoarseRadius = clampNumber(coarseRadius, 8, 0.1, 250);
    const resolvedOpacity = clampNumber(opacity, 55, 1, 100);

    if (resolvedCoarseRadius <= resolvedFineRadius) {
        throw createError("Coarse Radius phai lon hon Fine Radius.", "INVALID_TEXTURE_RADII");
    }

    await executeLegacyTool("MEKO Texture Pro", async () => {
        const photoshop = getPhotoshopModule();
        const document = photoshop.app.activeDocument;
        const sourceLayer = document.activeLayers && document.activeLayers[0];

        if (!sourceLayer) {
            throw createError("Hay chon mot layer anh truoc khi chay Texture Pro.", "NO_ACTIVE_LAYER");
        }

        const sourceLayerId = Number(sourceLayer.id);
        const fineCommands = [duplicateLayerById(sourceLayerId, "MEKO Texture Pro - Fine")];
        if (monochromatic) {
            fineCommands.push(desaturate());
        }
        fineCommands.push(
            highPass(resolvedFineRadius),
            setActiveLayerOptions({
                mode: "overlay",
                opacity: resolvedOpacity
            })
        );
        await runBatchPlay(fineCommands);
        const fineLayer = document.activeLayers && document.activeLayers[0];

        const coarseCommands = [duplicateLayerById(sourceLayerId, "MEKO Texture Pro - Coarse")];
        if (monochromatic) {
            coarseCommands.push(desaturate());
        }
        coarseCommands.push(
            highPass(resolvedCoarseRadius),
            setActiveLayerOptions({
                mode: "softLight",
                opacity: Math.max(1, Math.round(resolvedOpacity * 0.65))
            })
        );
        await runBatchPlay(coarseCommands);
        const coarseLayer = document.activeLayers && document.activeLayers[0];

        if (!fineLayer || !coarseLayer) {
            throw createError("Khong tao duoc cac layer Texture Pro.", "TEXTURE_PRO_FAILED");
        }

        await runBatchPlay([
            selectLayerById(Number(fineLayer.id)),
            selectLayerById(Number(coarseLayer.id), true),
            groupSelectedLayers("MEKO Texture Pro")
        ]);
    });

    return "Da tao group Texture Pro gom Fine va Coarse.";
};

export const runFrequencySeparation = async ({ radius = 6, bitDepth = "auto" } = {}) => {
    const resolvedRadius = clampNumber(radius, 6, 0.1, 250);
    const requestedBitDepth = bitDepth === "8" || bitDepth === "16" ? Number(bitDepth) : null;
    let completedBitDepth = null;

    await executeLegacyTool("MEKO Frequency Separation", async () => {
        const photoshop = getPhotoshopModule();
        const document = photoshop.app.activeDocument;
        const sourceLayer = document.activeLayers && document.activeLayers[0];

        if (!sourceLayer) {
            throw createError("Hay chon mot layer anh truoc khi chay Frequency Separation.", "NO_ACTIVE_LAYER");
        }

        const depthResult = await runBatchPlay([getDocumentDepth()]);
        const reportedDepth = depthResult && depthResult[0] ? Number(depthResult[0].depth) : NaN;
        const resolvedBitDepth = requestedBitDepth || reportedDepth;

        if (resolvedBitDepth !== 8 && resolvedBitDepth !== 16) {
            throw createError("Frequency Separation hien chi ho tro document 8-bit va 16-bit.", "UNSUPPORTED_BIT_DEPTH");
        }

        completedBitDepth = resolvedBitDepth;
        const sourceLayerId = Number(sourceLayer.id);

        await runBatchPlay([
            duplicateLayerById(sourceLayerId, "MEKO Low Frequency"),
            gaussianBlur(resolvedRadius)
        ]);
        const lowLayer = document.activeLayers && document.activeLayers[0];

        if (!lowLayer) {
            throw createError("Khong tao duoc layer Low Frequency.", "LOW_FREQUENCY_FAILED");
        }

        const lowLayerId = Number(lowLayer.id);
        await runBatchPlay([
            duplicateLayerById(sourceLayerId, "MEKO High Frequency")
        ]);
        const highLayer = document.activeLayers && document.activeLayers[0];

        if (!highLayer) {
            throw createError("Khong tao duoc layer High Frequency.", "HIGH_FREQUENCY_FAILED");
        }

        const highLayerId = Number(highLayer.id);
        await runBatchPlay([
            applyFrequencySeparation({
                lowLayerId,
                bitDepth: resolvedBitDepth
            }),
            setActiveLayerOptions({
                mode: "linearLight",
                opacity: 100
            }),
            selectLayerById(highLayerId),
            selectLayerById(lowLayerId, true),
            groupSelectedLayers("MEKO Frequency Separation")
        ]);
    });

    return `Da tao Frequency Separation ${completedBitDepth}-bit.`;
};

export const runFrequencyPro = async ({
    fineRadius = 3,
    coarseRadius = 12,
    mediumOpacity = 100,
    highOpacity = 100,
    bitDepth = "auto"
} = {}) => {
    const resolvedFineRadius = clampNumber(fineRadius, 3, 0.1, 250);
    const resolvedCoarseRadius = clampNumber(coarseRadius, 12, 0.1, 250);
    const resolvedMediumOpacity = clampNumber(mediumOpacity, 100, 1, 100);
    const resolvedHighOpacity = clampNumber(highOpacity, 100, 1, 100);
    const requestedBitDepth = bitDepth === "8" || bitDepth === "16" ? Number(bitDepth) : null;
    let completedBitDepth = null;

    if (resolvedCoarseRadius <= resolvedFineRadius) {
        throw createError("Coarse Radius phai lon hon Fine Radius.", "INVALID_FREQUENCY_RADII");
    }

    await executeLegacyTool("MEKO Frequency Pro", async () => {
        const photoshop = getPhotoshopModule();
        const document = photoshop.app.activeDocument;
        const sourceLayer = document.activeLayers && document.activeLayers[0];

        if (!sourceLayer) {
            throw createError("Hay chon mot layer anh truoc khi chay Frequency Pro.", "NO_ACTIVE_LAYER");
        }

        const depthResult = await runBatchPlay([getDocumentDepth()]);
        const reportedDepth = depthResult && depthResult[0] ? Number(depthResult[0].depth) : NaN;
        const resolvedBitDepth = requestedBitDepth || reportedDepth;

        if (resolvedBitDepth !== 8 && resolvedBitDepth !== 16) {
            throw createError("Frequency Pro hien chi ho tro document 8-bit va 16-bit.", "UNSUPPORTED_BIT_DEPTH");
        }

        completedBitDepth = resolvedBitDepth;
        const sourceLayerId = Number(sourceLayer.id);

        await runBatchPlay([
            duplicateLayerById(sourceLayerId, "MEKO Frequency Pro - Fine Base Temp"),
            gaussianBlur(resolvedFineRadius)
        ]);
        const fineBaseLayer = document.activeLayers && document.activeLayers[0];

        if (!fineBaseLayer) {
            throw createError("Khong tao duoc Fine Base cua Frequency Pro.", "FREQUENCY_PRO_FINE_BASE_FAILED");
        }

        await runBatchPlay([
            duplicateLayerById(sourceLayerId, "MEKO Frequency Pro - High"),
            applyFrequencySeparation({
                lowLayerId: Number(fineBaseLayer.id),
                bitDepth: resolvedBitDepth
            }),
            setActiveLayerOptions({
                mode: "linearLight",
                opacity: resolvedHighOpacity
            })
        ]);
        const highLayer = document.activeLayers && document.activeLayers[0];

        if (!highLayer) {
            throw createError("Khong tao duoc High Frequency.", "FREQUENCY_PRO_HIGH_FAILED");
        }

        await runBatchPlay([
            duplicateLayerById(sourceLayerId, "MEKO Frequency Pro - Low"),
            gaussianBlur(resolvedCoarseRadius)
        ]);
        const lowLayer = document.activeLayers && document.activeLayers[0];

        if (!lowLayer) {
            throw createError("Khong tao duoc Low Frequency.", "FREQUENCY_PRO_LOW_FAILED");
        }

        await runBatchPlay([
            duplicateLayerById(Number(fineBaseLayer.id), "MEKO Frequency Pro - Medium"),
            applyFrequencySeparation({
                lowLayerId: Number(lowLayer.id),
                bitDepth: resolvedBitDepth
            }),
            setActiveLayerOptions({
                mode: "linearLight",
                opacity: resolvedMediumOpacity
            })
        ]);
        const mediumLayer = document.activeLayers && document.activeLayers[0];

        if (!mediumLayer) {
            throw createError("Khong tao duoc Medium Frequency.", "FREQUENCY_PRO_MEDIUM_FAILED");
        }

        await runBatchPlay([
            deleteLayerById(Number(fineBaseLayer.id)),
            selectLayerById(Number(lowLayer.id)),
            selectLayerById(Number(highLayer.id), true),
            selectLayerById(Number(mediumLayer.id), true),
            groupSelectedLayers("MEKO Frequency Pro")
        ]);
    });

    return `Da tao Frequency Pro 3-band ${completedBitDepth}-bit.`;
};

export const runLuminosityMasks = async ({ levels = "3", includeMidtones = true } = {}) => {
    const resolvedLevels = levels === "2" ? 2 : 3;
    const suffix = buildMaskRunSuffix();
    const names = {
        lights1: `MEKO Lights 1 ${suffix}`,
        lights2: `MEKO Lights 2 ${suffix}`,
        lights3: `MEKO Lights 3 ${suffix}`,
        darks1: `MEKO Darks 1 ${suffix}`,
        darks2: `MEKO Darks 2 ${suffix}`,
        darks3: `MEKO Darks 3 ${suffix}`,
        midtones: `MEKO Midtones ${suffix}`
    };

    await executeLegacyTool("MEKO Luminosity Masks", async () => {
        const commands = [
            duplicateChannel("RGB", names.lights1),
            duplicateChannel(names.lights1, names.lights2),
            multiplyActiveChannel(names.lights1)
        ];

        if (resolvedLevels === 3) {
            commands.push(
                duplicateChannel(names.lights2, names.lights3),
                multiplyActiveChannel(names.lights1)
            );
        }

        commands.push(
            duplicateChannel("RGB", names.darks1),
            invertActiveChannel(),
            duplicateChannel(names.darks1, names.darks2),
            multiplyActiveChannel(names.darks1)
        );

        if (resolvedLevels === 3) {
            commands.push(
                duplicateChannel(names.darks2, names.darks3),
                multiplyActiveChannel(names.darks1)
            );
        }

        if (includeMidtones) {
            commands.push(
                duplicateChannel(names.lights1, names.midtones),
                multiplyActiveChannel(names.darks1)
            );
        }

        commands.push(selectCompositeChannel());
        await runBatchPlay(commands);
    });

    const channelCount = (resolvedLevels * 2) + (includeMidtones ? 1 : 0);
    return `Da tao ${channelCount} Luminosity Mask trong Channels.`;
};

export const runIncreaseBrightness = async ({ strength = 28, opacity = 100, blackMask = false } = {}) => {
    const resolvedStrength = Math.round(clampNumber(strength, 28, 5, 100));
    const resolvedOpacity = clampNumber(opacity, 100, 1, 100);
    const midpoint = Math.min(228, 128 + resolvedStrength);

    await executeLegacyTool("MEKO Increase Brightness", async () => {
        const commands = [
            makeCurvesLayer({
                name: "MEKO Tang Sang",
                midpoint
            })
        ];

        if (blackMask) {
            commands.push(invertActiveChannel());
        }

        commands.push(setActiveLayerOptions({
            mode: "luminosity",
            opacity: resolvedOpacity
        }));
        await runBatchPlay(commands);
    });

    return blackMask
        ? "Da tao Curves Tang Sang voi mask den."
        : "Da tao Curves Tang Sang.";
};

export const runFixOverexposure = async ({ strength = 35, highlightLevel = "2", opacity = 100 } = {}) => {
    const resolvedStrength = Math.round(clampNumber(strength, 35, 5, 100));
    const resolvedOpacity = clampNumber(opacity, 100, 1, 100);
    const resolvedHighlightLevel = highlightLevel === "1" || highlightLevel === "3"
        ? Number(highlightLevel)
        : 2;
    const midpoint = Math.max(48, 128 - Math.round(resolvedStrength * 0.4));
    const highlight = Math.max(155, 255 - resolvedStrength);

    await executeLegacyTool("MEKO Fix Overexposure", async () => {
        const commands = [loadCompositeAsSelection()];

        for (let level = 1; level < resolvedHighlightLevel; level += 1) {
            commands.push(loadCompositeAsSelection(true));
        }

        commands.push(
            makeCurvesLayerWithPoints({
                name: `MEKO Fix Du Sang L${resolvedHighlightLevel}`,
                points: [
                    [0, 0],
                    [128, midpoint],
                    [255, highlight]
                ]
            }),
            setActiveLayerOptions({
                mode: "luminosity",
                opacity: resolvedOpacity
            }),
            clearSelection()
        );

        await runBatchPlay(commands);
    });

    return `Da tao Fix Du Sang voi Lights ${resolvedHighlightLevel} mask.`;
};

export const runHighlightPop = async ({ strength = 30, highlightLevel = "2", opacity = 75 } = {}) => {
    const resolvedStrength = Math.round(clampNumber(strength, 30, 5, 100));
    const resolvedOpacity = clampNumber(opacity, 75, 1, 100);
    const resolvedLevel = highlightLevel === "1" || highlightLevel === "3"
        ? Number(highlightLevel)
        : 2;
    const upperMidpoint = Math.min(245, 190 + Math.round(resolvedStrength * 0.55));
    const highlightPoint = Math.min(250, 235 + Math.round(resolvedStrength * 0.2));

    await executeLegacyTool("MEKO Highlight Pop", async () => {
        const commands = [loadCompositeAsSelection()];

        for (let level = 1; level < resolvedLevel; level += 1) {
            commands.push(loadCompositeAsSelection(true));
        }

        commands.push(
            makeCurvesLayerWithPoints({
                name: `MEKO Noi Vung Sang L${resolvedLevel}`,
                points: [
                    [0, 0],
                    [128, 128],
                    [190, upperMidpoint],
                    [235, highlightPoint],
                    [255, 255]
                ]
            }),
            setActiveLayerOptions({
                mode: "luminosity",
                opacity: resolvedOpacity
            }),
            clearSelection()
        );

        await runBatchPlay(commands);
    });

    return `Da tao Noi Vung Sang voi Lights ${resolvedLevel} mask.`;
};

export const runHdrHighlights = async ({ strength = 32, highlightLevel = "2", opacity = 75 } = {}) => {
    const resolvedStrength = Math.round(clampNumber(strength, 32, 5, 100));
    const resolvedOpacity = clampNumber(opacity, 75, 1, 100);
    const resolvedLevel = highlightLevel === "1" || highlightLevel === "3"
        ? Number(highlightLevel)
        : 2;
    const midpoint = Math.max(88, 128 - Math.round(resolvedStrength * 0.2));
    const upperMidpoint = Math.max(145, 205 - Math.round(resolvedStrength * 0.55));
    const whitePoint = Math.max(205, 255 - Math.round(resolvedStrength * 0.35));

    await executeLegacyTool("MEKO HDR Highlights", async () => {
        const commands = [loadCompositeAsSelection()];

        for (let level = 1; level < resolvedLevel; level += 1) {
            commands.push(loadCompositeAsSelection(true));
        }

        commands.push(
            makeCurvesLayerWithPoints({
                name: `MEKO HDR Vung Sang L${resolvedLevel}`,
                points: [
                    [0, 0],
                    [128, midpoint],
                    [205, upperMidpoint],
                    [255, whitePoint]
                ]
            }),
            setActiveLayerOptions({
                mode: "luminosity",
                opacity: resolvedOpacity
            }),
            clearSelection()
        );

        await runBatchPlay(commands);
    });

    return `Da tao HDR Vung Sang voi Lights ${resolvedLevel} mask.`;
};

export const runHdrShadows = async ({ strength = 32, shadowLevel = "2", opacity = 75 } = {}) => {
    const resolvedStrength = Math.round(clampNumber(strength, 32, 5, 100));
    const resolvedOpacity = clampNumber(opacity, 75, 1, 100);
    const resolvedLevel = shadowLevel === "1" || shadowLevel === "3"
        ? Number(shadowLevel)
        : 2;
    const suffix = buildMaskRunSuffix();
    const darks1 = `MEKO HDR Temp Darks 1 ${suffix}`;
    const darks2 = `MEKO HDR Temp Darks 2 ${suffix}`;
    const darks3 = `MEKO HDR Temp Darks 3 ${suffix}`;
    const shadowPoint = Math.min(125, 50 + Math.round(resolvedStrength * 0.65));
    const midpoint = Math.min(175, 128 + Math.round(resolvedStrength * 0.3));

    await executeLegacyTool("MEKO HDR Shadows", async () => {
        const commands = [
            duplicateChannel("RGB", darks1),
            invertActiveChannel()
        ];
        let selectedMask = darks1;
        const temporaryChannels = [darks1];

        if (resolvedLevel >= 2) {
            commands.push(
                duplicateChannel(darks1, darks2),
                multiplyActiveChannel(darks1)
            );
            selectedMask = darks2;
            temporaryChannels.push(darks2);
        }

        if (resolvedLevel === 3) {
            commands.push(
                duplicateChannel(darks2, darks3),
                multiplyActiveChannel(darks1)
            );
            selectedMask = darks3;
            temporaryChannels.push(darks3);
        }

        commands.push(
            loadChannelAsSelection(selectedMask),
            selectCompositeChannel(),
            makeCurvesLayerWithPoints({
                name: `MEKO HDR Vung Toi L${resolvedLevel}`,
                points: [
                    [0, 0],
                    [50, shadowPoint],
                    [128, midpoint],
                    [255, 255]
                ]
            }),
            setActiveLayerOptions({
                mode: "luminosity",
                opacity: resolvedOpacity
            }),
            clearSelection(),
            ...temporaryChannels.reverse().map(deleteChannel)
        );

        await runBatchPlay(commands);
    });

    return `Da tao HDR Vung Toi voi Darks ${resolvedLevel} mask.`;
};

export const runHdrOverall = async ({ strength = 30, contrast = 20, opacity = 70 } = {}) => {
    const resolvedStrength = Math.round(clampNumber(strength, 30, 5, 100));
    const resolvedContrast = Math.round(clampNumber(contrast, 20, 0, 80));
    const resolvedOpacity = clampNumber(opacity, 70, 1, 100);
    const highlightMidpoint = Math.max(88, 128 - Math.round(resolvedStrength * 0.2));
    const highlightUpper = Math.max(145, 205 - Math.round(resolvedStrength * 0.55));
    const highlightWhite = Math.max(205, 255 - Math.round(resolvedStrength * 0.35));
    const shadowPoint = Math.min(125, 50 + Math.round(resolvedStrength * 0.65));
    const shadowMidpoint = Math.min(175, 128 + Math.round(resolvedStrength * 0.3));
    const contrastShadow = Math.max(24, 64 - Math.round(resolvedContrast * 0.4));
    const contrastHighlight = Math.min(232, 192 + Math.round(resolvedContrast * 0.4));
    const suffix = buildMaskRunSuffix();
    const tempDarks1 = `MEKO HDR Overall Temp D1 ${suffix}`;
    const tempDarks2 = `MEKO HDR Overall Temp D2 ${suffix}`;

    await executeLegacyTool("MEKO HDR Overall", async () => {
        const photoshop = getPhotoshopModule();
        const document = photoshop.app.activeDocument;
        const layerIds = [];
        const captureLayerId = () => {
            const layer = document.activeLayers && document.activeLayers[0];
            if (!layer) {
                throw createError("Khong tao duoc HDR Tong The layer.", "HDR_OVERALL_LAYER_FAILED");
            }
            layerIds.push(Number(layer.id));
        };

        await runBatchPlay([
            loadCompositeAsSelection(),
            loadCompositeAsSelection(true),
            makeCurvesLayerWithPoints({
                name: "MEKO HDR Tong The - Highlights",
                points: [
                    [0, 0],
                    [128, highlightMidpoint],
                    [205, highlightUpper],
                    [255, highlightWhite]
                ]
            }),
            setActiveLayerOptions({
                mode: "luminosity",
                opacity: resolvedOpacity
            }),
            clearSelection()
        ]);
        captureLayerId();

        await runBatchPlay([
            duplicateChannel("RGB", tempDarks1),
            invertActiveChannel(),
            duplicateChannel(tempDarks1, tempDarks2),
            multiplyActiveChannel(tempDarks1),
            loadChannelAsSelection(tempDarks2),
            selectCompositeChannel(),
            makeCurvesLayerWithPoints({
                name: "MEKO HDR Tong The - Shadows",
                points: [
                    [0, 0],
                    [50, shadowPoint],
                    [128, shadowMidpoint],
                    [255, 255]
                ]
            }),
            setActiveLayerOptions({
                mode: "luminosity",
                opacity: resolvedOpacity
            }),
            clearSelection(),
            deleteChannel(tempDarks2),
            deleteChannel(tempDarks1)
        ]);
        captureLayerId();

        await runBatchPlay([
            makeCurvesLayerWithPoints({
                name: "MEKO HDR Tong The - Midtone Contrast",
                points: [
                    [0, 0],
                    [64, contrastShadow],
                    [128, 128],
                    [192, contrastHighlight],
                    [255, 255]
                ]
            }),
            setActiveLayerOptions({
                mode: "luminosity",
                opacity: resolvedOpacity
            })
        ]);
        captureLayerId();

        await runBatchPlay([
            selectLayerById(layerIds[0]),
            ...layerIds.slice(1).map((layerId) => selectLayerById(layerId, true)),
            groupSelectedLayers("MEKO HDR Tong The")
        ]);
    });

    return "Da tao group HDR Tong The gom Highlights, Shadows va Midtone Contrast.";
};

export const runFixHdrSharpen = async ({
    detailRadius = 3,
    detailOpacity = 45,
    sharpenAmount = 90,
    sharpenRadius = 0.8,
    sharpenOpacity = 55
} = {}) => {
    const resolvedDetailRadius = clampNumber(detailRadius, 3, 0.1, 250);
    const resolvedDetailOpacity = clampNumber(detailOpacity, 45, 1, 100);
    const resolvedSharpenAmount = clampNumber(sharpenAmount, 90, 1, 500);
    const resolvedSharpenRadius = clampNumber(sharpenRadius, 0.8, 0.1, 250);
    const resolvedSharpenOpacity = clampNumber(sharpenOpacity, 55, 1, 100);
    const suffix = buildMaskRunSuffix();
    const tempLights = `MEKO Fix Net HDR Temp Lights ${suffix}`;
    const tempDarks = `MEKO Fix Net HDR Temp Darks ${suffix}`;
    const tempMidtones = `MEKO Fix Net HDR Temp Midtones ${suffix}`;

    await executeLegacyTool("MEKO Fix HDR Sharpen", async () => {
        const photoshop = getPhotoshopModule();
        const document = photoshop.app.activeDocument;
        const sourceLayer = document.activeLayers && document.activeLayers[0];

        if (!sourceLayer) {
            throw createError("Hay chon mot layer anh truoc khi chay Fix Net HDR.", "NO_ACTIVE_LAYER");
        }

        const sourceLayerId = Number(sourceLayer.id);
        await runBatchPlay([
            duplicateLayerById(sourceLayerId, "MEKO Fix Net HDR - Detail"),
            desaturate(),
            highPass(resolvedDetailRadius),
            setActiveLayerOptions({
                mode: "overlay",
                opacity: resolvedDetailOpacity
            })
        ]);
        const detailLayer = document.activeLayers && document.activeLayers[0];

        await runBatchPlay([
            duplicateLayerById(sourceLayerId, "MEKO Fix Net HDR - Edge"),
            unsharpMask({
                amount: resolvedSharpenAmount,
                radius: resolvedSharpenRadius,
                threshold: 2
            }),
            setActiveLayerOptions({
                mode: "luminosity",
                opacity: resolvedSharpenOpacity
            })
        ]);
        const edgeLayer = document.activeLayers && document.activeLayers[0];

        if (!detailLayer || !edgeLayer) {
            throw createError("Khong tao duoc cac layer Fix Net HDR.", "FIX_HDR_SHARPEN_FAILED");
        }

        await runBatchPlay([
            selectLayerById(Number(detailLayer.id)),
            selectLayerById(Number(edgeLayer.id), true),
            groupSelectedLayers("MEKO Fix Net HDR")
        ]);
        const groupLayer = document.activeLayers && document.activeLayers[0];

        if (!groupLayer) {
            throw createError("Khong tao duoc group Fix Net HDR.", "FIX_HDR_GROUP_FAILED");
        }

        await runBatchPlay([
            duplicateChannel("RGB", tempLights),
            duplicateChannel("RGB", tempDarks),
            invertActiveChannel(),
            duplicateChannel(tempLights, tempMidtones),
            multiplyActiveChannel(tempDarks),
            loadChannelAsSelection(tempMidtones),
            selectCompositeChannel(),
            selectLayerById(Number(groupLayer.id)),
            addSelectionLayerMask(),
            clearSelection(),
            deleteChannel(tempMidtones),
            deleteChannel(tempDarks),
            deleteChannel(tempLights)
        ]);
    });

    return "Da tao group Fix Net HDR voi Midtones mask.";
};

export const runCheckColor = async ({ activeView = "color", saturation = 100 } = {}) => {
    const resolvedView = ["color", "luminosity", "saturation", "solar", "none"].includes(activeView)
        ? activeView
        : "color";
    const resolvedSaturation = Math.round(clampNumber(saturation, 100, 10, 100));

    await executeLegacyTool("MEKO Check Color", async () => {
        const photoshop = getPhotoshopModule();
        const document = photoshop.app.activeDocument;
        const layerIds = [];
        const captureActiveLayer = () => {
            const layer = document.activeLayers && document.activeLayers[0];
            if (!layer) {
                throw createError("Khong tao duoc Check Color layer.", "CHECK_COLOR_LAYER_FAILED");
            }
            layerIds.push(Number(layer.id));
        };

        await runBatchPlay([
            makeSolidColorLayer({
                name: "MEKO Check - Luminosity",
                red: 0,
                green: 0,
                blue: 0
            }),
            setActiveLayerOptions({
                mode: "color",
                visible: resolvedView === "luminosity"
            })
        ]);
        captureActiveLayer();

        await runBatchPlay([
            makeSolidColorLayer({
                name: "MEKO Check - Color Only",
                red: 128,
                green: 128,
                blue: 128
            }),
            setActiveLayerOptions({
                mode: "luminosity",
                visible: resolvedView === "color"
            })
        ]);
        captureActiveLayer();

        await runBatchPlay([
            makeHueSaturationLayer({
                name: "MEKO Check - Saturation",
                saturation: resolvedSaturation
            }),
            setActiveLayerOptions({
                visible: resolvedView === "saturation"
            })
        ]);
        captureActiveLayer();

        await runBatchPlay([
            makeCurvesLayerWithPoints({
                name: "MEKO Check - Solar Curve",
                points: [
                    [0, 0],
                    [32, 255],
                    [64, 0],
                    [96, 255],
                    [128, 0],
                    [160, 255],
                    [192, 0],
                    [224, 255],
                    [255, 0]
                ]
            }),
            setActiveLayerOptions({
                mode: "luminosity",
                visible: resolvedView === "solar"
            })
        ]);
        captureActiveLayer();

        await runBatchPlay([
            selectLayerById(layerIds[0]),
            ...layerIds.slice(1).map((layerId) => selectLayerById(layerId, true)),
            groupSelectedLayers("MEKO Check Color")
        ]);
    });

    const viewLabel = {
        color: "Color Only",
        luminosity: "Luminosity",
        saturation: "Saturation",
        solar: "Solar Curve",
        none: "khong bat Check layer"
    }[resolvedView];

    return `Da tao group Check Color, dang bat ${viewLabel}.`;
};

export const runColorCorrection = async ({
    tonalRange = "midtones",
    cyanRed = 0,
    magentaGreen = 0,
    yellowBlue = 0,
    opacity = 100,
    preserveLuminosity = true,
    blackMask = false
} = {}) => {
    const resolvedRange = tonalRange === "shadows" || tonalRange === "highlights"
        ? tonalRange
        : "midtones";
    const resolvedLevels = [
        Math.round(clampNumber(cyanRed, 0, -100, 100)),
        Math.round(clampNumber(magentaGreen, 0, -100, 100)),
        Math.round(clampNumber(yellowBlue, 0, -100, 100))
    ];
    const resolvedOpacity = clampNumber(opacity, 100, 1, 100);
    const zeroLevels = [0, 0, 0];
    const rangeLabel = {
        shadows: "Shadows",
        midtones: "Midtones",
        highlights: "Highlights"
    }[resolvedRange];

    await executeLegacyTool("MEKO Color Correction", async () => {
        const commands = [
            makeColorBalanceLayer({
                name: `MEKO Color Correction - ${rangeLabel}`,
                shadowLevels: resolvedRange === "shadows" ? resolvedLevels : zeroLevels,
                midtoneLevels: resolvedRange === "midtones" ? resolvedLevels : zeroLevels,
                highlightLevels: resolvedRange === "highlights" ? resolvedLevels : zeroLevels,
                preserveLuminosity
            })
        ];

        if (blackMask) {
            commands.push(invertActiveChannel());
        }

        commands.push(setActiveLayerOptions({
            opacity: resolvedOpacity
        }));
        await runBatchPlay(commands);
    });

    return blackMask
        ? `Da tao Color Correction ${rangeLabel} voi mask den.`
        : `Da tao Color Correction ${rangeLabel}.`;
};

export const runSkinBrightening = async ({ strength = 22, desaturation = 6, opacity = 100 } = {}) => {
    const resolvedStrength = Math.round(clampNumber(strength, 22, 5, 60));
    const resolvedDesaturation = Math.round(clampNumber(desaturation, 6, 0, 40));
    const resolvedOpacity = clampNumber(opacity, 100, 1, 100);
    const midpoint = Math.min(188, 128 + resolvedStrength);
    const highlight = Math.min(235, 210 + Math.round(resolvedStrength * 0.25));

    await executeLegacyTool("MEKO Skin Brightening", async () => {
        const photoshop = getPhotoshopModule();
        const document = photoshop.app.activeDocument;
        const layerIds = [];
        const captureLayer = () => {
            const layer = document.activeLayers && document.activeLayers[0];
            if (!layer) {
                throw createError("Khong tao duoc Sang Da layer.", "SKIN_BRIGHTENING_FAILED");
            }
            layerIds.push(Number(layer.id));
        };

        await runBatchPlay([
            makeCurvesLayerWithPoints({
                name: "MEKO Sang Da - Light",
                points: [
                    [0, 0],
                    [64, 64],
                    [128, midpoint],
                    [210, highlight],
                    [255, 255]
                ]
            }),
            setActiveLayerOptions({
                mode: "luminosity"
            })
        ]);
        captureLayer();

        await runBatchPlay([
            makeHueSaturationLayer({
                name: "MEKO Sang Da - Saturation",
                saturation: -resolvedDesaturation
            })
        ]);
        captureLayer();

        await runBatchPlay([
            selectLayerById(layerIds[0]),
            selectLayerById(layerIds[1], true),
            groupSelectedLayers("MEKO Sang Da"),
            setActiveLayerOptions({
                opacity: resolvedOpacity
            }),
            addBlackLayerMask()
        ]);
    });

    return "Da tao group Sang Da voi mask den. To trang tren mask de ap dung len da.";
};

export const runEvenSkin = async ({
    rednessCorrection = 10,
    warmth = 0,
    toneBalance = 8,
    desaturation = 4,
    opacity = 100
} = {}) => {
    const resolvedRedness = Math.round(clampNumber(rednessCorrection, 10, 0, 40));
    const resolvedWarmth = Math.round(clampNumber(warmth, 0, -30, 30));
    const resolvedToneBalance = Math.round(clampNumber(toneBalance, 8, 0, 30));
    const resolvedDesaturation = Math.round(clampNumber(desaturation, 4, 0, 30));
    const resolvedOpacity = clampNumber(opacity, 100, 1, 100);

    await executeLegacyTool("MEKO Even Skin", async () => {
        const photoshop = getPhotoshopModule();
        const document = photoshop.app.activeDocument;
        const layerIds = [];
        const captureLayer = () => {
            const layer = document.activeLayers && document.activeLayers[0];
            if (!layer) {
                throw createError("Khong tao duoc Deu Da layer.", "EVEN_SKIN_FAILED");
            }
            layerIds.push(Number(layer.id));
        };

        await runBatchPlay([
            makeColorBalanceLayer({
                name: "MEKO Deu Da - Color Balance",
                shadowLevels: [0, 0, 0],
                midtoneLevels: [-resolvedRedness, 0, -resolvedWarmth],
                highlightLevels: [0, 0, 0],
                preserveLuminosity: true
            })
        ]);
        captureLayer();

        await runBatchPlay([
            makeHueSaturationLayer({
                name: "MEKO Deu Da - Saturation",
                saturation: -resolvedDesaturation
            })
        ]);
        captureLayer();

        await runBatchPlay([
            makeCurvesLayerWithPoints({
                name: "MEKO Deu Da - Tone Balance",
                points: [
                    [0, 0],
                    [64, 64 + resolvedToneBalance],
                    [128, 128],
                    [192, 192 - resolvedToneBalance],
                    [255, 255]
                ]
            }),
            setActiveLayerOptions({ mode: "luminosity" })
        ]);
        captureLayer();

        await runBatchPlay([
            selectLayerById(layerIds[0]),
            ...layerIds.slice(1).map((layerId) => selectLayerById(layerId, true)),
            groupSelectedLayers("MEKO Deu Da"),
            setActiveLayerOptions({ opacity: resolvedOpacity }),
            addBlackLayerMask()
        ]);
    });

    return "Da tao group Deu Da voi mask den. To trang tren mask de ap dung len vung da can can bang.";
};

export const runTeethWhitening = async ({
    yellowReduction = 55,
    brightness = 14,
    opacity = 100
} = {}) => {
    const resolvedYellowReduction = Math.round(clampNumber(yellowReduction, 55, 0, 100));
    const resolvedBrightness = Math.round(clampNumber(brightness, 14, 0, 40));
    const resolvedOpacity = clampNumber(opacity, 100, 1, 100);
    const midpoint = Math.min(168, 128 + resolvedBrightness);
    const highlight = Math.min(235, 210 + Math.round(resolvedBrightness * 0.5));

    await executeLegacyTool("MEKO Teeth Whitening", async () => {
        const photoshop = getPhotoshopModule();
        const document = photoshop.app.activeDocument;
        const layerIds = [];
        const captureLayer = () => {
            const layer = document.activeLayers && document.activeLayers[0];
            if (!layer) {
                throw createError("Khong tao duoc Trang Rang layer.", "TEETH_WHITENING_FAILED");
            }
            layerIds.push(Number(layer.id));
        };

        await runBatchPlay([
            makeHueSaturationLayer({
                name: "MEKO Trang Rang - Giam Vang",
                channel: "yellow",
                saturation: -resolvedYellowReduction,
                lightness: Math.round(resolvedBrightness * 0.35)
            })
        ]);
        captureLayer();

        await runBatchPlay([
            makeCurvesLayerWithPoints({
                name: "MEKO Trang Rang - Sang",
                points: [
                    [0, 0],
                    [64, 64],
                    [128, midpoint],
                    [210, highlight],
                    [255, 255]
                ]
            }),
            setActiveLayerOptions({ mode: "luminosity" })
        ]);
        captureLayer();

        await runBatchPlay([
            selectLayerById(layerIds[0]),
            selectLayerById(layerIds[1], true),
            groupSelectedLayers("MEKO Trang Rang"),
            setActiveLayerOptions({ opacity: resolvedOpacity }),
            addBlackLayerMask()
        ]);
    });

    return "Da tao group Trang Rang voi mask den. To trang tren mask de ap dung len rang.";
};

export const runLipColor = async ({ color = "rose", intensity = 65 } = {}) => {
    const colors = {
        natural: [153, 52, 64],
        rose: [184, 63, 91],
        red: [190, 33, 45],
        coral: [211, 82, 70],
        mauve: [139, 68, 92]
    };
    const resolvedColorName = Object.prototype.hasOwnProperty.call(colors, color) ? color : "rose";
    const [red, green, blue] = colors[resolvedColorName];
    const resolvedIntensity = clampNumber(intensity, 65, 1, 100);

    await executeLegacyTool("MEKO Lip Color", async () => {
        await runBatchPlay([
            makeSolidColorLayer({
                name: `MEKO Son Moi - ${resolvedColorName}`,
                red,
                green,
                blue
            }),
            setActiveLayerOptions({
                mode: "color",
                opacity: resolvedIntensity
            }),
            addBlackLayerMask()
        ]);
    });

    return "Da tao layer Son Moi voi mask den. To trang tren mask de ap dung len moi.";
};

export const runBlush = async ({ color = "natural", intensity = 35 } = {}) => {
    const colors = {
        natural: [205, 107, 112],
        rose: [220, 115, 145],
        peach: [229, 137, 107],
        coral: [221, 105, 91],
        mauve: [174, 105, 135]
    };
    const resolvedColorName = Object.prototype.hasOwnProperty.call(colors, color) ? color : "natural";
    const [red, green, blue] = colors[resolvedColorName];
    const resolvedIntensity = clampNumber(intensity, 35, 1, 100);

    await executeLegacyTool("MEKO Blush", async () => {
        await runBatchPlay([
            makeSolidColorLayer({
                name: `MEKO Ma Hong - ${resolvedColorName}`,
                red,
                green,
                blue
            }),
            setActiveLayerOptions({
                mode: "softLight",
                opacity: resolvedIntensity
            }),
            addBlackLayerMask()
        ]);
    });

    return "Da tao layer Ma Hong voi mask den. To trang tren mask de ap dung len ma.";
};

export const runRetouchMaster = async ({
    fineRadius = 3,
    coarseRadius = 12,
    dodgeBurnStrength = 32,
    includeSkinHighPass = true,
    includeTexture = false,
    includeCheckColor = true
} = {}) => {
    const photoshop = getPhotoshopModule();
    const document = photoshop.app && photoshop.app.activeDocument;

    if (!document) {
        throw createError("Hay mo document Photoshop truoc khi chay Retouch Master.", "NO_ACTIVE_DOCUMENT");
    }

    const sourceLayer = document.activeLayers && document.activeLayers[0];
    if (!sourceLayer) {
        throw createError("Hay chon mot layer anh truoc khi chay Retouch Master.", "NO_ACTIVE_LAYER");
    }

    const sourceLayerId = Number(sourceLayer.id);
    const componentIds = [];
    const selectSourceLayer = async () => {
        await executeLegacyTool("MEKO Retouch Master - Select Source", async () => {
            await runBatchPlay([selectLayerById(sourceLayerId)]);
        });
    };
    const captureComponent = (label) => {
        const layer = document.activeLayers && document.activeLayers[0];
        if (!layer) {
            throw createError(`Khong tao duoc ${label} trong Retouch Master.`, "RETOUCH_MASTER_COMPONENT_FAILED");
        }
        componentIds.push(Number(layer.id));
    };

    await selectSourceLayer();
    await runFrequencyPro({
        fineRadius,
        coarseRadius,
        mediumOpacity: 100,
        highOpacity: 100,
        bitDepth: "auto"
    });
    captureComponent("Frequency Pro");

    if (includeSkinHighPass) {
        await selectSourceLayer();
        await runSkinHighPass({
            highPassRadius: Math.max(6, Number(coarseRadius) || 12),
            blurRadius: Math.max(1, (Number(fineRadius) || 3)),
            opacity: 50
        });
        captureComponent("Da Highpass");
    }

    await selectSourceLayer();
    await runDodgeBurnMaster({
        strength: dodgeBurnStrength,
        opacity: 100,
        checkMode: "none"
    });
    captureComponent("D&B Master");

    await selectSourceLayer();
    await runColorRetouchLayer({ opacity: 100 });
    captureComponent("Color Retouch");

    if (includeTexture) {
        await selectSourceLayer();
        await runTexturePro({
            fineRadius: Math.max(0.5, Math.min(4, Number(fineRadius) || 2)),
            coarseRadius: Math.max(5, Number(coarseRadius) || 8),
            opacity: 40,
            monochromatic: true
        });
        captureComponent("Texture Pro");
    }

    if (includeCheckColor) {
        await selectSourceLayer();
        await runCheckColor({
            activeView: "none",
            saturation: 100
        });
        captureComponent("Check Color");
    }

    await executeLegacyTool("MEKO Retouch Master - Assemble", async () => {
        await runBatchPlay([
            selectLayerById(componentIds[0]),
            ...componentIds.slice(1).map((layerId) => selectLayerById(layerId, true)),
            groupSelectedLayers("MEKO Retouch Master")
        ]);
    });

    return `Da tao Retouch Master gom ${componentIds.length} workflow.`;
};
