import { requestJson } from "./api.js";

const noop = () => {};

const requireSession = (session) => {
    if (!session) {
        throw new Error("Vui lòng đăng nhập để dùng flow mua credit hoặc subscription.");
    }

    return session;
};

export const formatPriceVnd = (value) => Number(value || 0).toLocaleString("vi-VN");

export const getPurchasePackagePrimaryValue = (pkg) => {
    if (!pkg) {
        return "";
    }

    if (pkg.purchaseType === "credit") {
        return `${pkg.creditAmount} credit`;
    }

    return `${pkg.durationMonths} tháng • ${pkg.monthlyCreditLimit} credit/tháng`;
};

export const createPurchaseGateway = ({ getSession, onSessionRefresh } = {}) => {
    const resolveSession = () => requireSession(typeof getSession === "function" ? getSession() : null);
    const handleSessionRefresh = typeof onSessionRefresh === "function" ? onSessionRefresh : noop;

    return {
        mode: "backend",

        async listPackages({ purchaseType } = {}) {
            const query = new URLSearchParams();
            if (purchaseType) {
                query.set("purchaseType", purchaseType);
            }

            const path = query.toString()
                ? `/purchase/packages?${query.toString()}`
                : "/purchase/packages";

            return requestJson(path, { method: "GET" }, resolveSession(), handleSessionRefresh);
        },

        async getOpenOrder() {
            return requestJson("/purchase/orders/open", { method: "GET" }, resolveSession(), handleSessionRefresh);
        },

        async createDraftOrder({ packageId }) {
            return requestJson("/purchase/orders", {
                method: "POST",
                body: JSON.stringify({ packageId })
            }, resolveSession(), handleSessionRefresh);
        },

        async confirmTransferred({ orderId }) {
            return requestJson(`/purchase/orders/${encodeURIComponent(orderId)}/confirm-transferred`, {
                method: "POST"
            }, resolveSession(), handleSessionRefresh);
        },

        async getOrder({ orderId }) {
            return requestJson(`/purchase/orders/${encodeURIComponent(orderId)}`, {
                method: "GET"
            }, resolveSession(), handleSessionRefresh);
        }
    };
};

export const purchaseGateway = createPurchaseGateway();
