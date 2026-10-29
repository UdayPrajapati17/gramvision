// Root: show the workspace when signed in, the sign-in screen when not.
import React, { useState } from 'react';
import Auth from './Auth.jsx';
import Workspace from './Workspace.jsx';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('gv_token'));

  function signIn(payload) {
    localStorage.setItem('gv_token', payload.access_token);
    setToken(payload.access_token);
  }

  function signOut() {
    localStorage.removeItem('gv_token');
    setToken(null);
  }

  return token ? <Workspace key={token} onSignOut={signOut} /> : <Auth onLogin={signIn} />;
}
