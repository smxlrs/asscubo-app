// Store reason keys in screen state so changing language also updates an existing error.
export const networkMessages: Record<string, Record<string, string>> = {
  "zh": {
    "requestErrorTimeout": "等待服务响应超时，单次请求最多等待 20 秒。请切换网络后重试。",
    "requestErrorConnection": "未能连接到服务，系统没有提供具体原因。请检查本 App 的联网权限，或切换网络后重试；使用 VPN 时请确认它也代理了本 App。",
    "requestErrorDns": "无法找到服务器地址。请切换网络，或检查 VPN 的 DNS 设置后重试。",
    "requestErrorSecure": "无法与服务器建立安全连接。请检查手机日期和时间，或切换网络后重试。",
    "requestErrorServer": "服务器暂时无法处理请求，请稍后重试。",
    "requestErrorBusy": "请求过于频繁，服务器暂时限制了访问，请稍后重试。",
    "requestErrorAuth": "登录状态无效或已过期，请重新登录后重试。",
    "requestErrorForbidden": "服务器拒绝了这次访问，可能是权限或访问限制。请稍后重试。",
    "requestErrorMissing": "服务器上找不到所需内容，内容可能已移除，请稍后刷新。",
    "requestErrorData": "已连接到服务器，但返回的内容无法读取。请重试。",
    "requestErrorCancelled": "请求已取消，请重试。",
    "requestErrorUnknown": "加载失败，暂时无法确定原因。请重试。",
    "requestErrorNoData": "暂无数据"
  },
  "zh-Hant": {
    "requestErrorTimeout": "等待服務回應逾時，單次請求最多等待 20 秒。請切換網路後重試。",
    "requestErrorConnection": "未能連線到服務，系統沒有提供具體原因。請檢查本 App 的連網權限，或切換網路後重試；使用 VPN 時請確認它也代理了本 App。",
    "requestErrorDns": "無法找到伺服器位址。請切換網路，或檢查 VPN 的 DNS 設定後重試。",
    "requestErrorSecure": "無法與伺服器建立安全連線。請檢查手機日期和時間，或切換網路後重試。",
    "requestErrorServer": "伺服器暫時無法處理請求，請稍後重試。",
    "requestErrorBusy": "請求過於頻繁，伺服器暫時限制了存取，請稍後重試。",
    "requestErrorAuth": "登入狀態無效或已過期，請重新登入後重試。",
    "requestErrorForbidden": "伺服器拒絕了這次存取，可能是權限或存取限制。請稍後重試。",
    "requestErrorMissing": "伺服器上找不到所需內容，內容可能已移除，請稍後重新整理。",
    "requestErrorData": "已連線到伺服器，但傳回的內容無法讀取。請重試。",
    "requestErrorCancelled": "請求已取消，請重試。",
    "requestErrorUnknown": "載入失敗，暫時無法確定原因。請重試。",
    "requestErrorNoData": "暫無資料"
  },
  "en": {
    "requestErrorTimeout": "Timed out waiting for the service. Each request waits up to 20 seconds. Try switching networks and try again.",
    "requestErrorConnection": "Could not connect to the service. Your device did not provide a specific reason. Check this app’s internet permissions or try another network. If you use a VPN, make sure it also routes this app’s traffic.",
    "requestErrorDns": "Could not find the server address. Try another network or check your VPN’s DNS settings.",
    "requestErrorSecure": "Could not establish a secure connection. Check your phone’s date and time, or try another network.",
    "requestErrorServer": "The server is temporarily unable to handle the request. Please try again later.",
    "requestErrorBusy": "Too many requests. The server has temporarily limited access. Please try again later.",
    "requestErrorAuth": "Your login session is invalid or has expired. Please sign in again.",
    "requestErrorForbidden": "The server denied access. This may be a permission or access restriction. Try again later.",
    "requestErrorMissing": "The requested content was not found on the server. It may have been removed. Please refresh later.",
    "requestErrorData": "Connected to the server, but its response could not be read. Try again.",
    "requestErrorCancelled": "The request was cancelled. Please try again.",
    "requestErrorUnknown": "Loading failed, and the cause is not yet known. Try again.",
    "requestErrorNoData": "No data available"
  },
  "it": {
    "requestErrorTimeout": "Tempo di attesa del servizio scaduto. Ogni richiesta attende al massimo 20 secondi. Prova a cambiare rete e riprova.",
    "requestErrorConnection": "Impossibile connettersi al servizio. Il dispositivo non ha indicato una causa precisa. Controlla i permessi di accesso a Internet dell’app o prova un’altra rete. Se usi una VPN, verifica che gestisca anche il traffico di questa app.",
    "requestErrorDns": "Impossibile trovare l’indirizzo del server. Prova un’altra rete o controlla le impostazioni DNS della VPN.",
    "requestErrorSecure": "Impossibile stabilire una connessione sicura. Controlla data e ora del telefono o prova un’altra rete.",
    "requestErrorServer": "Il server non può elaborare la richiesta al momento. Riprova più tardi.",
    "requestErrorBusy": "Troppe richieste. Il server ha limitato temporaneamente l’accesso. Riprova più tardi.",
    "requestErrorAuth": "La sessione di accesso non è valida o è scaduta. Accedi di nuovo.",
    "requestErrorForbidden": "Il server ha negato l’accesso, forse per permessi o restrizioni. Riprova più tardi.",
    "requestErrorMissing": "Il contenuto richiesto non è stato trovato sul server. Potrebbe essere stato rimosso. Aggiorna più tardi.",
    "requestErrorData": "Connessione al server riuscita, ma la risposta non è leggibile. Riprova.",
    "requestErrorCancelled": "La richiesta è stata annullata. Riprova.",
    "requestErrorUnknown": "Caricamento non riuscito: la causa non è ancora nota. Riprova.",
    "requestErrorNoData": "Nessun dato disponibile"
  }
};

