import { api, endpoints, responseData } from "./api.js";

export async function askAssistant(question, history = []) {
  return responseData(await api.post(endpoints.chat, { question, history }, { timeout: 40_000 }));
}

export async function testAssistantConnection() {
  return responseData(await api.post(endpoints.aiDiagnostics, {}, { timeout: 40_000 }));
}
