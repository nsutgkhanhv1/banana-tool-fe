import React, { useMemo, useState } from "react";
import { addLogoToDocument, exportFacebookImage, pickLogoFile } from "../lib/branding-export.js";
import { filterAndCopyImages, pickImageFolder } from "../lib/image-filter.js";
import {
    runAddNoiseLayer,
    runCheckColor,
    runCheckTextureLegacy,
    runCheckTextureProLegacy,
    runColorCorrection,
    runColorCorrectionPro,
    runColorRetouchLayer,
    runDodgeBurnCurves,
    runDodgeBurnGrayLayer,
    runDodgeBurnMaster,
    runDreamyBlur,
    runFrequencyPro,
    runFrequencySeparation,
    runFixHdrSharpen,
    runFixOverexposure,
    runHdrHighlights,
    runHdrOverall,
    runHdrShadows,
    runHighPassSharpen,
    runHighlightBoost,
    runHighlightPop,
    runIncreaseBrightness,
    runLuminosityMasks,
    runLipColor,
    runBlush,
    runRetouchMaster,
    runSmoothNoiseLayer,
    runSharpenLayer,
    runSkinBrightening,
    runEvenSkin,
    runSkinHighPass,
    runTextureLayer,
    runTexturePro,
    runTeethWhitening,
    runDarkBoost,
    runUpscalePro
} from "../lib/legacy-tools.js";

