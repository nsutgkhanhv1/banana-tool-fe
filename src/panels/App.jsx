import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "../components/Header.jsx";
import { TabNavigation } from "../components/TabNavigation.jsx";
import { ShellModalHost } from "../components/ShellModalHost.jsx";
import { ShellSettingsView } from "../components/ShellSettingsView.jsx";
import { requestJson } from "../lib/api.js";
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

const HISTORY_ITEMS = [
    {
        id: "hist-01",
        tool: "Thay Nền",
        title: "Portrait studio nền be",
        time: "10:42",
        creditCost: 1,
        prompt: "Nền studio be, ánh sáng mềm, giữ nguyên chủ thể.",
        status: "Hoàn tất"
    },
    {
        id: "hist-02",
        tool: "Phục chế ảnh",
        title: "Ảnh gia đình 1986",
        time: "Hôm qua",
        creditCost: 2,
        prompt: "Khôi phục khuôn mặt, giảm hạt và giữ tone ảnh gốc.",
        status: "Hoàn tất"
    },
    {
        id: "hist-03",
        tool: "Tự Do AI",
        title: "Lookbook ngoài trời",
        time: "Thứ Hai",
        creditCost: 3,
        prompt: "Tạo lookbook ngoài trời, tông nắng chiều, bố cục editorial.",
        status: "Đã lưu"
    }
];

const PURCHASE_OPTIONS = [
    {
        id: "credit-pack",
        title: "Gói credit linh hoạt",
        price: "299.000đ",
        description: "Nạp thêm 80 credit cho các job ngắn hạn và chiến dịch đột xuất."
    },
    {
        id: "studio-plan",
        title: "Pro Studio Monthly",
        price: "799.000đ / tháng",
        description: "Phù hợp cho team xử lý ảnh mỗi ngày, có credit làm mới định kỳ."
    }
];

