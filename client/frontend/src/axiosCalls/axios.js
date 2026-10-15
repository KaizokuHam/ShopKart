import axios from "axios";

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:8085",
    withCredentials: true,
    timeout: 15000,
    headers:{
        "Content-Type": "application/json"
    }
})

axiosInstance.interceptors.response.use(response => response, error => {
    if (error.response?.status === 401 && !/\/(users|customers)\/(login|register|change-password)$/.test(error.config?.url || "")) {
        window.dispatchEvent(new Event("authExpired"));
    }
    return Promise.reject(error);
});

export default axiosInstance