const TOOL_GROUPS = [
    {
        title: "Master Workflows",
        tools: [
            {
                id: "retouch-master",
                label: "Retouch Master",
                description: "Dung bo retouch hoan chinh va gom cac workflow vao mot group tong.",
                defaults: {
                    fineRadius: 3,
                    coarseRadius: 12,
                    dodgeBurnStrength: 32,
                    includeSkinHighPass: true,
                    includeTexture: false,
                    includeCheckColor: true
                },
                fields: [
                    { key: "fineRadius", label: "Fine Radius", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "px" },
                    { key: "coarseRadius", label: "Coarse Radius", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "px" },
                    { key: "dodgeBurnStrength", label: "D&B Strength", type: "number", min: 5, max: 100, step: 1 },
                    { key: "includeSkinHighPass", label: "Da Highpass", type: "checkbox" },
                    { key: "includeTexture", label: "Texture Pro", type: "checkbox" },
                    { key: "includeCheckColor", label: "Check Color", type: "checkbox" }
                ],
                run: runRetouchMaster
            }
        ]
    },
    {
        title: "Brand & Export",
        tools: [
            {
                id: "add-logo",
                label: "Add Logo Meko",
                description: "Chen logo hoac text watermark vao document, scale/can vi tri theo legacy Watermark VIP.",
                defaults: {
                    logoFile: null,
                    watermarkType: "logo",
                    watermarkText: "© Mekomedia.vn",
                    font: "ArialMT",
                    fontSize: 40,
                    position: "bottomRight",
                    sizePercent: 20,
                    marginPercent: 3,
                    opacity: 80
                },
                fields: [
                    {
                        key: "watermarkType",
                        label: "Type",
                        type: "select",
                        options: [
                            { value: "logo", label: "Logo Watermark" },
                            { value: "text", label: "Text Watermark" }
                        ]
                    },
                    { key: "logoFile", label: "Logo File", type: "file" },
                    { key: "watermarkText", label: "Text", type: "text", placeholder: "© Mekomedia.vn" },
                    { key: "font", label: "Font PS Name", type: "text", placeholder: "ArialMT" },
                    { key: "fontSize", label: "Font Size", type: "number", min: 6, max: 300, step: 1, suffix: "pt" },
                    {
                        key: "position",
                        label: "Position",
                        type: "select",
                        options: [
                            { value: "topLeft", label: "Top Left" },
                            { value: "topRight", label: "Top Right" },
                            { value: "bottomLeft", label: "Bottom Left" },
                            { value: "bottomRight", label: "Bottom Right" },
                            { value: "center", label: "Center" }
                        ]
                    },
                    { key: "sizePercent", label: "Logo Width", type: "number", min: 1, max: 100, step: 1, suffix: "%" },
                    { key: "marginPercent", label: "Margin", type: "number", min: 0, max: 25, step: 0.5, suffix: "%" },
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: addLogoToDocument
            },
            {
                id: "export-facebook",
                label: "Xuat Anh Facebook",
                description: "Xuat JPEG tu document duplicate; co preset Facebook ngang/doc legacy, sRGB, flatten va sharpen nhe.",
                defaults: {
                    destinationFolder: null,
                    exportMode: "facebookLandscape",
                    longEdge: "2048",
                    quality: 10,
                    overwrite: false,
                    convertSrgb: true,
                    flatten: true,
                    sharpen: true
                },
                fields: [
                    { key: "destinationFolder", label: "Thu muc xuat", type: "folder" },
                    {
                        key: "exportMode",
                        label: "Preset",
                        type: "select",
                        options: [
                            { value: "facebookLandscape", label: "Facebook Ngang 2048x1072" },
                            { value: "facebookPortrait", label: "Facebook Dung 1350x1688" },
                            { value: "longEdge", label: "Long Edge tu chon" }
                        ]
                    },
                    {
                        key: "longEdge",
                        label: "Long Edge",
                        type: "select",
                        options: [
                            { value: "2048", label: "2048 px" },
                            { value: "1350", label: "1350 px" },
                            { value: "1080", label: "1080 px" }
                        ]
                    },
                    { key: "quality", label: "JPEG Quality", type: "number", min: 1, max: 12, step: 1 },
                    { key: "convertSrgb", label: "Convert sRGB", type: "checkbox" },
                    { key: "flatten", label: "Flatten duplicate", type: "checkbox" },
                    { key: "sharpen", label: "Sharpen nhe", type: "checkbox" },
                    { key: "overwrite", label: "Ghi de file", type: "checkbox" }
                ],
                run: exportFacebookImage
            }
        ]
    },
    {
        title: "File Selection",
        tools: [
            {
                id: "filter-images",
                label: "Loc Anh Theo Ma",
                description: "Loc va copy anh/RAW theo ma 4 chu so trong ten file.",
                defaults: {
                    codes: "",
                    sourceFolder: null,
                    destinationFolder: null,
                    overwrite: false
                },
                fields: [
                    { key: "codes", label: "Ma anh", type: "textarea", placeholder: "0123, 0456, 0789" },
                    { key: "sourceFolder", label: "Thu muc nguon", type: "folder" },
                    { key: "destinationFolder", label: "Thu muc dich", type: "folder" },
                    { key: "overwrite", label: "Ghi de file", type: "checkbox" }
                ],
                run: filterAndCopyImages
            }
        ]
    },
    {
        title: "Frequency Separation",
        tools: [
            {
                id: "frequency-separation",
                label: "Frequency Separation",
                description: "Tach mau/sac do vao Low va chi tiet vao High, sau do gom trong mot group.",
                defaults: {
                    radius: 6,
                    bitDepth: "auto"
                },
                fields: [
                    { key: "radius", label: "Blur Radius", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "px" },
                    {
                        key: "bitDepth",
                        label: "Document",
                        type: "select",
                        options: [
                            { value: "auto", label: "Auto" },
                            { value: "8", label: "8-bit" },
                            { value: "16", label: "16-bit" }
                        ]
                    }
                ],
                run: runFrequencySeparation
            },
            {
                id: "frequency-pro",
                label: "Frequency Pro",
                description: "Tach anh thanh ba dai Low, Medium va High Frequency.",
                defaults: {
                    fineRadius: 3,
                    coarseRadius: 12,
                    mediumOpacity: 100,
                    highOpacity: 100,
                    bitDepth: "auto"
                },
                fields: [
                    { key: "fineRadius", label: "Fine Radius", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "px" },
                    { key: "coarseRadius", label: "Coarse Radius", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "px" },
                    { key: "mediumOpacity", label: "Medium Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" },
                    { key: "highOpacity", label: "High Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" },
                    {
                        key: "bitDepth",
                        label: "Document",
                        type: "select",
                        options: [
                            { value: "auto", label: "Auto" },
                            { value: "8", label: "8-bit" },
                            { value: "16", label: "16-bit" }
                        ]
                    }
                ],
                run: runFrequencyPro
            }
        ]
    },
    {
        title: "Luminosity Masks",
        tools: [
            {
                id: "luminosity-masks",
                label: "Luminosity Masks",
                description: "Tao Lights, Darks va Midtones thanh Alpha Channels de tai lai lam selection/mask.",
                defaults: {
                    levels: "3",
                    includeMidtones: true
                },
                fields: [
                    {
                        key: "levels",
                        label: "Levels",
                        type: "select",
                        options: [
                            { value: "3", label: "1 - 3" },
                            { value: "2", label: "1 - 2" }
                        ]
                    },
                    { key: "includeMidtones", label: "Midtones", type: "checkbox" }
                ],
                run: runLuminosityMasks
            }
        ]
    },
    {
        title: "Light Control",
        tools: [
            {
                id: "increase-brightness",
                label: "Tang Sang",
                description: "Tao Curves tang sang o Luminosity; co the dung mask den de to chon loc.",
                defaults: {
                    strength: 28,
                    opacity: 100,
                    blackMask: false
                },
                fields: [
                    { key: "strength", label: "Strength", type: "number", min: 5, max: 100, step: 1 },
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" },
                    { key: "blackMask", label: "Black Mask", type: "checkbox" }
                ],
                run: runIncreaseBrightness
            },
            {
                id: "fix-overexposure",
                label: "Fix Du Sang",
                description: "Keo highlight xuong bang Curves va tu tao luminosity mask vung sang.",
                defaults: {
                    strength: 35,
                    highlightLevel: "2",
                    opacity: 100
                },
                fields: [
                    { key: "strength", label: "Strength", type: "number", min: 5, max: 100, step: 1 },
                    {
                        key: "highlightLevel",
                        label: "Highlights",
                        type: "select",
                        options: [
                            { value: "1", label: "Lights 1 - Broad" },
                            { value: "2", label: "Lights 2" },
                            { value: "3", label: "Lights 3 - Narrow" }
                        ]
                    },
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runFixOverexposure
            },
            {
                id: "highlight-pop",
                label: "Noi Vung Sang",
                description: "Nang upper-midtones va highlights co chon loc, giu diem trang de han che chay sang.",
                defaults: {
                    strength: 30,
                    highlightLevel: "2",
                    opacity: 75
                },
                fields: [
                    { key: "strength", label: "Strength", type: "number", min: 5, max: 100, step: 1 },
                    {
                        key: "highlightLevel",
                        label: "Highlights",
                        type: "select",
                        options: [
                            { value: "1", label: "Lights 1 - Broad" },
                            { value: "2", label: "Lights 2" },
                            { value: "3", label: "Lights 3 - Narrow" }
                        ]
                    },
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runHighlightPop
            }
        ]
    },
    {
        title: "Regional HDR",
        tools: [
            {
                id: "hdr-overall",
                label: "HDR Tong The",
                description: "Can bang highlight, shadow va tang tuong phan midtone trong mot group.",
                defaults: {
                    strength: 30,
                    contrast: 20,
                    opacity: 70
                },
                fields: [
                    { key: "strength", label: "Recovery", type: "number", min: 5, max: 100, step: 1 },
                    { key: "contrast", label: "Contrast", type: "number", min: 0, max: 80, step: 1 },
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runHdrOverall
            },
            {
                id: "fix-hdr-sharpen",
                label: "Fix Net HDR",
                description: "Ket hop High Pass detail va Unsharp edge, gioi han bang Midtones mask.",
                defaults: {
                    detailRadius: 3,
                    detailOpacity: 45,
                    sharpenAmount: 90,
                    sharpenRadius: 0.8,
                    sharpenOpacity: 55
                },
                fields: [
                    { key: "detailRadius", label: "Detail Radius", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "px" },
                    { key: "detailOpacity", label: "Detail Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" },
                    { key: "sharpenAmount", label: "Edge Amount", type: "number", min: 1, max: 500, step: 1, suffix: "%" },
                    { key: "sharpenRadius", label: "Edge Radius", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "px" },
                    { key: "sharpenOpacity", label: "Edge Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runFixHdrSharpen
            },
            {
                id: "hdr-highlights",
                label: "HDR Vung Sang",
                description: "Nen highlight va khoi phuc chi tiet bang Curves kem Lights mask.",
                defaults: {
                    strength: 32,
                    highlightLevel: "2",
                    opacity: 75
                },
                fields: [
                    { key: "strength", label: "Strength", type: "number", min: 5, max: 100, step: 1 },
                    {
                        key: "highlightLevel",
                        label: "Highlights",
                        type: "select",
                        options: [
                            { value: "1", label: "Lights 1 - Broad" },
                            { value: "2", label: "Lights 2" },
                            { value: "3", label: "Lights 3 - Narrow" }
                        ]
                    },
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runHdrHighlights
            },
            {
                id: "hdr-shadows",
                label: "HDR Vung Toi",
                description: "Nang shadow co chon loc bang Curves kem Darks mask.",
                defaults: {
                    strength: 32,
                    shadowLevel: "2",
                    opacity: 75
                },
                fields: [
                    { key: "strength", label: "Strength", type: "number", min: 5, max: 100, step: 1 },
                    {
                        key: "shadowLevel",
                        label: "Shadows",
                        type: "select",
                        options: [
                            { value: "1", label: "Darks 1 - Broad" },
                            { value: "2", label: "Darks 2" },
                            { value: "3", label: "Darks 3 - Narrow" }
                        ]
                    },
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runHdrShadows
            }
        ]
    },
    {
        title: "Color Correction",
        tools: [
            {
                id: "color-correction",
                label: "Color Balance",
                description: "Can mau theo Shadows, Midtones hoac Highlights bang ba truc mau Color Balance.",
                defaults: {
                    tonalRange: "midtones",
                    cyanRed: 0,
                    magentaGreen: 0,
                    yellowBlue: 0,
                    opacity: 100,
                    preserveLuminosity: true,
                    blackMask: false
                },
                fields: [
                    {
                        key: "tonalRange",
                        label: "Tonal Range",
                        type: "select",
                        options: [
                            { value: "shadows", label: "Shadows" },
                            { value: "midtones", label: "Midtones" },
                            { value: "highlights", label: "Highlights" }
                        ]
                    },
                    { key: "cyanRed", label: "Cyan (-) / Red (+)", type: "number", min: -100, max: 100, step: 1 },
                    { key: "magentaGreen", label: "Magenta (-) / Green (+)", type: "number", min: -100, max: 100, step: 1 },
                    { key: "yellowBlue", label: "Yellow (-) / Blue (+)", type: "number", min: -100, max: 100, step: 1 },
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" },
                    { key: "preserveLuminosity", label: "Preserve Lum", type: "checkbox" },
                    { key: "blackMask", label: "Black Mask", type: "checkbox" }
                ],
                run: runColorCorrection
            },
            {
                id: "color-correction-pro",
                label: "Color Correction Pro",
                description: "Tao group Hue/Saturation correction theo JSX legacy: Gradient skin, Dark/Light Hue fix, +/- Saturation fix.",
                defaults: {
                    hueShift: 25,
                    saturationShift: 25,
                    gradientOpacity: 0
                },
                fields: [
                    { key: "hueShift", label: "Hue Shift", type: "number", min: 1, max: 180, step: 1 },
                    { key: "saturationShift", label: "Saturation Shift", type: "number", min: 1, max: 100, step: 1 },
                    { key: "gradientOpacity", label: "Gradient Opacity", type: "number", min: 0, max: 100, step: 1, suffix: "%" }
                ],
                run: runColorCorrectionPro
            }
        ]
    },
    {
        title: "Color Inspection",
        tools: [
            {
                id: "check-color",
                label: "Check Color",
                description: "Tao group kiem tra Color Only, Luminosity, Saturation va Solar Curve.",
                defaults: {
                    activeView: "color",
                    saturation: 100
                },
                fields: [
                    {
                        key: "activeView",
                        label: "Active View",
                        type: "select",
                        options: [
                            { value: "color", label: "Color Only" },
                            { value: "luminosity", label: "Luminosity" },
                            { value: "saturation", label: "Saturation" },
                            { value: "solar", label: "Solar Curve" }
                        ]
                    },
                    { key: "saturation", label: "Saturation", type: "number", min: 10, max: 100, step: 5, suffix: "%" }
                ],
                run: runCheckColor
            }
        ]
    },
    {
        title: "Dodge & Burn",
        tools: [
            {
                id: "db-master",
                label: "D&B Master",
                description: "Tao D&B Master theo cac mode legacy: Soft Light, Overlay, Screen, Multiply, danh khoi AI/+ va check layer.",
                defaults: {
                    mode: "standard",
                    strength: 32,
                    opacity: 100,
                    checkMode: "bw"
                },
                fields: [
                    {
                        key: "mode",
                        label: "Mode",
                        type: "select",
                        options: [
                            { value: "standard", label: "Standard Curves" },
                            { value: "softLight", label: "Soft Light" },
                            { value: "contour", label: "Danh khoi" },
                            { value: "overlay", label: "Overlay" },
                            { value: "screen", label: "Screen" },
                            { value: "contourRa", label: "Danh khoi RA" },
                            { value: "multiply", label: "Multiply" },
                            { value: "sangAi", label: "Sang AI" },
                            { value: "khoiAi", label: "Danh khoi AI" },
                            { value: "toiAi", label: "Toi AI" },
                            { value: "sangAiPlus", label: "Sang AI+" },
                            { value: "khoiAiPlus", label: "Danh khoi AI+" },
                            { value: "toiAiPlus", label: "Toi AI+" }
                        ]
                    },
                    { key: "strength", label: "Strength", type: "number", min: 5, max: 100, step: 1 },
                    { key: "opacity", label: "D&B Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" },
                    {
                        key: "checkMode",
                        label: "Check View",
                        type: "select",
                        options: [
                            { value: "bw", label: "B&W Check" },
                            { value: "solar", label: "Solar Curve" },
                            { value: "none", label: "None" }
                        ]
                    }
                ],
                run: runDodgeBurnMaster
            },
            {
                id: "db-gray",
                label: "D&B 50% Gray",
                description: "Tao layer 50% gray kieu legacy: Overlay, ten layer Mekomedia, de retouch dodge & burn.",
                defaults: {
                    opacity: 100,
                    blendMode: "overlay"
                },
                fields: [
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" },
                    {
                        key: "blendMode",
                        label: "Blend",
                        type: "select",
                        options: [
                            { value: "overlay", label: "Overlay / Legacy" },
                            { value: "softLight", label: "Soft Light" }
                        ]
                    }
                ],
                run: runDodgeBurnGrayLayer
            },
            {
                id: "db-curves",
                label: "D&B Curves",
                description: "Tao hai Curves Dodge/Burn voi mask den; default dung curve point legacy Burn [165,125], Dodge [85,125].",
                defaults: {
                    strength: 32,
                    legacyMode: true
                },
                fields: [
                    { key: "strength", label: "Strength", type: "number", min: 5, max: 100, step: 1 },
                    { key: "legacyMode", label: "Legacy Curve Points", type: "checkbox" }
                ],
                run: runDodgeBurnCurves
            }
        ]
    },
    {
        title: "Skin Retouch",
        tools: [
            {
                id: "skin-brightening",
                label: "Sang Da",
                description: "Nang midtone va giam saturation nhe trong group co mask den de to chon loc.",
                defaults: {
                    strength: 22,
                    desaturation: 6,
                    opacity: 100
                },
                fields: [
                    { key: "strength", label: "Brightness", type: "number", min: 5, max: 60, step: 1 },
                    { key: "desaturation", label: "Desaturation", type: "number", min: 0, max: 40, step: 1, suffix: "%" },
                    { key: "opacity", label: "Group Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runSkinBrightening
            },
            {
                id: "even-skin",
                label: "Deu Da",
                description: "Can bang am do, do am va sac do da trong group co mask den de to chon loc.",
                defaults: {
                    rednessCorrection: 10,
                    warmth: 0,
                    toneBalance: 8,
                    desaturation: 4,
                    opacity: 100
                },
                fields: [
                    { key: "rednessCorrection", label: "Giam am do", type: "number", min: 0, max: 40, step: 1 },
                    { key: "warmth", label: "Do am", type: "number", min: -30, max: 30, step: 1 },
                    { key: "toneBalance", label: "Can bang sac do", type: "number", min: 0, max: 30, step: 1 },
                    { key: "desaturation", label: "Giam bao hoa", type: "number", min: 0, max: 30, step: 1, suffix: "%" },
                    { key: "opacity", label: "Group Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runEvenSkin
            },
            {
                id: "teeth-whitening",
                label: "Trang Rang",
                description: "Giam sac vang va nang sang rang trong group co mask den de to chon loc.",
                defaults: {
                    yellowReduction: 55,
                    brightness: 14,
                    opacity: 100
                },
                fields: [
                    { key: "yellowReduction", label: "Giam vang", type: "number", min: 0, max: 100, step: 1, suffix: "%" },
                    { key: "brightness", label: "Do sang", type: "number", min: 0, max: 40, step: 1 },
                    { key: "opacity", label: "Group Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runTeethWhitening
            },
            {
                id: "lip-color",
                label: "Son Moi",
                description: "Tao lop mau son o blend mode Color voi mask den de to chon loc len moi.",
                defaults: {
                    color: "rose",
                    intensity: 65
                },
                fields: [
                    {
                        key: "color",
                        label: "Mau son",
                        type: "select",
                        options: [
                            { value: "natural", label: "Natural" },
                            { value: "rose", label: "Rose" },
                            { value: "red", label: "Red" },
                            { value: "coral", label: "Coral" },
                            { value: "mauve", label: "Mauve" }
                        ]
                    },
                    { key: "intensity", label: "Cuong do", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runLipColor
            },
            {
                id: "blush",
                label: "Ma Hong",
                description: "Tao lop mau ma o Soft Light voi mask den de to chon loc va giu chi tiet da.",
                defaults: {
                    color: "natural",
                    intensity: 35
                },
                fields: [
                    {
                        key: "color",
                        label: "Mau ma",
                        type: "select",
                        options: [
                            { value: "natural", label: "Natural" },
                            { value: "rose", label: "Rose" },
                            { value: "peach", label: "Peach" },
                            { value: "coral", label: "Coral" },
                            { value: "mauve", label: "Mauve" }
                        ]
                    },
                    { key: "intensity", label: "Cuong do", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runBlush
            }
        ]
    },
    {
        title: "Color Retouch",
        tools: [
            {
                id: "color-layer",
                label: "Color Layer",
                description: "Tao layer trong suot o blend mode Color de sua mau da va chi tiet.",
                defaults: {
                    opacity: 100
                },
                fields: [
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runColorRetouchLayer
            }
        ]
    },
    {
        title: "Sharpen & Texture",
        tools: [
            {
                id: "sharpen",
                label: "Tang Net",
                description: "Tang net bang Unsharp Mask tren layer sao chep o Luminosity.",
                defaults: {
                    amount: 120,
                    radius: 1.2,
                    threshold: 2,
                    opacity: 80
                },
                fields: [
                    { key: "amount", label: "Amount", type: "number", min: 1, max: 500, step: 1, suffix: "%" },
                    { key: "radius", label: "Radius", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "px" },
                    { key: "threshold", label: "Threshold", type: "number", min: 0, max: 255, step: 1 },
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runSharpenLayer
            },
            {
                id: "skin-high-pass",
                label: "Da Highpass",
                description: "Tao lop lam min da bang High Pass dao, Linear Light va mask den.",
                defaults: {
                    highPassRadius: 10,
                    blurRadius: 3,
                    opacity: 55
                },
                fields: [
                    { key: "highPassRadius", label: "High Pass", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "px" },
                    { key: "blurRadius", label: "Blur", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "px" },
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runSkinHighPass
            },
            {
                id: "high-pass",
                label: "High Pass",
                description: "Duplicate layer hien tai, ap High Pass va blend de tang net.",
                defaults: {
                    radius: 2,
                    opacity: 70,
                    blendMode: "linearLight"
                },
                fields: [
                    { key: "radius", label: "Radius", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "px" },
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" },
                    {
                        key: "blendMode",
                        label: "Blend",
                        type: "select",
                        options: [
                            { value: "linearLight", label: "Linear Light" },
                            { value: "overlay", label: "Overlay" },
                            { value: "softLight", label: "Soft Light" }
                        ]
                    }
                ],
                run: runHighPassSharpen
            },
            {
                id: "add-noise",
                label: "Add Noise",
                description: "Tao layer grain kieu legacy: fill mau xam, Add Noise, blur nhe va Soft Light.",
                defaults: {
                    amount: 25.98,
                    blurRadius: 1.1,
                    opacity: 100,
                    gaussian: false,
                    monochromatic: false,
                    legacyMode: true
                },
                fields: [
                    { key: "amount", label: "Amount", type: "number", min: 0.1, max: 400, step: 0.1, suffix: "%" },
                    { key: "blurRadius", label: "Blur", type: "number", min: 0, max: 100, step: 0.1, suffix: "px" },
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" },
                    { key: "gaussian", label: "Gaussian", type: "checkbox" },
                    { key: "monochromatic", label: "Mono", type: "checkbox" },
                    { key: "legacyMode", label: "Legacy Fill Layer", type: "checkbox" }
                ],
                run: runAddNoiseLayer
            },
            {
                id: "texture",
                label: "Texture",
                description: "Tao layer ket cau tu High Pass, giu nguyen layer goc.",
                defaults: {
                    radius: 4,
                    opacity: 45,
                    blendMode: "overlay",
                    monochromatic: true
                },
                fields: [
                    { key: "radius", label: "Radius", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "px" },
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" },
                    {
                        key: "blendMode",
                        label: "Blend",
                        type: "select",
                        options: [
                            { value: "overlay", label: "Overlay" },
                            { value: "softLight", label: "Soft Light" },
                            { value: "linearLight", label: "Linear Light" }
                        ]
                    },
                    { key: "monochromatic", label: "B&W", type: "checkbox" }
                ],
                run: runTextureLayer
            },
            {
                id: "texture-pro",
                label: "Texture Pro",
                description: "Tao hai dai texture Fine va Coarse tu cung layer nguon.",
                defaults: {
                    fineRadius: 2,
                    coarseRadius: 8,
                    opacity: 55,
                    monochromatic: true
                },
                fields: [
                    { key: "fineRadius", label: "Fine Radius", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "px" },
                    { key: "coarseRadius", label: "Coarse Radius", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "px" },
                    { key: "opacity", label: "Fine Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" },
                    { key: "monochromatic", label: "B&W", type: "checkbox" }
                ],
                run: runTexturePro
            },
            {
                id: "check-texture",
                label: "Check Texture",
                description: "Tao group Check Layer theo JSX legacy: D&B gray, Skin Blemish, Solarize, Black/White, Invert.",
                defaults: {
                    includeDodgeBurn: true,
                    activeView: "skinBlemish"
                },
                fields: [
                    { key: "includeDodgeBurn", label: "Them D&B", type: "checkbox" },
                    {
                        key: "activeView",
                        label: "Active View",
                        type: "select",
                        options: [
                            { value: "skinBlemish", label: "Skin Blemish" },
                            { value: "solarize", label: "Solarize" },
                            { value: "blackWhite", label: "Black/White" },
                            { value: "invert", label: "Invert" },
                            { value: "all", label: "Show All" }
                        ]
                    }
                ],
                run: runCheckTextureLegacy
            },
            {
                id: "check-texture-pro",
                label: "Check Texture Pro",
                description: "Tao group Help voi cac layer inspection legacy: Saturation, Color, Hue, Luminosity, Negative, Contract, Test Color...",
                defaults: {
                    activeView: "skinBlemish"
                },
                fields: [
                    {
                        key: "activeView",
                        label: "Active View",
                        type: "select",
                        options: [
                            { value: "skinBlemish", label: "Skin Blemish" },
                            { value: "saturation", label: "Saturation" },
                            { value: "color", label: "Color" },
                            { value: "hue", label: "Hue" },
                            { value: "luminosity", label: "Luminosity" },
                            { value: "negative", label: "Negative" },
                            { value: "contract", label: "Contract" },
                            { value: "testColor", label: "Test Color" },
                            { value: "desaturate", label: "Desaturate" },
                            { value: "invert", label: "Invert" },
                            { value: "all", label: "Show All" }
                        ]
                    }
                ],
                run: runCheckTextureProLegacy
            }
        ]
    },
    {
        title: "Legacy Quick Effects",
        tools: [
            {
                id: "dreamy-blur",
                label: "Mo Ao / Nang Tho",
                description: "Copy layer, blur manh, blend Soft Light + Screen de tao hieu ung nang tho legacy.",
                defaults: {
                    blurRadius: 100,
                    screenOpacity: 47,
                    groupOpacity: 100
                },
                fields: [
                    { key: "blurRadius", label: "Blur", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "px" },
                    { key: "screenOpacity", label: "Screen", type: "number", min: 1, max: 100, step: 1, suffix: "%" },
                    { key: "groupOpacity", label: "Group", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runDreamyBlur
            },
            {
                id: "highlight-boost",
                label: "Highlight Boost",
                description: "Duplicate layer, Screen, opacity va Gaussian Blur de lam noi vung sang.",
                defaults: {
                    brightness: 55,
                    range: 45
                },
                fields: [
                    { key: "brightness", label: "Brightness", type: "number", min: 1, max: 100, step: 1, suffix: "%" },
                    { key: "range", label: "Range", type: "number", min: 1, max: 100, step: 1 }
                ],
                run: runHighlightBoost
            },
            {
                id: "dark-boost",
                label: "Dark Boost",
                description: "Duplicate layer, Multiply, blur va contrast nhe de nhan vung toi theo code bo sung.",
                defaults: {
                    strength: 35,
                    range: 40
                },
                fields: [
                    { key: "strength", label: "Strength", type: "number", min: 1, max: 100, step: 1, suffix: "%" },
                    { key: "range", label: "Range", type: "number", min: 1, max: 100, step: 1 }
                ],
                run: runDarkBoost
            },
            {
                id: "upscale-pro",
                label: "Upscale Pro",
                description: "Resize document theo ti le, dung interpolation Preserve Details/Smooth va sharpen nhe.",
                defaults: {
                    scale: 2,
                    method: "preserveDetailsUpscale",
                    sharpen: true
                },
                fields: [
                    { key: "scale", label: "Scale", type: "number", min: 1, max: 4, step: 0.1, suffix: "x" },
                    {
                        key: "method",
                        label: "Method",
                        type: "select",
                        options: [
                            { value: "preserveDetailsUpscale", label: "Preserve Details 2.0" },
                            { value: "smooth", label: "Bicubic Smoother" },
                            { value: "automatic", label: "Automatic" }
                        ]
                    },
                    { key: "sharpen", label: "Smart Sharpen nhe", type: "checkbox" }
                ],
                run: runUpscalePro
            }
        ]
    },
    {
        title: "Noise Cleanup",
        tools: [
            {
                id: "smooth-noise",
                label: "Smooth Noise",
                description: "Duplicate layer hien tai va lam min bang Surface Blur.",
                defaults: {
                    radius: 3,
                    threshold: 12,
                    opacity: 100
                },
                fields: [
                    { key: "radius", label: "Radius", type: "number", min: 1, max: 100, step: 1, suffix: "px" },
                    { key: "threshold", label: "Threshold", type: "number", min: 1, max: 255, step: 1 },
                    { key: "opacity", label: "Opacity", type: "number", min: 1, max: 100, step: 1, suffix: "%" }
                ],
                run: runSmoothNoiseLayer
            }
        ]
    }
];

const buildInitialToolState = () => (
    TOOL_GROUPS.reduce((state, group) => {
        group.tools.forEach((tool) => {
            state[tool.id] = {
                ...tool.defaults
            };
        });

        return state;
    }, {})
);

const FieldControl = ({ field, value, onChange }) => {
    if (field.type === "textarea") {
        return (
            <label className="legacy-field legacy-field-wide">
                <span>{field.label}</span>
                <textarea
                    className="legacy-textarea"
                    value={value}
                    placeholder={field.placeholder || ""}
                    onChange={(event) => onChange(event.target.value)}
                />
            </label>
        );
    }

    if (field.type === "text") {
        return (
            <label className="legacy-field legacy-field-wide">
                <span>{field.label}</span>
                <input
                    className="legacy-input"
                    type="text"
                    value={value || ""}
                    placeholder={field.placeholder || ""}
                    onChange={(event) => onChange(event.target.value)}
                />
            </label>
        );
    }

    if (field.type === "folder" || field.type === "file") {
        const pickEntry = async () => {
            const entry = field.type === "file" ? await pickLogoFile() : await pickImageFolder();
            if (entry) {
                onChange(entry);
            }
        };

        return (
            <div className="legacy-field legacy-folder-field">
                <span>{field.label}</span>
                <div className="legacy-folder-row">
                    <div className="legacy-folder-name" title={value && value.nativePath ? value.nativePath : ""}>
                        {value ? (value.nativePath || value.name) : "Chua chon"}
                    </div>
                    <button className="btn legacy-folder-button" onClick={pickEntry}>Chon</button>
                </div>
            </div>
        );
    }

    if (field.type === "select") {
        return (
            <label className="legacy-field">
                <span>{field.label}</span>
                <select
                    className="legacy-select"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                >
                    {field.options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </label>
        );
    }

    if (field.type === "checkbox") {
        return (
            <label className="legacy-checkbox-field">
                <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) => onChange(event.target.checked)}
                />
                <span>{field.label}</span>
            </label>
        );
    }

    return (
        <label className="legacy-field">
            <span>{field.label}</span>
            <div className="legacy-number-wrap">
                <input
                    className="legacy-input"
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
                {field.suffix ? <em>{field.suffix}</em> : null}
            </div>
        </label>
    );
};

const ToolCard = ({ tool, values, isRunning, disabled, onValueChange, onRun }) => (
    <div className="legacy-tool-card">
        <div className="legacy-tool-copy">
            <strong>{tool.label}</strong>
            <span>{tool.description}</span>
        </div>

        <div className="legacy-field-grid">
            {tool.fields.map((field) => (
                <FieldControl
                    key={field.key}
                    field={field}
                    value={values[field.key]}
                    onChange={(value) => onValueChange(tool.id, field.key, value)}
                />
            ))}
        </div>

        <button
            className="btn primary legacy-run-button"
            disabled={disabled}
            onClick={() => onRun(tool)}
        >
            {isRunning ? "Dang chay..." : "Chay tool"}
        </button>
    </div>
);

export const LegacyToolsApp = () => {
    const [toolState, setToolState] = useState(() => buildInitialToolState());
    const [runningToolId, setRunningToolId] = useState("");
    const [status, setStatus] = useState({
        tone: "neutral",
        message: "Mo document Photoshop, chon layer can xu ly, roi chay tool."
    });

    const toolCount = useMemo(() => (
        TOOL_GROUPS.reduce((count, group) => count + group.tools.length, 0)
    ), []);

    const handleValueChange = (toolId, fieldKey, value) => {
        setToolState((current) => ({
            ...current,
            [toolId]: {
                ...current[toolId],
                [fieldKey]: value
            }
        }));
    };

    const runTool = async (tool) => {
        if (runningToolId) {
            return;
        }

        setRunningToolId(tool.id);
        setStatus({
            tone: "neutral",
            message: `Dang chay ${tool.label}...`
        });

        try {
            const message = await tool.run(toolState[tool.id]);
            setStatus({
                tone: "success",
                message
            });
        } catch (error) {
            setStatus({
                tone: "error",
                message: error && error.message ? error.message : "Khong the chay tool Photoshop."
            });
        } finally {
            setRunningToolId("");
        }
    };

    return (
        <div className="legacy-tools-app">
            <header className="legacy-tools-header">
                <div>
                    <span className="legacy-eyebrow">MEKO legacy port</span>
                    <h1>Retouch Tools</h1>
                    <p>{toolCount} tool dau tien duoc port sang UXP tu nhom JSX cu.</p>
                </div>
                <div className={`legacy-status legacy-status-${status.tone}`}>
                    {status.message}
                </div>
            </header>

            <main className="legacy-tool-groups">
                {TOOL_GROUPS.map((group) => (
                    <section key={group.title} className="legacy-tool-section">
                        <div className="legacy-section-title">{group.title}</div>
                        <div className="legacy-tool-list">
                            {group.tools.map((tool) => (
                                <ToolCard
                                    key={tool.id}
                                    tool={tool}
                                    values={toolState[tool.id]}
                                    isRunning={runningToolId === tool.id}
                                    disabled={Boolean(runningToolId)}
                                    onValueChange={handleValueChange}
                                    onRun={runTool}
                                />
                            ))}
                        </div>
                    </section>
                ))}
            </main>
        </div>
    );
};
