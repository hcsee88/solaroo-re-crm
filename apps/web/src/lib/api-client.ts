import axios from "axios";
import type { ApiResponse } from "@solaroo/types";

// API calls go through Next.js rewrites (/api/* → NestJS API) so that
// auth cookies are set on the same domain as the frontend.
// NEXT_PUBLIC_API_URL is kept as a fallback for non-browser contexts only.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const apiClient = axios.create({
  baseURL: typeof window !== "undefined" ? "/api" : `${API_BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Attach auth token from session cookie on each request
apiClient.interceptors.request.use((config) => {
  // Auth handled via httpOnly cookie set by NestJS auth module.
  // No manual token attachment needed — browser sends cookie automatically.
  return config;
});

// Normalise errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined") {
      if (error.response?.status === 401) {
        window.location.href = "/login";
      } else if (error.response?.status === 403) {
        window.location.href = "/forbidden";
      }
    }
    return Promise.reject(error);
  }
);

export async function get<T>(path: string): Promise<T> {
  const response = await apiClient.get<ApiResponse<T>>(path);
  const data = response.data;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await apiClient.post<ApiResponse<T>>(path, body);
  const data = response.data;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}

export async function patch<T>(path: string, body: unknown): Promise<T> {
  const response = await apiClient.patch<ApiResponse<T>>(path, body);
  const data = response.data;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}

export async function del<T>(path: string): Promise<T> {
  const response = await apiClient.delete<ApiResponse<T>>(path);
  const data = response.data;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}

// ── File upload (base64 JSON) ──────────────────────────────────────────────

export async function uploadFile<T>(
  path: string,
  file: File,
  fields: Record<string, string>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        // Strip "data:<mime>;base64," prefix
        const base64 = dataUrl.split(",")[1];
        const response = await apiClient.post<ApiResponse<T>>(path, {
          ...fields,
          fileBase64:    base64,
          fileName:      file.name,
          mimeType:      file.type || "application/octet-stream",
          fileSizeBytes: file.size,
        });
        const data = response.data;
        if (!data.success) reject(new Error(data.error.message));
        else resolve(data.data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export const API_BASE_URL_EXPORT = API_BASE_URL;
