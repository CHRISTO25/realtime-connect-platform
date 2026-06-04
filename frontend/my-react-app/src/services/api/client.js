import axios from "axios";

const apiClient = axios.create({
  baseURL: "http://localhost:8080/api/v1",
  timeout: 10000,
});

export default apiClient;