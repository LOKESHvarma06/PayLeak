import { api, endpoints, responseData } from "./api.js";

export async function askAssistant(question) {
  return responseData(await api.post(endpoints.chat, { question }));
}
