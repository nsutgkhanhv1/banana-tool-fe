import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "../components/Header.jsx";
import { TabNavigation } from "../components/TabNavigation.jsx";
import { ShellModalHost } from "../components/ShellModalHost.jsx";
import { ShellSettingsView } from "../components/ShellSettingsView.jsx";
import { requestJson } from "../lib/api.js";
import { formatEntitlementDate, getEntitlementUiState, getGenerateDenyMessage } from "../lib/entitlement.js";
import {
    getPluginEnvironmentSummary,
    getPluginVersion,
    PLUGIN_DISPLAY_NAME,
    PLUGIN_SUPPORT_CONTACT,
    PLUGIN_SUPPORT_LINK
} from "../lib/plugin-config.js";
import { persistPluginSettings, readPluginSettings } from "../lib/plugin-settings.js";
import { createPurchaseGateway } from "../lib/purchase.js";
import { capturePhotoshopContext, insertGeneratedImage } from "../lib/photoshop.js";
import { appendHistoryItem, loadHistoryItems, updateHistoryItemInsertState } from "../lib/result-history.js";
import { ThayNenTab } from "./tabs/ThayNenTab.jsx";
import { PhucCheTab } from "./tabs/PhucCheTab.jsx";
import { TuDoAITab } from "./tabs/TuDoAITab.jsx";

const DEFAULT_TAB = "thaynen";
const TAB_STORAGE_KEY = "banana-tool.shell.active-tab";
const SESSION_STORAGE_KEY = "banana-tool.account.session.v1";

const TABS = [
    { id: "thaynen", label: "Thay Nền", component: ThayNenTab },
    { id: "phucche", label: "Phục chế ảnh", component: PhucCheTab },
    { id: "tudoai", label: "Tự do AI", component: TuDoAITab }
];

const wait = (duration) => new Promise((resolve) => {
    setTimeout(resolve, duration);
});

const getStorage = () => {
    if (typeof window === "undefined" || !window.localStorage) {
        return null;
    }

    return window.localStorage;
};

const readPersistedTab = () => {
    const storage = getStorage();
    const persisted = storage ? storage.getItem(TAB_STORAGE_KEY) : null;
    const validTab = TABS.some((tab) => tab.id === persisted);
    return validTab ? persisted : DEFAULT_TAB;
};

const readPersistedSession = () => {
    const storage = getStorage();
    if (!storage) {
        return null;
    }

    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw);
        if (!parsed.accessToken || !parsed.refreshToken) {
            return null;
        }

        return parsed;
    } catch (error) {
        return null;
    }
};

const persistTab = (value) => {
    const storage = getStorage();
    if (!storage) {
        return;
    }

    storage.setItem(TAB_STORAGE_KEY, value);
};

