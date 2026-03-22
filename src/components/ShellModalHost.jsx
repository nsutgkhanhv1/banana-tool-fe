import React, { useEffect, useState } from "react";
import { formatPriceVnd, getPurchasePackagePrimaryValue } from "../lib/purchase.js";

const CloseButton = ({ onClick, title = "Đóng" }) => (
    <button type="button" className="btn modal-close" onClick={onClick} title={title}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        <span>Đóng</span>
    </button>
);

const ModalFrame = ({ title, subtitle, onClose, canClose, children, backdropClassName = "", cardClassName = "", bodyClassName = "" }) => (
    <div className={`modal-backdrop ${backdropClassName}`.trim()}>
        <div className={`modal-card ${cardClassName}`.trim()}>
            <div className="modal-header">
                <div>
                    <h2>{title}</h2>
                    {subtitle ? <p>{subtitle}</p> : null}
                </div>
                {canClose ? (
                    <CloseButton onClick={onClose} />
                ) : null}
            </div>
            <div className={`modal-body ${bodyClassName}`.trim()}>{children}</div>
        </div>
    </div>
);

const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value);
const passwordMeetsPolicy = (value) => value.length >= 8 && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
const isValidOtp = (value) => /^[0-9]{6}$/.test(value);

const getApiErrorMessage = (error) => {
    if (error && error.message) {
        return error.message;
    }

    return "Có lỗi xảy ra. Vui lòng thử lại.";
};

const getEmailStatusLabel = (status) => {
    if (status === "verified") {
        return "Đã xác thực";
    }

    if (status === "pending_email_change") {
        return "Chờ xác thực email mới";
    }

    return "Chưa xác thực";
};

const FormField = ({ label, type = "text", value, onChange, placeholder, disabled, autoComplete, maxLength }) => (
    <label className="form-field">
        <span>{label}</span>
        <input
            className="form-input"
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete={autoComplete}
            maxLength={maxLength}
        />
    </label>
);

const PasswordField = ({ label, value, onChange, disabled, autoComplete, placeholder }) => {
    const [visible, setVisible] = useState(false);

    return (
        <label className="form-field">
            <span>{label}</span>
            <div className="password-field">
                <input
                    className="form-input"
                    type={visible ? "text" : "password"}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    disabled={disabled}
                    autoComplete={autoComplete}
                    placeholder={placeholder}
                />
                <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setVisible((current) => !current)}
                    disabled={disabled}
                >
                    {visible ? "Ẩn" : "Hiện"}
                </button>
            </div>
        </label>
    );
};

const InlineError = ({ message }) => (
    message ? <div className="form-error">{message}</div> : null
);

const PURCHASE_TYPE_OPTIONS = [
    {
        id: "credit",
        title: "Mua credit",
        description: "Nạp thêm credit dùng ngay khi admin xác nhận thủ công giao dịch chuyển khoản."
    },
    {
        id: "subscription",
        title: "Mua subscription",
        description: "Mua gói theo thời hạn với quota credit theo tháng, vẫn duyệt thủ công bởi admin."
    }
];

const PURCHASE_STATUS_LABELS = {
    draft: "Chờ chuyển khoản",
    expired: "Đã hết hạn",
    pending_admin_review: "Chờ admin duyệt",
    approved: "Đã duyệt",
    rejected: "Bị từ chối"
};

