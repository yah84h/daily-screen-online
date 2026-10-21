import { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';
export default function DisplayControls() {
    const [full, setFull] = useState(false), [visible, setVisible] = useState(true), [hint, setHint] = useState('');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => { function update() { const active = !!(document.fullscreenElement || (document as any).webkitFullscreenElement); setFull(active); setVisible(true); if (timer.current)
        clearTimeout(timer.current); timer.current = setTimeout(() => setVisible(false), 3000); } function reveal() { setVisible(true); if (timer.current)
        clearTimeout(timer.current); timer.current = setTimeout(() => setVisible(false), 3000); } document.addEventListener('fullscreenchange', update); document.addEventListener('webkitfullscreenchange', update); window.addEventListener('pointermove', reveal); window.addEventListener('pointerdown', reveal); window.addEventListener('keydown', reveal); update(); return () => { if (timer.current)
        clearTimeout(timer.current); document.removeEventListener('fullscreenchange', update); document.removeEventListener('webkitfullscreenchange', update); window.removeEventListener('pointermove', reveal); window.removeEventListener('pointerdown', reveal); window.removeEventListener('keydown', reveal); }; }, []);
    async function toggle(pointer = false) { setHint(''); try {
        const d = document as any, root = document.documentElement as any;
        if (d.fullscreenElement || d.webkitFullscreenElement) {
            const exit = d.exitFullscreen || d.webkitExitFullscreen;
            if (exit)
                await exit.call(d);
        }
        else {
            const enter = root.requestFullscreen || root.webkitRequestFullscreen;
            if (!enter)
                throw Error();
            await enter.call(root);
        }
        if (pointer && document.activeElement instanceof HTMLElement)
            document.activeElement.blur();
    }
    catch {
        setHint(/Mac|iPhone|iPad/.test(navigator.platform) ? 'لملء الشاشة في Safari على Mac استخدم Control + Command + F. قد لا يدعم متصفح الهاتف ملء الشاشة.' : 'إذا لم يعمل الزر، اضغط F11 من لوحة المفاتيح لملء الشاشة.');
    } }
    return <div className={'display-controls ' + (!visible ? 'controls-idle' : '')} onPointerEnter={() => setVisible(true)} onFocusCapture={() => setVisible(true)}><button onClick={e => toggle(e.detail > 0)} aria-label={full ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}>{full ? <Minimize size={19}/> : <Maximize size={19}/>}<span>{full ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}</span></button>{hint && <p role="status">{hint}</p>}</div>;
}