const persistSession = (session) => {
    const storage = getStorage();
    if (!storage) {
        return;
    }

    if (!session) {
        storage.removeItem(SESSION_STORAGE_KEY);
        return;
    }

    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

const formatRelativeDate = (timestamp) => {
    if (!timestamp) {
        return "Chưa có";
    }

    const date = new Date(timestamp);
    return date.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
};

const resolveHistoryNamespace = (profile) => {
    if (!profile) {
        return null;
    }

    return profile.id || profile.email || "authenticated-user";
};

export const App = () => {
    const [bootStatus, setBootStatus] = useState("idle");
    const [authStatus, setAuthStatus] = useState("unknown");
    const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
    const [activeModal, setActiveModal] = useState(null);
    const [activeAuxScreen, setActiveAuxScreen] = useState(null);
    const [session, setSession] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [entitlement, setEntitlement] = useState(null);
    const [entitlementSyncError, setEntitlementSyncError] = useState("");
    const [refreshStatus, setRefreshStatus] = useState("idle");
    const [toast, setToast] = useState(null);
    const [tabRefreshVersion, setTabRefreshVersion] = useState(0);
    const [historyItems, setHistoryItems] = useState([]);
    const [historyStatus, setHistoryStatus] = useState("idle");
    const [historyError, setHistoryError] = useState("");
    const [historyRestoreRequest, setHistoryRestoreRequest] = useState(null);
    const [pluginSettings, setPluginSettings] = useState(() => readPluginSettings());
    const [authModalConfig, setAuthModalConfig] = useState({
        resetKey: 0,
        initialView: "login",
        email: "",
        notice: ""
    });

    const historyNamespace = useMemo(() => {
        return resolveHistoryNamespace(userProfile);
    }, [userProfile]);

    const showToast = useCallback((message, tone, options) => {
        const config = options || {};
        const nextMessage = pluginSettings.toastMode === "detailed" && config.detail
            ? config.detail
            : message;

        setToast({
            id: Date.now(),
            message: nextMessage,
            tone: tone || "info"
        });
    }, [pluginSettings.toastMode]);

    useEffect(() => {
        if (!toast) {
            return undefined;
        }

        const timer = setTimeout(() => {
            setToast(null);
        }, 3000);

        return () => clearTimeout(timer);
    }, [toast]);

    const updatePluginSettings = useCallback((partialSettings) => {
        setPluginSettings((current) => {
            const nextSettings = {
                ...current,
                ...(partialSettings || {})
            };

            persistPluginSettings(nextSettings);
            return nextSettings;
        });
    }, []);

    const handleSessionChange = useCallback((nextSession) => {
        setSession(nextSession);
        persistSession(nextSession);
    }, []);

    const applyUnauthenticatedShell = useCallback(() => {
        handleSessionChange(null);
        setAuthStatus("unauthenticated");
        setUserProfile(null);
        setEntitlement(null);
        setEntitlementSyncError("");
    }, [handleSessionChange]);

    const openAuthModal = useCallback((initialView, nextConfig) => {
        setActiveAuxScreen(null);
        setActiveModal("login");
        setAuthModalConfig((current) => ({
            resetKey: current.resetKey + 1,
            initialView: initialView || "login",
            email: nextConfig && nextConfig.email ? nextConfig.email : "",
            notice: nextConfig && nextConfig.notice ? nextConfig.notice : ""
        }));
    }, []);

    const openCreditSubscription = useCallback(() => {
        setActiveAuxScreen(null);
        setActiveModal("credit-subscription");
    }, []);

    const openSupportModal = useCallback(() => {
        setActiveAuxScreen(null);
        setActiveModal("support");
    }, []);

    const loadEntitlementData = useCallback(async (sessionValue, options) => {
        const config = options || {};

        try {
            const currentEntitlement = await requestJson(
                "/me/entitlement",
                { method: "GET" },
                sessionValue,
                handleSessionChange,
                {
                    disableSessionRefresh: Boolean(config.disableSessionRefresh)
                }
            );
            setEntitlement(currentEntitlement);
            setEntitlementSyncError("");
            return {
                entitlement: currentEntitlement,
                error: null
            };
        } catch (error) {
            if (error && error.status === 401) {
                throw error;
            }

            if (!config.preserveExisting) {
                setEntitlement(null);
            }

            const message = error && error.message ? error.message : "Không thể cập nhật trạng thái mới nhất.";
            setEntitlementSyncError(message);
            return {
                entitlement: config.preserveExisting ? entitlement : null,
                error
            };
        }
    }, [entitlement, handleSessionChange]);

    const loadShellData = useCallback(async (sessionValue, options) => {
        const config = options || {};
        const profile = await requestJson(
            "/me",
            { method: "GET" },
            sessionValue,
            handleSessionChange,
            {
                disableSessionRefresh: Boolean(config.disableSessionRefresh)
            }
        );
        setUserProfile(profile);
        setAuthStatus("authenticated");

        const entitlementResult = await loadEntitlementData(sessionValue, {
            preserveExisting: Boolean(config.preserveEntitlement),
            disableSessionRefresh: Boolean(config.disableSessionRefresh)
        });

        return {
            profile,
            entitlement: entitlementResult.entitlement,
            entitlementError: entitlementResult.error
        };
    }, [handleSessionChange, loadEntitlementData]);

    const bootstrapShell = useCallback(async () => {
        setBootStatus("loading");

        try {
            await wait(350);
            setActiveTab(readPersistedTab());

            const persistedSession = readPersistedSession();
            if (!persistedSession) {
                applyUnauthenticatedShell();
                openAuthModal("login");
                setBootStatus("ready");
                return;
            }

            handleSessionChange(persistedSession);

            try {
                const result = await loadShellData(persistedSession);
                setActiveModal(null);
                if (result.entitlementError) {
                    showToast("Đã đăng nhập nhưng chưa thể đồng bộ entitlement mới nhất.", "warning");
                }
            } catch (error) {
                applyUnauthenticatedShell();
                openAuthModal("login", {
                    notice: error instanceof Error ? error.message : "Phiên đăng nhập đã hết hạn."
                });
                showToast("Phiên đăng nhập đã hết hạn.", "error");
            }

            setBootStatus("ready");
        } catch (error) {
            applyUnauthenticatedShell();
            openAuthModal("login", {
                notice: "Không thể khởi tạo phiên đăng nhập."
            });
            setBootStatus("ready");
        }
    }, [applyUnauthenticatedShell, handleSessionChange, loadShellData, openAuthModal, showToast]);

    useEffect(() => {
        bootstrapShell();
    }, [bootstrapShell]);

    useEffect(() => {
        persistTab(activeTab);
    }, [activeTab]);

    const refreshHistory = useCallback(async (profileOverride) => {
        const nextNamespace = resolveHistoryNamespace(profileOverride || userProfile);

        if (!nextNamespace) {
            setHistoryItems([]);
            setHistoryStatus("ready");
            setHistoryError("");
            return {
                ok: true,
                skipped: true
            };
        }

        setHistoryStatus("loading");
        setHistoryError("");

        try {
            const items = await loadHistoryItems(nextNamespace);
            setHistoryItems(items);
            setHistoryStatus("ready");
            return {
                ok: true,
                skipped: false
            };
        } catch (error) {
            setHistoryItems([]);
            setHistoryStatus("error");
            setHistoryError(error && error.message ? error.message : "Không thể đọc lịch sử local trong plugin.");
            return {
                ok: false,
                skipped: false,
                error
            };
        }
    }, [userProfile]);

    useEffect(() => {
        if (authStatus !== "authenticated") {
            setHistoryItems([]);
            setHistoryStatus("idle");
            setHistoryError("");
            return;
        }

        refreshHistory();
    }, [authStatus, refreshHistory]);

    const refreshShell = useCallback(async () => {
        if (!session) {
            openAuthModal("login");
            return;
        }

        if (refreshStatus === "refreshing") {
            return;
        }

        setActiveModal(null);
        setRefreshStatus("refreshing");

        try {
            const result = await loadShellData(session, {
                preserveEntitlement: true,
                disableSessionRefresh: true
            });
            const historyResult = await refreshHistory(result.profile);

            setTabRefreshVersion((value) => value + 1);

            if (result.entitlementError || (historyResult && !historyResult.ok)) {
                setRefreshStatus("error");
                showToast("Không thể cập nhật đầy đủ dữ liệu mới nhất.", "warning", {
                    detail: "Đã refresh session, user và shell summary, nhưng vẫn còn ít nhất một nguồn dữ liệu giữ trạng thái cũ."
                });
            } else {
                setRefreshStatus("success");
                showToast("Đã đồng bộ lại dữ liệu plugin.", "success", {
                    detail: "Đã đồng bộ lại session, user summary, entitlement và history local. Tab hiện tại được giữ nguyên."
                });
            }
        } catch (error) {
            if (error && error.status === 401) {
                applyUnauthenticatedShell();
                openAuthModal("login", {
                    notice: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
                });
                showToast("Không thể đồng bộ vì phiên đã hết hạn.", "error", {
                    detail: "Manual refresh phát hiện session không còn hợp lệ. Plugin đã chuyển sang trạng thái yêu cầu đăng nhập lại."
                });
            } else {
                setEntitlementSyncError(error && error.message ? error.message : "Không thể cập nhật trạng thái mới nhất.");
                showToast("Không thể cập nhật trạng thái mới nhất.", "error", {
                    detail: "Refresh không hoàn tất do lỗi mạng hoặc backend tạm thời. Tab và form state hiện tại vẫn được giữ nguyên."
                });
            }
            setRefreshStatus("error");
        }

        setTimeout(() => {
            setRefreshStatus("idle");
        }, 1200);
    }, [applyUnauthenticatedShell, loadShellData, openAuthModal, refreshHistory, refreshStatus, session, showToast]);

    const closeModal = useCallback(() => {
        const shouldRefreshAfterPurchase = activeModal === "purchase" && authStatus === "authenticated";
        setActiveModal(null);

        if (shouldRefreshAfterPurchase) {
            refreshShell();
        }
    }, [activeModal, authStatus, refreshShell]);

    const handleBlockedInteraction = useCallback(() => {
        showToast("Vui lòng đăng nhập để thực hiện thao tác này.", "warning");
        openAuthModal("login");
    }, [openAuthModal, showToast]);

    const handleEntitlementDenied = useCallback((currentEntitlement) => {
        const message = getGenerateDenyMessage(currentEntitlement);
        const uiState = getEntitlementUiState(currentEntitlement);

        showToast(message, uiState.severity === "danger" ? "error" : "warning");

        if (uiState.primaryAction.type === "support") {
            openSupportModal();
            return;
        }

        openCreditSubscription();
    }, [openCreditSubscription, openSupportModal, showToast]);

    const handleTabChange = useCallback((nextTab) => {
        if (authStatus !== "authenticated") {
            handleBlockedInteraction();
            return;
        }

        setActiveTab(nextTab);
    }, [authStatus, handleBlockedInteraction]);

    const handleRecordHistory = useCallback(async (draft) => {
        if (!historyNamespace) {
            return;
        }

        try {
            const items = await appendHistoryItem({
                namespace: historyNamespace,
                draft
            });
            setHistoryItems(items);
            setHistoryStatus("ready");
            setHistoryError("");
        } catch (error) {
            showToast("Đã tạo ảnh nhưng chưa thể ghi lịch sử local.", "warning");
        }
    }, [historyNamespace, showToast]);

    const handleHistoryReinsert = useCallback(async (item) => {
        if (!historyNamespace) {
            return {
                ok: false,
                error: "Không tìm thấy namespace history hiện tại."
            };
        }

        if (!item || !item.canReinsert || !item.previewUrl) {
            return {
                ok: false,
                error: "Asset kết quả cục bộ không còn khả dụng để chèn lại."
            };
        }

        try {
            const insertContext = await capturePhotoshopContext();
            const insertResult = await insertGeneratedImage({
                imageBase64: item.previewUrl,
                mimeType: item.resultAsset && item.resultAsset.mimeType ? item.resultAsset.mimeType : "image/png",
                context: insertContext,
                layerNamePrefix: item.layerNamePrefix
            });

            const nextInsertState = {
                status: "success",
                insertedLayerId: insertResult.insertedLayerId,
                insertedLayerName: insertResult.insertedLayerName,
                error: "",
                mode: "reinsert",
                updatedAt: Date.now()
            };
            const items = await updateHistoryItemInsertState({
                namespace: historyNamespace,
                historyId: item.historyId,
                insert: nextInsertState
            });

            setHistoryItems(items);
            setHistoryStatus("ready");
            setHistoryError("");
            showToast("Đã chèn lại ảnh từ lịch sử vào Photoshop.", "success");

            return {
                ok: true
            };
        } catch (error) {
            const nextInsertState = {
                status: "failed",
                insertedLayerId: null,
                insertedLayerName: "",
                error: error && error.message ? error.message : "Không thể chèn lại ảnh từ lịch sử.",
                mode: "reinsert",
                updatedAt: Date.now()
            };

            try {
                const items = await updateHistoryItemInsertState({
                    namespace: historyNamespace,
                    historyId: item.historyId,
                    insert: nextInsertState
                });
                setHistoryItems(items);
                setHistoryStatus("ready");
            } catch (updateError) {
                // Keep original history item even if local insert status cannot be updated.
            }

            showToast(nextInsertState.error, "error");

            return {
                ok: false,
                error: nextInsertState.error
            };
        }
    }, [historyNamespace, showToast]);

    const handleHistoryReload = useCallback((item) => {
        if (!item || !item.canReload || !item.rehydrationPayload) {
            showToast("History item này chưa đủ dữ liệu để nạp lại cấu hình.", "warning");
            return;
        }

        const confirmed = typeof window === "undefined" || typeof window.confirm !== "function"
            ? true
            : window.confirm("Nạp lại cấu hình từ lịch sử sẽ ghi đè form hiện tại của tab đích. Tiếp tục?");

        if (!confirmed) {
            return;
        }

        setActiveAuxScreen(null);
        setActiveModal(null);
        setActiveTab(item.rehydrationPayload.tabId);
        setHistoryRestoreRequest({
            id: Date.now(),
            historyId: item.historyId,
            featureLabel: item.featureLabel,
            payload: item.rehydrationPayload
        });
        showToast(`Đã nạp cấu hình ${item.featureLabel} từ lịch sử.`, "success");
    }, [showToast]);

    const performLogout = useCallback(async () => {
        if (session) {
            try {
                await requestJson("/auth/logout", {
                    method: "POST",
                    body: JSON.stringify({
                        refreshToken: session.refreshToken
                    })
                }, session, handleSessionChange);
            } catch (error) {
                // Prefer local logout completion even if backend session is already gone.
            }
        }

        applyUnauthenticatedShell();
        setActiveAuxScreen(null);
        openAuthModal("login", {
            notice: "Bạn đã đăng xuất khỏi plugin."
        });
        showToast("Đã đăng xuất khỏi plugin.", "info");
    }, [applyUnauthenticatedShell, handleSessionChange, openAuthModal, session, showToast]);

    const handleHeaderAction = useCallback((action) => {
        if (refreshStatus === "refreshing") {
            return;
        }

        if (action === "account") {
            if (authStatus !== "authenticated") {
                openAuthModal("login");
                return;
            }

            setActiveAuxScreen(null);
            setActiveModal("account");
            return;
        }

        if (action === "history") {
            if (authStatus !== "authenticated") {
                openAuthModal("login");
                return;
            }

            setActiveAuxScreen(null);
            setActiveModal("history");
            return;
        }

        if (action === "purchase") {
            if (authStatus !== "authenticated") {
                openAuthModal("login");
                showToast("Vui lòng đăng nhập để thực hiện thao tác này.", "warning");
                return;
            }

            setActiveAuxScreen(null);
            setActiveModal("purchase");
            return;
        }

        if (action === "credit-subscription") {
            if (authStatus !== "authenticated") {
                openAuthModal("login");
                return;
            }

            openCreditSubscription();
            return;
        }

        if (action === "support") {
            openSupportModal();
            return;
        }

        if (action === "refresh") {
            if (authStatus !== "authenticated") {
                openAuthModal("login");
                return;
            }

            setActiveModal("refresh-confirm");
            return;
        }

        if (action === "settings") {
            if (authStatus !== "authenticated") {
                openAuthModal("login");
                return;
            }

            setActiveModal(null);
            setActiveAuxScreen("settings");
            return;
        }

        if (action === "logout") {
            if (authStatus !== "authenticated") {
                openAuthModal("login");
                return;
            }

            performLogout();
        }
    }, [authStatus, openAuthModal, openCreditSubscription, openSupportModal, performLogout, refreshStatus]);

    const handleCopySupportContact = useCallback(async (contactValue) => {
        const value = contactValue || PLUGIN_SUPPORT_CONTACT;

        if (typeof navigator === "undefined" || !navigator.clipboard || !navigator.clipboard.writeText) {
            showToast("Môi trường hiện tại chưa hỗ trợ sao chép nhanh.", "warning");
            return;
        }

        try {
            await navigator.clipboard.writeText(value);
            showToast("Đã sao chép thông tin hỗ trợ.", "success");
        } catch (error) {
            showToast("Không thể sao chép thông tin hỗ trợ.", "error");
        }
    }, [showToast]);

    const submitLogin = useCallback(async ({ email, password }) => {
        const data = await requestJson("/auth/login", {
            method: "POST",
            body: JSON.stringify({
                identifier: email,
                password
            })
        }, session, handleSessionChange);

        const nextSession = {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken
        };

        handleSessionChange(nextSession);
        const result = await loadShellData(nextSession);
        setActiveModal(null);
        showToast("Đăng nhập thành công.", "success");
        if (result.entitlementError) {
            showToast("Đã đăng nhập nhưng chưa thể cập nhật entitlement mới nhất.", "warning");
        }
        return data.user;
    }, [handleSessionChange, loadShellData, session, showToast]);

    const submitRegister = useCallback(async ({ email, password }) => {
        const data = await requestJson("/auth/register", {
            method: "POST",
            body: JSON.stringify({
                email,
                password
            })
        }, session, handleSessionChange);

        showToast("Tài khoản đã được tạo. Nhập OTP để xác thực email.", "success");
        return data.user;
    }, [handleSessionChange, session, showToast]);

    const resendVerifyEmail = useCallback(async ({ email }) => {
        const data = await requestJson("/auth/verify-email/send", {
            method: "POST",
            body: JSON.stringify({
                email
            })
        }, session, handleSessionChange);

        showToast("OTP xác thực đã được gửi lại.", "info");
        return data;
    }, [handleSessionChange, session, showToast]);

    const confirmVerifyEmail = useCallback(async ({ email, otp }) => {
        const data = await requestJson("/auth/verify-email/confirm", {
            method: "POST",
            body: JSON.stringify({
                email,
                otp
            })
        }, session, handleSessionChange);

        if (userProfile && userProfile.email === email && session) {
            await loadShellData(session);
        }

        showToast("Email đã được xác thực.", "success");
        return data.user;
    }, [handleSessionChange, loadShellData, session, showToast, userProfile]);

    const requestPasswordReset = useCallback(async ({ email }) => {
        const data = await requestJson("/auth/forgot-password", {
            method: "POST",
            body: JSON.stringify({
                email
            })
        }, session, handleSessionChange);

        showToast("Nếu email tồn tại, OTP đã được gửi.", "info");
        return data;
    }, [handleSessionChange, session, showToast]);

    const submitPasswordReset = useCallback(async ({ email, otp, newPassword }) => {
        const data = await requestJson("/auth/reset-password", {
            method: "POST",
            body: JSON.stringify({
                email,
                otp,
                newPassword
            })
        }, session, handleSessionChange);

        showToast("Mật khẩu đã được đặt lại.", "success");
        return data;
    }, [handleSessionChange, session, showToast]);

    const updateDisplayName = useCallback(async ({ displayName }) => {
        const data = await requestJson("/me/profile", {
            method: "PATCH",
            body: JSON.stringify({
                displayName: displayName && displayName.trim() ? displayName.trim() : null
            })
        }, session, handleSessionChange);

        setUserProfile(data);
        showToast("Đã cập nhật thông tin tài khoản.", "success");
        return data;
    }, [handleSessionChange, session, showToast]);

    const startEmailChange = useCallback(async ({ newEmail }) => {
        const data = await requestJson("/me/change-email", {
            method: "POST",
            body: JSON.stringify({
                newEmail
            })
        }, session, handleSessionChange);

        setUserProfile(data);
        showToast("OTP đổi email đã được gửi.", "info");
        return data;
    }, [handleSessionChange, session, showToast]);

    const confirmEmailChange = useCallback(async ({ otp }) => {
        const data = await requestJson("/me/change-email/confirm", {
            method: "POST",
            body: JSON.stringify({
                otp
            })
        }, session, handleSessionChange);

        setUserProfile(data);
        showToast("Email đăng nhập đã được cập nhật.", "success");
        return data;
    }, [handleSessionChange, session, showToast]);

    const cancelPendingEmailChange = useCallback(async () => {
        const data = await requestJson("/me/change-email/cancel", {
            method: "POST",
            body: JSON.stringify({})
        }, session, handleSessionChange);

        setUserProfile(data);
        showToast("Đã hủy yêu cầu đổi email.", "info");
        return data;
    }, [handleSessionChange, session, showToast]);

    const submitPasswordChange = useCallback(async ({ currentPassword, newPassword }) => {
        const data = await requestJson("/me/change-password", {
            method: "POST",
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        }, session, handleSessionChange);

        showToast("Mật khẩu đã được cập nhật.", "success");
        return data;
    }, [handleSessionChange, session, showToast]);

    const submitGenerateRequest = useCallback(async ({ path, body }) => {
        if (!session) {
            openAuthModal("login");
            return { ok: false };
        }

        let currentEntitlement = entitlement;

        if (!currentEntitlement) {
            const entitlementResult = await loadEntitlementData(session, {
                preserveExisting: false
            });
            currentEntitlement = entitlementResult.entitlement;

            if (!currentEntitlement) {
                showToast("Chưa thể xác định entitlement hiện tại. Vui lòng refresh rồi thử lại.", "warning");
                openCreditSubscription();
                return { ok: false };
            }
        }

        if (!currentEntitlement.canGenerate) {
            handleEntitlementDenied(currentEntitlement);
            return { ok: false };
        }

        try {
            const data = await requestJson(path, {
                method: "POST",
                body: JSON.stringify(body)
            }, session, handleSessionChange);

            setTabRefreshVersion((value) => value + 1);

            return {
                ok: true,
                data
            };
        } catch (error) {
            if (error && error.status === 401) {
                applyUnauthenticatedShell();
                openAuthModal("login", {
                    notice: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
                });
                showToast("Phiên đăng nhập đã hết hạn.", "error");
                return { ok: false };
            }

            if (error && (error.code === "ENTITLEMENT_DENIED" || error.code === "NO_CREDITS")) {
                const entitlementResult = await loadEntitlementData(session, {
                    preserveExisting: true
                });
                handleEntitlementDenied(entitlementResult.entitlement || entitlement);
                return { ok: false, error };
            }

            showToast(error && error.message ? error.message : "Không thể generate ảnh.", "error");
            return { ok: false, error };
        } finally {
            if (session) {
                const entitlementResult = await loadEntitlementData(session, {
                    preserveExisting: true
                });

                if (entitlementResult.error) {
                    showToast("Không thể cập nhật credit mới nhất sau generate. Plugin đang giữ summary cũ.", "warning");
                }
            }
        }
    }, [
        applyUnauthenticatedShell,
        handleEntitlementDenied,
        handleSessionChange,
        loadEntitlementData,
        openCreditSubscription,
        openAuthModal,
        session,
        showToast
    ]);

    const submitGenerate = useCallback(async ({ prompt, options, imageBase64 }) => (
        submitGenerateRequest({
            path: "/images/generate",
            body: {
                prompt,
                imageBase64,
                options
            }
        })
    ), [submitGenerateRequest]);

    const submitThayNenGenerate = useCallback(async (payload) => (
        submitGenerateRequest({
            path: "/images/thay-nen/generate",
            body: payload
        })
    ), [submitGenerateRequest]);

    const submitTuDoAIGenerate = useCallback(async (payload) => (
        submitGenerateRequest({
            path: "/images/tu-do-ai/generate",
            body: payload
        })
    ), [submitGenerateRequest]);

    const submitPhucCheAnhGenerate = useCallback(async (payload) => (
        submitGenerateRequest({
            path: "/images/phuc-che-anh/generate",
            body: payload
        })
    ), [submitGenerateRequest]);

    const pluginVersion = getPluginVersion();
    const environmentSummary = getPluginEnvironmentSummary();
    const shellLocked = authStatus !== "authenticated";
    const pluginBusy = refreshStatus === "refreshing";
    const entitlementUi = getEntitlementUiState(entitlement);
    const supportContactValue = entitlementUi.supportContact || PLUGIN_SUPPORT_CONTACT || "";
    const supportContactDisplay = supportContactValue.replace(/^mailto:/i, "");
    const supportContactLink = supportContactValue
        ? (supportContactValue.startsWith("mailto:") ? supportContactValue : `mailto:${supportContactValue}`)
        : PLUGIN_SUPPORT_LINK;
    const currentUser = userProfile ? {
        displayName: userProfile.displayName || userProfile.email || "Người dùng",
        identifier: userProfile.email || "Chưa có email"
    } : {
        displayName: "Khách",
        identifier: "Chưa đăng nhập"
    };
    const currentPlan = entitlement ? {
        name: entitlementUi.planName,
        status: entitlementUi.statusLabel
    } : {
        name: shellLocked ? "Chưa có gói" : "Chưa có dữ liệu",
        status: shellLocked ? "Đăng nhập để xem" : "Không thể đồng bộ"
    };
    const currentCredit = entitlement ? {
        remaining: entitlement.creditRemaining,
        label: entitlementUi.creditLabel,
        detail: entitlementUi.creditDetail,
        severity: entitlementUi.severity
    } : {
        remaining: 0,
        label: shellLocked ? "0 credit" : "Chưa có dữ liệu",
        detail: shellLocked ? "Đăng nhập để đồng bộ" : "Không thể cập nhật trạng thái mới nhất",
        severity: "neutral"
    };
    const purchaseGateway = useMemo(() => createPurchaseGateway({
        getSession: () => session,
        onSessionRefresh: handleSessionChange
    }), [handleSessionChange, session]);

    const tabProps = useMemo(() => ({
        actionsDisabled: shellLocked,
        onRequireAuth: handleBlockedInteraction,
        onGenerate: submitGenerate,
        onRecordHistory: handleRecordHistory,
        historyRestoreRequest
    }), [handleBlockedInteraction, handleRecordHistory, historyRestoreRequest, shellLocked, submitGenerate]);

    const settingsSections = useMemo(() => ([
        {
            title: "Ngôn ngữ",
            items: [
                {
                    id: "language",
                    type: "static",
                    label: "Ngôn ngữ hiện tại",
                    description: "Pass này chỉ hỗ trợ một ngôn ngữ duy nhất để tránh tạo kỳ vọng sai về i18n.",
                    value: "Tiếng Việt"
                },
                {
                    id: "toast-mode",
                    type: "segmented",
                    settingKey: "toastMode",
                    label: "Thông báo tác vụ",
                    description: "Setting local trên máy này. Chỉ đổi mức chi tiết của toast, không sync qua backend.",
                    value: pluginSettings.toastMode,
                    options: [
                        { value: "compact", label: "Rút gọn" },
                        { value: "detailed", label: "Chi tiết" }
                    ]
                }
            ]
        },
        {
            title: "Thông tin phiên bản plugin",
            items: [
                {
                    id: "plugin-name",
                    type: "static",
                    label: "Tên plugin",
                    description: "Thông tin brand đang render ở shell hiện tại.",
                    value: PLUGIN_DISPLAY_NAME
                },
                {
                    id: "plugin-version",
                    type: "static",
                    label: "Version hiện tại",
                    description: "Đọc từ manifest của plugin. Không có action kiểm tra cập nhật trong pass này.",
                    value: pluginVersion
                },
                {
                    id: "plugin-environment",
                    type: "static",
                    label: "Môi trường",
                    description: environmentSummary.detail || "Không có endpoint shell đang hoạt động để hiển thị thêm.",
                    value: environmentSummary.label
                }
            ]
        },
        {
            title: "Liên hệ hỗ trợ",
            items: [
                {
                    id: "support-contact",
                    type: "actions",
                    label: "Kênh hỗ trợ",
                    description: "Khi cần hỗ trợ, hãy chia sẻ email đăng nhập, thời điểm gặp lỗi và ảnh chụp trạng thái hiện tại.",
                    value: supportContactDisplay || "Chưa có thông tin hỗ trợ",
                    actions: [
                        {
                            id: "copy-support",
                            label: "Sao chép liên hệ",
                            onClick: () => handleCopySupportContact(supportContactDisplay)
                        }
                    ],
                    link: supportContactLink
                }
            ]
        }
    ]), [
        environmentSummary.detail,
        environmentSummary.label,
        handleCopySupportContact,
        pluginSettings.toastMode,
        pluginVersion,
        supportContactDisplay,
        supportContactLink
    ]);

    const tabsMarkup = useMemo(() => (
        TABS.map((tab) => {
            const TabComponent = tab.component;

            return (
                <div
                    key={tab.id}
                    className={`tab-panel-frame ${activeTab === tab.id ? "is-active" : ""}`}
                >
                    <TabComponent
                        refreshVersion={tabRefreshVersion}
                        actionsDisabled={tabProps.actionsDisabled}
                        onRequireAuth={tabProps.onRequireAuth}
                        onRecordHistory={tabProps.onRecordHistory}
                        historyRestoreRequest={tabProps.historyRestoreRequest}
                        onGenerate={
                            tab.id === "tudoai"
                                ? submitTuDoAIGenerate
                                : tab.id === "thaynen"
                                    ? submitThayNenGenerate
                                    : tab.id === "phucche"
                                        ? submitPhucCheAnhGenerate
                                        : tabProps.onGenerate
                        }
                    />
                </div>
            );
        })
    ), [
        activeTab,
        submitPhucCheAnhGenerate,
        submitThayNenGenerate,
        submitTuDoAIGenerate,
        tabProps.actionsDisabled,
        tabProps.onGenerate,
        tabProps.onRequireAuth,
        tabRefreshVersion
    ]);

    if (bootStatus !== "ready") {
        return (
            <div className="splash-screen">
                <div className="splash-card">
                    <div className="logo-wrapper splash-logo">
                        <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                        </svg>
                    </div>
                    <div className="splash-copy">
                        <span className="splash-eyebrow">banana-tool-photoshop</span>
                        <h1>Đang khởi tạo plugin</h1>
                        <p>Đồng bộ phiên đăng nhập và dữ liệu tài khoản trước khi vào shell.</p>
                    </div>
                    <div className="splash-progress">
                        <div className="spinner-ring"></div>
                        <span>Bootstrap session...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <Header
                userSummary={currentUser}
                planSummary={currentPlan}
                creditSummary={currentCredit}
                refreshStatus={refreshStatus}
                actionsDisabled={pluginBusy}
                onAction={handleHeaderAction}
            />

            <div className={`shell-body ${activeAuxScreen ? "has-aux-screen" : ""}`}>
                <TabNavigation
                    tabs={TABS}
                    activeTab={activeTab}
                    disabled={pluginBusy}
                    onTabSelect={handleTabChange}
                />

                <div className="shell-main">
                    {shellLocked ? (
                        <div className="shell-lock-banner">
                            <div>
                                <strong>Plugin đang ở chế độ chưa đăng nhập.</strong>
                                <span>Bạn vẫn có thể xem shell, nhưng chuyển tab và mọi thao tác có side effect đều đang bị khóa.</span>
                            </div>
                            <button className="btn primary" onClick={() => openAuthModal("login")}>
                                Đăng nhập
                            </button>
                        </div>
                    ) : null}

                    <div className="tab-content">
                        {tabsMarkup}
                    </div>

                    {activeAuxScreen === "settings" ? (
                        <ShellSettingsView
                            sections={settingsSections}
                            pluginBusy={pluginBusy}
                            onSettingChange={updatePluginSettings}
                            onClose={() => setActiveAuxScreen(null)}
                        />
                    ) : null}
                </div>
            </div>

            <ShellModalHost
                activeModal={activeModal}
                refreshStatus={refreshStatus}
                authModalConfig={authModalConfig}
                summaries={{
                    userSummary: currentUser,
                    planSummary: currentPlan,
                    creditSummary: currentCredit,
                    entitlement,
                    entitlementUi,
                    entitlementSyncError,
                    historyItems,
                    historyStatus,
                    historyError
                }}
                userProfile={userProfile}
                purchaseGateway={purchaseGateway}
                onClose={closeModal}
                onReloadHistory={refreshHistory}
                onHistoryReinsert={handleHistoryReinsert}
                onHistoryReload={handleHistoryReload}
                onOpenPurchase={() => setActiveModal("purchase")}
                onOpenCreditSubscription={openCreditSubscription}
                onOpenSupport={openSupportModal}
                onSyncShell={refreshShell}
                onConfirmRefresh={refreshShell}
                onLogout={performLogout}
                authActions={{
                    login: submitLogin,
                    register: submitRegister,
                    resendVerifyEmail,
                    verifyEmail: confirmVerifyEmail,
                    requestPasswordReset,
                    resetPassword: submitPasswordReset,
                    updateDisplayName,
                    startEmailChange,
                    confirmEmailChange,
                    cancelPendingEmailChange,
                    changePassword: submitPasswordChange
                }}
                helpers={{
                    formatRelativeDate,
                    formatEntitlementDate
                }}
            />

            {toast ? (
                <div className={`toast toast-${toast.tone}`}>
                    {toast.message}
                </div>
            ) : null}

            <div className={`app-overlay ${pluginBusy ? "active" : ""}`}>
                <div className="spinner-ring"></div>
                <div className="overlay-text">Đang đồng bộ lại dữ liệu plugin...</div>
            </div>
        </div>
    );
};
