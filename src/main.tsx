import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initialLocale, LanguageProvider } from './i18n';
import './styles.css';
import './lab.css';
import './brainLoader.css';
import './minimal.css';

void initialLocale().then(locale => {
  document.documentElement.lang = locale;
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><LanguageProvider initial={locale}><App /></LanguageProvider></React.StrictMode>);
});
