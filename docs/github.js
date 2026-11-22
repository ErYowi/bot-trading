// Acceso a GitHub: leer el estado del motor y guardar la configuración de los bots.
(function () {
  const API = 'https://api.github.com';

  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(b64.replace(/\n/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }

  function create({ owner, repo, token }) {
    const headers = (extra = {}) => ({
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    });

    async function getState() {
      if (token) {
        const r = await fetch(`${API}/repos/${owner}/${repo}/contents/state.json?ref=data&t=${Date.now()}`, {
          headers: headers({ Accept: 'application/vnd.github.raw+json' }),
          cache: 'no-store',
        });
        if (r.ok) return r.json();
        if (r.status === 404) return null;
      }
      const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/data/state.json?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`No se pudo leer el estado (HTTP ${r.status})`);
      return r.json();
    }

    async function getFile(path) {
      const r = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}?ref=main&t=${Date.now()}`, { headers: headers(), cache: 'no-store' });
      if (r.status === 404) return { data: null, sha: null };
      if (!r.ok) throw new Error(errorText(r.status));
      const j = await r.json();
      return { data: JSON.parse(b64decode(j.content)), sha: j.sha };
    }

    async function putFile(path, data, sha, message) {
      const r = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}`, {
        method: 'PUT',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message, content: b64encode(JSON.stringify(data, null, 2) + '\n'), sha: sha || undefined, branch: 'main' }),
      });
      if (!r.ok) throw new Error(errorText(r.status));
      return r.json();
    }

    // Lee, modifica y guarda (con un reintento si alguien lo cambió a la vez).
    async function update(path, mutate, message) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data, sha } = await getFile(path);
        const next = mutate(data);
        try {
          return await putFile(path, next, sha, message);
        } catch (e) {
          if (attempt === 1 || !String(e.message).includes('409')) throw e;
        }
      }
    }

    async function check() {
      const r = await fetch(`${API}/repos/${owner}/${repo}`, { headers: headers(), cache: 'no-store' });
      if (!r.ok) throw new Error(errorText(r.status));
      const j = await r.json();
      if (token && !j.permissions?.push) throw new Error('El token no tiene permiso de escritura en este repositorio.');
      return j;
    }

    return { getState, getFile, putFile, update, check };
  }

  function errorText(status) {
    if (status === 401) return 'Token no válido o caducado (401).';
    if (status === 403) return 'GitHub ha rechazado el acceso (403). Revisa los permisos del token.';
    if (status === 404) return 'No encuentro el repositorio (404). Revisa usuario/nombre.';
    if (status === 409) return 'Conflicto al guardar (409). Vuelve a intentarlo.';
    if (status === 422) return 'GitHub no aceptó el cambio (422).';
    return `Error de GitHub (HTTP ${status}).`;
  }

  window.GH = { create };
})();
