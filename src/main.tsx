import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { installHeightFog } from './scene/effects/heightFog';

// Patch three's fog shader chunks before any material is compiled so the city's
// distance fog also pools over the ground (see scene/effects/heightFog.ts).
installHeightFog();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}
const root = createRoot(rootElement);
root.render(<App />);