const SHELL_SETTINGS = [
    {
        title: "Tùy chọn plugin",
        items: [
            { label: "Auto-save preview", value: "Bật", description: "Giữ bản xem trước gần nhất để mở lại nhanh hơn." },
            { label: "UXP temp cache", value: "Tự động dọn", description: "Xóa dữ liệu tạm sau mỗi phiên để tránh đầy bộ nhớ." }
        ]
    },
    {
        title: "Hiển thị",
        items: [
            { label: "Ngôn ngữ giao diện", value: "Tiếng Việt", description: "Đồng bộ theo bộ thiết lập hiện tại của plugin." },
            { label: "Thông báo tác vụ", value: "Rút gọn", description: "Toast ngắn gọn cho refresh, đăng nhập và trạng thái shell." }
        ]
    }
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

const formatPlanName = (planCode) => {
    if (!planCode) {
        return "Chưa có gói";
    }

    if (planCode === "free") {
        return "Free";
    }

    return planCode
        .split(/[-_]/g)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
};

const formatPlanStatus = (status) => {
    if (status === "active") {
        return "Đang hoạt động";
    }

    if (status === "expired") {
        return "Đã hết hạn";
    }

    if (status === "suspended") {
        return "Tạm dừng";
    }

    return "Đăng nhập để xem";
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

export const App = () => {
    const [bootStatus, setBootStatus] = useState("idle");
    const [authStatus, setAuthStatus] = useState("unknown");
    const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
    const [activeModal, setActiveModal] = useState(null);
    const [activeAuxScreen, setActiveAuxScreen] = useState(null);
    const [session, setSession] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [entitlement, setEntitlement] = useState(null);
    const [refreshStatus, setRefreshStatus] = useState("idle");
    const [toast, setToast] = useState(null);
    const [tabRefreshVersion, setTabRefreshVersion] = useState(0);
    const [authModalConfig, setAuthModalConfig] = useState({
        resetKey: 0,
        initialView: "login",
        email: "",
        notice: ""
    });

    const showToast = useCallback((message, tone) => {
        setToast({
            id: Date.now(),
            message,
            tone: tone || "info"
        });
    }, []);

    useEffect(() => {
        if (!toast) {
            return undefined;
        }

        const timer = setTimeout(() => {
            setToast(null);
        }, 3000);

        return () => clearTimeout(timer);
    }, [toast]);

    const handleSessionChange = useCallback((nextSession) => {
        setSession(nextSession);
        persistSession(nextSession);
    }, []);

    const applyUnauthenticatedShell = useCallback(() => {
        handleSessionChange(null);
        setAuthStatus("unauthenticated");
        setUserProfile(null);
        setEntitlement(null);
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

    const loadShellData = useCallback(async (sessionValue) => {
        const [profile, currentEntitlement] = await Promise.all([
            requestJson("/me", { method: "GET" }, sessionValue, handleSessionChange),
            requestJson("/me/entitlement", { method: "GET" }, sessionValue, handleSessionChange)
        ]);

        setUserProfile(profile);
        setEntitlement(currentEntitlement);
        setAuthStatus("authenticated");

        return {
            profile,
            entitlement: currentEntitlement
        };
    }, [handleSessionChange]);

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
                await loadShellData(persistedSession);
                setActiveModal(null);
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

    const refreshShell = useCallback(async () => {
        if (!session) {
            openAuthModal("login");
            return;
        }

        setRefreshStatus("refreshing");

        try {
            await loadShellData(session);
            setTabRefreshVersion((value) => value + 1);
            setRefreshStatus("success");
            showToast("Đã đồng bộ lại shell plugin.", "success");
        } catch (error) {
            applyUnauthenticatedShell();
            openAuthModal("login", {
                notice: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            });
            setRefreshStatus("error");
            showToast("Không thể đồng bộ vì phiên đã hết hạn.", "error");
        }

        setTimeout(() => {
            setRefreshStatus("idle");
        }, 1200);
    }, [applyUnauthenticatedShell, loadShellData, openAuthModal, session, showToast]);

    const handleBlockedInteraction = useCallback(() => {
        showToast("Vui lòng đăng nhập để thực hiện thao tác này.", "warning");
        openAuthModal("login");
    }, [openAuthModal, showToast]);

    const handleTabChange = useCallback((nextTab) => {
        setActiveTab(nextTab);
    }, []);

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
            setActiveAuxScreen(null);
            setActiveModal("purchase");
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
    }, [authStatus, openAuthModal, performLogout]);

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
        await loadShellData(nextSession);
        setActiveModal(null);
        showToast("Đăng nhập thành công.", "success");
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

    const shellLocked = authStatus !== "authenticated";
    const currentUser = userProfile ? {
        displayName: userProfile.displayName || userProfile.email || "Người dùng",
        identifier: userProfile.email || "Chưa có email"
    } : {
        displayName: "Khách",
        identifier: "Chưa đăng nhập"
    };
    const currentPlan = entitlement ? {
        name: formatPlanName(entitlement.planCode),
        status: formatPlanStatus(entitlement.subscriptionStatus)
    } : {
        name: "Chưa có gói",
        status: "Đăng nhập để xem"
    };
    const currentCredit = entitlement ? {
        remaining: entitlement.imagesRemaining,
        label: `${entitlement.imagesRemaining} ảnh`,
        detail: `${entitlement.imagesUsed}/${entitlement.monthlyCreditLimit} đã dùng`
    } : {
        remaining: 0,
        label: "0 ảnh",
        detail: "Đăng nhập để đồng bộ"
    };

    const tabProps = useMemo(() => ({
        actionsDisabled: shellLocked,
        onRequireAuth: handleBlockedInteraction
    }), [handleBlockedInteraction, shellLocked]);

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
                    />
                </div>
            );
        })
    ), [activeTab, tabProps.actionsDisabled, tabProps.onRequireAuth, tabRefreshVersion]);

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
                onAction={handleHeaderAction}
            />

            <div className={`shell-body ${activeAuxScreen ? "has-aux-screen" : ""}`}>
                <TabNavigation
                    tabs={TABS}
                    activeTab={activeTab}
                    onTabSelect={handleTabChange}
                />

                <div className="shell-main">
                    {shellLocked ? (
                        <div className="shell-lock-banner">
                            <div>
                                <strong>Plugin đang ở chế độ chưa đăng nhập.</strong>
                                <span>Bạn vẫn có thể xem shell và chuyển tab, nhưng mọi thao tác tạo side effect đang bị khóa.</span>
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
                            sections={SHELL_SETTINGS}
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
                    historyItems: HISTORY_ITEMS,
                    purchaseOptions: PURCHASE_OPTIONS
                }}
                userProfile={userProfile}
                onClose={() => setActiveModal(null)}
                onOpenPurchase={() => setActiveModal("purchase")}
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
                    formatRelativeDate
                }}
            />

            {toast ? (
                <div className={`toast toast-${toast.tone}`}>
                    {toast.message}
                </div>
            ) : null}
        </div>
    );
};
