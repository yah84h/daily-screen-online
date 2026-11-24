import { useEffect, useRef, useState } from 'react';
import {
  completeDescription,
  newPeer,
  peerSignaling,
  peerStore,
  validatePeerFile,
} from '@/lib/peerTransfer';
import { waitForMediaReady } from '@/lib/mediaReadiness';
import { MediaVideo } from './MediaVideo';
export function PeerVideoReceiver({ screen, token }: { screen: string; token: string }) {
  const [video, setVideo] = useState(''),
    [note, setNote] = useState('');
  const saved = useRef<{ blob: Blob; name: string } | undefined>(undefined);
  useEffect(() => {
    let live = true,
      peer: RTCPeerConnection | undefined,
      timer: ReturnType<typeof setTimeout> | undefined,
      session = '',
      url = '';
    saved.current = undefined;
    setVideo('');
    setNote('');
    const abort = new AbortController();
    let file: ReturnType<typeof validatePeerFile> | undefined,
      parts: ArrayBuffer[] = [],
      received = 0;
    void peerStore(screen)
      .then((value) => {
        if (live) saved.current = value;
      })
      .catch(() => {});
    const close = () => {
      clearTimeout(timer);
      const old = peer;
      peer = undefined;
      old?.close();
      parts = [];
      file = undefined;
      received = 0;
      session = '';
    };
    const play = () => {
      if (!saved.current) return;
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(saved.current.blob);
      setVideo(url);
    };
    const signaling = peerSignaling(token, async (signal) => {
      if (!live) return;
      try {
        if (signal.type === 'offer' && signal.sdp) {
          if (peer && peer.connectionState !== 'closed' && peer.connectionState !== 'failed')
            return;
          close();
          session = signal.session;
          peer = newPeer();
          const receivingPeer = peer;
          setNote('اتصال مباشر لاستقبال فيديو…');
          timer = setTimeout(
            () => {
              if (live && peer === receivingPeer) {
                close();
                setNote('انتهت مهلة النقل. أعد المحاولة من الإدارة.');
              }
            },
            10 * 60 * 1000,
          );
          peer.ondatachannel = (event) => {
            const channel = event.channel;
            channel.binaryType = 'arraybuffer';
            channel.onclose = () => {
              if (live && peer === receivingPeer) {
                close();
                setNote('');
              }
            };
            channel.onmessage = async (event) => {
              if (!live) return;
              try {
                if (typeof event.data === 'string') {
                  const message = JSON.parse(event.data);
                  if (message.type === 'file') {
                    if (file) throw Error('نقل غير صالح');
                    file = validatePeerFile(message);
                    parts = [];
                    received = 0;
                  } else if (message.type === 'end') {
                    if (!file || received !== file.size) throw Error('الملف غير مكتمل');
                    const blob = new Blob(parts, { type: file.mime }),
                      name = file.name;
                    parts = [];
                    const temporary = URL.createObjectURL(blob);
                    try {
                      await waitForMediaReady(temporary, 'video', abort.signal);
                    } finally {
                      URL.revokeObjectURL(temporary);
                    }
                    await peerStore(screen, { blob, name });
                    if (!live) return;
                    saved.current = { blob, name };
                    channel.send(JSON.stringify({ type: 'ready' }));
                    setNote('الفيديو محفوظ وجاهز للتشغيل من الإدارة');
                    clearTimeout(timer);
                  } else if (message.type === 'play') {
                    play();
                    channel.send(JSON.stringify({ type: 'playing' }));
                  } else if (message.type === 'stop') {
                    setVideo('');
                    setNote('');
                  }
                } else {
                  if (
                    !file ||
                    !(event.data instanceof ArrayBuffer) ||
                    received + event.data.byteLength > file.size
                  )
                    throw Error('بيانات نقل غير صالحة');
                  parts.push(event.data);
                  received += event.data.byteLength;
                  setNote('استقبال الفيديو ' + Math.round((received / file.size) * 100) + '٪');
                }
              } catch {
                setNote('تعذر حفظ الفيديو؛ تحقق من الصيغة ومساحة الجهاز');
                close();
              }
            };
          };
          await peer.setRemoteDescription(signal.sdp);
          await peer.setLocalDescription(await peer.createAnswer());
          const sdp = await completeDescription(peer);
          if (live) await (await signaling).send({ type: 'answer', session, sdp });
        } else if (signal.session === session && signal.type === 'cancel') {
          close();
          setNote('');
        }
      } catch {
        if (live) {
          close();
          setNote('تعذر الاتصال المباشر. قد تحتاج الشبكة إلى TURN.');
        }
      }
    });
    void signaling.catch(() => {});
    return () => {
      live = false;
      abort.abort();
      close();
      if (url) URL.revokeObjectURL(url);
      void signaling.then((s) => s.close()).catch(() => {});
    };
  }, [screen, token]);
  return (
    <>
      {video && (
        <div className="peer-video-overlay">
          <MediaVideo src={video} sound loop controls={false} />
          <button
            className="button white"
            onClick={() => {
              setVideo('');
              setNote('');
            }}
          >
            العودة إلى العرض
          </button>
        </div>
      )}
      {note && (
        <div className="peer-transfer-note" role="status">
          {note}
        </div>
      )}
    </>
  );
}
