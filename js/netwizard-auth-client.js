/* =========================================================
   NetWizard Auth Client v1
   UI mínima para sesión OIDC server-side.
========================================================= */
(function initNetWizardAuthClient(root){
  'use strict';

  function emitAuthChanged(state){
    try{
      if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function'){
        const detail={authenticated:!!(state&&state.authenticated),capabilities:(state&&state.capabilities)||{}};
        root.dispatchEvent(new root.CustomEvent('nw:auth:changed',{detail}));
      }
    }catch(_e){}
  }

  function createClient(options){
    const opts=options||{};
    const fetchFn=opts.fetchFn || (root.fetch ? root.fetch.bind(root) : null);
    const locationObj=opts.location || root.location;
    let capabilities=null;
    let me=null;

    async function requestJSON(url, init){
      if(!fetchFn) throw new Error('fetch unavailable');
      const response=await fetchFn(url, Object.assign({credentials:'same-origin'},init||{}));
      let body=null;
      try{ body=await response.json(); }catch{}
      return {response,body};
    }

    async function refresh(){
      const caps=await requestJSON('/api/capabilities');
      if(!caps.response.ok) throw new Error('capabilities unavailable');
      capabilities=caps.body||{};
      me=null;
      if(capabilities.authEnforced){
        const current=await requestJSON('/api/auth/me');
        if(current.response.ok) me=current.body||null;
        else if(current.response.status!==401) throw new Error('session status unavailable');
      }
      const current=state();
      emitAuthChanged(current);
      return current;
    }

    function state(){
      return {
        capabilities:capabilities||{},
        authenticated:!!me,
        user:me
      };
    }

    function login(returnTo){
      if(!locationObj || typeof locationObj.assign!=='function') return;
      let target=returnTo;
      if(!target){
        const path=String(locationObj.pathname||'/');
        const query=String(locationObj.search||'');
        target=path+query;
      }
      locationObj.assign('/api/auth/login?returnTo='+encodeURIComponent(target));
    }

    async function logout(){
      if(!me || !me.csrfToken) return false;
      const result=await requestJSON('/api/auth/logout',{
        method:'POST',
        headers:{'X-NetWizard-CSRF':me.csrfToken}
      });
      if(!result.response.ok) throw new Error('logout failed');
      me=null;
      emitAuthChanged(state());
      return true;
    }

    return {refresh,state,login,logout};
  }

  function setVisible(element, visible){
    if(element) element.style.display=visible?'':'none';
  }

  async function mount(){
    if(!root.document || !root.fetch) return null;
    const status=root.document.getElementById('authStatus');
    const loginButton=root.document.getElementById('btnAuthLogin');
    const logoutButton=root.document.getElementById('btnAuthLogout');
    if(!status || !loginButton || !logoutButton) return null;

    const client=createClient({});
    root.NetWizardAuth=client;
    loginButton.addEventListener('click',()=>client.login());
    logoutButton.addEventListener('click',async()=>{
      try{
        await client.logout();
        await render();
      }catch{
        if(status) status.textContent='Error al cerrar sesión';
      }
    });

    async function render(){
      try{
        const current=await client.refresh();
        const caps=current.capabilities||{};
        if(!caps.authEnforced){
          status.textContent='Modo local';
          setVisible(loginButton,false);
          setVisible(logoutButton,false);
          return;
        }
        if(current.authenticated){
          const user=current.user||{};
          status.textContent=user.displayName||user.email||'Sesión activa';
          setVisible(loginButton,false);
          setVisible(logoutButton,true);
        }else{
          status.textContent='Sin sesión';
          setVisible(loginButton,true);
          setVisible(logoutButton,false);
        }
      }catch{
        status.textContent='Sesión no disponible';
        setVisible(loginButton,false);
        setVisible(logoutButton,false);
      }
    }

    await render();
    return client;
  }

  const api={version:'netwizard-auth-client-v1',createClient,mount};
  root.NetWizardAuthClient=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  if(root.document){
    if(root.document.readyState==='loading') root.document.addEventListener('DOMContentLoaded',()=>mount());
    else mount();
  }
})(typeof window!=='undefined'?window:globalThis);
