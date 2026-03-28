const DEFAULT_API_BASE_URL = "https://banana-ai-tool-be.khanhdg3007-896.workers.dev/v1";

export const API_BASE_URL =
    (typeof window !== "undefined" && window.__BANANA_TOOL_API_BASE_URL__) || DEFAULT_API_BASE_URL;

const parseJson = async (response) => {
    try {
        return await response.json();
    } catch (error) {
        return {
            success: false,
            error: "Phản hồi từ server không hợp lệ.",
            code: "INVALID_RESPONSE"
        };
    }
};

export const ApiError = class extends Error {
    constructor(message, code, status) {
        super(message);
        this.name = "ApiError";
        this.code = code || "REQUEST_FAILED";
        this.status = status || 500;
    }
};

export const requestJson = async (path, init = {}, session, onSessionRefresh, options = {}) => {
    const config = options || {};
    const makeRequest = async (token) => fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
    });

    let response = await makeRequest(session ? session.accessToken : null);

    if (!config.disableSessionRefresh && response.status === 401 && session && session.refreshToken) {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                refreshToken: session.refreshToken
            })
        });
        const refreshBody = await parseJson(refreshResponse);

        if (refreshResponse.ok && refreshBody.success && refreshBody.data) {
            const nextSession = {
                ...session,
                accessToken: refreshBody.data.accessToken,
                refreshToken: refreshBody.data.refreshToken
            };

            // Keep the in-flight session object aligned with rotated tokens so
            // follow-up requests in the same async flow do not reuse a revoked refresh token.
            if (session) {
                session.accessToken = nextSession.accessToken;
                session.refreshToken = nextSession.refreshToken;
            }

            onSessionRefresh(nextSession);
            response = await makeRequest(nextSession.accessToken);
        } else {
            if (typeof onSessionRefresh === "function") {
                onSessionRefresh(null);
            }
            throw new ApiError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", refreshBody.code, 401);
        }
    }

    const body = await parseJson(response);

    if (!response.ok || !body.success) {
        throw new ApiError(body.error || `Request failed (${response.status})`, body.code, response.status);
    }

    return body.data;
};
