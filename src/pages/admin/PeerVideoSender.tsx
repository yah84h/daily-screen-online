import { useEffect, useRef, useState } from 'react';
import { useAdmin } from './store';
import { isLocalBackend } from '@/lib/supabase';
import {
  completeDescription,
  newPeer,
  peerSignaling,
  sendPeerFile,
  validatePeerFile,
} from '@/lib/peerTransfer';
export function PeerVideoSender() {
  const { data } = useAdmin();
  const [target, setTarget] = useState(''),
    [status, setStatus] = useState(''),
    [progress, setProgress] = useState(0),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const channel = useRef<RTCDataChannel | undefined>(undefined),
    cleanup = useRef<() => void>(() => {});
  useEffect(() => () => cleanup.current(), [data?.screen.id]);
  async function send(file?: File) {
    if (!file) return;
    cleanup.current();
    setReady(false);
    setProgress(0);
    setBusy(true);
    const device = data?.devices.find((d) => d.token === (target || data.devices[0]?.token));
    const abort = new AbortController();
    let peer: RTCPeerConnection | undefined,
      connection: Awaited<ReturnType<typeof peerSignaling>> | undefined;
    const session = crypto.randomUUID();
    let timer: ReturnType<typeof setTimeout>;
    cleanup.current = () => {
      abort.abort();
      clearTimeout(timer);
      peer?.close();
      channel.current = undefined;
      if (connection)
        void connection
          .send({ session, type: 'cancel' })
          .catch(() => {})
          .finally(() => connection?.close());
    };
    const fail = (message: string) => {
      setStatus(message);
      setBusy(false);
      setReady(false);
      cleanup.current();
    };
    try {
      validatePeerFile({ name: file.name, size: file.size, mime: file.type });
      if (!device) throw Error('اختر جهاز عرض مرتبطًا.');
      setStatus('جارٍ الاتصال بجهاز العرض…');
      peer = newPeer();
      connection = await peerSignaling(device.token, async (signal) => {
        if (
          signal.session === session &&
          signal.type === 'answer' &&
          signal.sdp &&
          !abort.signal.aborted
        ) {
          try {
            await peer!.setRemoteDescription(signal.sdp);
          } catch {
            fail('تعذر الربط بجهاز العرض');
          }
        }
      });
      if (abort.signal.aborted) {
        void connection.close();
        return;
      }
      const dc = peer.createDataChannel('video-file', { ordered: true });
      channel.current = dc;
      dc.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'ready') {
            clearTimeout(timer);
            setReady(true);
            setBusy(false);
            setProgress(1);
            setStatus('محفوظ على جهاز العرض وجاهز للتشغيل');
          }
          if (message.type === 'playing') setStatus('يعمل الآن على جهاز العرض');
        } catch {}
      };
      dc.onclose = () => {
        if (!abort.signal.aborted) fail('انقطع اتصال النقل. أعد الإرسال للاتصال مجددًا.');
      };
      dc.onopen = () => {
        clearTimeout(timer);
        timer = setTimeout(() => fail('انتهت مهلة نقل الفيديو؛ أعد المحاولة.'), 10 * 60 * 1000);
        setStatus('نقل مباشر؛ أبقِ الصفحة مفتوحة');
        void sendPeerFile(dc, file, setProgress, abort.signal)
          .then(() => setStatus('التحقق من الفيديو وحفظه على جهاز العرض…'))
          .catch((error) => {
            if (!abort.signal.aborted) fail(error.message);
          });
      };
      timer = setTimeout(
        () => fail('انتهت مهلة النقل. قد تحتاج هذه الشبكة إلى TURN؛ جرّب رابط Drive بدلًا منه.'),
        45000,
      );
      peer.onconnectionstatechange = () => {
        if (peer?.connectionState === 'failed')
          fail('الاتصال المباشر محجوب على هذه الشبكة. يلزم TURN أو رابط فيديو.');
      };
      await peer.setLocalDescription(await peer.createOffer());
      const sdp = await completeDescription(peer);
      if (!abort.signal.aborted) await connection.send({ session, type: 'offer', sdp });
    } catch (error) {
      if (!abort.signal.aborted) fail((error as Error).message);
    }
  }
  if (isLocalBackend) return <p>النقل المباشر متاح في نسخة الموقع المتصلة بـ Supabase.</p>;
  return (
    <section className="collection-card" aria-label="إرسال فيديو مباشر">
      <h2>إرسال فيديو مباشر إلى جهاز العرض</h2>
      <p>
        بدون رفع إلى التخزين السحابي. أبقِ الهاتف والصفحة مفتوحين حتى تظهر «جاهز». الاتصال بين
        الشبكات تجريبي وقد يحتاج TURN.
      </p>
      <label>
        جهاز الاستقبال
        <select
          value={target}
          disabled={busy}
          onChange={(e) => {
            cleanup.current();
            setReady(false);
            setTarget(e.target.value);
          }}
        >
          {data?.devices.map((d) => (
            <option key={d.token} value={d.token}>
              {d.label || 'جهاز العرض'}
            </option>
          ))}
        </select>
      </label>
      <input
        aria-label="فيديو للنقل المباشر"
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        disabled={busy || !data?.devices.length}
        onChange={(e) => {
          void send(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {busy && (
        <>
          <progress max={1} value={progress} />
          <span>{Math.round(progress * 100)}٪ تم الإرسال</span>
          <button
            onClick={() => {
              cleanup.current();
              setBusy(false);
              setStatus('أُلغي النقل');
            }}
          >
            إلغاء النقل
          </button>
        </>
      )}
      <p role="status">{status}</p>
      {ready && (
        <>
          <button
            className="button primary"
            onClick={() => channel.current?.send(JSON.stringify({ type: 'play' }))}
          >
            تشغيل الفيديو على الشاشة
          </button>
          <button
            className="button white"
            onClick={() => channel.current?.send(JSON.stringify({ type: 'stop' }))}
          >
            العودة إلى العرض المعتاد
          </button>
        </>
      )}
    </section>
  );
}
