export const getGenerationCreditCost = (size) => (size === "4K" ? 2 : 1);

export const getGenerationCreditWarning = (size, fallbackLabel = "các kích thước còn lại") =>
    size === "4K"
        ? "Lưu ý: chọn 4K sẽ tốn 2 credit cho mỗi lần generate."
        : `Lưu ý: chỉ 4K mới tốn 2 credit, ${fallbackLabel} tốn 1 credit.`;
