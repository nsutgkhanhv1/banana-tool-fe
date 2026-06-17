const SUPPORTED_IMAGE_EXTENSIONS = new Set([
    "jpg",
    "jpeg",
    "png",
    "tif",
    "tiff",
    "psd",
    "cr2",
    "cr3",
    "arw",
    "nef",
    "nrw",
    "raf",
    "dng"
]);

const createError = (message, code) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const getStorage = () => {
    try {
        return require("uxp").storage;
    } catch (error) {
        throw createError("Khong the truy cap UXP storage.", "UXP_STORAGE_UNAVAILABLE");
    }
};

const parseCodes = (value) => {
    const codes = String(value || "")
        .split(/[\s,;]+/)
        .map((code) => code.trim())
        .filter(Boolean);
    const invalidCodes = codes.filter((code) => !/^\d{4}$/.test(code));

    if (codes.length === 0) {
        throw createError("Hay nhap it nhat mot ma anh gom 4 chu so.", "MISSING_IMAGE_CODES");
    }

    if (invalidCodes.length > 0) {
        throw createError(`Ma anh khong hop le: ${invalidCodes.join(", ")}. Moi ma phai co dung 4 chu so.`, "INVALID_IMAGE_CODES");
    }

    return Array.from(new Set(codes));
};

const getExtension = (fileName) => {
    const index = String(fileName || "").lastIndexOf(".");
    return index >= 0 ? fileName.slice(index + 1).toLowerCase() : "";
};

export const pickImageFolder = async () => {
    const storage = getStorage();
    return storage.localFileSystem.getFolder();
};

export const filterAndCopyImages = async ({
    codes,
    sourceFolder,
    destinationFolder,
    overwrite = false
} = {}) => {
    const resolvedCodes = parseCodes(codes);

    if (!sourceFolder || !sourceFolder.isFolder) {
        throw createError("Hay chon thu muc nguon.", "MISSING_SOURCE_FOLDER");
    }

    if (!destinationFolder || !destinationFolder.isFolder) {
        throw createError("Hay chon thu muc dich.", "MISSING_DESTINATION_FOLDER");
    }

    if (sourceFolder.nativePath && destinationFolder.nativePath && sourceFolder.nativePath === destinationFolder.nativePath) {
        throw createError("Thu muc nguon va thu muc dich phai khac nhau.", "SAME_SOURCE_DESTINATION");
    }

    const storage = getStorage();
    const sourceEntries = await sourceFolder.getEntries();
    const destinationEntries = await destinationFolder.getEntries();
    const destinationNames = new Set(
        destinationEntries
            .filter((entry) => entry && entry.isFile)
            .map((entry) => String(entry.name || "").toLowerCase())
    );
    const imageFiles = sourceEntries.filter((entry) => (
        entry && entry.isFile && SUPPORTED_IMAGE_EXTENSIONS.has(getExtension(entry.name))
    ));
    const matchedFiles = imageFiles.filter((entry) => (
        resolvedCodes.some((code) => String(entry.name || "").includes(code))
    ));
    let copied = 0;
    let skipped = 0;

    for (const sourceFile of matchedFiles) {
        const normalizedName = String(sourceFile.name || "").toLowerCase();
        const alreadyExists = destinationNames.has(normalizedName);

        if (alreadyExists && !overwrite) {
            skipped += 1;
            continue;
        }

        const binary = await sourceFile.read({ format: storage.formats.binary });
        const destinationFile = await destinationFolder.createFile(sourceFile.name, {
            overwrite: Boolean(overwrite)
        });
        await destinationFile.write(binary, { format: storage.formats.binary });
        destinationNames.add(normalizedName);
        copied += 1;
    }

    return `Da loc ${imageFiles.length} file, khop ${matchedFiles.length}, copy ${copied}, bo qua ${skipped}.`;
};
