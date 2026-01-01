import { createApp } from 'vue';
import 'leaflet/dist/leaflet.css';
import './styles/main.css';
import App from './views/App.vue';

const _origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
	try {
		_origConsoleError(...args);
		const msg = args
			.map((a) => {
				try {
					if (a && typeof a === 'object' && 'message' in (a as any)) return (a as any).message;
					return String(a);
				} catch {
					return String(a);
				}
			})
			.join(' ');
		window.dispatchEvent(new CustomEvent('app:console-error', { detail: { message: msg } }));
	} catch (e) {
		_origConsoleError('Error forwarding console.error:', e);
	}
};

createApp(App).mount('#app');
