/* 年年 · Zenith 连接测试 v1.1.0 — 原生 Roche 插件，Buttplug JSON v3 */
(() => {
  'use strict';
  let active = null;
  const observed = new Map();
  const noSession = () => ({ok:false,error:'请先打开 Zenith 控制，连接设备并开启指定聊天授权。'});
  function mount(container, roche) {
    if (active) {active.attach(container, roche); return;}
    const root = document.createElement('section');
    root.className = 'roche-plugin-niannian-zenith';
    root.innerHTML = `
      <style>
      .roche-plugin-niannian-zenith{box-sizing:border-box;height:100%;overflow:auto;background:#f6f4f8;color:#282233;padding:24px 18px;font:15px/1.6 system-ui,sans-serif}
      .roche-plugin-niannian-zenith *{box-sizing:border-box}
      .roche-plugin-niannian-zenith .wrap{max-width:560px;margin:auto}
      .roche-plugin-niannian-zenith h2{margin:0;font-size:24px}
      .roche-plugin-niannian-zenith .sub{color:#71667e;margin:4px 0 20px}
      .roche-plugin-niannian-zenith .card{background:#fff;border:1px solid #e6deec;border-radius:18px;padding:18px;margin:14px 0}
      .roche-plugin-niannian-zenith label{display:block;margin:12px 0 6px}
      .roche-plugin-niannian-zenith input,.roche-plugin-niannian-zenith select{width:100%;padding:12px;border:1px solid #bfb2ca;border-radius:10px;background:white;color:#282233;font:inherit;min-width:0}
      .roche-plugin-niannian-zenith button{display:block;width:100%;padding:14px;margin:12px 0 0;border:0;border-radius:12px;background:#685385;color:white;font:600 16px system-ui;cursor:pointer}
      .roche-plugin-niannian-zenith button:disabled{opacity:.42;cursor:default}
      .roche-plugin-niannian-zenith .stop{background:#ac304b;min-height:56px}
      .roche-plugin-niannian-zenith .status{font-weight:650;white-space:pre-wrap;overflow-wrap:anywhere}
      .roche-plugin-niannian-zenith small{display:block;color:#71667e;margin-top:8px}
      .roche-plugin-niannian-zenith pre{font:12px/1.6 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:230px;overflow:auto}
      .roche-plugin-niannian-zenith .nav{position:sticky;top:-24px;z-index:10;background:#f6f4f8;padding:10px 0}
      .roche-plugin-niannian-zenith .back{width:auto;margin:0;min-height:44px;padding:10px 18px}
      </style>
      <div class="wrap"><div class="nav"><button class="back" type="button">← 返回 Roche</button></div><h2>Zenith 电脑控制</h2><p class="sub">年年 · 聊天控制版 1.1.0</p>
      <div class="card"><div class="status" role="status" aria-live="polite">尚未连接</div>
      <label>Intiface 地址<input class="address" type="url" value="ws://192.168.1.10:12345" spellcheck="false" autocapitalize="off"></label>
      <small>电脑打开 Roche，手机运行 Intiface；填写手机当前显示的地址，并连接同一 Wi-Fi。</small>
      <button class="connect">连接 Intiface</button>
      <label>测试设备<select class="devices" disabled><option value="">连接后选择 Zenith</option></select></label>
      <button class="test" disabled>10% 测试 · 2 秒</button>
      <button class="stop">停止</button><small>停止按钮会停止当前 Intiface 下的所有设备。若连接已断开，请用设备按键或 Intiface 停止。</small></div>
      <div class="card"><strong>聊天控制</strong>
      <label>允许控制的单聊<select class="chats"><option value="">请选择聊天</option></select></label>
      <button class="refresh">刷新聊天列表</button>
      <small>若列表为空，先去目标单聊发一条消息，再返回刷新。只向选中的聊天开放控制。</small>
      <button class="arm" disabled>开启聊天控制 · 15 分钟</button>
      <div class="armed-status" role="status">未授权聊天控制</div>
      <small>强度最高 20%，每次最多 10 秒；一次只执行一条指令。返回 Roche 后连接保留；切换浏览器标签或最小化会停止并断开。</small></div>
      <div class="card">请把设备放在桌上测试，保持页面在前台。2 秒自动停止依赖连接和页面正常运行，不能替代设备实体开关。
      <small>使用 Roche 当前聊天模型的工具调用；不另接 AI，不读取记忆或密钥。连接和授权本身不会启动振动。</small></div>
      <details class="card"><summary>连接诊断 / 截图给 G 哥</summary><pre class="log"></pre></details>
      </div>`;
    container.append(root);
    const $ = s => root.querySelector(s);
    const address = $('.address'), connect = $('.connect'), test = $('.test');
    const select = $('.devices'), status = $('.status'), logBox = $('.log');
    let lastTurn = null;
    let armed = false, bound = '', armUntil = 0, armTimer = null, finishRun = null;
    let host = roche;
    const floating = document.createElement('button');
    floating.type = 'button';
    floating.style.cssText = 'position:fixed;right:18px;bottom:24px;z-index:2147483647;padding:14px 18px;border:2px solid white;border-radius:14px;background:#ac304b;color:white;font:700 15px system-ui;cursor:pointer;box-shadow:0 3px 15px #0004;display:none';
    document.body.append(floating);
    let ws = null, ready = false, busy = false, running = false, destroyed = false;
    let sequence = 0, runToken = 0, watchdog = 0, pingBusy = false;
    let autoStop = null, pingTimer = null, scanTimer = null, openTimer = null;
    let devices = new Map(), pending = new Map();
    const timers = new Set();
    function later(fn, ms) { const t = setTimeout(() => {timers.delete(t); fn();}, ms); timers.add(t); return t; }
    function cancel(t) {clearTimeout(t); timers.delete(t);}
    function log(s) {logBox.textContent = (logBox.textContent + new Date().toLocaleTimeString() + ' ' + s + '\n').split('\n').slice(-65).join('\n');}
    function say(s) {if (!destroyed) status.textContent = s; log(s);}
    function target() {return devices.get(Number(select.value));}
    function features(d) {return Array.isArray(d?.DeviceMessages?.ScalarCmd) ? d.DeviceMessages.ScalarCmd : [];}
    function isZenith(d) {return /zenith|funwand/i.test(d?.DeviceName || '') && features(d).some(f => f.ActuatorType === 'Vibrate');}
    function settle(result) { const resolve = finishRun; finishRun = null; if (resolve) resolve(result); }
    function revoke() {armed = false; bound = ''; armUntil = 0; cancel(armTimer); armTimer = null;}
    function update() {
      $('.arm').disabled = !ready || busy || running || select.value === '' || !isZenith(target()) || !$('.chats').value || document.hidden;
      $('.arm').textContent = armed ? '关闭聊天控制并停止' : '开启聊天控制 · 15 分钟';
      $('.chats').disabled = armed || running;
      $('.armed-status').textContent = armed ? '已授权所选聊天 · 到期自动关闭' : '未授权聊天控制';
      floating.style.display = armed || running ? 'block' : 'none';
      floating.textContent = '■ Zenith 停止 / 关闭聊天控制';
      connect.disabled = busy || running;
      connect.textContent = ready ? '重新连接 / 刷新设备' : '连接 Intiface';
      address.disabled = busy || running;
      select.disabled = !ready || running || busy;
      test.disabled = !ready || busy || running || select.value === '' || !isZenith(target()) || document.hidden;
    }
    function renderDevices() {
      const old = select.value;
      select.replaceChildren();
      const blank = document.createElement('option'); blank.value = ''; blank.textContent = '请选择 MagicMotion Zenith'; select.append(blank);
      for (const d of devices.values()) {
        const opt = document.createElement('option'); opt.value = String(d.DeviceIndex);
        opt.textContent = `${d.DeviceName} (#${d.DeviceIndex})${isZenith(d) ? '' : ' · 本版不控制'}`;
        opt.disabled = !isZenith(d); select.append(opt);
      }
      if (old !== '' && devices.has(Number(old))) select.value = old;
      update();
    }
    function rejectPending(message) {
      for (const p of pending.values()) {cancel(p.timer); p.reject(new Error(message));}
      pending.clear();
    }
    function request(type, fields = {}, expected = 'Ok', timeout = 3500) {
      return new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== 1) {reject(new Error('连接未打开')); return;}
        const id = ++sequence;
        const timer = later(() => {pending.delete(id); reject(new Error(type + ' 等待回应超时'));}, timeout);
        pending.set(id, {resolve,reject,timer,expected});
        try {ws.send(JSON.stringify([{[type]:{Id:id,...fields}}]));}
        catch (e) {cancel(timer); pending.delete(id); reject(e);}
      });
    }
    function rawStop() {
      if (ready && ws?.readyState === 1) {
        try {ws.send(JSON.stringify([{StopAllDevices:{Id:++sequence}}]));} catch (_) {}
      }
    }
    function closeSession(reason) {
      revoke(); settle({ok:false,error:reason || '连接已关闭',stopConfirmed:false});
      ++runToken; rawStop(); ready = false; running = false; busy = false;
      for (const t of timers) clearTimeout(t); timers.clear();
      clearInterval(pingTimer); pingTimer = null; pingBusy = false;
      rejectPending(reason || '连接已关闭');
      const old = ws; ws = null;
      if (old) {old.onopen = old.onmessage = old.onerror = old.onclose = null; try {old.close();} catch (_) {}}
      devices.clear(); renderDevices();
    }
    function fail(message) {closeSession(message); say(message + '\n若设备仍在运行，请用实体开关或 Intiface 停止。');}
    async function stop(reason = '手动停止') {
      const token = ++runToken; cancel(autoStop); autoStop = null;
      if (!ready || ws?.readyState !== 1) {const result = {ok:false,stopConfirmed:false,error:'未连接，无法确认停止'}; settle(result); say('无法发送停止：未连接。请用设备按键或 Intiface 停止。'); return result;}
      running = true; update();
      say(reason + '：正在等待 Intiface 确认');
      try {
        await request('StopAllDevices');
        if (token !== runToken) return;
        running = false; update(); say('Intiface 已确认停止指令，请确认设备实际停止。');
        const result = {ok:true,stopConfirmed:true,message:'Intiface 已确认停止；实体设备状态需用户确认。'}; settle(result); return result;
      } catch (e) {if (token === runToken) fail('停止未确认：' + e.message);}
    }
    function receive(event) {
      try {
        const batch = JSON.parse(event.data);
        if (!Array.isArray(batch)) throw new Error('响应不是消息数组');
        for (const item of batch) {
          const [kind, body] = Object.entries(item)[0] || [];
          if (!body) throw new Error('响应格式不正确');
          const p = pending.get(body.Id);
          if (p) {
            cancel(p.timer); pending.delete(body.Id);
            if (kind === 'Error') p.reject(new Error(`Intiface ${body.ErrorCode}: ${body.ErrorMessage}`));
            else if (kind !== p.expected) p.reject(new Error('意外回应：' + kind));
            else p.resolve(body);
          } else if (kind === 'Error') {fail(`Intiface ${body.ErrorCode}: ${body.ErrorMessage}`); return;}
          if (kind === 'DeviceAdded') {
            devices.set(body.DeviceIndex, body); renderDevices();
            log('发现设备：' + body.DeviceName);
            if (!running) say('已连接，请在列表中选择 Zenith。');
          }
          if (kind === 'DeviceRemoved') {
            const removed = select.value !== '' && Number(select.value) === body.DeviceIndex;
            devices.delete(body.DeviceIndex); renderDevices();
            if (removed) {revoke(); settle({ok:false,error:'设备已断开',stopConfirmed:false}); ++runToken; cancel(autoStop); running = false; rawStop(); update(); say('所选设备已断开；停止状态无法确认，请检查实体设备。');}
          }
        }
      } catch (e) {fail('响应解析失败：' + e.message);}
    }
    async function startConnection() {
      if (busy || running) return;
      closeSession('重新连接');
      let url;
      try {
        url = new URL(address.value.trim());
        if (!['ws:','wss:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('请输入 ws:// 或 wss:// 地址，不要填网页链接或账号密码');
      } catch (e) {say('地址格式错误：' + e.message); return;}
      log('本次连接地址：' + url.href);
      busy = true; update(); say('1/3 正在打开 WebSocket…');
      if (location.protocol === 'https:' && url.protocol === 'ws:') log('当前是 HTTPS 页面，浏览器可能限制 ws 连接；实际结果以本次测试为准。');
      try {ws = new WebSocket(url.href);} catch (e) {fail('浏览器拒绝建立连接：' + e.name + ' ' + e.message); return;}
      const socket = ws;
      openTimer = later(() => {if (ws === socket) fail('WebSocket 连接超时：检查地址、Engine、同一网络与系统局域网权限。');}, 8000);
      socket.onmessage = receive;
      socket.onerror = () => {if (ws === socket) fail('WebSocket 连接失败：浏览器未提供具体原因。检查 Engine、地址、网络权限；也可能是 HTTPS/ws 或后台运行限制。');};
      socket.onclose = e => {if (ws === socket) fail('WebSocket 已断开，代码 ' + e.code);};
      socket.onopen = async () => {
        cancel(openTimer); say('2/3 已连接，正在协商协议…');
        try {
          const info = await request('RequestServerInfo', {ClientName:'Niannian Zenith Test',MessageVersion:3}, 'ServerInfo');
          if (ws !== socket) return;
          if (info.MessageVersion !== 3) throw new Error('服务器未接受 Buttplug v3，本版停止测试');
          ready = true; watchdog = info.MaxPingTime;
          log(`协议 v3；服务器心跳超时 ${watchdog} ms`);
          if (watchdog > 0) pingTimer = setInterval(async () => {
            if (pingBusy || !ready) return;
            pingBusy = true;
            try {await request('Ping',{},'Ok',Math.min(3500,watchdog));}
            catch(e) {if (ws === socket) fail('心跳失败：' + e.message);}
            finally {pingBusy = false;}
          }, Math.max(1,Math.floor(watchdog / 3)));
          else log('服务器没有启用心跳超时保护；页面冻结或断网时不能保证按时停止。');
          say('3/3 正在读取已连接设备…');
          const list = await request('RequestDeviceList',{},'DeviceList');
          if (ws !== socket) return;
          for (const d of list.Devices) devices.set(d.DeviceIndex,d);
          busy = false; renderDevices();
          if ([...devices.values()].some(isZenith)) say('已连接，请在列表中选择 Zenith，再点 10% 测试。');
          else {
            say('尚未发现 Zenith，扫描 10 秒…');
            await request('StartScanning');
            if (ws !== socket) return;
            scanTimer = later(async () => {
              try {await request('StopScanning'); if (![...devices.values()].some(isZenith)) say('扫描结束，未发现支持的 Zenith。请检查开机、蓝牙连接及官方 App 是否占用。');}
              catch(e) {log('结束扫描：' + e.message);}
            },10000);
          }
        } catch(e) {if (ws === socket) fail('握手或设备读取失败：' + e.message);}
      };
    }
    async function vibrate(intensity = 10, seconds = 2) {
      const d = target();
      if (!Number.isFinite(intensity) || !Number.isFinite(seconds) || intensity < 1 || intensity > 20 || seconds < 0.5 || seconds > 10)
        return {ok:false,error:'强度必须为 1–20 的数字，秒数必须为 0.5–10 的数字。'};
      if (!ready || busy || running || select.value === '' || !isZenith(d) || document.hidden)
        return {ok:false,error:'未就绪、正在执行或页面不在前台；指令未发送。'};
      const index = features(d).findIndex(f => f.ActuatorType === 'Vibrate');
      const token = ++runToken; running = true; update();
      let accepted = false, commandError = null;
      const completion = new Promise(resolve => {finishRun = resolve;});
      say(`正在发送 ${intensity}% 指令；${seconds} 秒后发送停止。`);
      autoStop = later(() => {if (token === runToken) void stop('限时结束');}, seconds * 1000);
      request('ScalarCmd',{DeviceIndex:d.DeviceIndex,Scalars:[{Index:index,Scalar:intensity / 100,ActuatorType:'Vibrate'}]})
        .then(() => {accepted = true; if (token === runToken) say('Intiface 已接受指令，等待限时停止…');})
        .catch(e => {commandError = e.message; if (token === runToken) void stop('控制异常，尝试停止');});
      const result = await completion;
      return {...result, ok:result.ok && accepted && !commandError, commandAccepted:accepted,
        intensity, seconds, ...(commandError ? {error:commandError} : {})};
    }
    function snapshot() {return {connected:ready,armed:armed && Date.now() < armUntil,
      conversationId:bound,device:target()?.DeviceName || null,running,maxIntensity:20,maxSeconds:10};}
    async function refreshChats() {
      const old = $('.chats').value;
      try {
        if (typeof host?.character?.list === 'function') {
          const chars = await host.character.list();
          if (Array.isArray(chars)) for (const c of chars) if (c.conversationId)
            observed.set(String(c.conversationId),String(c.handle || c.name || c.conversationId));
        }
      } catch(e) {log('聊天列表：' + e.message + '；可先向目标单聊发消息再刷新。');}
      if (destroyed || armed) return;
      const menu = $('.chats'); menu.replaceChildren();
      const blank = document.createElement('option'); blank.value = ''; blank.textContent = '请选择聊天'; menu.append(blank);
      for (const [id,name] of observed) {const opt = document.createElement('option'); opt.value = id; opt.textContent = name; menu.append(opt);}
      if (observed.has(old)) menu.value = old;
      update();
    }
    async function disarm() {revoke(); update(); return await stop('关闭聊天控制');}
    $('.arm').onclick = () => {
      if (armed) return disarm();
      if (!ready || busy || running || document.hidden || !isZenith(target()) || select.value === '' || !$('.chats').value) return;
      lastTurn = null; bound = $('.chats').value; armed = true; armUntil = Date.now() + 15 * 60 * 1000;
      armTimer = later(() => {void disarm();},15 * 60 * 1000);
      update(); say('聊天控制已开启。返回 Roche，在选中的单聊发送控制请求。');
    };
    $('.refresh').onclick = () => void refreshChats();
    $('.chats').onchange = () => {revoke(); update();};
    floating.onclick = () => void disarm();
    function allowed(ctx) {return armed && Date.now() < armUntil && !document.hidden &&
      ctx?.conversationType === 'direct' && String(ctx.conversationId || '') === bound;}
    function visibility() {if (document.hidden) {closeSession('页面进入后台'); say('页面已进入后台，已尝试停止并断开。返回后需手动重连。');} else update();}
    function hide() {closeSession('页面关闭');}
    $('.back').onclick = async () => {
      const back = $('.back'); back.disabled = true;
      try {
        if (ready && ws?.readyState === 1) await stop('返回前停止');
        if (!armed) closeSession('返回 Roche');
        if (typeof host?.ui?.closeApp !== 'function') throw new Error('宿主未提供 closeApp 接口');
        await host.ui.closeApp();
      } catch (e) {say('返回失败：' + e.message + '。请重新打开 Roche 页面。');}
      finally {back.disabled = false;}
    };
    function policyViolation(e) {
      if (e.effectiveDirective === 'connect-src') log('检测到页面 CSP connect-src 拦截：' + e.blockedURI);
    }
    document.addEventListener('securitypolicyviolation',policyViolation);
    connect.onclick = () => void startConnection();
    test.onclick = () => void vibrate();
    $('.stop').onclick = () => void disarm();
    select.onchange = () => {revoke(); update();};
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('pagehide',hide);
    log('页面协议：' + location.protocol + '；安全上下文：' + Boolean(window.isSecureContext));
    log('电脑版：填写手机 Intiface 当前地址。授权后返回 Roche 保持连接。');
    function dispose() {
      destroyed = true; closeSession('插件已关闭');
      document.removeEventListener('securitypolicyviolation',policyViolation); document.removeEventListener('visibilitychange',visibility); window.removeEventListener('pagehide',hide);
      root.remove(); floating.remove(); active = null;
    }
    active = {
      attach(next, nextHost) {host = nextHost; next.append(root); void refreshChats(); update();},
      detach() {if (!armed) closeSession('面板已关闭'); else if (running) void stop('离开控制面板'); root.remove();},
      dispose, snapshot,
      context(ctx) {return allowed(ctx) ? 'Zenith 已连接并授权本聊天。可调用 zenith_vibrate（intensity 百分比 1–20，seconds 秒数 0.5–10）或 zenith_stop。仅在用户明确要求设备动作时调用；每轮最多一次振动，禁止循环续时。' : null;},
      async execute(args,ctx) {
        if (!allowed(ctx)) return {ok:false,error:'本聊天未授权或授权已过期。'};
        if (typeof args?.intensity !== 'number' || typeof args?.seconds !== 'number') return {ok:false,error:'请提供数字 intensity 和 seconds。'};
        const turn = JSON.stringify(ctx.latestUserMessage ?? null);
        if (turn === 'null' || turn === lastTurn) return {ok:false,error:'缺少本轮用户消息，或本轮已执行过；请等待下一条用户指令。'};
        if (!ready || busy || running || args.intensity < 1 || args.intensity > 20 || args.seconds < 0.5 || args.seconds > 10 || !Number.isFinite(args.intensity) || !Number.isFinite(args.seconds)) return {ok:false,error:'设备忙或参数越界；未发送。'};
        lastTurn = turn;
        return await vibrate(args.intensity,args.seconds);
      },
      async stopFromChat() {return await disarm();}
    };
    void refreshChats(); update();
  }
  if (!window.RochePlugin?.register) throw new Error('请通过 Roche 插件管理安装此 JS 文件。');
  window.RochePlugin.register({
    id:'niannian-zenith-test',name:'年年 · Zenith 电脑控制',version:'1.1.0',
    description:'电脑 Roche 聊天控制 Zenith；指定单聊授权、限时执行、浮动停止按钮。',author:'年年',permissions:['ui','character:read'],
    onUnload() {active?.dispose();},
    chat:{
      scope:{conversationTypes:['direct']},
      contextProvider(ctx) {
        if (ctx?.conversationType === 'direct' && ctx.conversationId)
          observed.set(String(ctx.conversationId),String(ctx.contact?.handle || ctx.contact?.name || ctx.conversation?.name || ctx.conversationId));
        return active?.context(ctx) || null;
      },
      tools:[
        {id:'zenith_status',description:'查询 Zenith 连接及当前聊天授权；不启动设备。',parameters:{},
          execute(args,ctx) {const state=active?.snapshot(); return state ? {...state,armed:state.armed && state.conversationId === String(ctx?.conversationId || ''),conversationId:undefined} : noSession();}},
        {id:'zenith_vibrate',description:'用户明确要求控制 Zenith 时执行一次限时振动。必须先手动授权本聊天；每轮最多调用一次，不循环。intensity 是 1–20 的百分比数字，seconds 是 0.5–10 秒；等待停止后返回结果，不得虚构成功。',parameters:{intensity:'number',seconds:'number'},
          execute(args,ctx) {return active ? active.execute(args,ctx) : noSession();}},
        {id:'zenith_stop',description:'停止 Zenith 并关闭聊天控制。用户要求停止时优先调用，不需要授权。',parameters:{},
          execute() {return active ? active.stopFromChat() : noSession();}}
      ]
    },
    apps:[{id:'niannian-zenith-test-home',name:'Zenith 控制',icon:'settings',
      mount,unmount(container){active?.detach();container.replaceChildren();}}]
  });
})();