const networkSummaries: Record<string, Record<string, string>> = {
  "zh": {
    "requestErrorTimeout": "连接超时",
    "requestErrorConnection": "无法连接服务",
    "requestErrorDns": "找不到服务器地址",
    "requestErrorSecure": "安全连接失败",
    "requestErrorServer": "服务器暂不可用",
    "requestErrorBusy": "请求过于频繁",
    "requestErrorAuth": "请重新登录",
    "requestErrorForbidden": "访问被拒绝",
    "requestErrorMissing": "内容不存在",
    "requestErrorData": "返回内容无法读取",
    "requestErrorCancelled": "请求已取消",
    "requestErrorUnknown": "加载失败",
    "requestErrorNoData": "暂无数据"
  },
  "zh-Hant": {
    "requestErrorTimeout": "連線逾時",
    "requestErrorConnection": "無法連線到服務",
    "requestErrorDns": "找不到伺服器位址",
    "requestErrorSecure": "安全連線失敗",
    "requestErrorServer": "伺服器暫時無法使用",
    "requestErrorBusy": "請求過於頻繁",
    "requestErrorAuth": "請重新登入",
    "requestErrorForbidden": "存取遭拒",
    "requestErrorMissing": "內容不存在",
    "requestErrorData": "傳回內容無法讀取",
    "requestErrorCancelled": "請求已取消",
    "requestErrorUnknown": "載入失敗",
    "requestErrorNoData": "暫無資料"
  },
  "en": {
    "requestErrorTimeout": "Connection timed out",
    "requestErrorConnection": "Could not connect",
    "requestErrorDns": "Server address not found",
    "requestErrorSecure": "Secure connection failed",
    "requestErrorServer": "Server unavailable",
    "requestErrorBusy": "Too many requests",
    "requestErrorAuth": "Please sign in again",
    "requestErrorForbidden": "Access denied",
    "requestErrorMissing": "Content not found",
    "requestErrorData": "Unreadable response",
    "requestErrorCancelled": "Request cancelled",
    "requestErrorUnknown": "Loading failed",
    "requestErrorNoData": "No data available"
  },
  "it": {
    "requestErrorTimeout": "Connessione scaduta",
    "requestErrorConnection": "Connessione non riuscita",
    "requestErrorDns": "Indirizzo server non trovato",
    "requestErrorSecure": "Connessione sicura non riuscita",
    "requestErrorServer": "Server non disponibile",
    "requestErrorBusy": "Troppe richieste",
    "requestErrorAuth": "Accedi di nuovo",
    "requestErrorForbidden": "Accesso negato",
    "requestErrorMissing": "Contenuto non trovato",
    "requestErrorData": "Risposta non leggibile",
    "requestErrorCancelled": "Richiesta annullata",
    "requestErrorUnknown": "Caricamento non riuscito",
    "requestErrorNoData": "Nessun dato disponibile"
  }
};

export function networkErrorText(key: string, language: string, compact = false): string {
  const normalized = key === '无数据' ? 'requestErrorNoData' : key === '无网络' ? 'requestErrorConnection' : key;
  if (compact) return networkSummaries[language]?.[normalized] || networkSummaries.zh[normalized] || key;
  return networkMessages[language]?.[normalized] || networkMessages.zh[normalized] || key;
}
