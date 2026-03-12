const PURCHASE_STORAGE_KEY = "banana-tool.purchase.orders.v1";
const ORDER_EXPIRATION_MS = 30 * 60 * 1000;

const PURCHASE_CATALOG = [
    {
        id: "credit-100",
        code: "credit-100",
        purchaseType: "credit",
        displayName: "100 credit",
        description: "Phù hợp khi cần nạp nhanh cho các job ngắn hạn hoặc đợt xử lý gấp.",
        priceVnd: 199000,
        isActive: true,
        sortOrder: 10,
        creditAmount: 100
    },
    {
        id: "credit-300",
        code: "credit-300",
        purchaseType: "credit",
        displayName: "300 credit",
        description: "Tối ưu hơn cho tần suất generate cao trong nhiều ngày liên tiếp.",
        priceVnd: 499000,
        isActive: true,
        sortOrder: 20,
        creditAmount: 300
    },
    {
        id: "sub-starter-1m",
        code: "sub-starter-1m",
        purchaseType: "subscription",
        displayName: 'Starter 1 tháng',
        description: "Dành cho cá nhân hoặc studio nhỏ cần quota ổn định mỗi tháng.",
        priceVnd: 799000,
        isActive: true,
        sortOrder: 10,
        planCode: "starter-monthly",
        durationMonths: 1,
        monthlyCreditLimit: 200
    },
    {
        id: "sub-pro-3m",
        code: "sub-pro-3m",
        purchaseType: "subscription",
        displayName: 'Pro 3 tháng',
        description: "Phù hợp team xử lý ảnh thường xuyên, giảm thao tác gia hạn hàng tháng.",
        priceVnd: 1990000,
        isActive: true,
        sortOrder: 20,
        planCode: "pro-quarterly",
        durationMonths: 3,
        monthlyCreditLimit: 500
    }
];

const BANK_ACCOUNT = {
    bankName: "MB Bank",
    bankBin: "970422",
    accountNumber: "0987654321",
    accountHolder: "BANANA TOOL DEMO"
};

const getStorage = () => {
    if (typeof window === "undefined" || !window.localStorage) {
        return null;
    }

    return window.localStorage;
};

const readOrders = () => {
    const storage = getStorage();
    if (!storage) {
        return [];
    }

    const raw = storage.getItem(PURCHASE_STORAGE_KEY);
    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
};

const writeOrders = (orders) => {
    const storage = getStorage();
    if (!storage) {
        return;
    }

    storage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(orders));
};

const formatOrderCodePart = (value) => String(value).padStart(2, "0");

const buildOrderCode = (timestamp) => {
    const date = new Date(timestamp);
    const datePart = [
        date.getFullYear(),
        formatOrderCodePart(date.getMonth() + 1),
        formatOrderCodePart(date.getDate())
    ].join("");
    const timePart = [
        formatOrderCodePart(date.getHours()),
        formatOrderCodePart(date.getMinutes()),
        formatOrderCodePart(date.getSeconds())
    ].join("");
    const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

    return `BT${datePart}${timePart}${randomPart}`;
};

const normalizeOrder = (order, now) => {
    if (!order) {
        return order;
    }

    if (order.status !== "draft") {
        return order;
    }

    if (!order.expiresAt || order.expiresAt > now) {
        return order;
    }

    return {
        ...order,
        status: "expired",
        updatedAt: now
    };
};

const resolveOrders = (now = Date.now()) => {
    const storedOrders = readOrders();
    let changed = false;
    const orders = storedOrders.map((order) => {
        const nextOrder = normalizeOrder(order, now);
        if (nextOrder !== order) {
            changed = true;
        }

        return nextOrder;
    });

    if (changed) {
        writeOrders(orders);
    }

    return orders;
};

const persistOrders = (orders, now = Date.now()) => {
    const normalized = orders.map((order) => normalizeOrder(order, now));
    writeOrders(normalized);
    return normalized;
};

const getOpenOrderForUser = (orders, userId) => {
    const userOrders = orders
        .filter((order) => order.userId === userId && (order.status === "draft" || order.status === "pending_admin_review"))
        .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));

    return userOrders[0] || null;
};

const getPackageById = (packageId) => (
    PURCHASE_CATALOG.find((item) => item.id === packageId && item.isActive) || null
);

const buildPackageSnapshot = (pkg) => {
    if (!pkg) {
        return null;
    }

    if (pkg.purchaseType === "credit") {
        return {
            id: pkg.id,
            code: pkg.code,
            purchaseType: pkg.purchaseType,
            displayName: pkg.displayName,
            description: pkg.description,
            priceVnd: pkg.priceVnd,
            creditAmount: pkg.creditAmount
        };
    }

    return {
        id: pkg.id,
        code: pkg.code,
        purchaseType: pkg.purchaseType,
        displayName: pkg.displayName,
        description: pkg.description,
        priceVnd: pkg.priceVnd,
        planCode: pkg.planCode,
        durationMonths: pkg.durationMonths,
        monthlyCreditLimit: pkg.monthlyCreditLimit
    };
};

