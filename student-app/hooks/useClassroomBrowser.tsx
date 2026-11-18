import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { CLASSROOM_ORIGIN, classroomBrowserScript, isClassroomOrigin, ClassroomData, ClassroomPayload } from '../lib/classroomService';
import { NetworkError, NETWORK_TIMEOUT_MS } from '../lib/network';

type Request = { id: number; payload: ClassroomPayload };
type Pending = { id: number; timer: ReturnType<typeof setTimeout>; resolve(value: ClassroomData): void; reject(error: Error): void };

/** A normal official-site browser session, used only when native fetch gets a WAF challenge. */
export function useClassroomBrowser() {
  const [request, setRequest] = useState<Request | null>(null);
  const pending = useRef<Pending | null>(null);
  const sequence = useRef(0);
  const webView = useRef<WebView>(null);
  const finish = useCallback((id: number, data?: ClassroomData, error?: Error) => {
    const current = pending.current;
    if (!current || current.id !== id) return;
    pending.current = null; clearTimeout(current.timer); setRequest(null);
    if (error) current.reject(error); else current.resolve(data!);
  }, []);
  const loadInBrowser = useCallback((payload: ClassroomPayload) => new Promise<ClassroomData>((resolve, reject) => {
    if (pending.current) finish(pending.current.id, undefined,
      new NetworkError('network', 'Request cancelled', undefined, undefined, 'requestErrorCancelled'));
    const id = ++sequence.current;
    const timer = setTimeout(() => finish(id, undefined, new NetworkError('timeout', 'Official website verification timed out')), NETWORK_TIMEOUT_MS);
    pending.current = { id, timer, resolve, reject };
    setRequest({ id, payload });
  }), [finish]);
  useEffect(() => () => {
    const current = pending.current;
    pending.current = null;
    if (current) { clearTimeout(current.timer); current.reject(new NetworkError('network', 'Request cancelled', undefined, undefined, 'requestErrorCancelled')); }
  }, []);

  const browser = request ? <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}>
    <WebView ref={webView} key={request.id} source={{ uri: CLASSROOM_ORIGIN + '/' }} javaScriptEnabled
      originWhitelist={[CLASSROOM_ORIGIN]}
      injectedJavaScriptBeforeContentLoaded={classroomBrowserScript(request.id, request.payload)}
      injectedJavaScript={classroomBrowserScript(request.id, request.payload)}
      onLoadProgress={event => {
        // The website can keep optional resources loading after its document is ready.
        if (isClassroomOrigin(event.nativeEvent.url)) webView.current?.injectJavaScript(classroomBrowserScript(request.id, request.payload));
      }}
      onShouldStartLoadWithRequest={navigation => navigation.url === 'about:blank' || isClassroomOrigin(navigation.url)}
      onMessage={event => {
        if (!isClassroomOrigin(event.nativeEvent.url)) return;
        try {
          const message = JSON.parse(event.nativeEvent.data);
          if (message.id !== request.id) return;
          if (message.error) {
            finish(request.id, undefined, new NetworkError(message.status ? 'http' : message.invalid ? 'data' : 'network',
              'Official classroom request failed', message.status || undefined));
          } else if (Array.isArray(message.classrooms) && Array.isArray(message.bookings)) {
            finish(request.id, { classrooms: message.classrooms, bookings: message.bookings });
          } else finish(request.id, undefined, new NetworkError('data', 'Invalid classroom data'));
        } catch { finish(request.id, undefined, new NetworkError('data', 'Invalid classroom message')); }
      }}
      onError={() => finish(request.id, undefined, new NetworkError('network', 'Official classroom page could not load'))}
      onHttpError={event => {
        if (event.nativeEvent.url === CLASSROOM_ORIGIN + '/') finish(request.id, undefined,
          new NetworkError('http', 'Official classroom page unavailable', event.nativeEvent.statusCode));
      }}
    />
  </View> : null;
  return { loadInBrowser, browser };
}
