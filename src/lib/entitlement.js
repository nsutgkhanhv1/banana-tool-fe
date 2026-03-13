const STATUS_LABELS = {
    active: "Đang hoạt động",
    expired: "Đã hết hạn",
    suspended: "Tạm khóa"
};

const DENY_MESSAGES = {
    account_inactive: "Tài khoản của bạn hiện đang bị tạm ngưng generate",
    no_credit: "Bạn đã hết credit",
    subscription_expired: "Gói của bạn đã hết hạn",
    subscription_suspended: "Tài khoản sử dụng hiện đang bị tạm khóa",
    subscription_missing: "Không thể xác định quyền sử dụng hiện tại"
};

export const getEntitlementUiState = (entitlement) => {
    if (!entitlement) {
        return {
            planName: "Chưa có gói",
            statusLabel: "Đăng nhập để xem",
            creditRemaining: 0,
            creditLabel: "0 credit",
            creditDetail: "Chưa có dữ liệu",
            usageLabel: "Chưa có dữ liệu",
            lowCredit: false,
            severity: "neutral",
            canGenerate: false,
            denyReason: "subscription_missing",
            denyMessage: "Đăng nhập để đồng bộ trạng thái credit và gói.",
            nextResetText: "Chưa có dữ liệu",
            subscriptionEndText: "Chưa có dữ liệu",
            primaryAction: {
                type: "purchase",
                label: "Mua credit / subscription"
            },
            supportContact: null
        };
    }

    const creditLimit = Number(entitlement.creditLimit ?? 0);
    const creditRemaining = Math.max(Number(entitlement.creditRemaining ?? 0), 0);
    const creditUsed = Math.max(Number(entitlement.creditUsed ?? 0), 0);
    const lowCredit = creditLimit > 0 && creditRemaining > 0 && creditRemaining / creditLimit <= 0.1;
    const denyReason = entitlement.denyReason || null;
    const statusLabel = STATUS_LABELS[entitlement.subscriptionStatus] || "Chưa có dữ liệu";
    const denyMessage = DENY_MESSAGES[denyReason] || (entitlement.canGenerate ? "Bạn có thể generate bình thường." : "Chưa có dữ liệu");

    let severity = "normal";
    if (denyReason === "account_inactive" || denyReason === "subscription_suspended" || denyReason === "subscription_expired" || denyReason === "no_credit") {
        severity = "danger";
    } else if (lowCredit) {
        severity = "warning";
    }

    const primaryAction = denyReason === "subscription_suspended" || denyReason === "account_inactive"
        ? { type: "support", label: "Liên hệ hỗ trợ" }
        : { type: "purchase", label: "Mua credit / subscription" };

    return {
        planName: entitlement.planDisplayName || entitlement.planCode || "Chưa có gói",
        statusLabel,
        creditRemaining,
        creditLabel: `${creditRemaining} credit`,
        creditDetail: creditLimit > 0
            ? `${creditUsed}/${creditLimit} đã dùng`
            : creditRemaining > 0
                ? `${creditRemaining} credit khả dụng`
                : "Đã hết credit",
        usageLabel: creditLimit > 0 ? `${creditUsed} / ${creditLimit}` : "Chưa có dữ liệu",
        lowCredit,
        severity,
        canGenerate: Boolean(entitlement.canGenerate),
        denyReason,
        denyMessage,
        nextResetText: entitlement.nextResetAt ? "Có dữ liệu" : "Không áp dụng",
        subscriptionEndText: entitlement.subscriptionEndAt ? "Có dữ liệu" : "Không áp dụng",
        primaryAction,
        supportContact: entitlement.supportContact || null
    };
};

export const formatEntitlementDate = (timestamp) => {
    if (!timestamp) {
        return "Chưa có dữ liệu";
    }

    return new Date(timestamp).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
};

export const getGenerateDenyMessage = (entitlement) => {
    const uiState = getEntitlementUiState(entitlement);
    return uiState.denyMessage;
};
