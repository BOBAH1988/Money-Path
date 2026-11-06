import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'REDACTED',
  authDomain: 'money-path-af37c.firebaseapp.com',
  projectId: 'money-path-af37c',
  storageBucket: 'money-path-af37c.firebasestorage.app',
  messagingSenderId: '1093832828420',
  appId: '1:1093832828420:web:0d02feeb8adc2dab16b751',
};

const app = initializeApp(firebaseConfig);

export default app;