const buildTransferContent = (orderCode) => `BANANA ${orderCode}`;

const buildQrPayload = (order) => JSON.stringify({
    bankName: order.bankAccount.bankName,
    accountNumber: order.bankAccount.accountNumber,
    accountHolder: order.bankAccount.accountHolder,
    amount: order.priceVnd,
    transferContent: order.transferContent,
    orderCode: order.orderCode
});

const buildQrImageUrl = (order) => {
    const params = [
        `amount=${encodeURIComponent(String(order.priceVnd))}`,
        `addInfo=${encodeURIComponent(order.transferContent)}`,
        `accountName=${encodeURIComponent(order.bankAccount.accountHolder)}`
    ].join("&");

    return `https://img.vietqr.io/image/${order.bankAccount.bankBin}-${order.bankAccount.accountNumber}-compact2.png?${params}`;
};

const createDraftOrderRecord = ({ userId, userEmail, pkg, now = Date.now() }) => {
    const orderId = `purchase_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const orderCode = buildOrderCode(now);
    const transferContent = buildTransferContent(orderCode);

    const baseOrder = {
        orderId,
        orderCode,
        userId,
        userEmail: userEmail || "",
        status: "draft",
        purchaseType: pkg.purchaseType,
        packageSnapshot: buildPackageSnapshot(pkg),
        priceVnd: pkg.priceVnd,
        bankAccount: {
            ...BANK_ACCOUNT
        },
        transferContent,
        qrPayload: "",
        qrImageUrl: "",
        createdAt: now,
        updatedAt: now,
        expiresAt: now + ORDER_EXPIRATION_MS,
        confirmedTransferredAt: null,
        approvedAt: null,
        rejectedAt: null,
        rejectionReason: null
    };

    return {
        ...baseOrder,
        qrPayload: buildQrPayload(baseOrder),
        qrImageUrl: buildQrImageUrl(baseOrder)
    };
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

export const purchaseGateway = {
    mode: "local-mock",

    async listPackages({ purchaseType } = {}) {
        return PURCHASE_CATALOG
            .filter((item) => item.isActive && (!purchaseType || item.purchaseType === purchaseType))
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((item) => ({ ...item }));
    },

    async getOpenOrder({ userId }) {
        const orders = resolveOrders();
        const order = getOpenOrderForUser(orders, userId);
        return order ? { ...order } : null;
    },

    async createDraftOrder({ userId, userEmail, packageId }) {
        const now = Date.now();
        const orders = resolveOrders(now);
        const existingOrder = getOpenOrderForUser(orders, userId);
        if (existingOrder) {
            return {
                order: { ...existingOrder },
                resumedExisting: true
            };
        }

        const selectedPackage = getPackageById(packageId);
        if (!selectedPackage) {
            throw new Error("Không tìm thấy gói khả dụng để tạo yêu cầu thanh toán.");
        }

        const nextOrder = createDraftOrderRecord({
            userId,
            userEmail,
            pkg: selectedPackage,
            now
        });
        persistOrders([nextOrder, ...orders], now);

        return {
            order: { ...nextOrder },
            resumedExisting: false
        };
    },

    async confirmTransferred({ userId, orderId }) {
        const now = Date.now();
        const orders = resolveOrders(now);
        const currentOrder = orders.find((order) => order.orderId === orderId && order.userId === userId);

        if (!currentOrder) {
            throw new Error("Không tìm thấy order cần xác nhận.");
        }

        if (currentOrder.status === "pending_admin_review") {
            return { ...currentOrder };
        }

        if (currentOrder.status !== "draft") {
            throw new Error("Order hiện tại không còn ở trạng thái có thể xác nhận chuyển khoản.");
        }

        if (!currentOrder.expiresAt || currentOrder.expiresAt <= now) {
            const nextOrders = orders.map((order) => (
                order.orderId === orderId
                    ? {
                        ...order,
                        status: "expired",
                        updatedAt: now
                    }
                    : order
            ));
            persistOrders(nextOrders, now);
            throw new Error("Order đã hết hạn. Vui lòng tạo yêu cầu mới trước khi xác nhận chuyển khoản.");
        }

        const updatedOrder = {
            ...currentOrder,
            status: "pending_admin_review",
            confirmedTransferredAt: now,
            updatedAt: now
        };
        const nextOrders = orders.map((order) => (
            order.orderId === orderId ? updatedOrder : order
        ));
        persistOrders(nextOrders, now);

        return { ...updatedOrder };
    },

    async getOrder({ userId, orderId }) {
        const orders = resolveOrders();
        const currentOrder = orders.find((order) => order.orderId === orderId && order.userId === userId);
        return currentOrder ? { ...currentOrder } : null;
    }
};