const formatPurchaseDate = (timestamp) => {
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

const formatPurchaseRemainingTime = (expiresAt, now) => {
    if (!expiresAt) {
        return "Không xác định";
    }

    const remainingMs = Math.max(expiresAt - now, 0);
    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (remainingMs <= 0) {
        return "Đã hết hạn";
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const copyTextToClipboard = async (value) => {
    if (!value) {
        throw new Error("Không có dữ liệu để sao chép.");
    }

    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }

    throw new Error("Môi trường hiện tại chưa hỗ trợ sao chép nhanh.");
};

const AuthModal = ({ config, authActions, onClose }) => {
    const [view, setView] = useState(config.initialView || "login");
    const [email, setEmail] = useState(config.email || "");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [otp, setOtp] = useState("");
    const [notice, setNotice] = useState(config.notice || "");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const moveTo = (nextView, nextState) => {
        setView(nextView);
        setError("");
        if (nextState && Object.prototype.hasOwnProperty.call(nextState, "email")) {
            setEmail(nextState.email || "");
        }
        if (nextState && Object.prototype.hasOwnProperty.call(nextState, "notice")) {
            setNotice(nextState.notice || "");
        } else {
            setNotice("");
        }
        setPassword("");
        setConfirmPassword("");
        setOtp("");
    };

    const handleLogin = async () => {
        if (!isValidEmail(email)) {
            setError("Email không hợp lệ.");
            return;
        }

        if (!password) {
            setError("Vui lòng nhập mật khẩu.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await authActions.login({ email, password });
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const handleRegister = async () => {
        if (!isValidEmail(email)) {
            setError("Email không hợp lệ.");
            return;
        }

        if (!passwordMeetsPolicy(password)) {
            setError("Mật khẩu phải có ít nhất 8 ký tự, gồm tối thiểu 1 chữ cái và 1 chữ số.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Xác nhận mật khẩu không khớp.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await authActions.register({ email, password });
            moveTo("verify-email", {
                email,
                notice: "Tài khoản đã được tạo ở trạng thái chưa xác thực email."
            });
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const handleResendVerifyOtp = async () => {
        if (!isValidEmail(email)) {
            setError("Email không hợp lệ.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await authActions.resendVerifyEmail({ email });
            setNotice("OTP mới đã được gửi tới email của bạn.");
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerifyEmail = async () => {
        if (!isValidOtp(otp)) {
            setError("OTP phải gồm đúng 6 chữ số.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await authActions.verifyEmail({ email, otp });
            moveTo("login", {
                email,
                notice: "Email đã được xác thực. Bạn có thể đăng nhập ngay."
            });
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!isValidEmail(email)) {
            setError("Email không hợp lệ.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await authActions.requestPasswordReset({ email });
            moveTo("reset-password", {
                email,
                notice: "Nếu email tồn tại, OTP đặt lại mật khẩu đã được gửi."
            });
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const handleResetPassword = async () => {
        if (!isValidEmail(email)) {
            setError("Email không hợp lệ.");
            return;
        }

        if (!isValidOtp(otp)) {
            setError("OTP phải gồm đúng 6 chữ số.");
            return;
        }

        if (!passwordMeetsPolicy(password)) {
            setError("Mật khẩu mới phải có ít nhất 8 ký tự, gồm tối thiểu 1 chữ cái và 1 chữ số.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Xác nhận mật khẩu không khớp.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await authActions.resetPassword({
                email,
                otp,
                newPassword: password
            });
            moveTo("login", {
                email,
                notice: "Đặt lại mật khẩu thành công. Hãy đăng nhập với mật khẩu mới."
            });
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const titleMap = {
        login: "Đăng nhập",
        register: "Đăng ký",
        "verify-email": "Xác thực email",
        "forgot-password": "Quên mật khẩu",
        "reset-password": "Đặt lại mật khẩu"
    };

    const subtitleMap = {
        login: "Đăng nhập để mở khóa thao tác generate, lịch sử và quản lý tài khoản.",
        register: "Tạo tài khoản trực tiếp trong plugin bằng email và mật khẩu.",
        "verify-email": "Nhập OTP 6 số được gửi tới email để xác thực tài khoản.",
        "forgot-password": "Nhập email để yêu cầu OTP đặt lại mật khẩu.",
        "reset-password": "Đặt mật khẩu mới bằng email và OTP đã nhận."
    };

    return (
        <ModalFrame
            title={titleMap[view]}
            subtitle={subtitleMap[view]}
            onClose={onClose}
            canClose={true}
            cardClassName="purchase-modal-card"
            backdropClassName="auth-modal-backdrop"
            cardClassName="auth-modal-card"
            bodyClassName="auth-modal-body"
        >
            <div className="modal-stack">
                {notice ? <div className="info-banner">{notice}</div> : null}
                <InlineError message={error} />

                {view === "login" ? (
                    <div className="auth-form-card">
                        <FormField
                            label="Email"
                            value={email}
                            onChange={setEmail}
                            placeholder="name@example.com"
                            autoComplete="email"
                            disabled={submitting}
                        />
                        <PasswordField
                            label="Mật khẩu"
                            value={password}
                            onChange={setPassword}
                            autoComplete="current-password"
                            placeholder="Nhập mật khẩu"
                            disabled={submitting}
                        />
                        <div className="modal-actions">
                            <button className="btn primary" onClick={handleLogin} disabled={submitting}>
                                {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
                            </button>
                            <button className="btn" onClick={() => moveTo("register", { email })} disabled={submitting}>
                                Tạo tài khoản
                            </button>
                            <button className="btn subtle" onClick={() => moveTo("forgot-password", { email })} disabled={submitting}>
                                Quên mật khẩu
                            </button>
                        </div>
                    </div>
                ) : null}

                {view === "register" ? (
                    <div className="auth-form-card">
                        <FormField
                            label="Email"
                            value={email}
                            onChange={setEmail}
                            placeholder="name@example.com"
                            autoComplete="email"
                            disabled={submitting}
                        />
                        <PasswordField
                            label="Mật khẩu"
                            value={password}
                            onChange={setPassword}
                            autoComplete="new-password"
                            placeholder="Tối thiểu 8 ký tự"
                            disabled={submitting}
                        />
                        <PasswordField
                            label="Xác nhận mật khẩu"
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                            autoComplete="new-password"
                            placeholder="Nhập lại mật khẩu"
                            disabled={submitting}
                        />
                        <div className="form-hint">Mật khẩu cần có ít nhất 1 chữ cái và 1 chữ số.</div>
                        <div className="modal-actions">
                            <button className="btn primary" onClick={handleRegister} disabled={submitting}>
                                {submitting ? "Đang tạo tài khoản..." : "Đăng ký"}
                            </button>
                            <button className="btn" onClick={() => moveTo("login", { email })} disabled={submitting}>
                                Quay lại đăng nhập
                            </button>
                        </div>
                    </div>
                ) : null}

                {view === "verify-email" ? (
                    <div className="auth-form-card">
                        <FormField
                            label="Email"
                            value={email}
                            onChange={setEmail}
                            placeholder="name@example.com"
                            autoComplete="email"
                            disabled={true}
                        />
                        <FormField
                            label="OTP"
                            value={otp}
                            onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="Nhập 6 số"
                            autoComplete="one-time-code"
                            maxLength={6}
                            disabled={submitting}
                        />
                        <div className="modal-actions">
                            <button className="btn primary" onClick={handleVerifyEmail} disabled={submitting}>
                                {submitting ? "Đang xác thực..." : "Xác thực email"}
                            </button>
                            <button className="btn" onClick={handleResendVerifyOtp} disabled={submitting}>
                                Gửi lại OTP
                            </button>
                            <button className="btn subtle" onClick={() => moveTo("login", { email })} disabled={submitting}>
                                Để sau
                            </button>
                        </div>
                    </div>
                ) : null}

                {view === "forgot-password" ? (
                    <div className="auth-form-card">
                        <FormField
                            label="Email"
                            value={email}
                            onChange={setEmail}
                            placeholder="name@example.com"
                            autoComplete="email"
                            disabled={submitting}
                        />
                        <div className="modal-actions">
                            <button className="btn primary" onClick={handleForgotPassword} disabled={submitting}>
                                {submitting ? "Đang gửi OTP..." : "Gửi OTP"}
                            </button>
                            <button className="btn" onClick={() => moveTo("login", { email })} disabled={submitting}>
                                Quay lại đăng nhập
                            </button>
                        </div>
                    </div>
                ) : null}

                {view === "reset-password" ? (
                    <div className="auth-form-card">
                        <FormField
                            label="Email"
                            value={email}
                            onChange={setEmail}
                            placeholder="name@example.com"
                            autoComplete="email"
                            disabled={true}
                        />
                        <FormField
                            label="OTP"
                            value={otp}
                            onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="Nhập 6 số"
                            autoComplete="one-time-code"
                            maxLength={6}
                            disabled={submitting}
                        />
                        <PasswordField
                            label="Mật khẩu mới"
                            value={password}
                            onChange={setPassword}
                            autoComplete="new-password"
                            placeholder="Tối thiểu 8 ký tự"
                            disabled={submitting}
                        />
                        <PasswordField
                            label="Xác nhận mật khẩu mới"
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                            autoComplete="new-password"
                            placeholder="Nhập lại mật khẩu mới"
                            disabled={submitting}
                        />
                        <div className="modal-actions">
                            <button className="btn primary" onClick={handleResetPassword} disabled={submitting}>
                                {submitting ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
                            </button>
                            <button className="btn subtle" onClick={() => moveTo("login", { email })} disabled={submitting}>
                                Quay lại đăng nhập
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </ModalFrame>
    );
};

const formatHistoryTime = (value, helpers) => {
    if (helpers && typeof helpers.formatRelativeDate === "function") {
        return helpers.formatRelativeDate(value);
    }

    return value ? new Date(value).toLocaleString("vi-VN") : "Chưa có";
};

const getInsertStatusLabel = (item) => {
    if (!item || !item.insert) {
        return "Chưa rõ trạng thái chèn";
    }

    if (item.insert.status === "success") {
        return item.insert.mode === "reinsert" ? "Reinsert thành công" : "Auto-insert thành công";
    }

    return item.insert.mode === "reinsert" ? "Reinsert thất bại" : "Auto-insert thất bại";
};

const HistoryModal = ({
    items,
    status,
    error,
    helpers,
    onClose,
    onReload,
    onReinsert,
    onReloadConfig
}) => {
    const [expandedItemId, setExpandedItemId] = useState(null);
    const [previewItemId, setPreviewItemId] = useState(null);
    const [actionError, setActionError] = useState("");
    const [reinsertingItemId, setReinsertingItemId] = useState(null);

    useEffect(() => {
        if (!expandedItemId) {
            return;
        }

        if (!items.some((item) => item.historyId === expandedItemId)) {
            setExpandedItemId(null);
        }
    }, [expandedItemId, items]);

    const previewItem = items.find((item) => item.historyId === previewItemId) || null;

    const handleReinsert = async (item) => {
        setActionError("");
        setReinsertingItemId(item.historyId);

        const result = await onReinsert(item);

        if (!result || !result.ok) {
            setActionError(result && result.error ? result.error : "Không thể chèn lại ảnh từ lịch sử.");
        }

        setReinsertingItemId(null);
    };

    return (
        <ModalFrame
            title="Lịch sử"
            subtitle="Lịch sử kết quả local cho Tự Do AI, Thay Nền và Phục Chế Ảnh."
            onClose={onClose}
            canClose={true}
        >
            <div className="modal-stack">
                {status === "error" ? (
                    <div className="form-error">
                        <div>{error || "Không thể đọc lịch sử local trong plugin."}</div>
                        <div className="modal-actions" style={{ marginTop: "10px" }}>
                            <button className="btn" onClick={onReload}>Tải lại</button>
                        </div>
                    </div>
                ) : null}

                {status === "loading" ? (
                    <div className="info-banner">Đang tải lịch sử local...</div>
                ) : null}

                {status !== "loading" && status !== "error" && !items.length ? (
                    <div className="info-banner">Chưa có lịch sử kết quả nào trên máy này.</div>
                ) : null}

                {items.map((item) => {
                    const isExpanded = expandedItemId === item.historyId;

                    return (
                        <div key={item.historyId} className={`history-entry ${isExpanded ? "is-expanded" : ""}`}>
                            <button
                                className="history-row"
                                onClick={() => {
                                    setActionError("");
                                    setExpandedItemId(isExpanded ? null : item.historyId);
                                }}
                            >
                                <div className="history-row-preview">
                                    {item.previewUrl ? (
                                        <img src={item.previewUrl} alt={`${item.featureLabel} preview`} />
                                    ) : (
                                        <div className="history-row-placeholder">No preview</div>
                                    )}
                                </div>
                                <div className="history-row-copy">
                                    <strong>{item.featureLabel}</strong>
                                    <span>{formatHistoryTime(item.createdAt, helpers)}</span>
                                    <span>{item.summaryLines && item.summaryLines.length ? item.summaryLines[0] : "Không có tóm tắt input."}</span>
                                </div>
                                <div className="history-row-side">
                                    <span className={`history-status ${item.insert && item.insert.status === "success" ? "is-success" : "is-error"}`}>
                                        {item.insert && item.insert.status === "success" ? "Đã chèn" : "Chèn lỗi"}
                                    </span>
                                </div>
                            </button>

                            {isExpanded ? (
                                <div className="history-detail-card">
                                    <div className="history-detail-header">
                                        <span className="pill-tag">{item.featureLabel}</span>
                                        <span className={`history-status ${item.insert && item.insert.status === "success" ? "is-success" : "is-error"}`}>
                                            {getInsertStatusLabel(item)}
                                        </span>
                                    </div>

                                    <div className="history-detail-layout">
                                        <div className="history-preview-panel">
                                            {item.previewUrl ? (
                                                <img className="history-preview-image" src={item.previewUrl} alt={`Kết quả ${item.featureLabel}`} />
                                            ) : (
                                                <div className="history-preview-missing">Asset preview không còn khả dụng.</div>
                                            )}
                                        </div>

                                        <div className="history-detail-copy">
                                            {item.promptSnapshot ? (
                                                <>
                                                    <span className="summary-label">Prompt</span>
                                                    <p>{item.promptSnapshot}</p>
                                                </>
                                            ) : null}

                                            <div className="summary-grid">
                                                <div className="summary-tile">
                                                    <span className="summary-label">Thời gian</span>
                                                    <strong>{formatHistoryTime(item.createdAt, helpers)}</strong>
                                                    <span>{item.requestId ? `Request ${item.requestId}` : "Không có request id"}</span>
                                                </div>
                                                <div className="summary-tile">
                                                    <span className="summary-label">Trạng thái chèn</span>
                                                    <strong>{item.insert && item.insert.status === "success" ? "Thành công" : "Thất bại"}</strong>
                                                    <span>{getInsertStatusLabel(item)}</span>
                                                </div>
                                            </div>

                                            {item.summaryLines && item.summaryLines.length ? (
                                                <div className="history-input-list">
                                                    {item.summaryLines.map((line) => (
                                                        <div key={line} className="history-input-line">{line}</div>
                                                    ))}
                                                </div>
                                            ) : null}

                                            {item.insert && item.insert.insertedLayerName ? (
                                                <div className="history-meta-line">Layer gần nhất: {item.insert.insertedLayerName}</div>
                                            ) : null}

                                            {item.resultMeta && item.resultMeta.fileName ? (
                                                <div className="history-meta-line">Asset insert: {item.resultMeta.fileName}</div>
                                            ) : null}

                                            {item.capturedContext && (item.capturedContext.documentName || item.capturedContext.layerName) ? (
                                                <div className="history-meta-line">
                                                    Context gốc: {item.capturedContext.documentName || `Document #${item.capturedContext.documentId}`} / {item.capturedContext.layerName || `Layer #${item.capturedContext.layerId}`}
                                                </div>
                                            ) : null}

                                            {item.insert && item.insert.errorCode ? (
                                                <div className="history-meta-line">Mã lỗi insert: {item.insert.errorCode}</div>
                                            ) : null}

                                            {item.resultAsset && !item.resultAsset.available ? (
                                                <div className="form-error">
                                                    {item.resultAsset.error || "Asset kết quả cục bộ không còn khả dụng."}
                                                </div>
                                            ) : null}

                                            {item.insert && item.insert.error ? (
                                                <div className="form-error">{item.insert.error}</div>
                                            ) : null}

                                            {actionError ? (
                                                <div className="form-error">{actionError}</div>
                                            ) : null}

                                            <div className="modal-actions history-actions">
                                                <button
                                                    className="btn"
                                                    onClick={() => setPreviewItemId(item.historyId)}
                                                    disabled={!item.previewUrl}
                                                >
                                                    Xem ảnh lớn
                                                </button>
                                                <button
                                                    className="btn primary"
                                                    onClick={() => handleReinsert(item)}
                                                    disabled={!item.canReinsert || reinsertingItemId === item.historyId}
                                                >
                                                    {reinsertingItemId === item.historyId ? "Đang chèn..." : "Reinsert"}
                                                </button>
                                                <button
                                                    className="btn"
                                                    onClick={() => onReloadConfig(item)}
                                                    disabled={!item.canReload}
                                                >
                                                    Nạp lại cấu hình
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>

            {previewItem && previewItem.previewUrl ? (
                <div className="history-preview-overlay" onClick={() => setPreviewItemId(null)}>
                    <div className="history-preview-dialog" onClick={(event) => event.stopPropagation()}>
                        <div className="history-detail-header">
                            <span className="pill-tag">{previewItem.featureLabel}</span>
                            <CloseButton onClick={() => setPreviewItemId(null)} title="Đóng preview" />
                        </div>
                        <img className="history-preview-dialog-image" src={previewItem.previewUrl} alt={`Preview lớn ${previewItem.featureLabel}`} />
                    </div>
                </div>
            ) : null}
        </ModalFrame>
    );
};

const PurchaseModal = ({ userProfile, purchaseGateway, onClose, onOpenCreditSubscription, onSyncShell }) => {
    const [selectedType, setSelectedType] = useState("");
    const [packages, setPackages] = useState([]);
    const [currentOrder, setCurrentOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [now, setNow] = useState(Date.now());
    const [qrFailed, setQrFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const loadPurchaseState = async () => {
            if (!userProfile || !purchaseGateway) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError("");

            try {
                const [catalog, openOrder] = await Promise.all([
                    purchaseGateway.listPackages(),
                    purchaseGateway.getOpenOrder({ userId: userProfile.id })
                ]);

                if (cancelled) {
                    return;
                }

                setPackages(catalog);
                setCurrentOrder(openOrder);
                setSelectedType(openOrder ? openOrder.purchaseType : "");
                setNotice(openOrder
                    ? "Đã resume yêu cầu đang mở của bạn. Mỗi tài khoản chỉ có một order draft hoặc chờ duyệt tại một thời điểm."
                    : "");
                setQrFailed(false);
            } catch (nextError) {
                if (!cancelled) {
                    setError(getApiErrorMessage(nextError));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadPurchaseState();

        return () => {
            cancelled = true;
        };
    }, [purchaseGateway, userProfile]);

    useEffect(() => {
        if (!currentOrder || currentOrder.status !== "pending_admin_review" || !purchaseGateway || !userProfile) {
            return undefined;
        }

        const timer = setInterval(async () => {
            try {
                const refreshedOrder = await purchaseGateway.getOrder({
                    userId: userProfile.id,
                    orderId: currentOrder.orderId
                });

                if (!refreshedOrder) {
                    return;
                }

                setCurrentOrder(refreshedOrder);
                if (refreshedOrder.status === "approved" && onSyncShell) {
                    onSyncShell();
                }
            } catch (nextError) {
                // Keep polling silently for local/mock adapter and future backend retries.
            }
        }, 8000);

        return () => clearInterval(timer);
    }, [currentOrder, onSyncShell, purchaseGateway, userProfile]);

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!currentOrder || currentOrder.status !== "draft" || !currentOrder.expiresAt || currentOrder.expiresAt > now || !purchaseGateway || !userProfile) {
            return;
        }

        let cancelled = false;

        const refreshExpiredOrder = async () => {
            try {
                const nextOrder = await purchaseGateway.getOrder({
                    userId: userProfile.id,
                    orderId: currentOrder.orderId
                });
                if (!cancelled && nextOrder) {
                    setCurrentOrder(nextOrder);
                }
            } catch (nextError) {
                if (!cancelled) {
                    setError(getApiErrorMessage(nextError));
                }
            }
        };

        refreshExpiredOrder();

        return () => {
            cancelled = true;
        };
    }, [currentOrder, now, purchaseGateway, userProfile]);

    if (!userProfile) {
        return null;
    }

    const currentStep = currentOrder
        ? currentOrder.status === "draft"
            ? 3
            : 4
        : selectedType
            ? 2
            : 1;
    const filteredPackages = packages.filter((item) => item.purchaseType === selectedType);
    const creditPackages = packages.filter((item) => item.purchaseType === "credit");
    const subscriptionPackages = packages.filter((item) => item.purchaseType === "subscription");
    const currentPackage = currentOrder ? currentOrder.packageSnapshot : null;
    const currentStatusLabel = currentOrder ? (PURCHASE_STATUS_LABELS[currentOrder.status] || currentOrder.status) : "";
    const expiresInLabel = currentOrder && currentOrder.status === "draft"
        ? formatPurchaseRemainingTime(currentOrder.expiresAt, now)
        : "";

    const handleCopy = async (value, successMessage) => {
        try {
            await copyTextToClipboard(value);
            setNotice(successMessage);
            setError("");
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        }
    };

    const handleSelectType = (purchaseType) => {
        setSelectedType(purchaseType);
        setNotice("");
        setError("");
    };

    const handleSelectPackage = async (pkg) => {
        if (!purchaseGateway) {
            return;
        }

        setSubmitting(true);
        setError("");
        setNotice("");

        try {
            const result = await purchaseGateway.createDraftOrder({
                userId: userProfile.id,
                userEmail: userProfile.email,
                packageId: pkg.id
            });
            setCurrentOrder(result.order);
            setSelectedType(result.order.purchaseType);
            setQrFailed(false);
            setNotice(result.resumedExisting
                ? "Bạn đã có một yêu cầu đang mở nên plugin đưa bạn quay lại order hiện tại."
                : "Order draft đã được tạo. Chuyển khoản theo đúng nội dung để admin đối soát thủ công.");
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmTransferred = async () => {
        if (!purchaseGateway || !currentOrder) {
            return;
        }

        setSubmitting(true);
        setError("");
        setNotice("");

        try {
            const nextOrder = await purchaseGateway.confirmTransferred({
                userId: userProfile.id,
                orderId: currentOrder.orderId
            });
            setCurrentOrder(nextOrder);
            setNotice("Đã ghi nhận thao tác của bạn. Yêu cầu hiện đang chờ admin kiểm tra giao dịch thủ công.");
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const handleRefreshOrder = async () => {
        if (!purchaseGateway || !currentOrder) {
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            const nextOrder = await purchaseGateway.getOrder({
                userId: userProfile.id,
                orderId: currentOrder.orderId
            });

            if (nextOrder) {
                setCurrentOrder(nextOrder);
                if (nextOrder.status === "approved" && onSyncShell) {
                    await onSyncShell();
                }
            }
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const handleStartNewOrder = () => {
        setCurrentOrder(null);
        setSelectedType(currentOrder ? currentOrder.purchaseType : "");
        setNotice("");
        setError("");
        setQrFailed(false);
    };

    const handleViewOtherPackages = () => {
        setCurrentOrder(null);
        setSelectedType(currentOrder ? currentOrder.purchaseType : "");
        setNotice("Bạn vẫn đang có một draft order mở. Catalog bên dưới chỉ để tham khảo; nếu chọn gói khác lúc này, plugin sẽ quay lại order hiện tại cho tới khi có flow hủy hoặc tạo lại draft.");
        setError("");
        setQrFailed(false);
    };

    const renderStepHeader = () => (
        <div className="purchase-stepper">
            <div className={`purchase-step ${currentStep >= 1 ? "is-active" : ""}`}>
                <span>1</span>
                <strong>Loại mua</strong>
            </div>
            <div className={`purchase-step ${currentStep >= 2 ? "is-active" : ""}`}>
                <span>2</span>
                <strong>Gói</strong>
            </div>
            <div className={`purchase-step ${currentStep >= 3 ? "is-active" : ""}`}>
                <span>3</span>
                <strong>Chuyển khoản</strong>
            </div>
            <div className={`purchase-step ${currentStep >= 4 ? "is-active" : ""}`}>
                <span>4</span>
                <strong>Chờ duyệt</strong>
            </div>
        </div>
    );

    const renderTypeSelection = () => (
        <div className="modal-stack">
            <div className="info-banner">
                Chọn trực tiếp gói bạn muốn mua. Plugin sẽ tạo order draft tương ứng để sinh mã chuyển khoản và theo dõi trạng thái thủ công.
            </div>
            <div className="purchase-catalog-section">
                <div className="purchase-inline-header">
                    <div>
                        <strong>Gói credit</strong>
                    </div>
                    <button className="btn" onClick={() => handleSelectType("credit")}>
                        Xem riêng credit
                    </button>
                </div>
                {creditPackages.length ? (
                    creditPackages.map((pkg) => (
                        <div key={pkg.id} className="purchase-card purchase-card-selectable">
                            <div>
                                <span className="pill-tag">{getPurchasePackagePrimaryValue(pkg)}</span>
                                <h3>{pkg.displayName}</h3>
                                <p>{pkg.description}</p>
                            </div>
                            <div className="purchase-meta">
                                <strong>{formatPriceVnd(pkg.priceVnd)}đ</strong>
                                <span className="purchase-meta-note">Credit cộng sau khi admin duyệt.</span>
                                <button className="btn primary" onClick={() => handleSelectPackage(pkg)} disabled={submitting}>
                                    {submitting ? "Đang tạo order..." : "Chọn gói này"}
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="info-banner purchase-empty-note">
                        Hiện chưa có gói credit nào đang bật cho plugin.
                    </div>
                )}
            </div>

            <div className="purchase-catalog-section">
                <div className="purchase-inline-header">
                    <div>
                        <strong>Gói subscription</strong>
                    </div>
                    <button className="btn" onClick={() => handleSelectType("subscription")}>
                        Xem riêng subscription
                    </button>
                </div>
                {subscriptionPackages.length ? (
                    subscriptionPackages.map((pkg) => (
                        <div key={pkg.id} className="purchase-card purchase-card-selectable">
                            <div>
                                <span className="pill-tag">{getPurchasePackagePrimaryValue(pkg)}</span>
                                <h3>{pkg.displayName}</h3>
                                <p>{pkg.description}</p>
                            </div>
                            <div className="purchase-meta">
                                <strong>{formatPriceVnd(pkg.priceVnd)}đ</strong>
                                <span className="purchase-meta-note">Subscription kích hoạt hoặc gia hạn sau khi admin duyệt.</span>
                                <button className="btn primary" onClick={() => handleSelectPackage(pkg)} disabled={submitting}>
                                    {submitting ? "Đang tạo order..." : "Chọn gói này"}
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="info-banner purchase-empty-note">
                        Hiện chưa có gói subscription nào đang bật cho plugin.
                    </div>
                )}
            </div>
        </div>
    );

    const renderPackageSelection = () => (
        <div className="modal-stack">
            <div className="purchase-inline-header">
                <button className="back-link" onClick={() => setSelectedType("")}>
                    ← Chọn lại loại mua
                </button>
                <span className="pill-tag">{selectedType === "credit" ? "Credit" : "Subscription"}</span>
            </div>
            {filteredPackages.length ? (
                filteredPackages.map((pkg) => (
                    <div key={pkg.id} className="purchase-card purchase-card-selectable">
                        <div>
                            <span className="pill-tag">{getPurchasePackagePrimaryValue(pkg)}</span>
                            <h3>{pkg.displayName}</h3>
                            <p>{pkg.description}</p>
                        </div>
                        <div className="purchase-meta">
                            <strong>{formatPriceVnd(pkg.priceVnd)}đ</strong>
                            <span className="purchase-meta-note">{selectedType === "credit" ? "Credit cộng sau khi admin duyệt" : "Subscription kích hoạt/gia hạn sau khi admin duyệt"}</span>
                            <button className="btn primary" onClick={() => handleSelectPackage(pkg)} disabled={submitting}>
                                {submitting ? "Đang tạo order..." : "Chọn gói này"}
                            </button>
                        </div>
                    </div>
                ))
            ) : (
                <div className="info-banner">
                    Hiện chưa có gói khả dụng cho loại mua này.
                </div>
            )}
        </div>
    );

    const renderPaymentView = () => (
        <div className="modal-stack">
            <div className="purchase-inline-header">
                <button className="back-link" onClick={handleViewOtherPackages}>
                    ← Xem lại catalog
                </button>
                <span className={`purchase-status-badge status-${currentOrder.status}`}>{currentStatusLabel}</span>
            </div>

            <div className="form-error purchase-manual-banner">
                Đây là thanh toán chuyển khoản thủ công. Sau khi bạn bấm "Tôi đã chuyển khoản", admin sẽ kiểm tra giao dịch ngân hàng trước khi cộng credit hoặc kích hoạt subscription.
            </div>

            <div className="summary-grid">
                <div className="summary-tile">
                    <span className="summary-label">Loại mua</span>
                    <strong>{currentOrder.purchaseType === "credit" ? "Credit" : "Subscription"}</strong>
                    <span>{getPurchasePackagePrimaryValue(currentPackage)}</span>
                </div>
                <div className="summary-tile">
                    <span className="summary-label">Gói đã chọn</span>
                    <strong>{currentPackage.displayName}</strong>
                    <span>{currentPackage.description}</span>
                </div>
                <div className="summary-tile">
                    <span className="summary-label">Số tiền</span>
                    <strong>{formatPriceVnd(currentOrder.priceVnd)}đ</strong>
                    <span>Chốt tại thời điểm tạo order.</span>
                </div>
                <div className="summary-tile">
                    <span className="summary-label">Mã order</span>
                    <strong>{currentOrder.orderCode}</strong>
                    <span>Dùng để admin đối soát nội dung chuyển khoản.</span>
                </div>
                <div className="summary-tile">
                    <span className="summary-label">Hiệu lực draft</span>
                    <strong>{expiresInLabel}</strong>
                    <span>Draft order hết hạn sau 30 phút nếu chưa xác nhận chuyển khoản.</span>
                </div>
                <div className="summary-tile">
                    <span className="summary-label">Tạo lúc</span>
                    <strong>{formatPurchaseDate(currentOrder.createdAt)}</strong>
                    <span>Hết hạn lúc {formatPurchaseDate(currentOrder.expiresAt)}</span>
                </div>
            </div>

            <div className="purchase-payment-layout">
                <div className="account-detail-card">
                    <span className="summary-label">Thông tin chuyển khoản</span>
                    <strong>{currentOrder.bankAccount.bankName}</strong>
                    <span>Chủ tài khoản: {currentOrder.bankAccount.accountHolder}</span>
                    <span>Số tài khoản: {currentOrder.bankAccount.accountNumber}</span>
                    <div className="purchase-copy-row">
                        <button className="btn" onClick={() => handleCopy(currentOrder.bankAccount.accountNumber, "Đã sao chép số tài khoản.")}>
                            Copy STK
                        </button>
                        <button className="btn" onClick={() => handleCopy(currentOrder.transferContent, "Đã sao chép nội dung chuyển khoản.")}>
                            Copy nội dung
                        </button>
                        <button className="btn" onClick={() => handleCopy(currentOrder.orderCode, "Đã sao chép mã order.")}>
                            Copy mã order
                        </button>
                    </div>
                </div>

                <div className="account-detail-card purchase-transfer-card">
                    <span className="summary-label">Nội dung chuyển khoản chuẩn</span>
                    <strong>{currentOrder.transferContent}</strong>
                    <span>Giữ nguyên nội dung này để admin tìm giao dịch đúng order nhanh hơn.</span>
                </div>

                <div className="account-detail-card purchase-qr-card">
                    <span className="summary-label">QR thanh toán</span>
                    {!qrFailed && currentOrder.qrImageUrl ? (
                        <img
                            className="purchase-qr-image"
                            src={currentOrder.qrImageUrl}
                            alt={`QR thanh toán cho ${currentOrder.orderCode}`}
                            onError={() => setQrFailed(true)}
                        />
                    ) : (
                        <div className="purchase-qr-fallback">
                            <strong>QR chưa tải được</strong>
                            <span>Bạn vẫn có thể chuyển khoản thủ công bằng đúng số tài khoản, số tiền và nội dung bên cạnh.</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="modal-actions">
                <button className="btn primary" onClick={handleConfirmTransferred} disabled={submitting || currentOrder.status !== "draft" || expiresInLabel === "Đã hết hạn"}>
                    {submitting ? "Đang cập nhật..." : "Tôi đã chuyển khoản"}
                </button>
                <button className="btn" onClick={handleRefreshOrder} disabled={submitting}>
                    Làm mới trạng thái
                </button>
            </div>
        </div>
    );

    const renderPaymentViewCompact = () => (
        <div className="modal-stack purchase-payment-view">
            <div className="purchase-inline-header">
                <button className="back-link" onClick={handleViewOtherPackages}>
                    ← Xem lại catalog
                </button>
                <span className={`purchase-status-badge status-${currentOrder.status}`}>{currentStatusLabel}</span>
            </div>

            <div className="purchase-manual-callout">
                <strong>Chuyển khoản thủ công</strong>
                <span>Sau khi bạn bấm "Tôi đã chuyển khoản", admin sẽ kiểm tra giao dịch ngân hàng rồi mới cộng credit hoặc kích hoạt subscription.</span>
            </div>

            <div className="account-detail-card purchase-order-hero">
                <div className="purchase-order-main">
                    <span className="summary-label">{currentOrder.purchaseType === "credit" ? "Gói credit" : "Gói subscription"}</span>
                    <strong>{currentPackage.displayName}</strong>
                    <span>{getPurchasePackagePrimaryValue(currentPackage)}</span>
                </div>
                <div className="purchase-order-price">
                    <span className="summary-label">Số tiền cần chuyển</span>
                    <strong>{formatPriceVnd(currentOrder.priceVnd)}đ</strong>
                    <span>Mã order: {currentOrder.orderCode}</span>
                </div>
            </div>

            <div className="purchase-fact-grid">
                <div className="purchase-fact-card">
                    <span className="summary-label">Mã order</span>
                    <strong>{currentOrder.orderCode}</strong>
                    <span>Dùng mã này trong nội dung chuyển khoản để admin đối soát nhanh hơn.</span>
                </div>
                <div className="purchase-fact-card">
                    <span className="summary-label">Hiệu lực draft</span>
                    <strong>{expiresInLabel}</strong>
                    <span>Order sẽ hết hạn sau 30 phút nếu bạn chưa xác nhận đã chuyển khoản.</span>
                </div>
                <div className="purchase-fact-card">
                    <span className="summary-label">Thời gian</span>
                    <strong>{formatPurchaseDate(currentOrder.createdAt)}</strong>
                    <span>Hết hạn lúc {formatPurchaseDate(currentOrder.expiresAt)}</span>
                </div>
            </div>

            <div className="purchase-payment-layout">
                <div className="account-detail-card purchase-bank-card">
                    <span className="summary-label">Thông tin chuyển khoản</span>
                    <div className="purchase-bank-grid">
                        <div className="purchase-bank-field">
                            <span className="purchase-bank-label">Ngân hàng</span>
                            <strong>{currentOrder.bankAccount.bankName}</strong>
                        </div>
                        <div className="purchase-bank-field">
                            <span className="purchase-bank-label">Chủ tài khoản</span>
                            <strong>{currentOrder.bankAccount.accountHolder}</strong>
                        </div>
                        <div className="purchase-bank-field purchase-bank-field-wide">
                            <span className="purchase-bank-label">Số tài khoản</span>
                            <strong>{currentOrder.bankAccount.accountNumber}</strong>
                        </div>
                        <div className="purchase-bank-field purchase-bank-field-wide purchase-transfer-card">
                            <span className="purchase-bank-label">Nội dung chuyển khoản</span>
                            <strong>{currentOrder.transferContent}</strong>
                            <span>Giữ nguyên nội dung này để admin match đúng order nhanh hơn.</span>
                        </div>
                    </div>
                    <div className="purchase-copy-row">
                        <button className="btn" onClick={() => handleCopy(currentOrder.bankAccount.accountNumber, "Đã sao chép số tài khoản.")}>
                            Copy STK
                        </button>
                        <button className="btn" onClick={() => handleCopy(currentOrder.transferContent, "Đã sao chép nội dung chuyển khoản.")}>
                            Copy nội dung
                        </button>
                        <button className="btn" onClick={() => handleCopy(currentOrder.orderCode, "Đã sao chép mã order.")}>
                            Copy mã order
                        </button>
                    </div>
                </div>

                <div className="account-detail-card purchase-qr-card">
                    <span className="summary-label">Quét QR để chuyển nhanh</span>
                    {!qrFailed && currentOrder.qrImageUrl ? (
                        <img
                            className="purchase-qr-image"
                            src={currentOrder.qrImageUrl}
                            alt={`QR thanh toán cho ${currentOrder.orderCode}`}
                            onError={() => setQrFailed(true)}
                        />
                    ) : (
                        <div className="purchase-qr-fallback">
                            <strong>QR chưa tải được</strong>
                            <span>Bạn vẫn có thể chuyển khoản thủ công bằng đúng số tài khoản, số tiền và nội dung ở khối bên trái.</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="modal-actions">
                <button className="btn primary" onClick={handleConfirmTransferred} disabled={submitting || currentOrder.status !== "draft" || expiresInLabel === "Đã hết hạn"}>
                    {submitting ? "Đang cập nhật..." : "Tôi đã chuyển khoản"}
                </button>
                <button className="btn" onClick={handleRefreshOrder} disabled={submitting}>
                    Làm mới trạng thái
                </button>
            </div>
        </div>
    );

    const renderWaitingView = () => (
        <div className="modal-stack">
            <div className="success-banner">
                Yêu cầu của bạn đã được ghi nhận. Admin sẽ kiểm tra thủ công giao dịch ngân hàng trước khi duyệt.
            </div>
            <div className="summary-grid">
                <div className="summary-tile">
                    <span className="summary-label">Trạng thái</span>
                    <strong>{currentStatusLabel}</strong>
                    <span>Plugin đang giữ order ở chế độ chỉ theo dõi.</span>
                </div>
                <div className="summary-tile">
                    <span className="summary-label">Gói</span>
                    <strong>{currentPackage.displayName}</strong>
                    <span>{getPurchasePackagePrimaryValue(currentPackage)}</span>
                </div>
                <div className="summary-tile">
                    <span className="summary-label">Số tiền</span>
                    <strong>{formatPriceVnd(currentOrder.priceVnd)}đ</strong>
                    <span>Nội dung chuyển khoản: {currentOrder.transferContent}</span>
                </div>
                <div className="summary-tile">
                    <span className="summary-label">Đã xác nhận lúc</span>
                    <strong>{formatPurchaseDate(currentOrder.confirmedTransferredAt)}</strong>
                    <span>Admin sẽ đối soát theo số tiền và mã order.</span>
                </div>
            </div>
            <div className="account-detail-card">
                <span className="summary-label">Lưu ý</span>
                <strong>Thanh toán thủ công chưa dùng ngay</strong>
                <span>Quyền sử dụng chỉ được cập nhật sau khi admin duyệt. Bạn có thể đóng modal, mở lại sau để theo dõi tiếp.</span>
            </div>
            <div className="modal-actions">
                <button className="btn primary" onClick={handleRefreshOrder} disabled={submitting}>
                    {submitting ? "Đang kiểm tra..." : "Kiểm tra lại trạng thái"}
                </button>
                <button className="btn" onClick={onClose}>
                    Đóng
                </button>
            </div>
        </div>
    );

    const renderApprovedView = () => (
        <div className="modal-stack">
            <div className="success-banner">
                Order đã được duyệt. Plugin sẽ đồng bộ lại entitlement để cập nhật credit hoặc subscription mới nhất.
            </div>
            <div className="summary-grid">
                <div className="summary-tile">
                    <span className="summary-label">Gói</span>
                    <strong>{currentPackage.displayName}</strong>
                    <span>{getPurchasePackagePrimaryValue(currentPackage)}</span>
                </div>
                <div className="summary-tile">
                    <span className="summary-label">Duyệt lúc</span>
                    <strong>{formatPurchaseDate(currentOrder.approvedAt)}</strong>
                    <span>Mã order {currentOrder.orderCode}</span>
                </div>
            </div>
            <div className="modal-actions">
                <button className="btn primary" onClick={onOpenCreditSubscription}>
                    Xem Credit & Subscription
                </button>
                <button className="btn" onClick={onClose}>
                    Đóng
                </button>
            </div>
        </div>
    );

    const renderRejectedView = () => (
        <div className="modal-stack">
            <div className="form-error">
                Order đã bị từ chối. Bạn có thể tạo yêu cầu mới sau khi kiểm tra lại nội dung và giao dịch chuyển khoản.
            </div>
            <div className="summary-grid">
                <div className="summary-tile">
                    <span className="summary-label">Mã order</span>
                    <strong>{currentOrder.orderCode}</strong>
                    <span>{currentPackage.displayName}</span>
                </div>
                <div className="summary-tile">
                    <span className="summary-label">Lý do</span>
                    <strong>{currentOrder.rejectionReason || "Chưa có lý do chi tiết"}</strong>
                    <span>Từ chối lúc {formatPurchaseDate(currentOrder.rejectedAt)}</span>
                </div>
            </div>
            <div className="modal-actions">
                <button className="btn primary" onClick={handleStartNewOrder}>
                    Tạo order mới
                </button>
                <button className="btn" onClick={onClose}>
                    Đóng
                </button>
            </div>
        </div>
    );

    const renderExpiredView = () => (
        <div className="modal-stack">
            <div className="form-error">
                Draft order đã hết hạn trước khi bạn xác nhận chuyển khoản. Vui lòng tạo order mới để lấy lại mã chuyển khoản và thời hạn 30 phút.
            </div>
            <div className="summary-grid">
                <div className="summary-tile">
                    <span className="summary-label">Mã order cũ</span>
                    <strong>{currentOrder.orderCode}</strong>
                    <span>{currentPackage.displayName}</span>
                </div>
                <div className="summary-tile">
                    <span className="summary-label">Hết hạn lúc</span>
                    <strong>{formatPurchaseDate(currentOrder.expiresAt)}</strong>
                    <span>Order cũ vẫn được lưu cho mục đích tra cứu ngoại lệ.</span>
                </div>
            </div>
            <div className="modal-actions">
                <button className="btn primary" onClick={handleStartNewOrder}>
                    Tạo order mới
                </button>
                <button className="btn" onClick={onClose}>
                    Đóng
                </button>
            </div>
        </div>
    );

    const renderContent = () => {
        if (loading) {
            return (
                <div className="modal-stack">
                    <div className="info-banner">Đang tải catalog gói và order đang mở...</div>
                </div>
            );
        }

        if (currentOrder) {
            if (currentOrder.status === "draft") {
                return renderPaymentViewCompact();
            }

            if (currentOrder.status === "pending_admin_review") {
                return renderWaitingView();
            }

            if (currentOrder.status === "approved") {
                return renderApprovedView();
            }

            if (currentOrder.status === "rejected") {
                return renderRejectedView();
            }

            if (currentOrder.status === "expired") {
                return renderExpiredView();
            }
        }

        if (selectedType) {
            return renderPackageSelection();
        }

        return renderTypeSelection();
    };

    return (
        <ModalFrame
            title="Mua gói"
            subtitle="Chọn credit hoặc subscription, lấy thông tin chuyển khoản và theo dõi trạng thái admin duyệt thủ công."
            onClose={onClose}
            canClose={true}
        >
            <div className="modal-stack">
                {renderStepHeader()}
                {notice ? <div className="success-banner">{notice}</div> : null}
                <InlineError message={error} />
                {renderContent()}
            </div>
        </ModalFrame>
    );
};

const CreditSubscriptionModal = ({ summaries, helpers, refreshStatus, onClose, onOpenPurchase, onOpenSupport, onConfirmRefresh }) => {
    const { entitlement, entitlementUi, entitlementSyncError } = summaries;
    const primaryAction = entitlementUi.primaryAction;

    const handlePrimaryAction = () => {
        if (primaryAction.type === "support") {
            onOpenSupport();
            return;
        }

        onOpenPurchase();
    };

    return (
        <ModalFrame
            title="Credit & Subscription"
            subtitle="Tóm tắt entitlement đang áp dụng cho toàn plugin, bao gồm trạng thái gói, credit còn lại và hành động tiếp theo."
            onClose={onClose}
            canClose={true}
        >
            <div className="modal-stack">
                {entitlementSyncError ? (
                    <div className="form-error">
                        Không thể cập nhật trạng thái mới nhất. Plugin đang giữ summary gần nhất còn dùng được.
                    </div>
                ) : null}

                {entitlementUi.lowCredit ? (
                    <div className="info-banner">
                        Credit của bạn đang ở mức thấp. Bạn vẫn có thể generate, nhưng nên chuẩn bị mua thêm để tránh gián đoạn.
                    </div>
                ) : null}

                {!entitlementUi.canGenerate ? (
                    <div className="form-error">
                        <strong>{entitlementUi.denyMessage}.</strong>
                        <span> Plugin vẫn cho phép bạn xem tab và chỉnh input, nhưng thao tác generate sẽ bị chặn cho tới khi entitlement hợp lệ.</span>
                    </div>
                ) : null}

                <div className="summary-grid">
                    <div className="summary-tile">
                        <span className="summary-label">Plan</span>
                        <strong>{entitlementUi.planName}</strong>
                        <span>{entitlementUi.statusLabel}</span>
                    </div>
                    <div className="summary-tile">
                        <span className="summary-label">Credit còn lại</span>
                        <strong>{entitlement ? entitlement.creditRemaining : 0}</strong>
                        <span>{entitlementUi.creditDetail}</span>
                    </div>
                    <div className="summary-tile">
                        <span className="summary-label">Đã dùng / tổng limit</span>
                        <strong>{entitlementUi.usageLabel}</strong>
                        <span>Summary hợp nhất cho entitlement đang dùng để generate.</span>
                    </div>
                    <div className="summary-tile">
                        <span className="summary-label">Ngày reset tiếp theo</span>
                        <strong>{helpers.formatEntitlementDate(entitlement && entitlement.nextResetAt)}</strong>
                        <span>Không tự suy luận ở frontend nếu backend chưa trả dữ liệu.</span>
                    </div>
                    <div className="summary-tile">
                        <span className="summary-label">Ngày hết hạn</span>
                        <strong>{helpers.formatEntitlementDate(entitlement && entitlement.subscriptionEndAt)}</strong>
                        <span>Với entitlement onboarding hoặc Free có thể không áp dụng.</span>
                    </div>
                    <div className="summary-tile">
                        <span className="summary-label">Trạng thái sử dụng</span>
                        <strong>{entitlementUi.canGenerate ? "Có thể generate" : "Đang bị chặn"}</strong>
                        <span>{entitlementUi.canGenerate ? "Backend vẫn là nguồn chân lý cuối cùng khi submit." : entitlementUi.denyMessage}</span>
                    </div>
                </div>

                <div className="account-detail-card">
                    <span className="summary-label">Hành động</span>
                    <strong>{primaryAction.label}</strong>
                    <span>{primaryAction.type === "support" ? (entitlementUi.supportContact || "Liên hệ bộ phận hỗ trợ để mở khóa lại tài khoản.") : "Mở flow mua riêng để tiếp tục sử dụng plugin."}</span>
                </div>

                <div className="modal-actions">
                    <button className="btn primary" onClick={handlePrimaryAction}>
                        {primaryAction.label}
                    </button>
                    <button className="btn" onClick={onConfirmRefresh} disabled={refreshStatus === "refreshing"}>
                        {refreshStatus === "refreshing" ? "Đang đồng bộ..." : "Refresh"}
                    </button>
                </div>
            </div>
        </ModalFrame>
    );
};

const SupportModal = ({ supportContact, onClose }) => (
    <ModalFrame
        title="Liên hệ hỗ trợ"
        subtitle="CTA dành riêng cho trường hợp subscription bị suspended hoặc cần can thiệp vận hành."
        onClose={onClose}
        canClose={true}
    >
        <div className="modal-stack">
            <div className="account-detail-card">
                <span className="summary-label">Kênh hỗ trợ</span>
                <strong>{supportContact || "support@banana-tool.vn"}</strong>
                <span>Chia sẻ email đăng nhập, thời điểm gặp lỗi và ảnh chụp trạng thái hiện tại để đội hỗ trợ xử lý nhanh hơn.</span>
            </div>
            <div className="modal-actions">
                <button className="btn" onClick={onClose}>
                    Đóng
                </button>
            </div>
        </div>
    </ModalFrame>
);

const RefreshConfirmModal = ({ onClose, onConfirmRefresh, refreshStatus }) => (
    <ModalFrame
        title="Xác nhận làm mới plugin"
        subtitle="Plugin sẽ đồng bộ lại session, user, credit, gói và dữ liệu shell liên quan."
        onClose={onClose}
        canClose={refreshStatus !== "refreshing"}
    >
        <div className="modal-stack">
            <div className="info-banner">
                Thao tác này sẽ khóa plugin tạm thời, giữ nguyên tab hiện tại và chỉ đồng bộ lại dữ liệu đang có nguồn thật trong shell.
            </div>
            <div className="modal-actions">
                <button className="btn primary" onClick={onConfirmRefresh} disabled={refreshStatus === "refreshing"}>
                    {refreshStatus === "refreshing" ? "Đang đồng bộ..." : "Xác nhận làm mới"}
                </button>
                <button className="btn" onClick={onClose} disabled={refreshStatus === "refreshing"}>
                    Hủy
                </button>
            </div>
        </div>
    </ModalFrame>
);

const AccountModal = ({ userProfile, summaries, authActions, helpers, onClose, onOpenPurchase, onOpenCreditSubscription, onLogout }) => {
    const [view, setView] = useState("overview");
    const [displayName, setDisplayName] = useState(userProfile && userProfile.displayName ? userProfile.displayName : "");
    const [newEmail, setNewEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setDisplayName(userProfile && userProfile.displayName ? userProfile.displayName : "");
    }, [userProfile && userProfile.displayName]);

    if (!userProfile) {
        return null;
    }

    const handleSaveDisplayName = async () => {
        setSubmitting(true);
        setError("");

        try {
            const updated = await authActions.updateDisplayName({ displayName });
            setDisplayName(updated.displayName || "");
            setNotice("Đã cập nhật tên hiển thị.");
            setView("overview");
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const handleSendVerifyOtp = async () => {
        setSubmitting(true);
        setError("");

        try {
            await authActions.resendVerifyEmail({ email: userProfile.email });
            setNotice("OTP xác thực đã được gửi tới email hiện tại.");
            setView("verify-email");
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerifyCurrentEmail = async () => {
        if (!isValidOtp(otp)) {
            setError("OTP phải gồm đúng 6 chữ số.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await authActions.verifyEmail({ email: userProfile.email, otp });
            setNotice("Email đã được xác thực.");
            setOtp("");
            setView("overview");
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const handleStartEmailChange = async () => {
        if (!isValidEmail(newEmail)) {
            setError("Email mới không hợp lệ.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await authActions.startEmailChange({ newEmail });
            setOtp("");
            setNotice("OTP đổi email đã được gửi tới địa chỉ mới.");
            setView("confirm-email");
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmEmailChange = async () => {
        if (!isValidOtp(otp)) {
            setError("OTP phải gồm đúng 6 chữ số.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await authActions.confirmEmailChange({ otp });
            setOtp("");
            setNotice("Email đăng nhập đã được cập nhật.");
            setView("overview");
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancelPendingEmail = async () => {
        setSubmitting(true);
        setError("");

        try {
            await authActions.cancelPendingEmailChange();
            setNotice("Đã hủy yêu cầu đổi email.");
            setOtp("");
            setView("overview");
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const handleResendPendingEmailOtp = async () => {
        if (!userProfile.pendingEmail) {
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await authActions.startEmailChange({ newEmail: userProfile.pendingEmail });
            setNotice("OTP mới đã được gửi tới email đang chờ xác thực.");
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const handleChangePassword = async () => {
        if (!passwordMeetsPolicy(newPassword)) {
            setError("Mật khẩu mới phải có ít nhất 8 ký tự, gồm tối thiểu 1 chữ cái và 1 chữ số.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Xác nhận mật khẩu mới không khớp.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await authActions.changePassword({
                currentPassword,
                newPassword
            });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setNotice("Mật khẩu đã được cập nhật.");
            setView("overview");
        } catch (nextError) {
            setError(getApiErrorMessage(nextError));
        } finally {
            setSubmitting(false);
        }
    };

    const renderOverview = () => (
        <div className="modal-stack">
            {userProfile.emailVerificationStatus === "unverified" ? (
                <div className="info-banner">
                    <strong>Email chưa xác thực.</strong>
                    <span>Bạn vẫn có thể dùng plugin, nhưng nên xác thực email để tăng độ tin cậy của tài khoản.</span>
                    <div className="modal-actions">
                        <button className="btn primary" onClick={() => setView("verify-email")}>
                            Xác thực ngay
                        </button>
                        <button className="btn" onClick={handleSendVerifyOtp} disabled={submitting}>
                            Gửi lại OTP
                        </button>
                    </div>
                </div>
            ) : null}

            {userProfile.emailVerificationStatus === "pending_email_change" ? (
                <div className="info-banner">
                    <strong>Đang chờ xác thực email mới.</strong>
                    <span>Email hiện tại vẫn là địa chỉ đăng nhập chính cho tới khi OTP của email mới được xác nhận.</span>
                    <div className="modal-actions">
                        <button className="btn primary" onClick={() => setView("confirm-email")}>
                            Nhập OTP email mới
                        </button>
                        <button className="btn" onClick={handleCancelPendingEmail} disabled={submitting}>
                            Hủy yêu cầu
                        </button>
                    </div>
                </div>
            ) : null}

            {notice ? <div className="success-banner">{notice}</div> : null}
            <InlineError message={error} />

            <div className="summary-grid">
                <div className="summary-tile">
                    <span className="summary-label">Plan hiện tại</span>
                    <strong>{summaries.planSummary.name}</strong>
                    <span>{summaries.planSummary.status}</span>
                </div>
                <div className="summary-tile">
                    <span className="summary-label">Credit</span>
                    <strong>{summaries.creditSummary.label}</strong>
                    <span>{summaries.creditSummary.detail}</span>
                </div>
            </div>

            <div className="summary-grid">
                <div className="summary-tile">
                    <span className="summary-label">Email</span>
                    <strong>{userProfile.email}</strong>
                    <span>{userProfile.pendingEmail ? `Đang chờ đổi sang ${userProfile.pendingEmail}` : "Địa chỉ đăng nhập hiện tại"}</span>
                </div>
                <div className="summary-tile">
                    <span className="summary-label">Tên hiển thị</span>
                    <strong>{userProfile.displayName || "Chưa cập nhật"}</strong>
                    <span>Dùng trong header và tóm tắt tài khoản</span>
                </div>
                <div className="summary-tile">
                    <span className="summary-label">Trạng thái email</span>
                    <strong>{getEmailStatusLabel(userProfile.emailVerificationStatus)}</strong>
                    <span>{userProfile.emailVerified ? "Đã xác thực" : "Chưa xác thực"}</span>
                </div>
                <div className="summary-tile">
                    <span className="summary-label">Lần đăng nhập gần nhất</span>
                    <strong>{helpers.formatRelativeDate(userProfile.lastLoginAt)}</strong>
                    <span>Tạo lúc {helpers.formatRelativeDate(userProfile.createdAt)}</span>
                </div>
            </div>

            <div className="account-action-grid">
                <button className="btn primary" onClick={() => setView("edit-profile")}>
                    Chỉnh sửa thông tin
                </button>
                <button className="btn" onClick={() => setView("change-email")}>
                    Đổi email
                </button>
                <button className="btn" onClick={() => setView("change-password")}>
                    Đổi mật khẩu
                </button>
                <button className="btn" onClick={onOpenCreditSubscription}>
                    Xem Credit & Subscription
                </button>
                <button className="btn" onClick={onOpenPurchase}>
                    Mua credit / subscription
                </button>
                <button className="btn danger" onClick={onLogout}>
                    Đăng xuất
                </button>
            </div>
        </div>
    );

    const renderEditProfile = () => (
        <div className="modal-stack">
            <button className="back-link" onClick={() => setView("overview")}>
                ← Quay lại tài khoản
            </button>
            <InlineError message={error} />
            <FormField
                label="Tên hiển thị"
                value={displayName}
                onChange={setDisplayName}
                placeholder="Nhập tên hiển thị"
                disabled={submitting}
            />
            <div className="modal-actions">
                <button className="btn primary" onClick={handleSaveDisplayName} disabled={submitting}>
                    {submitting ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
                <button className="btn" onClick={() => setView("overview")} disabled={submitting}>
                    Hủy
                </button>
            </div>
        </div>
    );

    const renderVerifyEmail = () => (
        <div className="modal-stack">
            <button className="back-link" onClick={() => setView("overview")}>
                ← Quay lại tài khoản
            </button>
            {notice ? <div className="success-banner">{notice}</div> : null}
            <InlineError message={error} />
            <div className="account-detail-card">
                <span className="summary-label">Email hiện tại</span>
                <strong>{userProfile.email}</strong>
                <span>Nhập OTP 6 số được gửi tới email này.</span>
            </div>
            <FormField
                label="OTP"
                value={otp}
                onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Nhập 6 số"
                maxLength={6}
                autoComplete="one-time-code"
                disabled={submitting}
            />
            <div className="modal-actions">
                <button className="btn primary" onClick={handleVerifyCurrentEmail} disabled={submitting}>
                    {submitting ? "Đang xác thực..." : "Xác thực email"}
                </button>
                <button className="btn" onClick={handleSendVerifyOtp} disabled={submitting}>
                    Gửi lại OTP
                </button>
            </div>
        </div>
    );

    const renderChangeEmail = () => (
        <div className="modal-stack">
            <button className="back-link" onClick={() => setView("overview")}>
                ← Quay lại tài khoản
            </button>
            <InlineError message={error} />
            <div className="account-detail-card">
                <span className="summary-label">Email hiện tại</span>
                <strong>{userProfile.email}</strong>
                <span>Email cũ vẫn giữ hiệu lực cho tới khi xác thực OTP email mới.</span>
            </div>
            <FormField
                label="Email mới"
                value={newEmail}
                onChange={setNewEmail}
                placeholder="new@example.com"
                autoComplete="email"
                disabled={submitting}
            />
            <div className="modal-actions">
                <button className="btn primary" onClick={handleStartEmailChange} disabled={submitting}>
                    {submitting ? "Đang gửi OTP..." : "Tiếp tục"}
                </button>
                <button className="btn" onClick={() => setView("overview")} disabled={submitting}>
                    Hủy
                </button>
            </div>
        </div>
    );

    const renderConfirmEmail = () => (
        <div className="modal-stack">
            <button className="back-link" onClick={() => setView("overview")}>
                ← Quay lại tài khoản
            </button>
            {notice ? <div className="success-banner">{notice}</div> : null}
            <InlineError message={error} />
            <div className="account-detail-card">
                <span className="summary-label">Email mới đang chờ xác thực</span>
                <strong>{userProfile.pendingEmail || "Chưa có email chờ xác thực"}</strong>
                <span>Email cũ vẫn là email đăng nhập chính cho tới khi OTP đúng.</span>
            </div>
            <FormField
                label="OTP"
                value={otp}
                onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Nhập 6 số"
                autoComplete="one-time-code"
                maxLength={6}
                disabled={submitting}
            />
            <div className="modal-actions">
                <button className="btn primary" onClick={handleConfirmEmailChange} disabled={submitting}>
                    {submitting ? "Đang xác thực..." : "Xác nhận email mới"}
                </button>
                <button className="btn" onClick={handleResendPendingEmailOtp} disabled={submitting || !userProfile.pendingEmail}>
                    Gửi lại OTP
                </button>
                <button className="btn subtle" onClick={handleCancelPendingEmail} disabled={submitting}>
                    Hủy yêu cầu
                </button>
            </div>
        </div>
    );

    const renderChangePassword = () => (
        <div className="modal-stack">
            <button className="back-link" onClick={() => setView("overview")}>
                ← Quay lại tài khoản
            </button>
            <InlineError message={error} />
            <PasswordField
                label="Mật khẩu hiện tại"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu hiện tại"
                disabled={submitting}
            />
            <PasswordField
                label="Mật khẩu mới"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                placeholder="Tối thiểu 8 ký tự"
                disabled={submitting}
            />
            <PasswordField
                label="Xác nhận mật khẩu mới"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu mới"
                disabled={submitting}
            />
            <div className="modal-actions">
                <button className="btn primary" onClick={handleChangePassword} disabled={submitting}>
                    {submitting ? "Đang lưu..." : "Đổi mật khẩu"}
                </button>
                <button className="btn" onClick={() => setView("overview")} disabled={submitting}>
                    Hủy
                </button>
            </div>
        </div>
    );

    return (
        <ModalFrame
            title="Tài khoản"
            subtitle="Xem trạng thái email, chỉnh thông tin cơ bản và quản lý phiên đăng nhập hiện tại."
            onClose={onClose}
            canClose={true}
        >
            {view === "overview" ? renderOverview() : null}
            {view === "edit-profile" ? renderEditProfile() : null}
            {view === "verify-email" ? renderVerifyEmail() : null}
            {view === "change-email" ? renderChangeEmail() : null}
            {view === "confirm-email" ? renderConfirmEmail() : null}
            {view === "change-password" ? renderChangePassword() : null}
        </ModalFrame>
    );
};

export const ShellModalHost = ({
    activeModal,
    refreshStatus,
    authModalConfig,
    summaries,
    userProfile,
    purchaseGateway,
    authActions,
    helpers,
    onClose,
    onReloadHistory,
    onHistoryReinsert,
    onHistoryReload,
    onOpenPurchase,
    onOpenCreditSubscription,
    onOpenSupport,
    onSyncShell,
    onConfirmRefresh,
    onLogout
}) => {
    if (!activeModal) {
        return null;
    }

    if (activeModal === "login") {
        return (
            <AuthModal
                key={authModalConfig.resetKey}
                config={authModalConfig}
                authActions={authActions}
                onClose={onClose}
            />
        );
    }

    if (activeModal === "history") {
        return (
            <HistoryModal
                items={summaries.historyItems}
                status={summaries.historyStatus}
                error={summaries.historyError}
                helpers={helpers}
                onClose={onClose}
                onReload={onReloadHistory}
                onReinsert={onHistoryReinsert}
                onReloadConfig={onHistoryReload}
            />
        );
    }

    if (activeModal === "account") {
        return (
            <AccountModal
                userProfile={userProfile}
                summaries={summaries}
                authActions={authActions}
                helpers={helpers}
                onClose={onClose}
                onOpenPurchase={onOpenPurchase}
                onOpenCreditSubscription={onOpenCreditSubscription}
                onLogout={onLogout}
            />
        );
    }

    if (activeModal === "credit-subscription") {
        return (
            <CreditSubscriptionModal
                summaries={summaries}
                helpers={helpers}
                refreshStatus={refreshStatus}
                onClose={onClose}
                onOpenPurchase={onOpenPurchase}
                onOpenSupport={onOpenSupport}
                onConfirmRefresh={onConfirmRefresh}
            />
        );
    }

    if (activeModal === "purchase") {
        return (
            <PurchaseModal
                userProfile={userProfile}
                purchaseGateway={purchaseGateway}
                onClose={onClose}
                onOpenCreditSubscription={onOpenCreditSubscription}
                onSyncShell={onSyncShell}
            />
        );
    }

    if (activeModal === "support") {
        return <SupportModal supportContact={summaries.entitlementUi && summaries.entitlementUi.supportContact} onClose={onClose} />;
    }

    if (activeModal === "refresh-confirm") {
        return (
            <RefreshConfirmModal
                onClose={onClose}
                onConfirmRefresh={onConfirmRefresh}
                refreshStatus={refreshStatus}
            />
        );
    }

    return null;
};
