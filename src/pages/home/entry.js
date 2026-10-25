import './style.css';
import '../../ui/cloud/style.css';
import '../../i18n/style.css';
import '../../ui/select.css';
import { bootstrap } from '../../bootstrap.js';
import { mountOverview } from './app.js';
bootstrap();
mountOverview();

document.documentElement.dataset.ready = 'true';
