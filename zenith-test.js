/* 年年 · Zenith 连接测试 v1.0.1 — 原生 Roche 插件，Buttplug JSON v3 */
(() => {
  'use strict';
  const mounted = new WeakMap();
  function mount(container, roche) {
    if (mounted.has(container)) mounted.get(container)();
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
      <div class="wrap"><div class="nav"><button class="back" type="button">← 返回 Roche</button></div><h2>Zenith 连接测试</h2><p class="sub">年年 · 第一步 / 手动测试版 1.0.1</p>
      <div class="card"><div class="status" role="status" aria-live="polite">尚未连接</div>
      <label>Intiface 地址<input class="address" type="url" value="ws://127.0.0.1:12345" spellcheck="false" autocapitalize="off"></label>
      <small>同一台设备先用默认地址；不同设备请填写 Intiface 当时显示的地址，并连接同一 Wi-Fi。</small>
      <button class="connect">连接 Intiface</button>
      <label>测试设备<select class="devices" disabled><option value="">连接后选择 Zenith</option></select></label>
      <button class="test" disabled>10% 测试 · 2 秒</button>
      <button class="stop">停止</button><small>停止按钮会停止当前 Intiface 下的所有设备。若连接已断开，请用设备按键或 Intiface 停止。</small></div>
      <div class="card">请把设备放在桌上测试，保持页面在前台。2 秒自动停止依赖连接和页面正常运行，不能替代设备实体开关。
      <small>仅测试连接与手动控制，不读取聊天、记忆或密钥。连接本身不会启动振动。</small></div>
      <details class="card"><summary>连接诊断 / 截图给 G 哥</summary><pre class="log"></pre></details>
      </div>`;
    container.append(root);
    const $ = s => root.querySelector(s);
    const address = $('.address'), connect = $('.connect'), test = $('.test');
    const select = $('.devices'), status = $('.status'), logBox = $('.log');
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
    function update() {
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
      if (!ready || ws?.readyState !== 1) {say('无法发送停止：未连接。请用设备按键或 Intiface 停止。'); return;}
      running = true; update();
      say(reason + '：正在等待 Intiface 确认');
      try {
        await request('StopAllDevices');
        if (token !== runToken) return;
        running = false; update(); say('Intiface 已确认停止指令，请确认设备实际停止。');
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
            if (removed) {++runToken; cancel(autoStop); running = false; rawStop(); update(); say('所选设备已断开；停止状态无法确认，请检查实体设备。');}
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
    async function vibrate() {
      const d = target();
      if (!ready || busy || running || select.value === '' || !isZenith(d) || document.hidden) return;
      const index = features(d).findIndex(f => f.ActuatorType === 'Vibrate');
      const token = ++runToken; running = true; update();
      say('正在发送 10% 测试；2 秒后发送停止。');
      // Start the deadline BEFORE awaiting the acknowledgement: a missing ACK must not extend actuation.
      autoStop = later(() => {if (token === runToken) void stop('2 秒测试结束');},2000);
      try {
        await request('ScalarCmd',{DeviceIndex:d.DeviceIndex,Scalars:[{Index:index,Scalar:0.1,ActuatorType:'Vibrate'}]});
        if (token === runToken) say('Intiface 已接受 10% 指令，等待自动停止…');
      } catch(e) {
        if (token === runToken) {log('测试指令失败：' + e.message); void stop('测试异常，尝试停止');}
      }
    }
    function visibility() {if (document.hidden) {closeSession('页面进入后台'); say('页面已进入后台，已尝试停止并断开。返回后需手动重连。');} else update();}
    function hide() {closeSession('页面关闭');}
    $('.back').onclick = async () => {
      const back = $('.back'); back.disabled = true;
      try {
        if (ready && ws?.readyState === 1) await stop('返回前停止');
        closeSession('返回 Roche');
        if (typeof roche?.ui?.closeApp !== 'function') throw new Error('宿主未提供 closeApp 接口');
        await roche.ui.closeApp();
      } catch (e) {say('返回失败：' + e.message + '。请重新打开 Roche 页面。');}
      finally {back.disabled = false;}
    };
    function policyViolation(e) {
      if (e.effectiveDirective === 'connect-src') log('检测到页面 CSP connect-src 拦截：' + e.blockedURI);
    }
    document.addEventListener('securitypolicyviolation',policyViolation);
    connect.onclick = () => void startConnection();
    test.onclick = () => void vibrate();
    $('.stop').onclick = () => void stop();
    select.onchange = update;
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('pagehide',hide);
    log('页面协议：' + location.protocol + '；安全上下文：' + Boolean(window.isSecureContext));
    log('默认地址只适用于 Roche 和 Intiface 在同一台设备。');
    function dispose() {
      destroyed = true; closeSession('插件已关闭');
      document.removeEventListener('securitypolicyviolation',policyViolation); document.removeEventListener('visibilitychange',visibility); window.removeEventListener('pagehide',hide);
      root.remove(); mounted.delete(container);
    }
    mounted.set(container,dispose);
  }
  if (!window.RochePlugin?.register) throw new Error('请通过 Roche 插件管理安装此 JS 文件。');
  window.RochePlugin.register({
    id:'niannian-zenith-test',name:'年年 · Zenith 连接测试',version:'1.0.1',
    description:'手动连接 Intiface，Zenith 10% 两秒测试与停止。',author:'年年',permissions:['ui'],
    apps:[{id:'niannian-zenith-test-home',name:'Zenith 测试',icon:'settings',
      mount,unmount(container){mounted.get(container)?.();container.replaceChildren();}}]
  });
})();
