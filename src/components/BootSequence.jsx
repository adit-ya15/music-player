import { useEffect, useState } from 'react';

export default function BootSequence({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const minimum = setTimeout(() => setReady(true), 1100);
    const finishOnLoad = () => setReady(true);
    window.addEventListener('load', finishOnLoad);

    return () => {
      clearTimeout(minimum);
      window.removeEventListener('load', finishOnLoad);
    };
  }, []);

  return (
    <>
      {!ready && (
        <div className="boot-splash" role="status" aria-live="polite">
          <img src="/null-logo.svg" className="boot-splash-logo" alt="Null" />
          <p className="boot-splash-label">Null</p>
        </div>
      )}
      <div className={`boot-splash-app ${ready ? 'boot-splash-app--ready' : ''}`}>
        {children}
      </div>
    </>
  );
}
