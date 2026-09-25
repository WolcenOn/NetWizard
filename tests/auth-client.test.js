'use strict';

const assert=require('assert');
const Auth=require('../js/netwizard-auth-client.js');

function response(status,body){
  return {ok:status>=200&&status<300,status,async json(){return body;}};
}

(async()=>{
  const calls=[];
  const location={pathname:'/project',search:'?x=1',assigned:'',assign(value){this.assigned=value;}};
  let loggedIn=true;
  const client=Auth.createClient({
    location,
    fetchFn:async(url,init)=>{
      calls.push({url,init:init||{}});
      if(url==='/api/capabilities') return response(200,{authEnforced:true,privateRouting:true});
      if(url==='/api/auth/me'){
        return loggedIn
          ? response(200,{email:'user@example.test',displayName:'User',csrfToken:'csrf-1'})
          : response(401,{});
      }
      if(url==='/api/auth/logout'){
        assert.strictEqual(init.method,'POST');
        assert.strictEqual(init.headers['X-NetWizard-CSRF'],'csrf-1');
        loggedIn=false;
        return response(204,null);
      }
      throw new Error('unexpected URL '+url);
    }
  });

  let state=await client.refresh();
  assert.strictEqual(state.authenticated,true);
  assert.strictEqual(state.user.email,'user@example.test');

  client.login();
  assert.strictEqual(location.assigned,'/api/auth/login?returnTo=%2Fproject%3Fx%3D1');

  assert.strictEqual(await client.logout(),true);
  state=client.state();
  assert.strictEqual(state.authenticated,false);

  state=await client.refresh();
  assert.strictEqual(state.authenticated,false);
  assert.ok(calls.some(call=>call.url==='/api/auth/me'));

  console.log('✓ Auth client usa sesión server-side, login same-origin y CSRF en logout');
})().catch(error=>{console.error(error);process.exitCode=1;});
