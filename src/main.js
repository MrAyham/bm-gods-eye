import { installBmFetchNamespace } from './bmFetchNamespace.js';
import { mountBmOntarioAlertBanner } from './bmOntarioAlertsBanner.js';
import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';

installBmFetchNamespace();

function loaderStatusNode() {
  return document.querySelector('#loading-screen .loader-status');
}

function setLoaderStatus(message, color = '') {
  const node = loaderStatusNode();
  if (!node) return;
  node.textContent = message;
  if (color) node.style.color = color;
}

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

application.subscribe((state) => {
  if (state.status === 'starting' && state.phase) {
    setLoaderStatus(`Starting ${state.phase}...`);
    return;
  }
  if (state.status === 'ready') {
    setLoaderStatus('God\'s Eye ready');
    return;
  }
  if (state.status === 'failed') {
    setLoaderStatus('Application startup failed', '#ff4444');
  }
});

application
  .start()
  .then(() => {
    mountBmOntarioAlertBanner();
  })
  .catch((error) => {
    console.error("God's Eye View initialization failed:", error);
    setLoaderStatus(`Error: ${describeError(error)}`, '#ff4444');
  });

export { application };
