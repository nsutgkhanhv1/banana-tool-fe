import React, { useEffect, useState } from "react";

const ModalFrame = ({ title, subtitle, onClose, canClose, children }) => (
    <div className="modal-backdrop">
        <div className="modal-card">
            <div className="modal-header">
                <div>
                    <h2>{title}</h2>
                    {subtitle ? <p>{subtitle}</p> : null}
                </div>
                {canClose ? (
                    <button className="btn icon-only modal-close" onClick={onClose} title="Đóng">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                ) : null}
            </div>
            <div className="modal-body">{children}</div>
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

const HistoryModal = ({ items, onClose }) => {
    const [selectedItem, setSelectedItem] = useState(null);

    return (
        <ModalFrame
            title="Lịch sử"
            subtitle="Danh sách kết quả gần đây. Chọn một item để xem chi tiết trong cùng modal."
            onClose={onClose}
            canClose={true}
        >
            {selectedItem ? (
                <div className="modal-stack">
                    <button className="back-link" onClick={() => setSelectedItem(null)}>
                        ← Quay lại danh sách
                    </button>
                    <div className="history-detail-card">
                        <div className="history-detail-header">
                            <span className="pill-tag">{selectedItem.tool}</span>
                            <span className="history-status">{selectedItem.status}</span>
                        </div>
                        <h3>{selectedItem.title}</h3>
                        <p>{selectedItem.prompt}</p>
                        <div className="summary-grid">
                            <div className="summary-tile">
                                <span className="summary-label">Thời gian</span>
                                <strong>{selectedItem.time}</strong>
                            </div>
                            <div className="summary-tile">
                                <span className="summary-label">Credit</span>
                                <strong>{selectedItem.creditCost} ảnh</strong>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="modal-stack">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            className="history-row"
                            onClick={() => setSelectedItem(item)}
                        >
                            <div className="history-row-copy">
                                <strong>{item.title}</strong>
                                <span>{item.tool} · {item.time}</span>
                            </div>
                            <span className="history-status">{item.status}</span>
                        </button>
                    ))}
                </div>
            )}
        </ModalFrame>
    );
};

const PurchaseModal = ({ options, onClose }) => (
    <ModalFrame
        title="Mua gói"
        subtitle="Điểm vào riêng cho flow mua credit hoặc subscription."
        onClose={onClose}
        canClose={true}
    >
        <div className="modal-stack">
            {options.map((option) => (
                <div key={option.id} className="purchase-card">
                    <div>
                        <span className="pill-tag">Ưu tiên</span>
                        <h3>{option.title}</h3>
                        <p>{option.description}</p>
                    </div>
                    <div className="purchase-meta">
                        <strong>{option.price}</strong>
                        <button className="btn">Bắt đầu</button>
                    </div>
                </div>
            ))}
        </div>
    </ModalFrame>
);

const RefreshConfirmModal = ({ onClose, onConfirmRefresh, refreshStatus }) => (
    <ModalFrame
        title="Xác nhận làm mới shell"
        subtitle="Plugin sẽ đồng bộ lại session, user, credit, gói và dữ liệu shell liên quan."
        onClose={onClose}
        canClose={refreshStatus !== "refreshing"}
    >
        <div className="modal-stack">
            <div className="info-banner">
                Thao tác này giữ nguyên tab hiện tại và chỉ làm mới dữ liệu toàn cục cần thiết.
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

const AccountModal = ({ userProfile, summaries, authActions, helpers, onClose, onOpenPurchase, onLogout }) => {
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
                <button className="btn" onClick={onOpenPurchase}>
                    Xem gói / Credit
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
    authActions,
    helpers,
    onClose,
    onOpenPurchase,
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
        return <HistoryModal items={summaries.historyItems} onClose={onClose} />;
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
                onLogout={onLogout}
            />
        );
    }

    if (activeModal === "purchase") {
        return <PurchaseModal options={summaries.purchaseOptions} onClose={onClose} />;
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
