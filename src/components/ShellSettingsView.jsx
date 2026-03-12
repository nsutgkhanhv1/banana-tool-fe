import React from "react";

export const ShellSettingsView = ({ sections, pluginBusy, onSettingChange, onClose }) => (
    <div className="settings-view">
        <div className="settings-header">
            <div>
                <span className="pill-tag">Full view</span>
                <h2>Cài đặt</h2>
                <p>Đây là màn hình full-view của shell. Quay lại sẽ giữ nguyên tab và form state hiện tại nếu tab đó đã giữ state sẵn.</p>
            </div>
            <button className="btn" onClick={onClose} disabled={pluginBusy}>
                Quay lại
            </button>
        </div>

        <div className="settings-sections">
            {sections.map((section) => (
                <div key={section.title} className="settings-card">
                    <h3>{section.title}</h3>
                    <div className="settings-list">
                        {section.items.map((item) => (
                            <div key={item.id || item.label} className="settings-row">
                                <div className="settings-row-copy">
                                    <strong>{item.label}</strong>
                                    <p>{item.description}</p>
                                </div>

                                <div className="settings-row-side">
                                    {item.type === "segmented" ? (
                                        <div className="segmented-control settings-segmented-control">
                                            {item.options.map((option) => (
                                                <button
                                                    key={option.value}
                                                    className={`segment-btn ${item.value === option.value ? "active" : ""}`}
                                                    onClick={() => onSettingChange({ [item.settingKey]: option.value })}
                                                    disabled={pluginBusy || item.value === option.value}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}

                                    {item.type === "actions" ? (
                                        <div className="settings-actions">
                                            <span className="settings-value">{item.value}</span>
                                            <div className="settings-action-row">
                                                {item.actions && item.actions.length ? item.actions.map((action) => (
                                                    <button
                                                        key={action.id}
                                                        className="btn"
                                                        onClick={action.onClick}
                                                        disabled={pluginBusy}
                                                    >
                                                        {action.label}
                                                    </button>
                                                )) : null}
                                            </div>
                                        </div>
                                    ) : null}

                                    {item.type !== "segmented" && item.type !== "actions" ? (
                                        <span className="settings-value">{item.value}</span>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
);
