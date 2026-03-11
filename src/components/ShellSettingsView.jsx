import React from "react";

export const ShellSettingsView = ({ sections, onClose }) => (
    <div className="settings-view">
        <div className="settings-header">
            <div>
                <span className="pill-tag">Full view</span>
                <h2>Cài đặt</h2>
                <p>Không mở bằng modal. Đóng màn hình này sẽ đưa user về đúng tab đang làm dở.</p>
            </div>
            <button className="btn" onClick={onClose}>
                Quay lại shell
            </button>
        </div>

        <div className="settings-sections">
            {sections.map((section) => (
                <div key={section.title} className="settings-card">
                    <h3>{section.title}</h3>
                    <div className="settings-list">
                        {section.items.map((item) => (
                            <div key={item.label} className="settings-row">
                                <div>
                                    <strong>{item.label}</strong>
                                    <p>{item.description}</p>
                                </div>
                                <span className="settings-value">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
);
