import { render } from 'solid-js/web';
import App from './App';
import { applyTheme, type Theme } from './ui/Chrome';
import './styles/app.css';

try { applyTheme((localStorage.getItem('links-theme') || '') as Theme); } catch { /* no storage: follow the system */ }
render(() => <App />, document.getElementById('root')!);
